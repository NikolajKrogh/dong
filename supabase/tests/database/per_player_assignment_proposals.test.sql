BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();
SELECT ok(NOT has_table_privilege('authenticated','private.assignment_proposals','INSERT'),'clients cannot forge proposal storage');
SELECT ok(NOT has_function_privilege('authenticated','public.store_room_assignment_proposal(uuid,jsonb,jsonb)','EXECUTE'),'clients cannot publish solver results');
GRANT EXECUTE ON FUNCTION public.prepare_room_assignment_preview(uuid,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_session_v2(uuid,uuid,text,uuid,boolean) TO authenticated;
INSERT INTO public.game_sessions(id,owner_account_id,join_code,assignment_policy_version,matches_per_player,shared_matches_per_pair)
VALUES('00000000-0000-4031-9000-000000000001','00000000-0000-4000-8000-000000000001','PROP031',2,1,0);
INSERT INTO public.matches(id,session_id,source_provider,home_team_name,away_team_name)
SELECT ('00000000-0000-4031-9000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-4031-9000-000000000001','manual','Home','Away'
FROM generate_series(10,13) n;
UPDATE public.game_sessions SET common_match_id='00000000-0000-4031-9000-000000000010' WHERE id='00000000-0000-4031-9000-000000000001';
CREATE TEMP TABLE proposal_context(room uuid,token text,config jsonb,first_id uuid,second_id uuid,participant uuid,key uuid,response jsonb);
GRANT ALL ON proposal_context TO authenticated;
INSERT INTO proposal_context SELECT gs.id,private.running_configuration_token(gs.id),
 '{"assignmentPolicyVersion":2,"assignmentMode":"automatic","matchesPerPlayer":1,"sharedMatchesPerPair":0,"playerMatchCounts":{},"newMatches":[],"assignments":[]}',
 null,null,p.id,gen_random_uuid(),null FROM public.game_sessions gs JOIN public.participants p ON p.session_id=gs.id WHERE gs.join_code='PROP031';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT throws_ok($$SELECT public.prepare_room_assignment_preview(room,'start',config,token) FROM proposal_context$$,'P0001','not_host','nonhost cannot reserve expensive work');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
UPDATE proposal_context SET first_id=(public.prepare_room_assignment_preview(room,'start',config,token)->>'proposalId')::uuid;
SELECT is((SELECT public.prepare_room_assignment_preview(room,'start',config,token)->>'issue' FROM proposal_context),'preview_pending','identical preparing requests coalesce');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM private.assignment_proposals WHERE is_current),1,'one current reservation');
UPDATE private.assignment_proposals SET created_at=clock_timestamp()-interval '3 seconds',lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=(SELECT first_id FROM proposal_context);
SET LOCAL ROLE authenticated;
UPDATE proposal_context SET second_id=(public.prepare_room_assignment_preview(room,'start',config,token)->>'proposalId')::uuid;
RESET ROLE;
SELECT isnt((SELECT first_id FROM proposal_context),(SELECT second_id FROM proposal_context),'new admission reserves a new identity');
SELECT throws_ok($$SELECT public.store_room_assignment_proposal(first_id,'{}','{"quality":"fallback","summaryComplete":true,"totalDeviation":0,"exactPreferenceAchieved":true,"reason":null}') FROM proposal_context$$,'P0001','assignment_proposal_superseded','late work cannot replace a newer reservation');
SELECT throws_ok($$SELECT public.store_room_assignment_proposal(second_id,jsonb_build_object(participant::text,jsonb_build_array('bad-match')),'{"quality":"fallback","summaryComplete":true,"totalDeviation":0,"exactPreferenceAchieved":true,"reason":null}') FROM proposal_context$$,'P0001','invalid_assignment_proposal','publication independently validates pool membership');
UPDATE proposal_context SET response=public.store_room_assignment_proposal(second_id,jsonb_build_object(participant::text,jsonb_build_array('00000000-0000-4031-9000-000000000011')),'{"quality":"fallback","summaryComplete":true,"totalDeviation":0,"exactPreferenceAchieved":true,"reason":null}');
SET LOCAL ROLE authenticated;
SELECT is((SELECT public.prepare_room_assignment_preview(room,'start',config,token)->>'proposalId' FROM proposal_context),(SELECT second_id::text FROM proposal_context),'identical ready input reuses actual assignments');
UPDATE proposal_context SET response=public.start_game_session_v2(room,second_id,token,key,false);
SELECT is((SELECT response->>'state' FROM proposal_context),'in_progress','v2 start accepts the reviewed proposal');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.assignments WHERE session_id=(SELECT room FROM proposal_context)),2,'exact target plus common match is persisted');
DELETE FROM private.assignment_proposals WHERE session_id=(SELECT room FROM proposal_context);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.start_game_session_v2(room,second_id,token,key,false) FROM proposal_context$$,'accepted replay survives expired/deleted proposal and old fence');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
