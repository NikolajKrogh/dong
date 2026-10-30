BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();
SELECT ok(has_function_privilege('authenticated','public.set_room_assignment_configuration_v2(uuid,jsonb,text,uuid)','EXECUTE'),
  'complete v2 adoption is available to authenticated hosts');
SELECT ok(NOT has_function_privilege('anon','public.set_room_assignment_configuration_v2(uuid,jsonb,text,uuid)','EXECUTE'),
  'anonymous callers cannot adopt v2');
-- Exercise the future command's host/replay contract without enabling it outside this rollback.
GRANT EXECUTE ON FUNCTION public.set_room_assignment_configuration_v2(uuid,jsonb,text,uuid) TO authenticated;
INSERT INTO auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous)
VALUES ('00000000-0000-4031-8000-000000000001','authenticated','authenticated','counts-host@test.local','{}','{}',false,false),
 ('00000000-0000-4031-8000-000000000002','authenticated','authenticated','counts-member@test.local','{}','{}',false,false);
INSERT INTO public.accounts(id,username) VALUES
 ('00000000-0000-4031-8000-000000000001','Counts_Host'),('00000000-0000-4031-8000-000000000002','Counts_Member');
INSERT INTO public.game_sessions(id,owner_account_id,join_code,assignment_mode)
VALUES ('00000000-0000-4031-8000-000000000010','00000000-0000-4031-8000-000000000001','COUNTS031','host_assigned');
UPDATE public.participants SET id='00000000-0000-4031-8000-000000000011'
WHERE session_id='00000000-0000-4031-8000-000000000010';
INSERT INTO public.participants(id,session_id,account_id,display_name,membership_type,session_role)
VALUES ('00000000-0000-4031-8000-000000000012','00000000-0000-4031-8000-000000000010','00000000-0000-4031-8000-000000000002','Alex','registered','member');
INSERT INTO public.matches(id,session_id,source_provider,home_team_name,away_team_name)
SELECT ('00000000-0000-4031-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-4031-8000-000000000010','manual','Home','Away'
FROM generate_series(20,23) i;
UPDATE public.game_sessions SET common_match_id='00000000-0000-4031-8000-000000000020' WHERE id='00000000-0000-4031-8000-000000000010';
CREATE TEMP TABLE counts_context(token text, config jsonb, key uuid, response jsonb);
GRANT ALL ON counts_context TO authenticated;
INSERT INTO counts_context SELECT private.running_configuration_token('00000000-0000-4031-8000-000000000010'),
 '{"assignmentPolicyVersion":2,"matchesPerPlayer":3,"sharedMatchesPerPair":1,"playerMatchCounts":{"00000000-0000-4031-8000-000000000012":0}}'::jsonb,gen_random_uuid(),null;
SELECT is((SELECT assignment_policy_version::integer FROM public.game_sessions WHERE id='00000000-0000-4031-8000-000000000010'),1,'migration leaves legacy rooms on policy1');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4031-8000-000000000002',true);
SELECT throws_ok($$SELECT public.set_room_assignment_configuration_v2('00000000-0000-4031-8000-000000000010',config,token,key) FROM counts_context$$,'P0001','not_host','members cannot edit targets');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4031-8000-000000000001',true);
UPDATE counts_context SET response=public.set_room_assignment_configuration_v2('00000000-0000-4031-8000-000000000010',config,token,key);
SELECT is((SELECT response->>'assignmentPolicyVersion' FROM counts_context),'2','explicit configuration adopts policy2');
SELECT is((SELECT response#>>'{capabilities,perPlayerMatchCounts}' FROM counts_context),'true','snapshot advertises complete start/save support');
SELECT is((SELECT response#>>'{assignmentPlan,targetsByParticipantId,00000000-0000-4031-8000-000000000012}' FROM counts_context),'0','zero is an override');
SELECT is((SELECT response#>>'{assignmentPlan,targetsByParticipantId,00000000-0000-4031-8000-000000000011}' FROM counts_context),'3','missing override follows default');
SELECT lives_ok($$SELECT public.set_room_assignment_configuration_v2('00000000-0000-4031-8000-000000000010',config,token,key) FROM counts_context$$,'accepted replay precedes stale-token validation');
SELECT throws_ok($$SELECT public.set_room_assignment_configuration_v2('00000000-0000-4031-8000-000000000010',jsonb_set(config,'{matchesPerPlayer}','2'),token,key) FROM counts_context$$,'P0001','idempotency_conflict','replay cannot change body');
SELECT throws_ok($$SELECT public.set_room_assignment_configuration_v2('00000000-0000-4031-8000-000000000010',config,token,gen_random_uuid()) FROM counts_context$$,'P0001','configuration_conflict','stale write rejects');
UPDATE counts_context SET token=response->>'configurationToken';
SELECT throws_ok($$SELECT public.set_room_assignment_configuration_v2('00000000-0000-4031-8000-000000000010',config-'playerMatchCounts',token,gen_random_uuid()) FROM counts_context$$,'P0001','invalid_assignment_settings','full replacement requires override map');
SELECT throws_ok($$SELECT public.set_room_assignment_configuration_v2('00000000-0000-4031-8000-000000000010',jsonb_set(config,'{matchesPerPlayer}','101'),token,gen_random_uuid()) FROM counts_context$$,'P0001','invalid_assignment_settings','edited count is bounded');
SELECT throws_ok($$SELECT public.set_room_assignment_configuration_v2('00000000-0000-4031-8000-000000000010',jsonb_set(config,'{playerMatchCounts}','{"00000000-0000-4031-8000-000000000099":1}'),token,gen_random_uuid()) FROM counts_context$$,'P0001','invalid_assignment_settings','unknown participant cannot receive an override');
SELECT throws_ok($$SELECT public.set_room_assignment_settings('00000000-0000-4031-8000-000000000010',2,1)$$,'P0001','assignment_policy_upgrade_required','old scalar writer cannot discard targets');
RESET ROLE;
INSERT INTO public.assignments(session_id,participant_id,match_id) VALUES
 ('00000000-0000-4031-8000-000000000010','00000000-0000-4031-8000-000000000011','00000000-0000-4031-8000-000000000021');
UPDATE counts_context SET token=private.running_configuration_token('00000000-0000-4031-8000-000000000010');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.set_room_assignment_configuration_v2('00000000-0000-4031-8000-000000000010',jsonb_set(config,'{matchesPerPlayer}','0'),token,gen_random_uuid()) FROM counts_context$$,'P0001','target_below_existing_selections','reducing a default validates inherited selections atomically');
SELECT is((SELECT response#>>'{assignmentPlan,targetsByParticipantId,00000000-0000-4031-8000-000000000011}' FROM counts_context),'3','failed reduction leaves prior response unchanged');
RESET ROLE;
SELECT is((SELECT matches_per_player FROM public.game_sessions WHERE id='00000000-0000-4031-8000-000000000010'),3,'failed reduction leaves canonical default unchanged');
UPDATE public.game_sessions SET common_match_id=null WHERE id='00000000-0000-4031-8000-000000000010';
UPDATE counts_context SET token=private.running_configuration_token('00000000-0000-4031-8000-000000000010');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.set_room_assignment_configuration_v2('00000000-0000-4031-8000-000000000010',jsonb_set(config,'{matchesPerPlayer}','0'),token,gen_random_uuid()) FROM counts_context$$,'P0001','target_below_existing_selections','reductions validate selections before a Common Match is chosen');
RESET ROLE;
UPDATE public.game_sessions SET common_match_id='00000000-0000-4031-8000-000000000020' WHERE id='00000000-0000-4031-8000-000000000010';
DELETE FROM public.assignments WHERE session_id='00000000-0000-4031-8000-000000000010';
UPDATE counts_context SET token=private.running_configuration_token('00000000-0000-4031-8000-000000000010'),config='{"assignmentPolicyVersion":2,"matchesPerPlayer":0,"sharedMatchesPerPair":1,"playerMatchCounts":{}}';
SET LOCAL ROLE authenticated;
UPDATE counts_context SET response=public.set_room_assignment_configuration_v2('00000000-0000-4031-8000-000000000010',config,token,gen_random_uuid());
SELECT is((SELECT response#>>'{assignmentPlan,sharingPolicy}' FROM counts_context),'common_only','zero targets bypass sharing without resetting preference');
SELECT is((SELECT response#>>'{assignmentPlan,sharedMatchesPerPair}' FROM counts_context),'1','stored sharing preference survives common-only');

RESET ROLE;
CREATE TEMP TABLE created_room(result jsonb);
GRANT ALL ON created_room TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000064',true);
INSERT INTO created_room SELECT public.create_room_as_host_v2();
RESET ROLE;
SELECT is((SELECT assignment_policy_version::integer FROM public.game_sessions WHERE id=(SELECT (result->>'sessionId')::uuid FROM created_room)),2,'explicit maintained creation creates a v2 room');
UPDATE public.game_sessions SET assignment_policy_version=1 WHERE id=(SELECT (result->>'sessionId')::uuid FROM created_room);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.create_room_as_host_v2()$$,'repeat creation recovers the existing room');
RESET ROLE;
SELECT is((SELECT assignment_policy_version::integer FROM public.game_sessions WHERE id=(SELECT (result->>'sessionId')::uuid FROM created_room)),1,'recovering an existing legacy room never silently adopts it');
SELECT has_index('private','assignment_proposals','assignment_proposals_actor_account','proposal owner FK has a covering index');
SELECT ok(EXISTS(SELECT 1 FROM public.gameplay_events WHERE session_id='00000000-0000-4031-8000-000000000010' AND payload->'previousConfiguration' IS NOT NULL AND payload->'targetsByParticipantId' IS NOT NULL),'target changes retain previous configuration and accepted targets');
SELECT * FROM finish();

ROLLBACK;
