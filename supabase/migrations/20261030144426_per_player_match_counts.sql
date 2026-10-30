-- Existing sessions keep legacy generation until an explicit host adoption.
ALTER TABLE public.game_sessions ADD COLUMN assignment_policy_version smallint NOT NULL DEFAULT 1
  CHECK (assignment_policy_version IN (1,2));
ALTER TABLE public.participants ADD COLUMN additional_match_count integer
  CHECK (additional_match_count BETWEEN 0 AND 100);

CREATE FUNCTION private.normalized_assignment_configuration(p_session_id uuid, p_configuration jsonb)
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
  IF v_mode='automatic' AND v_max>0 AND v_max=v_min AND v_max<v_shared*(v_n-1) THEN
    RAISE EXCEPTION 'per_player_count_below_minimum';
  END IF;
  RETURN jsonb_build_object('assignmentPolicyVersion',2,'assignmentMode',v_mode,'matchesPerPlayer',v_count,
    'sharedMatchesPerPair',v_shared,'playerMatchCounts',v_map,'targetsByParticipantId',v_targets,
    'sharingPolicy',CASE WHEN v_max=0 THEN 'common_only' WHEN v_max=v_min THEN 'exact' ELSE 'preference' END,
    'newMatches',coalesce(p_configuration->'newMatches','[]'::jsonb),
    'assignments',coalesce(p_configuration->'assignments','[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION private.normalized_assignment_configuration(uuid,jsonb) FROM PUBLIC,anon,authenticated;

ALTER FUNCTION private.compute_room_assignment_plan(uuid) RENAME TO compute_room_assignment_plan_v1;
CREATE FUNCTION private.compute_room_assignment_plan(p_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_room public.game_sessions; v_targets jsonb; v_n integer; v_max integer; v_min integer;
  v_pool integer; v_required integer; v_valid boolean; v_policy text;
BEGIN
  SELECT * INTO v_room FROM public.game_sessions WHERE id=p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.assignment_policy_version=1 THEN RETURN private.compute_room_assignment_plan_v1(p_session_id); END IF;
  SELECT coalesce(jsonb_object_agg(p.id::text,coalesce(p.additional_match_count,v_room.matches_per_player)),'{}'),
    count(*),coalesce(max(coalesce(p.additional_match_count,v_room.matches_per_player)),0),
    coalesce(min(coalesce(p.additional_match_count,v_room.matches_per_player)),0)
  INTO v_targets,v_n,v_max,v_min FROM public.participants p WHERE p.session_id=p_session_id
    AND private.is_active_room_roster_member(p.membership_type::text,p.left_at,p.guest_rejoin_token_hash,p.guest_grant_expires_at);
  SELECT count(*) INTO v_pool FROM public.matches WHERE session_id=p_session_id;
  v_policy := CASE WHEN v_max=0 THEN 'common_only' WHEN v_max=v_min THEN 'exact' ELSE 'preference' END;
  v_valid := v_n>0 AND (v_room.assignment_mode<>'automatic' OR v_max=0 OR v_max<>v_min
    OR v_max>=v_room.shared_matches_per_pair*(v_n-1));
  v_required := 1+v_max;
  IF v_room.assignment_mode='automatic' AND v_policy='exact' AND v_valid THEN
    v_required := 1+v_room.shared_matches_per_pair*v_n*(v_n-1)/2
      +v_n*(v_max-v_room.shared_matches_per_pair*(v_n-1));
  END IF;
  RETURN jsonb_build_object('participantCount',v_n,'poolSize',v_pool,'matchesPerPlayer',v_room.matches_per_player,
    'sharedMatchesPerPair',v_room.shared_matches_per_pair,'effectivePerPlayer',v_max,'requiredPoolSize',v_required,
    'relaxedFloor',1+v_max,'feasible',v_valid AND v_pool>=v_required,'startable',v_valid AND v_pool>=1+v_max,
    'targetsByParticipantId',v_targets,'sharingPolicy',v_policy);
END;
$$;
REVOKE ALL ON FUNCTION private.compute_room_assignment_plan(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.compute_room_assignment_plan(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.running_configuration_token(p_session_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT md5(jsonb_build_object('owner',gs.owner_account_id,'state',gs.state,'common',gs.common_match_id,
  'mode',gs.assignment_mode,'count',gs.matches_per_player,'shared',gs.shared_matches_per_pair,'policy',gs.assignment_policy_version,
  'roster',(SELECT jsonb_agg(jsonb_build_array(p.id,p.session_role,p.additional_match_count) ORDER BY p.id)
    FROM public.participants p WHERE p.session_id=gs.id AND
      private.is_active_room_roster_member(p.membership_type::text,p.left_at,p.guest_rejoin_token_hash,p.guest_grant_expires_at)),
  'pool',(SELECT jsonb_agg(m.id ORDER BY m.id) FROM public.matches m WHERE m.session_id=gs.id),
  'assignments',(SELECT jsonb_agg(jsonb_build_array(a.participant_id,a.match_id) ORDER BY a.participant_id,a.match_id)
    FROM public.assignments a WHERE a.session_id=gs.id),
  'picks',(SELECT jsonb_agg(jsonb_build_array(a.participant_id,a.match_id) ORDER BY a.participant_id,a.match_id)
    FROM public.assignment_picks a WHERE a.session_id=gs.id))::text)
FROM public.game_sessions gs WHERE gs.id=p_session_id;
$$;

-- Decorate the current frozen-catalog snapshot; retain its provider/history projection.
ALTER FUNCTION private.build_guest_room_snapshot(uuid) RENAME TO build_guest_room_snapshot_v1;
CREATE FUNCTION private.build_guest_room_snapshot(p_session_id uuid) RETURNS jsonb
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
    'capabilities',jsonb_build_object('perPlayerMatchCounts',false,'assignmentPreview',false),
    'configurationToken',private.running_configuration_token(p_session_id));
END;
$$;
REVOKE ALL ON FUNCTION private.build_guest_room_snapshot(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.build_guest_room_snapshot(uuid) TO service_role;

CREATE FUNCTION private.set_room_assignment_configuration_v2(p_session_id uuid,p_configuration jsonb,p_expected_token text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_room public.game_sessions; v_actor uuid; v_configuration jsonb; v_response jsonb;
  v_fingerprint text := md5(jsonb_build_array(p_configuration,p_expected_token)::text);
  v_replay public.gameplay_command_results;
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
  v_configuration := private.normalized_assignment_configuration(p_session_id,
    p_configuration||jsonb_build_object('assignmentMode',v_room.assignment_mode));
  IF EXISTS (SELECT 1 FROM jsonb_each_text(v_configuration->'targetsByParticipantId') t WHERE
    (SELECT count(*) FROM public.assignments a WHERE a.session_id=p_session_id AND a.participant_id::text=t.key AND a.match_id<>v_room.common_match_id)>t.value::integer
    OR (SELECT count(*) FROM public.assignment_picks a WHERE a.session_id=p_session_id AND a.participant_id::text=t.key AND a.match_id<>v_room.common_match_id)>t.value::integer) THEN
    RAISE EXCEPTION 'target_below_existing_selections';
  END IF;
  UPDATE public.participants p SET additional_match_count=(v_configuration#>>ARRAY['playerMatchCounts',p.id::text])::integer
    WHERE p.session_id=p_session_id AND v_configuration->'targetsByParticipantId' ? p.id::text;
  UPDATE public.game_sessions SET assignment_policy_version=2,matches_per_player=(v_configuration->>'matchesPerPlayer')::integer,
    shared_matches_per_pair=(v_configuration->>'sharedMatchesPerPair')::integer WHERE id=p_session_id;
  INSERT INTO public.gameplay_events(session_id,sequence_number,actor_participant_id,event_type,idempotency_key,payload)
  VALUES(p_session_id,public.allocate_event_sequence(p_session_id),v_actor,'assignment_replaced',p_idempotency_key::text,
    jsonb_build_object('configurationOnly',true,'configuration',v_configuration,'previousPolicyVersion',v_room.assignment_policy_version,
      'assignments',(SELECT coalesce(jsonb_agg(jsonb_build_object('participantId',a.participant_id,'matchId',a.match_id)),'[]')
        FROM public.assignments a WHERE a.session_id=p_session_id)));
  v_response := private.authoritative_snapshot(p_session_id);
  INSERT INTO public.gameplay_command_results(session_id,idempotency_key,command_type,actor_participant_id,request_fingerprint,response)
    VALUES(p_session_id,p_idempotency_key,'set_assignment_configuration_v2',v_actor,v_fingerprint,v_response);
  RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION private.set_room_assignment_configuration_v2(uuid,jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.set_room_assignment_configuration_v2(session_id uuid,configuration jsonb,expected_token text,idempotency_key uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
SELECT private.set_room_assignment_configuration_v2(session_id,configuration,expected_token,idempotency_key);
$$;
REVOKE ALL ON FUNCTION public.set_room_assignment_configuration_v2(uuid,jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
-- Enable the new writer in a follow-up migration once v2 start/save are complete.

ALTER FUNCTION private.set_room_assignment_settings(uuid,integer,integer) RENAME TO set_room_assignment_settings_v1;
CREATE FUNCTION private.set_room_assignment_settings(p_session_id uuid,p_matches_per_player integer,p_shared_matches_per_pair integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.game_sessions WHERE id=p_session_id AND assignment_policy_version=2) THEN
    RAISE EXCEPTION 'assignment_policy_upgrade_required';
  END IF;
  PERFORM private.set_room_assignment_settings_v1(p_session_id,p_matches_per_player,p_shared_matches_per_pair);
END;
$$;
REVOKE ALL ON FUNCTION private.set_room_assignment_settings(uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.set_room_assignment_settings(uuid,integer,integer) TO service_role;

ALTER FUNCTION private.start_game_session(uuid,uuid,boolean) RENAME TO start_game_session_v1;
CREATE FUNCTION private.start_game_session(p_session_id uuid,p_idempotency_key uuid,p_relax_constraints boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.game_sessions WHERE id=p_session_id AND assignment_policy_version=2) THEN
    RAISE EXCEPTION 'assignment_policy_upgrade_required';
  END IF;
  RETURN private.start_game_session_v1(p_session_id,p_idempotency_key,p_relax_constraints);
END;
$$;
REVOKE ALL ON FUNCTION private.start_game_session(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.start_game_session(uuid,uuid,boolean) TO service_role;

ALTER FUNCTION private.save_running_game_configuration(uuid,jsonb,text,uuid) RENAME TO save_running_game_configuration_v1;
CREATE FUNCTION private.save_running_game_configuration(p_session_id uuid,p_configuration jsonb,p_expected_token text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.game_sessions WHERE id=p_session_id AND assignment_policy_version=2) THEN
    RAISE EXCEPTION 'assignment_policy_upgrade_required';
  END IF;
  RETURN private.save_running_game_configuration_v1(p_session_id,p_configuration,p_expected_token,p_idempotency_key);
END;
$$;
REVOKE ALL ON FUNCTION private.save_running_game_configuration(uuid,jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.save_running_game_configuration(uuid,jsonb,text,uuid) TO service_role;
