-- 035_configure_start_game_rpcs.sql
-- US1-US4: configure room matches/common match/assignments, and start the game.
-- Builds on 031 (session_state 'closed', event types already include match_added /
-- common_match_selected / assignment_replaced / session_started) and the existing
-- public.matches partial unique index (session_id, source_provider, source_match_id).

-- ---------------------------------------------------------------------------
-- add_room_match / remove_room_match (US1)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.add_room_match(
    p_session_id uuid,
    p_source_provider text,
    p_source_match_id text,
    p_home_team_name text,
    p_away_team_name text,
    p_kickoff_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_match_id uuid;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

  BEGIN
    INSERT INTO public.matches (
      session_id, source_provider, source_match_id, home_team_name, away_team_name, kickoff_at
    ) VALUES (
      p_session_id, p_source_provider, p_source_match_id, p_home_team_name, p_away_team_name, p_kickoff_at
    ) RETURNING id INTO v_match_id;
  EXCEPTION WHEN unique_violation THEN
    -- Repeat add of an already-selected fixture (FR-014): no-op success, no duplicate row/event.
    SELECT id INTO v_match_id FROM public.matches
    WHERE session_id = p_session_id
      AND source_provider = p_source_provider
      AND source_match_id = p_source_match_id;
    RETURN v_match_id;
  END;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id),
    (SELECT id FROM public.participants WHERE session_id = p_session_id AND account_id = v_account
      AND session_role = 'owner'::public.participant_session_role LIMIT 1),
    'match_added', concat('match-added:', v_match_id::text),
    jsonb_build_object('matchId', v_match_id::text, 'homeTeamName', p_home_team_name, 'awayTeamName', p_away_team_name),
    now()
  );

  RETURN v_match_id;
