-- Cover account-deletion FK checks without scanning every retained proposal.
CREATE INDEX assignment_proposals_actor_account ON private.assignment_proposals(actor_account_id);

-- Audit configuration changes and count selections even before a Common Match exists.
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
  IF EXISTS (SELECT 1 FROM jsonb_each_text(v_configuration->'targetsByParticipantId') t WHERE
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

-- Validate grouped individual caps before invoking the preserved allocation writer.
CREATE OR REPLACE FUNCTION private.set_room_assignments(p_session_id uuid,p_assignments jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_room public.game_sessions;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 SELECT * INTO v_room FROM public.game_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
 IF v_room.owner_account_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_host'; END IF;
 IF v_room.assignment_policy_version=2 THEN
   IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' OR jsonb_array_length(p_assignments)>10000 THEN RAISE EXCEPTION 'invalid_assignment'; END IF;
   IF EXISTS(SELECT 1 FROM (
     SELECT a->>'participantId' AS participant_id,count(*) FILTER(WHERE a->>'matchId' IS DISTINCT FROM v_room.common_match_id::text) AS selected_count
     FROM jsonb_array_elements(p_assignments) a GROUP BY a->>'participantId'
   ) selected JOIN public.participants p ON p.id::text=selected.participant_id AND p.session_id=p_session_id
   WHERE selected.selected_count>coalesce(p.additional_match_count,v_room.matches_per_player)) THEN
     RAISE EXCEPTION 'pick_limit_exceeded';
   END IF;
 END IF;
 PERFORM private.set_room_assignments_v1(p_session_id,p_assignments);
END;
$$;
REVOKE ALL ON FUNCTION private.set_room_assignments(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.set_room_assignments(uuid,jsonb) TO service_role;

