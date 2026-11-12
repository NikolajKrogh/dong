CREATE OR REPLACE FUNCTION private.prepare_room_assignment_preview(p_session_id uuid,p_purpose text,p_configuration jsonb,p_expected_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_room public.game_sessions; v_config jsonb; v_input jsonb; v_pool jsonb; v_hash text; v_policy text;
 v_plan jsonb; v_proposal private.assignment_proposals; v_last timestamptz; v_item jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 SELECT * INTO v_room FROM public.game_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
 IF v_room.owner_account_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_host'; END IF;
 IF p_purpose IS NULL OR p_purpose NOT IN ('start','running_save') OR
   (p_purpose='start' AND v_room.state<>'joinable') OR (p_purpose='running_save' AND v_room.state<>'in_progress') THEN
   RAISE EXCEPTION 'invalid_configuration';
 END IF;
 IF private.running_configuration_token(p_session_id) IS DISTINCT FROM p_expected_token THEN RAISE EXCEPTION 'configuration_conflict'; END IF;
 v_config := private.normalized_assignment_configuration(p_session_id,p_configuration);
 IF v_config->>'assignmentMode'<>'automatic' THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
 IF jsonb_typeof(v_config->'newMatches')<>'array' OR jsonb_array_length(v_config->'newMatches')>100
   OR jsonb_typeof(v_config->'assignments')<>'array' OR jsonb_array_length(v_config->'assignments')>10000 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
 IF p_purpose='start' AND (v_room.assignment_policy_version<>2 OR
   (v_config->>'matchesPerPlayer')::integer<>v_room.matches_per_player OR
   (v_config->>'sharedMatchesPerPair')::integer<>v_room.shared_matches_per_pair OR
   v_room.assignment_mode<>'automatic' OR jsonb_array_length(v_config->'newMatches')<>0 OR EXISTS(
     SELECT 1 FROM public.participants p WHERE p.session_id=p_session_id AND v_config->'targetsByParticipantId' ? p.id::text
     AND (v_config#>>ARRAY['targetsByParticipantId',p.id::text])::integer<>coalesce(p.additional_match_count,v_room.matches_per_player))) THEN
   RAISE EXCEPTION 'configuration_conflict';
 END IF;
 IF v_room.common_match_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.matches WHERE session_id=p_session_id AND id=v_room.common_match_id) THEN
   RAISE EXCEPTION 'missing_common_match';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_config->'newMatches') x GROUP BY x->>'clientId' HAVING count(*)>1) THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
 FOR v_item IN SELECT * FROM jsonb_array_elements(v_config->'newMatches') LOOP
   IF nullif(btrim(v_item->>'clientId'),'') IS NULL OR length(v_item->>'clientId')>128 OR
     nullif(btrim(v_item->>'homeTeamName'),'') IS NULL OR length(v_item->>'homeTeamName')>120 OR
     nullif(btrim(v_item->>'awayTeamName'),'') IS NULL OR length(v_item->>'awayTeamName')>120 OR
     coalesce(v_item->>'sourceProvider','') NOT IN ('manual','espn') THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
   IF v_item->>'sourceProvider'='espn' AND (nullif(v_item->>'sourceMatchId','') IS NULL OR
     nullif(v_item->>'sourceLeagueCode','') IS NULL OR nullif(v_item->>'kickoffAt','') IS NULL) THEN RAISE EXCEPTION 'invalid_provider_metadata'; END IF;
   PERFORM (v_item->>'kickoffAt')::timestamptz;
 END LOOP;
 SELECT coalesce(jsonb_agg(id::text ORDER BY id),'[]') INTO v_pool FROM public.matches WHERE session_id=p_session_id AND id<>v_room.common_match_id;
 SELECT v_pool||coalesce(jsonb_agg('new:'||(x->>'clientId')),'[]') INTO v_pool
 FROM jsonb_array_elements(v_config->'newMatches') WITH ORDINALITY incoming(x,position)
 WHERE NOT EXISTS(SELECT 1 FROM public.matches m WHERE m.session_id=p_session_id AND m.source_provider=x->>'sourceProvider'
   AND m.source_match_id=x->>'sourceMatchId' AND nullif(x->>'sourceMatchId','') IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_config->'newMatches') WITH ORDINALITY earlier(y,position)
   WHERE earlier.position<incoming.position AND y->>'sourceProvider'=x->>'sourceProvider' AND y->>'sourceMatchId'=x->>'sourceMatchId'
     AND nullif(x->>'sourceMatchId','') IS NOT NULL);
 IF EXISTS(SELECT 1 FROM jsonb_each_text(v_config->'targetsByParticipantId') t WHERE t.value::integer>jsonb_array_length(v_pool)) THEN RAISE EXCEPTION 'insufficient_match_pool'; END IF;
 IF v_config->>'sharingPolicy'='exact' AND
   (SELECT max(value::integer)<(v_config->>'sharedMatchesPerPair')::integer*(count(*)-1)
     FROM jsonb_each_text(v_config->'targetsByParticipantId')) THEN
   RAISE EXCEPTION 'per_player_count_below_minimum';
 END IF;
 v_policy := v_config->>'sharingPolicy';
 IF v_policy='exact' THEN
   IF jsonb_array_length(v_pool)<(SELECT (v_config->>'sharedMatchesPerPair')::integer*count(*)*(count(*)-1)/2+
     count(*)*(max(value::integer)-(v_config->>'sharedMatchesPerPair')::integer*(count(*)-1)) FROM jsonb_each_text(v_config->'targetsByParticipantId')) THEN
     v_policy := 'relaxed';
   END IF;
 END IF;
 v_input := jsonb_build_object('participants',(SELECT jsonb_agg(jsonb_build_object('id',key,'target',value::integer) ORDER BY key)
   FROM jsonb_each_text(v_config->'targetsByParticipantId')),'pool',v_pool,'commonMatchId',v_room.common_match_id,
   'sharing',(v_config->>'sharedMatchesPerPair')::integer,'policy',v_policy);
 v_hash := encode(extensions.digest(jsonb_build_array(v_config,v_input)::text,'sha256'),'hex');
 SELECT * INTO v_proposal FROM private.assignment_proposals WHERE session_id=p_session_id AND actor_account_id=auth.uid() AND purpose=p_purpose AND is_current;
 IF FOUND THEN
   IF v_proposal.configuration_hash=v_hash AND v_proposal.base_configuration_token=p_expected_token AND v_proposal.state='ready' AND v_proposal.expires_at>clock_timestamp() THEN
     RETURN private.assignment_preview_response(v_proposal);
   END IF;
   IF v_proposal.state='preparing' AND v_proposal.lease_expires_at>clock_timestamp() THEN
     RETURN jsonb_build_object('issue',CASE WHEN v_proposal.configuration_hash=v_hash THEN 'preview_pending' ELSE 'preview_busy' END,'retryAfterSeconds',1);
   END IF;
 END IF;
 SELECT max(created_at) INTO v_last FROM private.assignment_proposals WHERE session_id=p_session_id AND actor_account_id=auth.uid() AND purpose=p_purpose;
 IF v_last>clock_timestamp()-interval '2 seconds' THEN RETURN jsonb_build_object('issue','preview_busy','retryAfterSeconds',1); END IF;
 UPDATE private.assignment_proposals SET is_current=false,state='invalidated' WHERE session_id=p_session_id AND actor_account_id=auth.uid() AND purpose=p_purpose AND is_current;
 DELETE FROM private.assignment_proposals WHERE id IN(SELECT id FROM private.assignment_proposals WHERE session_id=p_session_id AND NOT is_current AND expires_at<clock_timestamp()-interval '1 day' ORDER BY expires_at LIMIT 100);
 INSERT INTO private.assignment_proposals(session_id,actor_account_id,purpose,base_configuration_token,configuration_hash,configuration,generation_input,sharing_policy,requires_sharing_consent)
 VALUES(p_session_id,auth.uid(),p_purpose,p_expected_token,v_hash,v_config,v_input,v_policy,v_policy='relaxed') RETURNING * INTO v_proposal;
 RETURN jsonb_build_object('proposalId',v_proposal.id,'input',v_input);
END;
$$;
