-- Feasibility belongs to generation/commit, so changing a target never discards selections.
CREATE OR REPLACE FUNCTION private.normalized_assignment_configuration(p_session_id uuid, p_configuration jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_room public.game_sessions;
  v_count integer;
  v_shared integer;
  v_mode text;
  v_map jsonb;
  v_targets jsonb;
  v_n integer;
  v_max integer;
  v_min integer;
  v_total integer;
BEGIN
  SELECT * INTO v_room FROM public.game_sessions WHERE id=p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF jsonb_typeof(p_configuration) IS DISTINCT FROM 'object' OR octet_length(p_configuration::text)>8388608
    OR p_configuration->'assignmentPolicyVersion' IS DISTINCT FROM '2'::jsonb
    OR jsonb_typeof(p_configuration->'matchesPerPlayer') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_configuration->'sharedMatchesPerPair') IS DISTINCT FROM 'number'
    OR (p_configuration->>'matchesPerPlayer') !~ '^(0|[1-9][0-9]{0,2})$'
    OR (p_configuration->>'sharedMatchesPerPair') !~ '^(0|[1-9][0-9]{0,2})$'
    OR jsonb_typeof(p_configuration->'playerMatchCounts') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_assignment_settings';
  END IF;
  v_count := (p_configuration->>'matchesPerPlayer')::integer;
  v_shared := (p_configuration->>'sharedMatchesPerPair')::integer;
  v_mode := coalesce(p_configuration->>'assignmentMode',v_room.assignment_mode::text);
  IF v_count>100 OR v_shared>100 OR v_mode NOT IN ('automatic','host_assigned','player_picked') THEN
    RAISE EXCEPTION 'invalid_assignment_settings';
  END IF;
  v_map := p_configuration->'playerMatchCounts';
  IF EXISTS (SELECT 1 FROM jsonb_each(v_map) e WHERE jsonb_typeof(e.value) IS DISTINCT FROM 'number'
    OR e.value::text !~ '^(0|[1-9][0-9]{0,2})$') THEN RAISE EXCEPTION 'invalid_assignment_settings'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(v_map) e WHERE (e.value::text)::integer>100
    OR NOT EXISTS (SELECT 1 FROM public.participants p WHERE p.id::text=e.key AND p.session_id=p_session_id
      AND private.is_active_room_roster_member(p.membership_type::text,p.left_at,p.guest_rejoin_token_hash,p.guest_grant_expires_at))) THEN
    RAISE EXCEPTION 'invalid_assignment_settings';
  END IF;
  SELECT jsonb_object_agg(p.id::text,coalesce((v_map->>p.id::text)::integer,v_count)), count(*),
    max(coalesce((v_map->>p.id::text)::integer,v_count)),min(coalesce((v_map->>p.id::text)::integer,v_count)),
    sum(coalesce((v_map->>p.id::text)::integer,v_count))
  INTO v_targets,v_n,v_max,v_min,v_total FROM public.participants p WHERE p.session_id=p_session_id
    AND private.is_active_room_roster_member(p.membership_type::text,p.left_at,p.guest_rejoin_token_hash,p.guest_grant_expires_at);
  IF v_n=0 THEN RAISE EXCEPTION 'empty_participants'; END IF;
  IF v_total>10000 THEN RAISE EXCEPTION 'assignment_capacity_exceeded'; END IF;
  RETURN jsonb_build_object('assignmentPolicyVersion',2,'assignmentMode',v_mode,'matchesPerPlayer',v_count,
    'sharedMatchesPerPair',v_shared,'playerMatchCounts',v_map,'targetsByParticipantId',v_targets,
    'sharingPolicy',CASE WHEN v_max=0 THEN 'common_only' WHEN v_max=v_min THEN 'exact' ELSE 'preference' END,
    'newMatches',coalesce(p_configuration->'newMatches','[]'::jsonb),
    'assignments',coalesce(p_configuration->'assignments','[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION private.normalized_assignment_configuration(uuid,jsonb) FROM PUBLIC,anon,authenticated;


-- Explicit selections share host-assigned validation, while retaining the chosen mode.
CREATE FUNCTION private.validate_assignment_overrides(p_session_id uuid,p_assignments jsonb,p_targets jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_selected jsonb; v_common uuid;
BEGIN
 IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' OR jsonb_array_length(p_assignments)>10000
   OR octet_length(p_assignments::text)>8388608 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
 SELECT common_match_id INTO v_common FROM public.game_sessions WHERE id=p_session_id;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_assignments) a WHERE
   jsonb_typeof(a) IS DISTINCT FROM 'object' OR NOT coalesce(p_targets ? (a->>'participantId'),false)
   OR NOT EXISTS(SELECT 1 FROM public.matches m WHERE m.session_id=p_session_id AND m.id::text=a->>'matchId' AND m.id<>v_common))
 THEN RAISE EXCEPTION 'invalid_assignment'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_assignments) a GROUP BY a->>'participantId',a->>'matchId' HAVING count(*)>1)
 THEN RAISE EXCEPTION 'invalid_assignment'; END IF;
 SELECT jsonb_object_agg(t.key,coalesce((SELECT jsonb_agg(a->>'matchId' ORDER BY a->>'matchId')
   FROM jsonb_array_elements(p_assignments) a WHERE a->>'participantId'=t.key),'[]')) INTO v_selected FROM jsonb_each(p_targets) t;
 IF EXISTS(SELECT 1 FROM jsonb_each_text(p_targets) t WHERE jsonb_array_length(v_selected->t.key)<>t.value::integer)
 THEN RAISE EXCEPTION 'assignment_count_mismatch'; END IF;
 RETURN coalesce(v_selected,'{}');