END;
$$;
REVOKE ALL ON FUNCTION private.add_room_match(uuid, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.add_room_match(uuid, text, text, text, text, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.add_room_match(
    session_id uuid, source_provider text, source_match_id text,
    home_team_name text, away_team_name text, kickoff_at timestamptz
) RETURNS uuid
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.add_room_match(session_id, source_provider, source_match_id, home_team_name, away_team_name, kickoff_at);
$$;
REVOKE ALL ON FUNCTION public.add_room_match(uuid, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_room_match(uuid, text, text, text, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION private.remove_room_match(p_session_id uuid, p_match_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

  -- Idempotent: removing an already-removed/non-existent match is a no-op success.
  PERFORM 1 FROM public.matches WHERE id = p_match_id AND session_id = p_session_id;
  IF NOT FOUND THEN RETURN; END IF;

  DELETE FROM public.assignments WHERE session_id = p_session_id AND match_id = p_match_id;
  IF v_room.common_match_id = p_match_id THEN
    UPDATE public.game_sessions SET common_match_id = NULL WHERE id = p_session_id;
  END IF;
  DELETE FROM public.matches WHERE id = p_match_id AND session_id = p_session_id;
END;
$$;
REVOKE ALL ON FUNCTION private.remove_room_match(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.remove_room_match(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.remove_room_match(session_id uuid, match_id uuid) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.remove_room_match(session_id, match_id);
$$;
REVOKE ALL ON FUNCTION public.remove_room_match(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_room_match(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- set_common_match (US2)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_common_match(p_session_id uuid, p_match_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

  PERFORM 1 FROM public.matches WHERE id = p_match_id AND session_id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  -- Idempotent: re-designating the already-current common match is a no-op success.
  IF v_room.common_match_id = p_match_id THEN RETURN; END IF;

  UPDATE public.game_sessions SET common_match_id = p_match_id WHERE id = p_session_id;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id),
    (SELECT id FROM public.participants WHERE session_id = p_session_id AND account_id = v_account
      AND session_role = 'owner'::public.participant_session_role LIMIT 1),
    'common_match_selected', concat('common-match:', gen_random_uuid()::text),
    jsonb_build_object('commonMatchId', p_match_id::text),
    now()
  );
END;
$$;
REVOKE ALL ON FUNCTION private.set_common_match(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.set_common_match(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.set_common_match(session_id uuid, match_id uuid) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.set_common_match(session_id, match_id);
$$;
REVOKE ALL ON FUNCTION public.set_common_match(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_common_match(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- set_room_assignments (US3)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_room_assignments(p_session_id uuid, p_assignments jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

  DELETE FROM public.assignments WHERE session_id = p_session_id;

  BEGIN
    INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
    SELECT p_session_id, (elem->>'participantId')::uuid, (elem->>'matchId')::uuid, now()
    FROM jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) AS elem;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'invalid_assignment';
  END;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id),
    (SELECT id FROM public.participants WHERE session_id = p_session_id AND account_id = v_account
      AND session_role = 'owner'::public.participant_session_role LIMIT 1),
    'assignment_replaced', concat('assignments-replaced:', gen_random_uuid()::text),
    jsonb_build_object('assignments', coalesce(p_assignments, '[]'::jsonb)),
    now()
  );
END;
$$;
REVOKE ALL ON FUNCTION private.set_room_assignments(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.set_room_assignments(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.set_room_assignments(session_id uuid, assignments jsonb) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.set_room_assignments(session_id, assignments);
$$;
REVOKE ALL ON FUNCTION public.set_room_assignments(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_room_assignments(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- start_game_session (US3) — mutation-level conflict-handling backstop (research.md R7).
--
-- Also re-validates FR-006–FR-009 (participants/matches/common-match/assignments)
-- under the row lock taken below. StartGameCommandHandler already performs the same
-- checks optimistically against a get_room_snapshot read (research.md R4); this is
-- the authoritative re-check that closes the race where the room's configuration is
-- mutated (e.g. the host removes the common match from a second device) in the
-- window between that read and this call. Raises the same error strings the
-- optimistic Java-side check uses, so StartGameCommandHandler.mapSupabaseError
-- maps them to identical ErrorCodes either way.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.start_game_session(p_session_id uuid, p_idempotency_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_host_participant_id uuid;
  v_participant_count int;
  v_match_count int;
  v_unassigned_count int;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'invalid_room_state'; END IF;

  SELECT count(*) INTO v_participant_count FROM public.participants
  WHERE session_id = p_session_id AND left_at IS NULL;
  IF v_participant_count = 0 THEN RAISE EXCEPTION 'empty_participants'; END IF;

  SELECT count(*) INTO v_match_count FROM public.matches WHERE session_id = p_session_id;
  IF v_match_count = 0 THEN RAISE EXCEPTION 'empty_matches'; END IF;

  IF v_room.common_match_id IS NULL THEN RAISE EXCEPTION 'missing_common_match'; END IF;
  PERFORM 1 FROM public.matches WHERE id = v_room.common_match_id AND session_id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_common_match'; END IF;

  SELECT count(*) INTO v_unassigned_count
  FROM public.participants p
  WHERE p.session_id = p_session_id
    AND p.left_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.session_id = p_session_id
        AND a.participant_id = p.id
        AND a.match_id <> v_room.common_match_id
    );
  IF v_unassigned_count > 0 THEN RAISE EXCEPTION 'unassigned_participants'; END IF;

  SELECT id INTO v_host_participant_id FROM public.participants
  WHERE session_id = p_session_id AND account_id = v_account
    AND session_role = 'owner'::public.participant_session_role
  LIMIT 1;

  UPDATE public.game_sessions SET state = 'in_progress'::public.session_state, started_at = now()
  WHERE id = p_session_id;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id), v_host_participant_id,
    'session_started', concat('start-game:', p_idempotency_key::text),
    jsonb_build_object('startedAt', now()),
    now()
  );

  RETURN jsonb_build_object('status', 'started', 'sessionId', p_session_id::text);
END;
$$;
REVOKE ALL ON FUNCTION private.start_game_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.start_game_session(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.start_game_session(session_id uuid, idempotency_key uuid) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.start_game_session(session_id, idempotency_key);
$$;
REVOKE ALL ON FUNCTION public.start_game_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_session(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- command_idempotency (research.md R7) — dispatch-layer idempotency store for the
-- Java command-api. Accessed only via the RPCs below, under the host's own forwarded
-- JWT (R6) — never a service_role credential.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.command_idempotency (
    idempotency_key uuid PRIMARY KEY,
    command_type    text NOT NULL,
    room_id         uuid NOT NULL,
    host_account_id uuid NOT NULL,
    response_status text,
    response_detail jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz
);
ALTER TABLE public.command_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.command_idempotency FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.command_idempotency TO service_role;

CREATE OR REPLACE FUNCTION private.reserve_command_idempotency(
    p_idempotency_key uuid, p_command_type text, p_room_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_existing public.command_idempotency %ROWTYPE;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  BEGIN
    INSERT INTO public.command_idempotency (idempotency_key, command_type, room_id, host_account_id)
    VALUES (p_idempotency_key, p_command_type, p_room_id, v_account);
    RETURN jsonb_build_object('outcome', 'reserved');
  EXCEPTION WHEN unique_violation THEN
    NULL; -- fall through to inspect the existing reservation
  END;

  SELECT * INTO v_existing FROM public.command_idempotency WHERE idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN
    -- Released between our failed insert and this read (the original attempt failed
    -- validation and released its reservation): treat as still-resolving; caller retries.
    RETURN jsonb_build_object('outcome', 'in_flight');
  END IF;

  IF v_existing.command_type <> p_command_type OR v_existing.room_id <> p_room_id THEN
    RETURN jsonb_build_object('outcome', 'conflict');
  ELSIF v_existing.response_status IS NULL THEN
    RETURN jsonb_build_object('outcome', 'in_flight');
  ELSE
    RETURN jsonb_build_object(
      'outcome', 'replay',
      'responseStatus', v_existing.response_status,
      'responseDetail', v_existing.response_detail
    );
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.reserve_command_idempotency(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.reserve_command_idempotency(uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_command_idempotency(
    idempotency_key uuid, command_type text, room_id uuid
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.reserve_command_idempotency(idempotency_key, command_type, room_id);
$$;
REVOKE ALL ON FUNCTION public.reserve_command_idempotency(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_command_idempotency(uuid, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.complete_command_idempotency(
    p_idempotency_key uuid, p_response_status text, p_response_detail jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.command_idempotency
  SET response_status = p_response_status,
      response_detail = p_response_detail,
      completed_at = now()
  WHERE idempotency_key = p_idempotency_key AND host_account_id = v_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'idempotency_reservation_not_found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.complete_command_idempotency(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.complete_command_idempotency(uuid, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_command_idempotency(
    idempotency_key uuid, response_status text, response_detail jsonb
) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.complete_command_idempotency(idempotency_key, response_status, response_detail);
$$;
REVOKE ALL ON FUNCTION public.complete_command_idempotency(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_command_idempotency(uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION private.release_command_idempotency(p_idempotency_key uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.command_idempotency
  WHERE idempotency_key = p_idempotency_key AND host_account_id = v_account;
END;
$$;
REVOKE ALL ON FUNCTION private.release_command_idempotency(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.release_command_idempotency(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.release_command_idempotency(idempotency_key uuid) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.release_command_idempotency(idempotency_key);
$$;
REVOKE ALL ON FUNCTION public.release_command_idempotency(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_command_idempotency(uuid) TO authenticated;
