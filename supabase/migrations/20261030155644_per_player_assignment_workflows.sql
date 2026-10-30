-- Private, leased proposals; ordinary clients cannot author trusted results.
CREATE TABLE private.assignment_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK(purpose IN ('start','running_save')),
  state text NOT NULL DEFAULT 'preparing' CHECK(state IN ('preparing','ready','consumed','invalidated')),
  is_current boolean NOT NULL DEFAULT true,
  base_configuration_token text NOT NULL,
  configuration_hash text NOT NULL,
  configuration jsonb NOT NULL,
  generation_input jsonb NOT NULL,
  sharing_policy text NOT NULL CHECK(sharing_policy IN ('exact','preference','relaxed','common_only')),
  requires_sharing_consent boolean NOT NULL,
  assignments jsonb,
  quality jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 seconds',
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 seconds',
  ready_at timestamptz,
  consumed_at timestamptz,
  CHECK(requires_sharing_consent=(sharing_policy='relaxed')),
  CHECK(state<>'preparing' OR (assignments IS NULL AND quality IS NULL)),
  CHECK(state NOT IN ('ready','consumed') OR (assignments IS NOT NULL AND quality IS NOT NULL AND ready_at IS NOT NULL))
);
CREATE UNIQUE INDEX assignment_proposals_current ON private.assignment_proposals(session_id,actor_account_id,purpose) WHERE is_current;
CREATE INDEX assignment_proposals_admission ON private.assignment_proposals(session_id,actor_account_id,purpose,created_at DESC);
CREATE INDEX assignment_proposals_expiry ON private.assignment_proposals(expires_at);
ALTER TABLE private.assignment_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.assignment_proposals FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.assignment_preview_response(p_proposal private.assignment_proposals) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
SELECT jsonb_build_object('proposalId',p_proposal.id,'expiresAt',p_proposal.expires_at,
  'assignments',p_proposal.assignments,'quality',p_proposal.quality,
  'targetsByParticipantId',p_proposal.configuration->'targetsByParticipantId',
  'sharingPolicy',p_proposal.sharing_policy,'requiresSharingConsent',p_proposal.requires_sharing_consent);
