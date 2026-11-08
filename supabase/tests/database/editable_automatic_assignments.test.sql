BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();
INSERT INTO public.game_sessions(id,owner_account_id,join_code,assignment_policy_version,assignment_mode,matches_per_player,shared_matches_per_pair)
VALUES('00000000-0000-4033-8000-000000000001','00000000-0000-4000-8000-000000000001','EDIT033',2,'automatic',1,1);
UPDATE public.participants SET id='00000000-0000-4033-8000-000000000002' WHERE session_id='00000000-0000-4033-8000-000000000001';
INSERT INTO public.participants(id,session_id,account_id,display_name,membership_type,session_role)
VALUES('00000000-0000-4033-8000-000000000003','00000000-0000-4033-8000-000000000001','00000000-0000-4000-8000-000000000002','Member','registered','member');
INSERT INTO public.matches(id,session_id,source_provider,home_team_name,away_team_name)
SELECT ('00000000-0000-4033-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-4033-8000-000000000001','manual','Home','Away' FROM generate_series(10,13) n;
UPDATE public.game_sessions SET common_match_id='00000000-0000-4033-8000-000000000010' WHERE join_code='EDIT033';
CREATE TEMP TABLE edit_context(room uuid,token text,key uuid,picks jsonb,response jsonb,config jsonb);
GRANT ALL ON edit_context TO authenticated;
INSERT INTO edit_context SELECT gs.id,private.running_configuration_token(gs.id),gen_random_uuid(),
 '[{"participantId":"00000000-0000-4033-8000-000000000002","matchId":"00000000-0000-4033-8000-000000000011"},{"participantId":"00000000-0000-4033-8000-000000000003","matchId":"00000000-0000-4033-8000-000000000012"}]',null,
 '{"assignmentPolicyVersion":2,"assignmentMode":"automatic","matchesPerPlayer":1,"sharedMatchesPerPair":1,"playerMatchCounts":{},"newMatches":[],"assignments":[]}'
 FROM public.game_sessions gs WHERE join_code='EDIT033';
INSERT INTO public.assignments(session_id,participant_id,match_id)
SELECT room,(picks->0->>'participantId')::uuid,(picks->0->>'matchId')::uuid FROM edit_context;
UPDATE edit_context SET token=private.running_configuration_token(room);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT throws_ok($$SELECT public.start_game_session_v2(room,null,token,key,false,picks) FROM edit_context$$,'P0001','not_host','members cannot commit host overrides');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT lives_ok($$UPDATE edit_context SET response=public.set_room_assignment_configuration_v2(room,jsonb_set(config,'{matchesPerPlayer}','0'),token,gen_random_uuid())$$,'host count reductions allow temporary over-selection');
SELECT is((SELECT count(*)::integer FROM public.assignments WHERE session_id=(SELECT room FROM edit_context)),1,'count changes preserve existing selections');
UPDATE edit_context SET response=public.set_room_assignment_configuration_v2(room,config,response->>'configurationToken',gen_random_uuid());
UPDATE edit_context SET token=response->>'configurationToken';
SELECT throws_ok($$SELECT public.start_game_session_v2(room,null,'stale',key,false,picks) FROM edit_context$$,'P0001','configuration_conflict','stale revisions are rejected');
SELECT throws_ok($$SELECT public.start_game_session_v2(room,key,token,key,false,picks) FROM edit_context$$,'P0001','invalid_configuration','proposal and overrides cannot be mixed');
SELECT throws_ok($$SELECT public.start_game_session_v2(room,null,token,key,false,picks||jsonb_build_array(picks->0)) FROM edit_context$$,'P0001','invalid_assignment','duplicate selections are rejected');
SELECT throws_ok($$SELECT public.start_game_session_v2(room,null,token,key,false,'[]') FROM edit_context$$,'P0001','assignment_count_mismatch','incomplete selections are never filled silently');
SELECT throws_ok($$SELECT public.start_game_session_v2(room,null,token,key,false,jsonb_set(picks,'{0,matchId}','"00000000-0000-4033-8000-000000000099"')) FROM edit_context$$,'P0001','invalid_assignment','foreign matches are rejected');
UPDATE edit_context SET response=public.start_game_session_v2(room,null,token,key,false,picks);
SELECT is((SELECT response->>'assignmentMode' FROM edit_context),'automatic','manual overrides keep Automatic mode');
SELECT is((SELECT response#>>'{capabilities,editableAutomaticAssignments}' FROM edit_context),'true','capability is advertised');
SELECT lives_ok($$SELECT public.start_game_session_v2(room,null,token,key,false,picks) FROM edit_context$$,'accepted retry replays after the room has started');
SELECT throws_ok($$SELECT public.start_game_session_v2(room,null,token,key,false,'[]') FROM edit_context$$,'P0001','idempotency_conflict','override contents belong to retry identity');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.assignments WHERE session_id=(SELECT room FROM edit_context)),4,'exact edited picks plus common are persisted');
SELECT is((SELECT count(*)::integer FROM public.assignments a JOIN public.assignments b USING(session_id,match_id) WHERE a.participant_id='00000000-0000-4033-8000-000000000002' AND b.participant_id='00000000-0000-4033-8000-000000000003'),1,'manual overlap may differ from automatic sharing; only common is shared');
UPDATE edit_context SET token=private.running_configuration_token(room),key=gen_random_uuid(),picks=jsonb_set(picks,'{0,matchId}','"00000000-0000-4033-8000-000000000013"');
SET LOCAL ROLE authenticated;
UPDATE edit_context SET response=public.save_running_game_configuration_v2(room,config,null,token,key,false,picks);
SELECT is((SELECT response->>'assignmentMode' FROM edit_context),'automatic','running save retains Automatic mode');
SELECT lives_ok($$SELECT public.save_running_game_configuration_v2(room,config,null,token,key,false,picks) FROM edit_context$$,'running save retry is idempotent');
RESET ROLE;
SELECT ok(EXISTS(SELECT FROM public.assignments WHERE session_id=(SELECT room FROM edit_context) AND match_id='00000000-0000-4033-8000-000000000013'),'running save keeps the edited fixture');
SELECT ok(NOT EXISTS(SELECT FROM public.assignments WHERE session_id=(SELECT room FROM edit_context) AND match_id='00000000-0000-4033-8000-000000000011'),'running save does not restore the replaced fixture');
SELECT ok(EXISTS(SELECT FROM public.gameplay_events WHERE session_id=(SELECT room FROM edit_context) AND payload->'assignmentOverrides' IS NOT NULL),'history records explicit selections');
SELECT * FROM finish();
ROLLBACK;
