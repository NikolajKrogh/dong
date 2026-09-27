-- Host termination is distinct from ordinary grant expiry. No old rows are backfilled.
ALTER TABLE public.participants ADD COLUMN guest_revocation_reason text;
ALTER TABLE public.participants ADD CONSTRAINT participants_guest_revocation_reason_check
  CHECK (guest_revocation_reason IS NULL OR
    (guest_revocation_reason = 'room_ended' AND membership_type = 'guest'::public.participant_membership_type));
COMMENT ON COLUMN public.participants.guest_revocation_reason IS
  'Terminal reason for the current guest token, set only when an active grant is revoked by the host.';

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
  SET guest_grant_expires_at = now(), guest_revocation_reason = 'room_ended'
  WHERE session_id = p_session_id
    AND membership_type = 'guest'::public.participant_membership_type
    AND left_at IS NULL
    AND guest_grant_expires_at > now();

  UPDATE public.game_sessions
  SET state = 'completed'::public.session_state
  WHERE id = p_session_id;

  RETURN jsonb_build_object('status', 'completed', 'sessionId', p_session_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION private.leave_room_as_host(
    p_session_id uuid,
    p_successor_participant_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_host_participant public.participants %ROWTYPE;
  v_eligible_count integer;
  v_successor public.participants %ROWTYPE;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  -- Widened from `<> 'joinable'`: a host must be able to step out of a running
  -- game, not only one still in the lobby. Terminal rooms have nothing to leave.
  IF v_room.state IN ('completed'::public.session_state, 'closed'::public.session_state) THEN
    RAISE EXCEPTION 'room_not_joinable';
  END IF;

  SELECT * INTO v_host_participant FROM public.participants p
  WHERE p.session_id = p_session_id AND p.account_id = v_account
    AND p.session_role = 'owner'::public.participant_session_role
  LIMIT 1;

  SELECT count(*) INTO v_eligible_count FROM public.participants p
  WHERE p.session_id = p_session_id
    AND p.membership_type = 'registered'::public.participant_membership_type
    AND p.session_role = 'member'::public.participant_session_role
    AND p.account_id IS NOT NULL
    AND p.account_id <> v_account
    AND p.left_at IS NULL;

  -- Resolve successor (explicit choice, auto, or none).
  IF p_successor_participant_id IS NOT NULL THEN
    SELECT * INTO v_successor FROM public.participants p
    WHERE p.id = p_successor_participant_id AND p.session_id = p_session_id
      AND p.membership_type = 'registered'::public.participant_membership_type
      AND p.session_role = 'member'::public.participant_session_role
      AND p.account_id IS NOT NULL AND p.account_id <> v_account AND p.left_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'successor_not_eligible'; END IF;
  ELSIF v_eligible_count = 0 THEN
    -- Close the room (US3). state-only update; owner participant remains as actor.
    UPDATE public.participants
    SET guest_grant_expires_at = now(), guest_revocation_reason = 'room_ended'
    WHERE session_id = p_session_id
      AND membership_type = 'guest'::public.participant_membership_type
      AND left_at IS NULL AND guest_grant_expires_at > now();
    UPDATE public.game_sessions SET state = 'closed'::public.session_state WHERE id = p_session_id;
    INSERT INTO public.gameplay_events (
      session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
    ) VALUES (
      p_session_id, public.allocate_event_sequence(p_session_id), v_host_participant.id, 'room_closed',
      concat('room-closed:', gen_random_uuid()::text),
      jsonb_build_object('reason', 'host_left_no_successor'), now()
    );
    RETURN jsonb_build_object('status', 'closed', 'sessionId', p_session_id::text);
  ELSIF v_eligible_count = 1 THEN
    SELECT * INTO v_successor FROM public.participants p
    WHERE p.session_id = p_session_id
      AND p.membership_type = 'registered'::public.participant_membership_type
      AND p.session_role = 'member'::public.participant_session_role
      AND p.account_id IS NOT NULL AND p.account_id <> v_account AND p.left_at IS NULL
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'successor_required';
  END IF;

  -- Transfer: trigger demotes old owner → member and promotes successor → owner.
  UPDATE public.game_sessions SET owner_account_id = v_successor.account_id WHERE id = p_session_id;
  -- Soft-leave the departing host (now a member after the trigger demotion).
  UPDATE public.participants SET left_at = now() WHERE id = v_host_participant.id;

  -- Re-read the successor (now owner) for the response.
  SELECT * INTO v_successor FROM public.participants p WHERE p.id = v_successor.id;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id), v_successor.id, 'host_transferred',
    concat('host-transferred:', gen_random_uuid()::text),
    jsonb_build_object('newHostParticipantId', v_successor.id::text,
                       'previousHostParticipantId', v_host_participant.id::text), now()
  );
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id), v_host_participant.id, 'participant_left',
    concat('host-left:', gen_random_uuid()::text),
    jsonb_build_object('participantId', v_host_participant.id::text, 'wasHost', true), now()
  );

  RETURN jsonb_build_object(
    'status', 'transferred',
    'sessionId', p_session_id::text,
    'newHostParticipantId', v_successor.id::text,
    'newHostDisplayName', v_successor.display_name,
    'snapshot', private.build_guest_room_snapshot(p_session_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_guest_room_snapshot(guest_token text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caller text;
  v_config private.guest_abuse_config;
  v_guest public.participants;
  v_hash text;
  v_caller_limit jsonb;
  v_token_limit jsonb;
BEGIN
  v_caller := private.guest_caller_identity();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'rate_limited', 'retryAfterSeconds', 60);
  END IF;
  SELECT c.* INTO v_config FROM private.guest_abuse_config c WHERE c.singleton;
  IF btrim(coalesce(guest_token, '')) <> ''
     AND length(guest_token) <= 128 THEN
    v_hash := encode(extensions.digest(btrim(guest_token), 'sha256'), 'hex');
    BEGIN
      v_guest := private.resolve_guest_participant(guest_token);
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'guest_token_expired' THEN RAISE; END IF;
      v_guest := NULL;
    END;
  END IF;
  IF v_guest.id IS NULL THEN
    v_caller_limit := private.take_guest_quota('invalid_caller', v_caller,
      v_config.invalid_caller_limit, 60);
    v_token_limit := private.take_guest_quota('invalid_token',
      coalesce(v_hash, 'blank_or_oversized'), v_config.invalid_token_limit, 60);
  ELSE
    v_caller_limit := private.take_guest_quota('valid_caller', v_caller,
      v_config.valid_caller_limit, 60);
    v_token_limit := private.take_guest_quota('valid_grant',
      v_guest.id::text, v_config.valid_grant_limit, 60);
  END IF;
  IF v_caller_limit->>'ok' = 'false' THEN RETURN v_caller_limit; END IF;
  IF v_token_limit->>'ok' = 'false' THEN RETURN v_token_limit; END IF;
  IF v_guest.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', CASE WHEN EXISTS (
      SELECT 1 FROM public.participants p
      JOIN public.game_sessions gs ON gs.id = p.session_id
      WHERE p.guest_rejoin_token_hash = v_hash
        AND p.membership_type = 'guest'::public.participant_membership_type
        AND p.left_at IS NULL AND p.guest_revocation_reason = 'room_ended'
        AND gs.state IN ('completed'::public.session_state, 'closed'::public.session_state)
    ) THEN 'room_ended' ELSE 'guest_access_lost' END);
  END IF;
  BEGIN
    RETURN private.get_guest_room_snapshot(guest_token);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'guest_token_expired' THEN RAISE; END IF;
    RETURN jsonb_build_object('ok', false, 'code', CASE WHEN EXISTS (
      SELECT 1 FROM public.participants p
      JOIN public.game_sessions gs ON gs.id = p.session_id
      WHERE p.guest_rejoin_token_hash = v_hash
        AND p.membership_type = 'guest'::public.participant_membership_type
        AND p.left_at IS NULL AND p.guest_revocation_reason = 'room_ended'
        AND gs.state IN ('completed'::public.session_state, 'closed'::public.session_state)
    ) THEN 'room_ended' ELSE 'guest_access_lost' END);
  END;
END;
$$;

REVOKE ALL ON FUNCTION private.end_game_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.leave_room_as_host(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_guest_room_snapshot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.end_game_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.leave_room_as_host(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_guest_room_snapshot(text) TO service_role;
NOTIFY pgrst, 'reload schema';
