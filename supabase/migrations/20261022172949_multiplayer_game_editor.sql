-- Shared score freshness and atomic, host-only edits of running games.
ALTER TABLE public.game_sessions ADD COLUMN last_scores_checked_at timestamptz;
ALTER TABLE private.provider_score_refresh_leases
  ADD COLUMN completed_request_id uuid,
  ADD COLUMN completed_response jsonb;

-- Configuration-only fence: live scores, drinks and provider metadata do not invalidate drafts.
CREATE FUNCTION private.running_configuration_token(p_session_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT md5(jsonb_build_object(
  'owner', gs.owner_account_id, 'state', gs.state, 'common', gs.common_match_id,
  'mode', gs.assignment_mode, 'count', gs.matches_per_player, 'shared', gs.shared_matches_per_pair,
  'roster', (SELECT jsonb_agg(jsonb_build_array(p.id, p.session_role) ORDER BY p.id)
    FROM public.participants p WHERE p.session_id = gs.id AND p.left_at IS NULL),
  'pool', (SELECT jsonb_agg(m.id ORDER BY m.id) FROM public.matches m WHERE m.session_id = gs.id),
  'assignments', (SELECT jsonb_agg(jsonb_build_array(a.participant_id, a.match_id) ORDER BY a.participant_id, a.match_id)
    FROM public.assignments a WHERE a.session_id = gs.id)
)::text) FROM public.game_sessions gs WHERE gs.id = p_session_id;
$$;
REVOKE ALL ON FUNCTION private.running_configuration_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.running_configuration_token(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.authoritative_snapshot(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_snapshot jsonb;
  v_matches jsonb;
BEGIN
  v_snapshot := private.build_guest_room_snapshot(p_session_id);

  SELECT COALESCE(
    jsonb_agg(
      match_item.value || jsonb_build_object(
        'sourceLeagueCode', matches.source_league_code
      )
      ORDER BY match_item.ordinality
    ),
    '[]'::jsonb
  ) INTO v_matches
  FROM jsonb_array_elements(COALESCE(v_snapshot->'matches', '[]'::jsonb))
    WITH ORDINALITY AS match_item(value, ordinality)
  JOIN public.matches matches
    ON matches.id = (match_item.value->>'id')::uuid
   AND matches.session_id = p_session_id;

  RETURN jsonb_set(v_snapshot, '{matches}', v_matches, true)
    || jsonb_build_object(
      'lastScoresCheckedAt', (SELECT last_scores_checked_at FROM public.game_sessions WHERE id = p_session_id),
      'configurationToken', private.running_configuration_token(p_session_id),
      'ownerParticipantId', (
        SELECT p.id::text
        FROM public.participants p
        JOIN public.game_sessions gs ON gs.owner_account_id = p.account_id
          AND gs.id = p_session_id
        WHERE p.session_id = p_session_id
          AND p.session_role = 'owner'::public.participant_session_role
          AND p.left_at IS NULL
        ORDER BY p.created_at, p.id
        LIMIT 1
      ),
      'lastEventSequence', (
        SELECT gs.last_event_sequence
        FROM public.game_sessions gs
        WHERE gs.id = p_session_id
      )
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.accept_provider_score_batch_checked_from_edge(
  p_session_id uuid,
  p_actor_account_id uuid,
  p_request_id uuid,
  p_observations jsonb,
  p_all_sources_checked boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_room public.game_sessions;
  v_actor_participant_id uuid;
  v_lease private.provider_score_refresh_leases;
  v_response jsonb;
BEGIN
  IF p_session_id IS NULL OR p_actor_account_id IS NULL OR p_request_id IS NULL
     OR p_observations IS NULL OR jsonb_typeof(p_observations) <> 'array'
     OR jsonb_array_length(p_observations) > 100 THEN
    RAISE EXCEPTION 'invalid_provider_refresh';
  END IF;

  SELECT gs.* INTO v_room
  FROM public.game_sessions gs
  WHERE gs.id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;

  v_actor_participant_id := private.require_registered_participant_for_account(
    p_session_id, p_actor_account_id
  );
  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'invalid_room_state';
  END IF;

  SELECT lease.* INTO v_lease
  FROM private.provider_score_refresh_leases lease
  WHERE lease.session_id = p_session_id
  FOR UPDATE;
  IF NOT FOUND OR v_lease.request_id <> p_request_id THEN
    RAISE EXCEPTION 'stale_provider_refresh';
  END IF;

  IF v_lease.completed_request_id = p_request_id THEN
    RETURN v_lease.completed_response;
  END IF;

  -- Reuse the existing provenance checks, score acceptance and event history.
  v_response := private.accept_provider_score_batch_from_edge(
    p_session_id, p_actor_account_id, p_request_id, p_observations
  );

  IF p_all_sources_checked AND jsonb_array_length(p_observations) > 0 THEN
    UPDATE public.game_sessions SET last_scores_checked_at = clock_timestamp() WHERE id = p_session_id;
  END IF;
  v_response := v_response || jsonb_build_object(
    'refreshedAt', (SELECT last_scores_checked_at FROM public.game_sessions WHERE id = p_session_id)
  );
  UPDATE private.provider_score_refresh_leases
  SET completed_request_id = p_request_id, completed_response = v_response
  WHERE session_id = p_session_id;
  RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION private.accept_provider_score_batch_checked_from_edge(uuid, uuid, uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.accept_provider_score_batch_checked_from_edge(uuid, uuid, uuid, jsonb, boolean) TO service_role;
CREATE FUNCTION public.accept_provider_score_batch_checked_from_edge(
  session_id uuid, actor_account_id uuid, request_id uuid, observations jsonb, all_sources_checked boolean
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
SELECT private.accept_provider_score_batch_checked_from_edge(session_id, actor_account_id, request_id, observations, all_sources_checked);
$$;
REVOKE ALL ON FUNCTION public.accept_provider_score_batch_checked_from_edge(uuid, uuid, uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_provider_score_batch_checked_from_edge(uuid, uuid, uuid, jsonb, boolean) TO service_role;

CREATE FUNCTION private.save_running_game_configuration(
  p_session_id uuid, p_configuration jsonb, p_expected_token text, p_idempotency_key uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_room public.game_sessions;
  v_actor uuid;
  v_fingerprint text := md5(jsonb_build_array(p_configuration, p_expected_token)::text);
  v_replay public.gameplay_command_results;
  v_item jsonb;
  v_map jsonb := '{}'::jsonb;
  v_match uuid;
  v_roster uuid[];
  v_pool uuid[];
  v_before jsonb;
  v_response jsonb;
  v_mode public.assignment_mode;
  v_count integer;
  v_shared integer;
  v_effective integer;
  v_required integer;
  v_n integer;
  v_i integer;
  v_j integer;
  v_k integer;
  v_cursor integer := 1;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_host'; END IF;
  v_actor := private.require_registered_participant(p_session_id);
  IF p_idempotency_key IS NULL OR p_expected_token IS NULL OR jsonb_typeof(p_configuration) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_configuration';
  END IF;
  SELECT * INTO v_replay FROM public.gameplay_command_results
    WHERE session_id = p_session_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_replay.command_type <> 'save_running_configuration' OR v_replay.actor_participant_id <> v_actor
      OR v_replay.request_fingerprint <> v_fingerprint THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_replay.response;
  END IF;
  IF v_room.state <> 'in_progress' THEN RAISE EXCEPTION 'game_not_in_progress'; END IF;
  IF private.running_configuration_token(p_session_id) IS DISTINCT FROM p_expected_token THEN
    RAISE EXCEPTION 'configuration_conflict';
  END IF;
  IF jsonb_typeof(p_configuration->'newMatches') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_configuration->'newMatches') > 100
    OR jsonb_typeof(p_configuration->'assignments') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_configuration->'assignments') > 10000 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  BEGIN
    v_mode := (p_configuration->>'assignmentMode')::public.assignment_mode;
    v_count := (p_configuration->>'matchesPerPlayer')::integer;
    v_shared := (p_configuration->>'sharedMatchesPerPair')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'invalid_configuration'; END;
  IF v_mode IS NULL OR v_mode NOT IN ('automatic', 'host_assigned') OR v_count IS NULL OR v_shared IS NULL
    OR v_count NOT BETWEEN 0 AND 100 OR v_shared NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  SELECT array_agg(id ORDER BY id) INTO v_roster FROM public.participants
    WHERE session_id = p_session_id AND left_at IS NULL;
  v_n := cardinality(v_roster);
  IF coalesce(v_n, 0) = 0 THEN RAISE EXCEPTION 'empty_participants'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('participantId', a.participant_id, 'matchId', a.match_id)
    ORDER BY a.participant_id, a.match_id), '[]'::jsonb) INTO v_before
    FROM public.assignments a WHERE a.session_id = p_session_id;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_configuration->'newMatches') x
    GROUP BY x->>'clientId' HAVING count(*) > 1) THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_configuration->'newMatches') LOOP
    IF nullif(btrim(v_item->>'clientId'), '') IS NULL OR length(v_item->>'clientId') > 128
      OR nullif(btrim(v_item->>'homeTeamName'), '') IS NULL OR length(v_item->>'homeTeamName') > 120
      OR nullif(btrim(v_item->>'awayTeamName'), '') IS NULL OR length(v_item->>'awayTeamName') > 120
      OR coalesce(v_item->>'sourceProvider','') NOT IN ('manual','espn') THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
    IF v_item->>'sourceProvider' = 'espn' AND
      (nullif(v_item->>'sourceMatchId','') IS NULL OR nullif(v_item->>'sourceLeagueCode','') IS NULL
       OR nullif(v_item->>'kickoffAt','') IS NULL) THEN RAISE EXCEPTION 'invalid_provider_metadata'; END IF;
    INSERT INTO public.matches(session_id, source_provider, source_match_id, source_league_code, home_team_name, away_team_name, kickoff_at)
    VALUES(p_session_id, v_item->>'sourceProvider', nullif(v_item->>'sourceMatchId',''), nullif(v_item->>'sourceLeagueCode',''),
      btrim(v_item->>'homeTeamName'), btrim(v_item->>'awayTeamName'), (v_item->>'kickoffAt')::timestamptz)
    ON CONFLICT (session_id, source_provider, source_match_id) WHERE source_match_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_match;
    IF v_match IS NULL THEN
      SELECT id INTO v_match FROM public.matches WHERE session_id = p_session_id
        AND source_provider = v_item->>'sourceProvider' AND source_match_id = v_item->>'sourceMatchId';
    END IF;
    v_map := v_map || jsonb_build_object(v_item->>'clientId', v_match::text);
  END LOOP;
  SELECT array_agg(id ORDER BY random()) INTO v_pool FROM public.matches
    WHERE session_id = p_session_id AND id <> v_room.common_match_id;
  v_effective := v_count;
  IF v_mode = 'automatic' THEN
    v_effective := greatest(v_count, v_shared * greatest(v_n - 1, 0));
    v_required := (v_n * (v_n - 1) / 2) * v_shared + v_n * (v_effective - v_shared * greatest(v_n - 1, 0));
    IF coalesce(cardinality(v_pool), 0) < v_required THEN RAISE EXCEPTION 'insufficient_match_pool'; END IF;
  ELSIF coalesce(cardinality(v_pool), 0) < v_count THEN RAISE EXCEPTION 'insufficient_match_pool'; END IF;

  -- Only current assignments change. Scores, totals, departed players and historical events are untouched.
  DELETE FROM public.assignments WHERE session_id = p_session_id AND participant_id = ANY(v_roster);
  IF v_mode = 'automatic' THEN
    IF v_n > 1 AND v_shared > 0 THEN
      FOR v_i IN 1..v_n-1 LOOP FOR v_j IN v_i+1..v_n LOOP FOR v_k IN 1..v_shared LOOP
        INSERT INTO public.assignments(session_id, participant_id, match_id)
          VALUES(p_session_id, v_roster[v_i], v_pool[v_cursor]),(p_session_id, v_roster[v_j], v_pool[v_cursor]);
        v_cursor := v_cursor + 1;
      END LOOP; END LOOP; END LOOP;
    END IF;
    FOR v_i IN 1..v_n LOOP
      FOR v_k IN 1..(v_effective - v_shared * greatest(v_n - 1, 0)) LOOP
        INSERT INTO public.assignments(session_id, participant_id, match_id) VALUES(p_session_id, v_roster[v_i], v_pool[v_cursor]);
        v_cursor := v_cursor + 1;
      END LOOP;
    END LOOP;
  ELSE
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_configuration->'assignments') LOOP
      IF (v_item->>'participantId')::uuid IS NULL OR NOT ((v_item->>'participantId')::uuid = ANY(v_roster)) THEN
        RAISE EXCEPTION 'participant_not_in_room';
      END IF;
      v_match := coalesce(v_map->>(v_item->>'matchId'), v_item->>'matchId')::uuid;
      IF v_match IS NULL OR NOT (v_match = ANY(coalesce(v_pool, ARRAY[]::uuid[]))) THEN RAISE EXCEPTION 'match_not_in_room_pool'; END IF;
      INSERT INTO public.assignments(session_id, participant_id, match_id) VALUES(p_session_id, (v_item->>'participantId')::uuid, v_match);
    END LOOP;
    IF EXISTS (SELECT 1 FROM unnest(v_roster) p(id) WHERE
      (SELECT count(*) FROM public.assignments a WHERE a.session_id = p_session_id AND a.participant_id = p.id) <> v_count) THEN
      RAISE EXCEPTION 'assignment_count_mismatch';
    END IF;
  END IF;
  INSERT INTO public.assignments(session_id, participant_id, match_id)
    SELECT p_session_id, unnest(v_roster), v_room.common_match_id;
  UPDATE public.game_sessions SET assignment_mode = v_mode, matches_per_player = v_count,
    shared_matches_per_pair = CASE WHEN v_mode = 'automatic' THEN v_shared ELSE 0 END WHERE id = p_session_id;
  INSERT INTO public.gameplay_events(session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload)
    VALUES(p_session_id, public.allocate_event_sequence(p_session_id), v_actor, 'assignment_replaced', p_idempotency_key::text,
      jsonb_build_object('runningGameEdit', true, 'previousAssignments', v_before,
        'assignments', (SELECT jsonb_agg(jsonb_build_object('participantId', a.participant_id, 'matchId', a.match_id))
          FROM public.assignments a WHERE a.session_id = p_session_id),
        'configuration', p_configuration, 'newMatchIds', v_map));
  v_response := private.authoritative_snapshot(p_session_id);
  INSERT INTO public.gameplay_command_results(session_id, idempotency_key, command_type, actor_participant_id, request_fingerprint, response)
    VALUES(p_session_id, p_idempotency_key, 'save_running_configuration', v_actor, v_fingerprint, v_response);
  RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION private.save_running_game_configuration(uuid, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.save_running_game_configuration(uuid, jsonb, text, uuid) TO service_role;
CREATE FUNCTION public.save_running_game_configuration(session_id uuid, configuration jsonb, expected_token text, idempotency_key uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
SELECT private.save_running_game_configuration(session_id, configuration, expected_token, idempotency_key);
$$;
REVOKE ALL ON FUNCTION public.save_running_game_configuration(uuid, jsonb, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_running_game_configuration(uuid, jsonb, text, uuid) TO authenticated;
