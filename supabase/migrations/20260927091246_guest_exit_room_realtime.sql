-- Issue #140: allow confirmed in-game guest departure and converge room clients.

CREATE OR REPLACE FUNCTION private.leave_room_as_guest(p_guest_token text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hash text;
  v_session_id uuid;
  v_room public.game_sessions;
  v_guest public.participants;
BEGIN
  IF btrim(coalesce(p_guest_token, '')) = '' OR length(p_guest_token) > 128 THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;
  v_hash := encode(extensions.digest(btrim(p_guest_token), 'sha256'), 'hex');
  SELECT p.session_id INTO v_session_id FROM public.participants p
  WHERE p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;

  SELECT gs.* INTO v_room FROM public.game_sessions gs
  WHERE gs.id = v_session_id FOR UPDATE;
  IF NOT FOUND OR v_room.state = 'closed'::public.session_state THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;
  SELECT p.* INTO v_guest FROM public.participants p
  WHERE p.session_id = v_session_id
    AND p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type
  FOR UPDATE;
  IF NOT FOUND OR v_guest.left_at IS NOT NULL
     OR v_guest.guest_grant_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;

  IF v_room.state = 'completed'::public.session_state THEN
    UPDATE public.participants SET guest_grant_expires_at = now()
    WHERE id = v_guest.id;
    RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
  END IF;

  IF v_room.state NOT IN (
    'joinable'::public.session_state,
    'in_progress'::public.session_state
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted');
  END IF;

  UPDATE public.participants SET left_at = now()
  WHERE id = v_guest.id AND left_at IS NULL;
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type,
    idempotency_key, payload, created_at
  ) VALUES (
    v_session_id, public.allocate_event_sequence(v_session_id), v_guest.id,
    'participant_left', concat('guest-left:', v_guest.id::text),
    jsonb_build_object('participantId', v_guest.id::text, 'membershipType', 'guest'),
    now()
  );
  RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
END;
$$;

REVOKE ALL ON FUNCTION private.leave_room_as_guest(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.leave_room_as_guest(text) TO service_role;

CREATE OR REPLACE FUNCTION public.can_access_room_realtime_channel()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.participants AS p
    JOIN public.game_sessions AS gs ON gs.id = p.session_id
    WHERE 'room:' || gs.id::text = realtime.topic()
      AND p.account_id = auth.uid()
      AND p.membership_type = 'registered'::public.participant_membership_type
      AND p.left_at IS NULL
      AND gs.state IN (
        'in_progress'::public.session_state,
        'completed'::public.session_state
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_room_realtime_channel()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_room_realtime_channel()
  TO authenticated;

DROP POLICY IF EXISTS registered_room_realtime_read ON realtime.messages;
CREATE POLICY registered_room_realtime_read
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    extension IN ('broadcast', 'presence')
    AND public.can_access_room_realtime_channel()
  );

DROP POLICY IF EXISTS registered_room_realtime_write ON realtime.messages;
CREATE POLICY registered_room_realtime_write
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    extension IN ('broadcast', 'presence')
    AND public.can_access_room_realtime_channel()
  );

CREATE OR REPLACE FUNCTION private.broadcast_room_changed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.send(
    '{}'::jsonb,
    'room_changed',
    'room:' || NEW.session_id::text,
    true
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Room change broadcast failed for session %', NEW.session_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.broadcast_room_changed()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.broadcast_room_changed() TO service_role;

DROP TRIGGER IF EXISTS gameplay_events_broadcast_room_changed ON public.gameplay_events;
CREATE TRIGGER gameplay_events_broadcast_room_changed
  AFTER INSERT ON public.gameplay_events
  FOR EACH ROW EXECUTE FUNCTION private.broadcast_room_changed();

CREATE OR REPLACE FUNCTION private.end_game_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_host_participant_id uuid;
  v_assignment_count integer;
  v_snapshot_count integer;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_room
  FROM public.game_sessions AS gs
  WHERE gs.id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id IS DISTINCT FROM v_account THEN RAISE EXCEPTION 'not_host'; END IF;

  IF v_room.state IN ('completed'::public.session_state, 'closed'::public.session_state) THEN
    RETURN jsonb_build_object('status', v_room.state::text, 'sessionId', p_session_id::text);
  END IF;

  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'game_not_in_progress';
  END IF;

  SELECT p.id INTO v_host_participant_id
  FROM public.participants AS p
  WHERE p.session_id = p_session_id
    AND p.account_id = v_account
    AND p.session_role = 'owner'::public.participant_session_role
  LIMIT 1;
  IF v_host_participant_id IS NULL THEN
    RAISE EXCEPTION 'host_participant_not_found';
  END IF;

  SELECT count(*)::integer INTO v_assignment_count
  FROM public.assignments AS a
  WHERE a.session_id = p_session_id;

  INSERT INTO public.assignment_snapshots (
    session_id, participant_id, match_id, captured_at, expected_assignment_count
  )
  SELECT a.session_id, a.participant_id, a.match_id, now(), v_assignment_count
  FROM public.assignments AS a
  WHERE a.session_id = p_session_id;

  GET DIAGNOSTICS v_snapshot_count = ROW_COUNT;
  IF v_snapshot_count <> v_assignment_count THEN
    RAISE EXCEPTION 'assignment_snapshot_incomplete';
  END IF;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type,
    idempotency_key, payload, created_at
  ) VALUES (
    p_session_id,
    public.allocate_event_sequence(p_session_id),
    v_host_participant_id,
    'session_completed',
    concat('session-completed:', gen_random_uuid()::text),
    jsonb_build_object('endedBy', 'host'),
    now()
  );

  UPDATE public.participants
  SET guest_grant_expires_at = now()
  WHERE session_id = p_session_id
    AND membership_type = 'guest'::public.participant_membership_type
    AND guest_grant_expires_at > now();

  UPDATE public.game_sessions
  SET state = 'completed'::public.session_state
  WHERE id = p_session_id;

  RETURN jsonb_build_object('status', 'completed', 'sessionId', p_session_id::text);
END;
$$;

REVOKE ALL ON FUNCTION private.end_game_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.end_game_session(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
