-- 033_host_leave.sql
-- US2/US3: host leaves a joinable room → ownership handover (auto / choose / close).
-- Transfer leans on the 025 sync_session_owner_participant trigger (demote old → promote new)
-- and the 030-fixed deferred assert trigger. Soft-leave (left_at) keeps the audit FK valid.

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
  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

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
REVOKE ALL ON FUNCTION private.leave_room_as_host(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.leave_room_as_host(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.leave_room_as_host(
    session_id uuid, successor_participant_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.leave_room_as_host(session_id, successor_participant_id);
$$;
REVOKE ALL ON FUNCTION public.leave_room_as_host(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_room_as_host(uuid, uuid) TO authenticated;