$$;
REVOKE ALL ON FUNCTION private.assignment_preview_response(private.assignment_proposals) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.prepare_room_assignment_preview(p_session_id uuid,p_purpose text,p_configuration jsonb,p_expected_token text)
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
REVOKE ALL ON FUNCTION private.prepare_room_assignment_preview(uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.prepare_room_assignment_preview(session_id uuid,purpose text,configuration jsonb,expected_token text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
SELECT private.prepare_room_assignment_preview(session_id,purpose,configuration,expected_token);
$$;
REVOKE ALL ON FUNCTION public.prepare_room_assignment_preview(uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
-- Grants and capabilities are activated only after complete start/save implementation.

CREATE FUNCTION private.store_room_assignment_proposal(p_proposal_id uuid,p_assignments jsonb,p_quality jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_proposal private.assignment_proposals; v_room public.game_sessions; v_target record; v_ids jsonb;
BEGIN
 SELECT session_id INTO v_proposal.session_id FROM private.assignment_proposals WHERE id=p_proposal_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_assignment_proposal'; END IF;
 SELECT * INTO v_room FROM public.game_sessions WHERE id=v_proposal.session_id FOR UPDATE;
 SELECT * INTO v_proposal FROM private.assignment_proposals WHERE id=p_proposal_id FOR UPDATE;
 IF NOT v_proposal.is_current OR v_proposal.state<>'preparing' OR v_proposal.lease_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'assignment_proposal_superseded'; END IF;
 IF v_room.owner_account_id<>v_proposal.actor_account_id OR private.running_configuration_token(v_room.id) IS DISTINCT FROM v_proposal.base_configuration_token THEN RAISE EXCEPTION 'configuration_conflict'; END IF;
 IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'object' OR jsonb_typeof(p_quality) IS DISTINCT FROM 'object' OR
   coalesce(p_quality->>'quality','') NOT IN ('optimal','best_effort','fallback') OR
   jsonb_typeof(p_quality->'summaryComplete') IS DISTINCT FROM 'boolean' OR
   coalesce(p_quality->>'reason','') NOT IN ('','time_limit','model_limit','solver_unavailable','invalid_solver_result') OR
   (p_quality->>'summaryComplete'='true' AND (coalesce(p_quality->>'totalDeviation','') !~ '^(0|[1-9][0-9]*)$' OR
     jsonb_typeof(p_quality->'exactPreferenceAchieved') IS DISTINCT FROM 'boolean')) OR
   (p_quality->>'summaryComplete'='false' AND (p_quality->'totalDeviation' IS DISTINCT FROM 'null'::jsonb OR
     p_quality->'exactPreferenceAchieved' IS DISTINCT FROM 'null'::jsonb)) THEN RAISE EXCEPTION 'invalid_assignment_proposal'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_assignments) k WHERE NOT(v_proposal.configuration->'targetsByParticipantId' ? k)) THEN RAISE EXCEPTION 'invalid_assignment_proposal'; END IF;
 FOR v_target IN SELECT * FROM jsonb_each_text(v_proposal.configuration->'targetsByParticipantId') LOOP
   v_ids := p_assignments->v_target.key;
   IF jsonb_typeof(v_ids) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_assignment_proposal'; END IF;
   IF jsonb_array_length(v_ids)<>v_target.value::integer OR
     (SELECT count(DISTINCT value) FROM jsonb_array_elements(v_ids))<>v_target.value::integer OR EXISTS(
       SELECT 1 FROM jsonb_array_elements(v_ids) x WHERE jsonb_typeof(x) IS DISTINCT FROM 'string' OR NOT(v_proposal.generation_input->'pool' @> jsonb_build_array(x))) THEN
     RAISE EXCEPTION 'invalid_assignment_proposal';
   END IF;
 END LOOP;
 IF v_proposal.sharing_policy='exact' THEN
   IF (v_proposal.generation_input->>'sharing')::integer=0 THEN
     IF EXISTS(SELECT 1 FROM jsonb_each(p_assignments) p CROSS JOIN LATERAL jsonb_array_elements_text(p.value) m GROUP BY m.value HAVING count(*)>1) THEN
       RAISE EXCEPTION 'invalid_assignment_proposal';
     END IF;
   ELSIF EXISTS(SELECT 1 FROM jsonb_each(p_assignments) a CROSS JOIN jsonb_each(p_assignments) b WHERE a.key<b.key AND
     (SELECT count(*) FROM jsonb_array_elements(a.value) m WHERE b.value @> jsonb_build_array(m.value))<>(v_proposal.generation_input->>'sharing')::integer) THEN
     RAISE EXCEPTION 'invalid_assignment_proposal';
   END IF;
 END IF;
 UPDATE private.assignment_proposals SET assignments=p_assignments,quality=p_quality,state='ready',ready_at=clock_timestamp(),expires_at=clock_timestamp()+interval '5 minutes'
 WHERE id=p_proposal_id RETURNING * INTO v_proposal;
 RETURN private.assignment_preview_response(v_proposal);
END;
$$;
REVOKE ALL ON FUNCTION private.store_room_assignment_proposal(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.store_room_assignment_proposal(proposal_id uuid,assignments jsonb,quality jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
SELECT private.store_room_assignment_proposal(proposal_id,assignments,quality);
$$;
REVOKE ALL ON FUNCTION public.store_room_assignment_proposal(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.store_room_assignment_proposal(uuid,jsonb,jsonb) TO service_role;

CREATE FUNCTION private.require_assignment_proposal(p_session_id uuid,p_proposal_id uuid,p_purpose text,p_expected_token text,p_accept_relaxed boolean)
RETURNS private.assignment_proposals LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_proposal private.assignment_proposals;
BEGIN
 SELECT * INTO v_proposal FROM private.assignment_proposals WHERE id=p_proposal_id AND session_id=p_session_id AND actor_account_id=auth.uid() AND purpose=p_purpose;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_assignment_proposal'; END IF;
 IF NOT v_proposal.is_current OR v_proposal.state<>'ready' THEN RAISE EXCEPTION 'assignment_proposal_superseded'; END IF;
 IF v_proposal.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'assignment_proposal_expired'; END IF;
 IF v_proposal.base_configuration_token IS DISTINCT FROM p_expected_token THEN RAISE EXCEPTION 'configuration_conflict'; END IF;
 IF v_proposal.requires_sharing_consent AND NOT coalesce(p_accept_relaxed,false) THEN RAISE EXCEPTION 'sharing_confirmation_required'; END IF;
 RETURN v_proposal;
END;
$$;
REVOKE ALL ON FUNCTION private.require_assignment_proposal(uuid,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.start_game_session_v2(p_session_id uuid,p_proposal_id uuid,p_expected_token text,p_idempotency_key uuid,p_accept_relaxed_sharing boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_room public.game_sessions; v_actor uuid; v_replay public.gameplay_command_results;
 v_fingerprint text:=md5(jsonb_build_array(p_proposal_id,p_expected_token,p_accept_relaxed_sharing)::text);
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
 IF NOT (v_plan->>'startable')::boolean THEN RAISE EXCEPTION 'insufficient_match_pool'; END IF;
 IF (SELECT sum(value::integer) FROM jsonb_each_text(v_targets))>10000 THEN RAISE EXCEPTION 'assignment_capacity_exceeded'; END IF;
 IF v_room.assignment_mode='automatic' THEN
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
   jsonb_build_object('assignmentPolicyVersion',2,'targetsByParticipantId',v_targets,'proposalId',p_proposal_id,'acceptRelaxedSharing',p_accept_relaxed_sharing,
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
REVOKE ALL ON FUNCTION private.start_game_session_v2(uuid,uuid,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.start_game_session_v2(session_id uuid,proposal_id uuid,expected_token text,idempotency_key uuid,accept_relaxed_sharing boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
SELECT private.start_game_session_v2(session_id,proposal_id,expected_token,idempotency_key,accept_relaxed_sharing);
$$;
REVOKE ALL ON FUNCTION public.start_game_session_v2(uuid,uuid,text,uuid,boolean) FROM PUBLIC,anon,authenticated;

ALTER FUNCTION private.write_room_picks(uuid,uuid,uuid[],uuid,integer) RENAME TO write_room_picks_v1;
CREATE FUNCTION private.write_room_picks(p_session_id uuid,p_participant_id uuid,p_match_ids uuid[],p_common_match_id uuid,p_cap integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cap integer:=p_cap;
BEGIN
 SELECT CASE WHEN gs.assignment_policy_version=2 THEN coalesce(p.additional_match_count,gs.matches_per_player) ELSE p_cap END
 INTO v_cap FROM public.participants p JOIN public.game_sessions gs ON gs.id=p.session_id WHERE p.session_id=p_session_id AND p.id=p_participant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'participant_not_in_room'; END IF;
 PERFORM private.write_room_picks_v1(p_session_id,p_participant_id,p_match_ids,p_common_match_id,v_cap);
END;
$$;
REVOKE ALL ON FUNCTION private.write_room_picks(uuid,uuid,uuid[],uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.write_room_picks(uuid,uuid,uuid[],uuid,integer) TO service_role;

-- Extend the newest protected running-save body; retain catalog drain/capacity and frozen history.
CREATE OR REPLACE FUNCTION private.save_running_game_configuration_v2(p_session_id uuid, p_configuration jsonb, p_proposal_id uuid, p_expected_token text, p_idempotency_key uuid, p_accept_relaxed_sharing boolean)
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
  v_fingerprint text := md5(jsonb_build_array(p_configuration, p_proposal_id, p_expected_token, p_accept_relaxed_sharing)::text);
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
  v_configuration := private.normalized_assignment_configuration(p_session_id,p_configuration);
  IF v_configuration->>'assignmentMode'='player_picked' THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  IF v_configuration->>'assignmentMode'='automatic' THEN
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
        'configuration', v_configuration, 'newMatchIds', v_map,'proposalId',p_proposal_id,'acceptRelaxedSharing',p_accept_relaxed_sharing));
  PERFORM private.assert_catalog_room_capacity(p_session_id);
  IF p_proposal_id IS NOT NULL THEN UPDATE private.assignment_proposals SET state='consumed',is_current=false,consumed_at=clock_timestamp() WHERE id=p_proposal_id; END IF;
  v_response := private.authoritative_snapshot(p_session_id);
  INSERT INTO public.gameplay_command_results(session_id, idempotency_key, command_type, actor_participant_id, request_fingerprint, response)
    VALUES(p_session_id, p_idempotency_key, 'save_running_configuration_v2', v_actor, v_fingerprint, v_response);
  RETURN v_response;
END;
$function$;

REVOKE ALL ON FUNCTION private.save_running_game_configuration_v2(uuid,jsonb,uuid,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.save_running_game_configuration_v2(session_id uuid,configuration jsonb,proposal_id uuid,expected_token text,idempotency_key uuid,accept_relaxed_sharing boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
SELECT private.save_running_game_configuration_v2(session_id,configuration,proposal_id,expected_token,idempotency_key,accept_relaxed_sharing);
$$;
REVOKE ALL ON FUNCTION public.save_running_game_configuration_v2(uuid,jsonb,uuid,text,uuid,boolean) FROM PUBLIC,anon,authenticated;

-- Keep the existing creation command legacy; maintained clients explicitly request v2.
CREATE FUNCTION private.create_room_as_host_v2() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_existing uuid; v_result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 -- Serialize the account's create calls so an old room is never silently adopted.
 PERFORM 1 FROM public.accounts WHERE id=auth.uid() FOR UPDATE;
 SELECT id INTO v_existing FROM public.game_sessions WHERE owner_account_id=auth.uid() AND state='joinable' LIMIT 1;
 v_result:=private.create_room_as_host();
 IF v_existing IS NULL THEN UPDATE public.game_sessions SET assignment_policy_version=2 WHERE id=(v_result->>'sessionId')::uuid; END IF;
 RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION private.create_room_as_host_v2() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.create_room_as_host_v2() RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$ SELECT private.create_room_as_host_v2(); $$;
REVOKE ALL ON FUNCTION public.create_room_as_host_v2() FROM PUBLIC,anon,authenticated;

ALTER FUNCTION private.set_room_assignments(uuid,jsonb) RENAME TO set_room_assignments_v1;
CREATE FUNCTION private.set_room_assignments(p_session_id uuid,p_assignments jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_room public.game_sessions;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 SELECT * INTO v_room FROM public.game_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
 IF v_room.owner_account_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_host'; END IF;
 IF v_room.assignment_policy_version=2 THEN
   IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' OR jsonb_array_length(p_assignments)>10000 THEN RAISE EXCEPTION 'invalid_assignment'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_assignments) a GROUP BY a->>'participantId' HAVING count(*) FILTER(WHERE a->>'matchId' IS DISTINCT FROM v_room.common_match_id::text)>
     (SELECT coalesce(p.additional_match_count,v_room.matches_per_player) FROM public.participants p WHERE p.id::text=a->>'participantId' AND p.session_id=p_session_id)) THEN
     RAISE EXCEPTION 'pick_limit_exceeded';
   END IF;
 END IF;
 PERFORM private.set_room_assignments_v1(p_session_id,p_assignments);
END;
$$;
REVOKE ALL ON FUNCTION private.set_room_assignments(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.set_room_assignments(uuid,jsonb) TO service_role;

-- A mode switch keeps target overrides and serializes with previews/start.
ALTER FUNCTION private.set_room_assignment_mode(uuid,text) RENAME TO set_room_assignment_mode_v1;
CREATE FUNCTION private.set_room_assignment_mode(p_session_id uuid,p_mode text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_room public.game_sessions;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 SELECT * INTO v_room FROM public.game_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
 IF v_room.owner_account_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_host'; END IF;
 IF p_mode IS NULL THEN RAISE EXCEPTION 'invalid_assignment_mode'; END IF;
 PERFORM private.set_room_assignment_mode_v1(p_session_id,p_mode);
END;
$$;
REVOKE ALL ON FUNCTION private.set_room_assignment_mode(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.set_room_assignment_mode(uuid,text) TO service_role;

-- Activate only after all versioned start/save/pick paths are present.
GRANT EXECUTE ON FUNCTION public.set_room_assignment_configuration_v2(uuid,jsonb,text,uuid),
 public.prepare_room_assignment_preview(uuid,text,jsonb,text),
 public.start_game_session_v2(uuid,uuid,text,uuid,boolean),
 public.save_running_game_configuration_v2(uuid,jsonb,uuid,text,uuid,boolean),
 public.create_room_as_host_v2() TO authenticated;

CREATE OR REPLACE FUNCTION private.build_guest_room_snapshot(p_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_snapshot jsonb; v_field text; v_rows jsonb; v_policy smallint;
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
  RETURN v_snapshot||jsonb_build_object('assignmentPolicyVersion',v_policy,
    'capabilities',jsonb_build_object('perPlayerMatchCounts',true,'assignmentPreview',true),
    'configurationToken',private.running_configuration_token(p_session_id));
END;
$$;
REVOKE ALL ON FUNCTION private.build_guest_room_snapshot(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.build_guest_room_snapshot(uuid) TO service_role;


-- This new non-secret field follows the table's existing room-membership RLS.
GRANT SELECT(additional_match_count) ON public.participants TO authenticated;
CREATE OR REPLACE VIEW public.completed_session_summaries WITH (security_invoker = true) AS
SELECT session_rollups.session_id,
  session_rollups.owner_account_id,
  session_rollups.completed_at,
  session_rollups.started_at,
  session_rollups.common_match_id,
  session_rollups.session_total_players,
  session_rollups.session_total_matches,
  session_rollups.session_total_goals,
  session_rollups.session_total_drinks,
  session_rollups.matches_per_player,
  COALESCE(players.players, '[]'::jsonb) AS players,
  COALESCE(matches.matches, '[]'::jsonb) AS matches,
  COALESCE(assignments.player_assignments, '{}'::jsonb) AS player_assignments,
  EXISTS (
    SELECT 1
    FROM public.gameplay_events AS events
    WHERE events.session_id = session_rollups.session_id
      AND events.event_type = 'assignment_reassigned'
  ) AS assignments_changed_during_play,
  gs.assignment_policy_version, gs.matches_per_player AS configured_default_match_count,
  CASE WHEN gs.assignment_policy_version=2 THEN (SELECT coalesce(jsonb_object_agg(p.id::text,p.additional_match_count) FILTER(WHERE p.additional_match_count IS NOT NULL),'{}') FROM public.participants p WHERE p.session_id=gs.id) END AS player_match_counts
FROM private._history_session_rollups AS session_rollups
JOIN public.game_sessions gs ON gs.id=session_rollups.session_id
LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', participants.participant_id,
        'accountId', participants.account_id,
        'name', participants.display_name,
        'drinksTaken', participants.current_drink_total,
        'membershipType', participants.membership_type,
        'leftAt', participants.left_at
      ) ORDER BY participants.created_at, participants.participant_id
    ),
    '[]'::jsonb
  ) AS players
  FROM private._history_completed_participants AS participants
  WHERE participants.session_id = session_rollups.session_id
) AS players ON TRUE
LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', matches.match_id,
        'catalogMatchId', matches.catalog_match_id::text,
        'catalogSnapshot', matches.catalog_snapshot,
        'sourceProvider', matches.source_provider,
        'sourceMatchId', matches.source_match_id,
        'homeTeam', matches.home_team_name,
        'awayTeam', matches.away_team_name,
        'kickoffAt', matches.kickoff_at,
        'homeGoals', matches.home_score,
        'awayGoals', matches.away_score,
        'goals', matches.total_goals
      ) ORDER BY matches.created_at, matches.match_id
    ),
    '[]'::jsonb
  ) AS matches
  FROM private._history_completed_matches AS matches
  WHERE matches.session_id = session_rollups.session_id
) AS matches ON TRUE
LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_object_agg(assignment_groups.participant_id::text, assignment_groups.match_ids),
    '{}'::jsonb
  ) AS player_assignments
  FROM (
    SELECT assignments.participant_id,
      jsonb_agg(assignments.match_id::text ORDER BY assignments.match_id) AS match_ids
    FROM private._history_completed_assignments AS assignments
    WHERE assignments.session_id = session_rollups.session_id
    GROUP BY assignments.participant_id
  ) AS assignment_groups
) AS assignments ON TRUE
ORDER BY session_rollups.completed_at DESC, session_rollups.session_id DESC;
