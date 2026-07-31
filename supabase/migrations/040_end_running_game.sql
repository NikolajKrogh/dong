-- 040_end_running_game.sql
-- Lets a host get out of a game that has already started.
--
-- Until now nothing could move a room out of `in_progress`. start_game_session
-- put it there, and the only exit RPC — leave_room_as_host (033) — guards on
-- `state <> 'joinable'` and raises room_not_joinable. The client compounded it:
-- the lobby does router.replace('/gameProgress') so the lobby leaves the history
-- stack, and the game screen's End Game is purely local (save to history, reset
-- the store, go home) and never tells the server.
--
-- The result was a room that could never be ended. find_active_room_for (032)
-- counts anything not completed/closed as active, so Home kept offering "Return
-- to room", which pushed the lobby, which immediately redirected back into the
-- game. The documented escape — "Leave current room & switch" from the join
-- conflict — called the very RPC that refuses a started room, so it failed too.
--
-- Two exits, because they mean different things to the other players:
--
--   end_game_session   the game is over for everyone; the room reaches its
--                      natural terminal state, `completed`.
--   leave_room_as_host the host personally steps out; the game carries on under
--                      a successor, or closes if there is nobody to hand it to.
--
-- Only the second already existed, so it is widened rather than duplicated.

-- ---------------------------------------------------------------------------
-- private/public.end_game_session
--
-- Deliberately NOT reusing the 'closed' state that a host-leaves-with-nobody
-- produces. `completed` is the state a finished game belongs in and is what the
-- history read models (018-022) treat as a played session; `closed` reads as
-- abandoned. Both are terminal for find_active_room_for, so either would free
-- the host — but only one of them tells the truth.
--
-- Idempotent on an already-completed room: a host double-tapping End Game, or
-- two of their devices racing, should not raise.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.end_game_session(
    p_session_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_host_participant_id uuid;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;

  -- Already finished: report success rather than raising, so a retry is safe.
  IF v_room.state IN ('completed'::public.session_state, 'closed'::public.session_state) THEN
    RETURN jsonb_build_object('status', v_room.state::text, 'sessionId', p_session_id::text);
  END IF;

  IF v_room.state <> 'in_progress'::public.session_state THEN
    -- A room that never started has nothing to end; leaving it is the right verb.
    RAISE EXCEPTION 'game_not_in_progress';
  END IF;

  SELECT p.id INTO v_host_participant_id FROM public.participants p
  WHERE p.session_id = p_session_id AND p.account_id = v_account
    AND p.session_role = 'owner'::public.participant_session_role
  LIMIT 1;

  -- Recorded in the room's auditable history as the bookend to session_started
  -- (FR-023). `session_completed` is reused rather than a new event type invented:
  -- it is already in chk_gameplay_events_event_type (031) and already means this.
  --
  -- Written BEFORE the state flip, not after: trg_prevent_events_on_completed
  -- (009) rejects any event insert once a session is `completed`, so doing it the
  -- other way round fails the whole call. The ordering is also the honest one --
  -- this is the last event of the live session, not the first of a finished one.
  -- (leave_room_as_host's close branch does not hit this because the trigger
  -- guards `completed` only, and that path sets `closed`.)
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id), v_host_participant_id,
    'session_completed', concat('session-completed:', gen_random_uuid()::text),
    jsonb_build_object('endedBy', 'host'), now()
  );

  UPDATE public.game_sessions
  SET state = 'completed'::public.session_state
  WHERE id = p_session_id;

  RETURN jsonb_build_object('status', 'completed', 'sessionId', p_session_id::text);
END;
$$;
REVOKE ALL ON FUNCTION private.end_game_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.end_game_session(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.end_game_session(session_id uuid) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.end_game_session(session_id);
$$;
REVOKE ALL ON FUNCTION public.end_game_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_game_session(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- leave_room_as_host: allow leaving a game that is under way.
--
-- Byte-identical to 033 except for the state guard, which widens from
-- "must be joinable" to "must not already be terminal". Everything downstream --
-- eligible-successor counting, the explicit/auto/none resolution, the ownership
-- transfer trigger, the soft-leave, and the close-with-no-successor branch --
-- is unchanged and works the same during a running game: a successor simply
-- inherits a room that happens to be in_progress.
--
-- Repeating the whole body is deliberate. CREATE OR REPLACE cannot patch one
-- line, and splitting the guard into a helper would leave the real logic split
-- across two migrations for a future reader.
-- ---------------------------------------------------------------------------
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
-- public wrapper signature unchanged from 033; its REVOKE/GRANT carry over.