END;
$$;
REVOKE ALL ON FUNCTION private.validate_assignment_overrides(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.start_game_session_v2(p_session_id uuid,p_proposal_id uuid,p_expected_token text,p_idempotency_key uuid,p_accept_relaxed_sharing boolean,p_assignment_overrides jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_room public.game_sessions; v_actor uuid; v_replay public.gameplay_command_results;
 v_fingerprint text:=CASE WHEN p_assignment_overrides IS NULL THEN md5(jsonb_build_array(p_proposal_id,p_expected_token,p_accept_relaxed_sharing)::text) ELSE md5(jsonb_build_array(p_proposal_id,p_expected_token,p_accept_relaxed_sharing,p_assignment_overrides)::text) END;
 v_plan jsonb; v_targets jsonb; v_selected jsonb; v_proposal private.assignment_proposals;
 v_target record; v_held integer; v_filled jsonb:='[]'; v_response jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 SELECT * INTO v_room FROM public.game_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
 IF v_room.owner_account_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_host'; END IF;
 v_actor:=private.require_registered_participant(p_session_id);
 IF p_expected_token IS NULL OR p_idempotency_key IS NULL OR p_accept_relaxed_sharing IS NULL THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
 SELECT * INTO v_replay FROM public.gameplay_command_results WHERE session_id=p_session_id AND idempotency_key=p_idempotency_key;
 IF FOUND THEN
   IF v_replay.command_type<>'start_game_v2' OR v_replay.actor_participant_id<>v_actor OR v_replay.request_fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
   RETURN v_replay.response;
 END IF;
 IF v_room.state<>'joinable' OR v_room.assignment_policy_version<>2 THEN RAISE EXCEPTION 'invalid_room_state'; END IF;
 IF private.running_configuration_token(p_session_id) IS DISTINCT FROM p_expected_token THEN RAISE EXCEPTION 'configuration_conflict'; END IF;
 IF v_room.common_match_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.matches WHERE session_id=p_session_id AND id=v_room.common_match_id) THEN RAISE EXCEPTION 'missing_common_match'; END IF;
 v_plan:=private.compute_room_assignment_plan(p_session_id); v_targets:=v_plan->'targetsByParticipantId';
 IF (v_plan->>'participantCount')::integer=0 THEN RAISE EXCEPTION 'empty_participants'; END IF;
 IF p_assignment_overrides IS NULL AND NOT (v_plan->>'startable')::boolean THEN RAISE EXCEPTION 'insufficient_match_pool'; END IF;
 IF (SELECT sum(value::integer) FROM jsonb_each_text(v_targets))>10000 THEN RAISE EXCEPTION 'assignment_capacity_exceeded'; END IF;
 IF p_assignment_overrides IS NOT NULL THEN
   IF v_room.assignment_mode='player_picked' OR p_proposal_id IS NOT NULL OR p_accept_relaxed_sharing THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
   v_selected:=private.validate_assignment_overrides(p_session_id,p_assignment_overrides,v_targets);
 ELSIF v_room.assignment_mode='automatic' THEN
   v_proposal:=private.require_assignment_proposal(p_session_id,p_proposal_id,'start',p_expected_token,p_accept_relaxed_sharing);
   v_selected:=v_proposal.assignments;
 ELSE
   IF p_proposal_id IS NOT NULL OR p_accept_relaxed_sharing THEN RAISE EXCEPTION 'invalid_assignment_proposal'; END IF;
   SELECT coalesce(jsonb_object_agg(t.key,coalesce((SELECT jsonb_agg(s.match_id::text ORDER BY s.match_id) FROM (
     SELECT a.match_id FROM public.assignments a WHERE v_room.assignment_mode='host_assigned' AND a.session_id=p_session_id AND a.participant_id::text=t.key AND a.match_id<>v_room.common_match_id
     UNION SELECT a.match_id FROM public.assignment_picks a WHERE v_room.assignment_mode='player_picked' AND a.session_id=p_session_id AND a.participant_id::text=t.key AND a.match_id<>v_room.common_match_id
   ) s),'[]')),'{}') INTO v_selected FROM jsonb_each_text(v_targets) t;
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each_text(v_targets) t WHERE jsonb_array_length(v_selected->t.key)>t.value::integer) THEN RAISE EXCEPTION 'target_below_existing_selections'; END IF;
 IF NOT private.drain_catalog_room_cutoff(p_session_id) THEN RETURN jsonb_build_object('ok',false,'code','room_processing_pending','retryAfterSeconds',1); END IF;
 DELETE FROM public.assignments WHERE session_id=p_session_id;
 FOR v_target IN SELECT * FROM jsonb_each_text(v_targets) LOOP
   INSERT INTO public.assignments(session_id,participant_id,match_id)
   SELECT p_session_id,v_target.key::uuid,x.value::uuid FROM jsonb_array_elements_text(v_selected->v_target.key) x;
   GET DIAGNOSTICS v_held=ROW_COUNT;
   IF v_held<v_target.value::integer THEN
     IF v_room.assignment_mode='automatic' THEN RAISE EXCEPTION 'assignment_count_mismatch'; END IF;
     INSERT INTO public.assignments(session_id,participant_id,match_id)
     SELECT p_session_id,v_target.key::uuid,m.id FROM public.matches m WHERE m.session_id=p_session_id AND m.id<>v_room.common_match_id
       AND NOT EXISTS(SELECT 1 FROM public.assignments a WHERE a.session_id=p_session_id AND a.participant_id=v_target.key::uuid AND a.match_id=m.id)
     ORDER BY random() LIMIT v_target.value::integer-v_held;
     v_filled:=v_filled||jsonb_build_array(v_target.key);
   END IF;
   IF (SELECT count(*) FROM public.assignments WHERE session_id=p_session_id AND participant_id=v_target.key::uuid)<>v_target.value::integer THEN RAISE EXCEPTION 'assignment_count_mismatch'; END IF;
   INSERT INTO public.assignments(session_id,participant_id,match_id) VALUES(p_session_id,v_target.key::uuid,v_room.common_match_id);
 END LOOP;
 INSERT INTO public.gameplay_events(session_id,sequence_number,actor_participant_id,event_type,idempotency_key,payload)
 VALUES(p_session_id,public.allocate_event_sequence(p_session_id),v_actor,'assignment_replaced','canonical-start-assignments:'||p_idempotency_key::text,
   jsonb_build_object('assignmentPolicyVersion',2,'targetsByParticipantId',v_targets,'proposalId',p_proposal_id,'acceptRelaxedSharing',p_accept_relaxed_sharing,'assignmentOverrides',p_assignment_overrides,
     'assignments',(SELECT jsonb_agg(jsonb_build_object('participantId',a.participant_id,'matchId',a.match_id)) FROM public.assignments a WHERE a.session_id=p_session_id)));
 UPDATE public.game_sessions SET state='in_progress',started_at=clock_timestamp() WHERE id=p_session_id;
 INSERT INTO public.gameplay_events(session_id,sequence_number,actor_participant_id,event_type,idempotency_key,payload)
 VALUES(p_session_id,public.allocate_event_sequence(p_session_id),v_actor,'session_started','start-game:'||p_idempotency_key::text,
   jsonb_build_object('startedAt',clock_timestamp(),'filledInParticipantIds',v_filled,'relaxedConstraints',coalesce(v_proposal.requires_sharing_consent,false)));
 PERFORM private.assert_catalog_room_capacity(p_session_id);
 IF p_proposal_id IS NOT NULL THEN UPDATE private.assignment_proposals SET state='consumed',consumed_at=clock_timestamp(),is_current=false WHERE id=p_proposal_id; END IF;
 v_response:=private.authoritative_snapshot(p_session_id);
 INSERT INTO public.gameplay_command_results(session_id,idempotency_key,command_type,actor_participant_id,request_fingerprint,response)
 VALUES(p_session_id,p_idempotency_key,'start_game_v2',v_actor,v_fingerprint,v_response);
 RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION private.save_running_game_configuration_v2(p_session_id uuid, p_configuration jsonb, p_proposal_id uuid, p_expected_token text, p_idempotency_key uuid, p_accept_relaxed_sharing boolean, p_assignment_overrides jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_sessions;
  v_configuration jsonb := p_configuration;
  v_proposal private.assignment_proposals;
  v_actor uuid;
  v_fingerprint text := CASE WHEN p_assignment_overrides IS NULL THEN md5(jsonb_build_array(p_configuration, p_proposal_id, p_expected_token, p_accept_relaxed_sharing)::text) ELSE md5(jsonb_build_array(p_configuration, p_proposal_id, p_expected_token, p_accept_relaxed_sharing, p_assignment_overrides)::text) END;
  v_replay public.gameplay_command_results;
  v_item jsonb;
  v_map jsonb := '{}'::jsonb;
  v_match uuid;
  v_roster uuid[];
  v_pool uuid[];
  v_before jsonb;
  v_previous_plan jsonb;
  v_response jsonb;
  v_mode public.assignment_mode;
  v_count integer;
  v_shared integer;
  v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_host'; END IF;
  v_actor := private.require_registered_participant(p_session_id);
  IF p_idempotency_key IS NULL OR p_expected_token IS NULL OR p_accept_relaxed_sharing IS NULL OR jsonb_typeof(p_configuration) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_configuration';
  END IF;
  SELECT * INTO v_replay FROM public.gameplay_command_results
    WHERE session_id = p_session_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_replay.command_type <> 'save_running_configuration_v2' OR v_replay.actor_participant_id <> v_actor
      OR v_replay.request_fingerprint <> v_fingerprint THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_replay.response;
  END IF;
  IF v_room.state <> 'in_progress' THEN RAISE EXCEPTION 'game_not_in_progress'; END IF;
  IF private.running_configuration_token(p_session_id) IS DISTINCT FROM p_expected_token THEN
    RAISE EXCEPTION 'configuration_conflict';
  END IF;
  v_previous_plan := private.compute_room_assignment_plan(p_session_id);
  IF p_assignment_overrides IS NOT NULL THEN
    IF p_configuration->>'assignmentMode' NOT IN ('automatic','host_assigned') OR p_proposal_id IS NOT NULL OR p_accept_relaxed_sharing
      OR jsonb_typeof(p_assignment_overrides) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
    IF jsonb_array_length(p_assignment_overrides)>10000 OR octet_length(p_assignment_overrides::text)>8388608
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_assignment_overrides) a WHERE jsonb_typeof(a) IS DISTINCT FROM 'object'
        OR jsonb_typeof(a->'participantId') IS DISTINCT FROM 'string' OR jsonb_typeof(a->'matchId') IS DISTINCT FROM 'string')
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_assignment_overrides) a GROUP BY a->>'participantId',a->>'matchId' HAVING count(*)>1)
      THEN RAISE EXCEPTION 'invalid_assignment'; END IF;
    -- Generation constraints do not apply to explicit, host-edited selections.
    v_configuration := private.normalized_assignment_configuration(p_session_id,
      p_configuration || jsonb_build_object('assignmentMode','host_assigned','assignments',p_assignment_overrides));
    v_configuration := v_configuration || jsonb_build_object('assignmentMode',p_configuration->>'assignmentMode');
  ELSE
    v_configuration := private.normalized_assignment_configuration(p_session_id,p_configuration);
  END IF;
  IF v_configuration->>'assignmentMode'='player_picked' THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  IF p_assignment_overrides IS NULL AND v_configuration->>'assignmentMode'='automatic' THEN
    v_proposal := private.require_assignment_proposal(p_session_id,p_proposal_id,'running_save',p_expected_token,p_accept_relaxed_sharing);
    IF v_proposal.configuration IS DISTINCT FROM v_configuration THEN RAISE EXCEPTION 'configuration_conflict'; END IF;
    v_configuration := jsonb_set(v_configuration,'{assignments}',coalesce((SELECT jsonb_agg(jsonb_build_object('participantId',p.key,'matchId',m.value))
      FROM jsonb_each(v_proposal.assignments) p CROSS JOIN LATERAL jsonb_array_elements_text(p.value) m),'[]'));
  ELSIF p_proposal_id IS NOT NULL OR coalesce(p_accept_relaxed_sharing,false) THEN RAISE EXCEPTION 'invalid_assignment_proposal'; END IF;
  IF jsonb_typeof(v_configuration->'newMatches') IS DISTINCT FROM 'array'
    OR jsonb_array_length(v_configuration->'newMatches') > 100
    OR jsonb_typeof(v_configuration->'assignments') IS DISTINCT FROM 'array'
    OR jsonb_array_length(v_configuration->'assignments') > 10000 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  BEGIN
    v_mode := (v_configuration->>'assignmentMode')::public.assignment_mode;
    v_count := (v_configuration->>'matchesPerPlayer')::integer;
    v_shared := (v_configuration->>'sharedMatchesPerPair')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'invalid_configuration'; END;
  IF v_mode IS NULL OR v_mode NOT IN ('automatic', 'host_assigned') OR v_count IS NULL OR v_shared IS NULL
    OR v_count NOT BETWEEN 0 AND 100 OR v_shared NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  SELECT array_agg(id ORDER BY id) INTO v_roster FROM public.participants
    WHERE session_id = p_session_id AND private.is_active_room_roster_member(membership_type::text,left_at,guest_rejoin_token_hash,guest_grant_expires_at);
  v_n := cardinality(v_roster);
  IF coalesce(v_n, 0) = 0 THEN RAISE EXCEPTION 'empty_participants'; END IF;
  IF NOT private.drain_catalog_room_cutoff(p_session_id) THEN
    RETURN jsonb_build_object('ok',false,'code','room_processing_pending','retryAfterSeconds',1);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('participantId', a.participant_id, 'matchId', a.match_id)
    ORDER BY a.participant_id, a.match_id), '[]'::jsonb) INTO v_before
    FROM public.assignments a WHERE a.session_id = p_session_id;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_configuration->'newMatches') x
    GROUP BY x->>'clientId' HAVING count(*) > 1) THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_configuration->'newMatches') LOOP
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
    v_map := v_map || jsonb_build_object(v_item->>'clientId', v_match::text,'new:'||(v_item->>'clientId'),v_match::text);
  END LOOP;
  SELECT array_agg(id ORDER BY random()) INTO v_pool FROM public.matches
    WHERE session_id = p_session_id AND id <> v_room.common_match_id;
  IF EXISTS(SELECT 1 FROM jsonb_each_text(v_configuration->'targetsByParticipantId') t WHERE t.value::integer>coalesce(cardinality(v_pool),0)) THEN RAISE EXCEPTION 'insufficient_match_pool'; END IF;
  -- Only current assignments change. Scores, totals, departed players and historical events are untouched.
  DELETE FROM public.assignments WHERE session_id = p_session_id AND participant_id = ANY(v_roster);
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_configuration->'assignments') LOOP
      IF (v_item->>'participantId')::uuid IS NULL OR NOT ((v_item->>'participantId')::uuid = ANY(v_roster)) THEN
        RAISE EXCEPTION 'participant_not_in_room';
      END IF;
      v_match := coalesce(v_map->>(v_item->>'matchId'), v_item->>'matchId')::uuid;
      IF v_match IS NULL OR NOT (v_match = ANY(coalesce(v_pool, ARRAY[]::uuid[]))) THEN RAISE EXCEPTION 'match_not_in_room_pool'; END IF;
      INSERT INTO public.assignments(session_id, participant_id, match_id) VALUES(p_session_id, (v_item->>'participantId')::uuid, v_match);
    END LOOP;
    IF EXISTS (SELECT 1 FROM unnest(v_roster) p(id) WHERE
      (SELECT count(*) FROM public.assignments a WHERE a.session_id = p_session_id AND a.participant_id = p.id) <> (v_configuration#>>ARRAY['targetsByParticipantId',p.id::text])::integer) THEN
      RAISE EXCEPTION 'assignment_count_mismatch';
    END IF;
  INSERT INTO public.assignments(session_id, participant_id, match_id)
    SELECT p_session_id, unnest(v_roster), v_room.common_match_id;
  UPDATE public.participants p SET additional_match_count=(v_configuration#>>ARRAY['playerMatchCounts',p.id::text])::integer WHERE p.session_id=p_session_id AND p.id=ANY(v_roster);
  UPDATE public.game_sessions SET assignment_policy_version=2,assignment_mode = v_mode, matches_per_player = v_count,
    shared_matches_per_pair = v_shared WHERE id = p_session_id;
  INSERT INTO public.gameplay_events(session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload)
    VALUES(p_session_id, public.allocate_event_sequence(p_session_id), v_actor, 'assignment_replaced', p_idempotency_key::text,
      jsonb_build_object('runningGameEdit', true, 'previousAssignments', v_before,
        'previousPolicyVersion',v_room.assignment_policy_version,'assignmentPolicyVersion',2,
        'previousTargetsByParticipantId',v_previous_plan->'targetsByParticipantId','targetsByParticipantId',v_configuration->'targetsByParticipantId',
        'assignments', (SELECT jsonb_agg(jsonb_build_object('participantId', a.participant_id, 'matchId', a.match_id))
          FROM public.assignments a WHERE a.session_id = p_session_id),
        'configuration', v_configuration, 'newMatchIds', v_map,'proposalId',p_proposal_id,'acceptRelaxedSharing',p_accept_relaxed_sharing,'assignmentOverrides',p_assignment_overrides));
  PERFORM private.assert_catalog_room_capacity(p_session_id);
  IF p_proposal_id IS NOT NULL THEN UPDATE private.assignment_proposals SET state='consumed',is_current=false,consumed_at=clock_timestamp() WHERE id=p_proposal_id; END IF;
  v_response := private.authoritative_snapshot(p_session_id);
  INSERT INTO public.gameplay_command_results(session_id, idempotency_key, command_type, actor_participant_id, request_fingerprint, response)
    VALUES(p_session_id, p_idempotency_key, 'save_running_configuration_v2', v_actor, v_fingerprint, v_response);
  RETURN v_response;
END;
$function$;



REVOKE ALL ON FUNCTION private.start_game_session_v2(uuid,uuid,text,uuid,boolean,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.save_running_game_configuration_v2(uuid,jsonb,uuid,text,uuid,boolean,jsonb) FROM PUBLIC,anon,authenticated;
-- Replace rather than overload public RPCs: old named requests continue using the defaults.
DROP FUNCTION public.start_game_session_v2(uuid,uuid,text,uuid,boolean);
CREATE FUNCTION public.start_game_session_v2(session_id uuid,proposal_id uuid,expected_token text,idempotency_key uuid,accept_relaxed_sharing boolean DEFAULT false,assignment_overrides jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.start_game_session_v2(session_id,proposal_id,expected_token,idempotency_key,accept_relaxed_sharing,assignment_overrides);
$$;
DROP FUNCTION public.save_running_game_configuration_v2(uuid,jsonb,uuid,text,uuid,boolean);
CREATE FUNCTION public.save_running_game_configuration_v2(session_id uuid,configuration jsonb,proposal_id uuid,expected_token text,idempotency_key uuid,accept_relaxed_sharing boolean DEFAULT false,assignment_overrides jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.save_running_game_configuration_v2(session_id,configuration,proposal_id,expected_token,idempotency_key,accept_relaxed_sharing,assignment_overrides);
$$;
REVOKE ALL ON FUNCTION public.start_game_session_v2(uuid,uuid,text,uuid,boolean,jsonb), public.save_running_game_configuration_v2(uuid,jsonb,uuid,text,uuid,boolean,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_game_session_v2(uuid,uuid,text,uuid,boolean,jsonb), public.save_running_game_configuration_v2(uuid,jsonb,uuid,text,uuid,boolean,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION private.build_guest_room_snapshot(p_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_snapshot jsonb;
  v_field text;
  v_rows jsonb;
  v_policy smallint;
  v_goals jsonb;
BEGIN
  v_snapshot := private.build_guest_room_snapshot_v1(p_session_id);
  SELECT assignment_policy_version INTO v_policy FROM public.game_sessions WHERE id=p_session_id;
  FOREACH v_field IN ARRAY ARRAY['participants','activeRoster'] LOOP
    SELECT coalesce(jsonb_agg(e.value||jsonb_build_object('additionalMatchCount',p.additional_match_count,
      'resolvedAdditionalMatchCount',coalesce(p.additional_match_count,gs.matches_per_player)) ORDER BY e.ordinality),'[]')
    INTO v_rows FROM jsonb_array_elements(v_snapshot->v_field) WITH ORDINALITY e(value,ordinality)
      JOIN public.participants p ON p.id::text=e.value->>'id' AND p.session_id=p_session_id
      JOIN public.game_sessions gs ON gs.id=p.session_id;
    v_snapshot := jsonb_set(v_snapshot,ARRAY[v_field],v_rows);
  END LOOP;
  IF v_snapshot->>'state' = 'in_progress' THEN
    WITH recent AS (
      SELECT sequence_number, room_match_id, catalog_match_id, provider_observation_version
      FROM public.gameplay_events
      WHERE session_id = p_session_id AND actor_kind = 'provider'
      ORDER BY sequence_number DESC
      LIMIT 24
    )
    SELECT jsonb_agg(jsonb_build_object(
      'sequence', e.sequence_number, 'matchId', e.room_match_id,
      'team', CASE WHEN curr.home_score > prev.home_score THEN 'home' ELSE 'away' END,
      'homeScore', curr.home_score, 'awayScore', curr.away_score
    ) ORDER BY e.sequence_number)
    INTO v_goals
    FROM recent e
    JOIN public.matches m ON m.id = e.room_match_id AND m.catalog_match_id = e.catalog_match_id
    JOIN private.provider_match_observations curr
      ON curr.match_id = e.catalog_match_id AND curr.observation_version = e.provider_observation_version
    JOIN private.provider_match_observations prev
      ON prev.match_id = curr.match_id AND prev.observation_version = curr.observation_version - 1
    WHERE prev.observation_version >= m.tracking_started_observation_version
      AND curr.accepted_at >= statement_timestamp() - interval '60 seconds'
      AND curr.lifecycle IN ('live', 'finished') AND prev.lifecycle IN ('scheduled', 'live')
      AND curr.shootout_home_score IS NULL AND curr.shootout_away_score IS NULL
      AND prev.shootout_home_score IS NULL AND prev.shootout_away_score IS NULL
      AND ((curr.home_score = prev.home_score + 1 AND curr.away_score = prev.away_score)
        OR (curr.away_score = prev.away_score + 1 AND curr.home_score = prev.home_score))
      AND NOT EXISTS (
        SELECT FROM private.provider_match_observations later
        WHERE later.match_id = curr.match_id AND later.observation_version > curr.observation_version
          AND (later.home_score < curr.home_score OR later.away_score < curr.away_score)
      );
  END IF;
  RETURN v_snapshot||jsonb_build_object('providerGoals',coalesce(v_goals,'[]'), 'assignmentPolicyVersion',v_policy,
    'capabilities',jsonb_build_object('perPlayerMatchCounts',true,'assignmentPreview',true,'editableAutomaticAssignments',true),
    'configurationToken',private.running_configuration_token(p_session_id));
END;
$$;
REVOKE ALL ON FUNCTION private.build_guest_room_snapshot(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.build_guest_room_snapshot(uuid) TO service_role;

-- Host targets may temporarily differ from existing selections; guest caps remain enforced.
CREATE OR REPLACE FUNCTION private.set_room_assignment_configuration_v2(p_session_id uuid,p_configuration jsonb,p_expected_token text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_room public.game_sessions; v_actor uuid; v_configuration jsonb; v_response jsonb;
  v_fingerprint text := md5(jsonb_build_array(p_configuration,p_expected_token)::text);
  v_replay public.gameplay_command_results;
  v_previous_plan jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_host'; END IF;
  v_actor := private.require_registered_participant(p_session_id);
  IF p_idempotency_key IS NULL OR p_expected_token IS NULL THEN RAISE EXCEPTION 'invalid_assignment_settings'; END IF;
  SELECT * INTO v_replay FROM public.gameplay_command_results WHERE session_id=p_session_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_replay.command_type<>'set_assignment_configuration_v2' OR v_replay.actor_participant_id<>v_actor
      OR v_replay.request_fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_replay.response;
  END IF;
  IF v_room.state<>'joinable' THEN RAISE EXCEPTION 'room_not_joinable'; END IF;
  IF private.running_configuration_token(p_session_id) IS DISTINCT FROM p_expected_token THEN RAISE EXCEPTION 'configuration_conflict'; END IF;
  v_previous_plan := private.compute_room_assignment_plan(p_session_id);
  v_configuration := private.normalized_assignment_configuration(p_session_id,
    p_configuration||jsonb_build_object('assignmentMode',v_room.assignment_mode));
  IF v_room.assignment_mode='player_picked' AND EXISTS (SELECT 1 FROM jsonb_each_text(v_configuration->'targetsByParticipantId') t WHERE
    (SELECT count(*) FROM public.assignments a WHERE a.session_id=p_session_id AND a.participant_id::text=t.key AND a.match_id IS DISTINCT FROM v_room.common_match_id)>t.value::integer
    OR (SELECT count(*) FROM public.assignment_picks a WHERE a.session_id=p_session_id AND a.participant_id::text=t.key AND a.match_id IS DISTINCT FROM v_room.common_match_id)>t.value::integer) THEN
    RAISE EXCEPTION 'target_below_existing_selections';
  END IF;
  UPDATE public.participants p SET additional_match_count=(v_configuration#>>ARRAY['playerMatchCounts',p.id::text])::integer
    WHERE p.session_id=p_session_id AND v_configuration->'targetsByParticipantId' ? p.id::text;
  UPDATE public.game_sessions SET assignment_policy_version=2,matches_per_player=(v_configuration->>'matchesPerPlayer')::integer,
    shared_matches_per_pair=(v_configuration->>'sharedMatchesPerPair')::integer WHERE id=p_session_id;
  INSERT INTO public.gameplay_events(session_id,sequence_number,actor_participant_id,event_type,idempotency_key,payload)
  VALUES(p_session_id,public.allocate_event_sequence(p_session_id),v_actor,'assignment_replaced',p_idempotency_key::text,
    jsonb_build_object('configurationOnly',true,'configuration',v_configuration,'previousPolicyVersion',v_room.assignment_policy_version,
      'assignmentPolicyVersion',2,'previousTargetsByParticipantId',v_previous_plan->'targetsByParticipantId',
      'targetsByParticipantId',v_configuration->'targetsByParticipantId',
      'previousConfiguration',jsonb_build_object('matchesPerPlayer',v_room.matches_per_player,'sharedMatchesPerPair',v_room.shared_matches_per_pair),
      'assignments',(SELECT coalesce(jsonb_agg(jsonb_build_object('participantId',a.participant_id,'matchId',a.match_id)),'[]')
        FROM public.assignments a WHERE a.session_id=p_session_id)));
  v_response := private.authoritative_snapshot(p_session_id);
  INSERT INTO public.gameplay_command_results(session_id,idempotency_key,command_type,actor_participant_id,request_fingerprint,response)
    VALUES(p_session_id,p_idempotency_key,'set_assignment_configuration_v2',v_actor,v_fingerprint,v_response);
  RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION private.set_room_assignment_configuration_v2(uuid,jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
