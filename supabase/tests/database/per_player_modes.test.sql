BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();
INSERT INTO public.game_sessions(id,owner_account_id,join_code,assignment_policy_version,assignment_mode,matches_per_player)
VALUES('00000000-0000-4031-a000-000000000001','00000000-0000-4000-8000-000000000001','PICKS031',2,'player_picked',3);
UPDATE public.participants SET id='00000000-0000-4031-a000-000000000002' WHERE session_id='00000000-0000-4031-a000-000000000001';
INSERT INTO public.participants(id,session_id,account_id,display_name,membership_type,session_role,additional_match_count) VALUES
('00000000-0000-4031-a000-000000000003','00000000-0000-4031-a000-000000000001','00000000-0000-4000-8000-000000000002','Member','registered','member',1);
INSERT INTO public.participants(id,session_id,display_name,membership_type,session_role,additional_match_count,guest_rejoin_token_hash) VALUES
('00000000-0000-4031-a000-000000000004','00000000-0000-4031-a000-000000000001','Guest','guest','member',0,encode(extensions.digest('counts-guest-token','sha256'),'hex'));
INSERT INTO public.matches(id,session_id,source_provider,home_team_name,away_team_name)
SELECT ('00000000-0000-4031-a000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-4031-a000-000000000001','manual','Home','Away' FROM generate_series(10,13) n;
UPDATE public.game_sessions SET common_match_id='00000000-0000-4031-a000-000000000010' WHERE join_code='PICKS031';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT public.set_room_assignment_mode('00000000-0000-4031-a000-000000000001','host_assigned');
SELECT throws_ok($$SELECT public.set_room_assignments('00000000-0000-4031-a000-000000000001','[{"participantId":"00000000-0000-4031-a000-000000000003","matchId":"00000000-0000-4031-a000-000000000011"},{"participantId":"00000000-0000-4031-a000-000000000003","matchId":"00000000-0000-4031-a000-000000000012"}]')$$,'P0001','pick_limit_exceeded','host cannot allocate above an individual target');
SELECT is((public.get_room_snapshot('00000000-0000-4031-a000-000000000001')#>>'{assignmentPlan,targetsByParticipantId,00000000-0000-4031-a000-000000000004}'),'0','mode changes retain a zero override');
SELECT public.set_room_assignment_mode('00000000-0000-4031-a000-000000000001','player_picked');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT lives_ok($$SELECT public.set_my_room_picks('00000000-0000-4031-a000-000000000001',ARRAY['00000000-0000-4031-a000-000000000011']::uuid[])$$,'member may select its own one match');
SELECT throws_ok($$SELECT public.set_my_room_picks('00000000-0000-4031-a000-000000000001',ARRAY['00000000-0000-4031-a000-000000000011','00000000-0000-4031-a000-000000000012']::uuid[])$$,'P0001','pick_limit_exceeded','member cannot use the larger default cap');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT throws_ok($$SELECT public.set_my_room_picks_as_guest('counts-guest-token',ARRAY['00000000-0000-4031-a000-000000000011']::uuid[])$$,'P0001','pick_limit_exceeded','zero-target guest cannot select additional matches');
SELECT lives_ok($$SELECT public.set_my_room_picks_as_guest('counts-guest-token',ARRAY[]::uuid[])$$,'zero-target guest may release all picks');
RESET ROLE;
CREATE TEMP TABLE mode_context(token text,key uuid,response jsonb);
INSERT INTO mode_context SELECT private.running_configuration_token('00000000-0000-4031-a000-000000000001'),gen_random_uuid(),null;
GRANT ALL ON mode_context TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
UPDATE mode_context SET response=public.start_game_session_v2('00000000-0000-4031-a000-000000000001',null,token,key,false);
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.assignments WHERE participant_id='00000000-0000-4031-a000-000000000002'),4,'start fills the host to three plus common');
SELECT is((SELECT count(*)::integer FROM public.assignments WHERE participant_id='00000000-0000-4031-a000-000000000003'),2,'start retains one member choice plus common');
SELECT ok(EXISTS(SELECT 1 FROM public.assignments WHERE participant_id='00000000-0000-4031-a000-000000000003' AND match_id='00000000-0000-4031-a000-000000000011'),'selected member match is retained');
SELECT is((SELECT count(*)::integer FROM public.assignments WHERE participant_id='00000000-0000-4031-a000-000000000004'),1,'zero guest receives common only');

INSERT INTO public.game_sessions(id,owner_account_id,join_code,assignment_policy_version,matches_per_player,shared_matches_per_pair)
VALUES('00000000-0000-4031-b000-000000000001','00000000-0000-4000-8000-000000000001','CONSENT031',2,2,1);
UPDATE public.participants SET id='00000000-0000-4031-b000-000000000002' WHERE session_id='00000000-0000-4031-b000-000000000001';
INSERT INTO public.participants(id,session_id,account_id,display_name,membership_type,session_role) VALUES
('00000000-0000-4031-b000-000000000003','00000000-0000-4031-b000-000000000001','00000000-0000-4000-8000-000000000002','Member','registered','member');
INSERT INTO public.matches(id,session_id,source_provider,home_team_name,away_team_name)
SELECT ('00000000-0000-4031-b000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-4031-b000-000000000001','manual','Home','Away' FROM generate_series(10,12) n;
UPDATE public.game_sessions SET common_match_id='00000000-0000-4031-b000-000000000010' WHERE join_code='CONSENT031';
CREATE TEMP TABLE consent_context(token text,key uuid,config jsonb,proposal uuid,response jsonb);
INSERT INTO consent_context SELECT private.running_configuration_token('00000000-0000-4031-b000-000000000001'),gen_random_uuid(),
'{"assignmentPolicyVersion":2,"assignmentMode":"automatic","matchesPerPlayer":2,"sharedMatchesPerPair":1,"playerMatchCounts":{},"newMatches":[],"assignments":[]}',null,null;
GRANT ALL ON consent_context TO authenticated;
SET LOCAL ROLE authenticated;
UPDATE consent_context SET proposal=(public.prepare_room_assignment_preview('00000000-0000-4031-b000-000000000001','start',config,token)->>'proposalId')::uuid;
RESET ROLE;
SELECT ok((SELECT requires_sharing_consent FROM private.assignment_proposals WHERE id=(SELECT proposal FROM consent_context)),'strict-equal shortfall reserves explicit relaxed consent');
SELECT throws_ok($$SELECT public.store_room_assignment_proposal(proposal,'{}','{"quality":"made_up"}') FROM consent_context$$,'P0001','invalid_assignment_proposal','publication rejects forged quality');
UPDATE consent_context SET response=public.store_room_assignment_proposal(proposal,
'{"00000000-0000-4031-b000-000000000002":["00000000-0000-4031-b000-000000000011","00000000-0000-4031-b000-000000000012"],"00000000-0000-4031-b000-000000000003":["00000000-0000-4031-b000-000000000011","00000000-0000-4031-b000-000000000012"]}',
'{"quality":"best_effort","summaryComplete":true,"totalDeviation":1,"exactPreferenceAchieved":false,"reason":null}');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.start_game_session_v2('00000000-0000-4031-b000-000000000001',proposal,token,key,false) FROM consent_context$$,'P0001','sharing_confirmation_required','sharing never relaxes without proposal-specific consent');
RESET ROLE;
UPDATE private.assignment_proposals SET expires_at=clock_timestamp()-interval '1 second' WHERE id=(SELECT proposal FROM consent_context);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.start_game_session_v2('00000000-0000-4031-b000-000000000001',proposal,token,key,true) FROM consent_context$$,'P0001','assignment_proposal_expired','expired preview cannot start');
RESET ROLE;
UPDATE private.assignment_proposals SET expires_at=clock_timestamp()+interval '1 minute' WHERE id=(SELECT proposal FROM consent_context);
SET LOCAL ROLE authenticated;
UPDATE consent_context SET response=public.start_game_session_v2('00000000-0000-4031-b000-000000000001',proposal,token,key,true);
RESET ROLE;
SELECT is((SELECT response->>'state' FROM consent_context),'in_progress','confirmed preview starts with fixed counts');
SELECT ok(EXISTS(SELECT 1 FROM public.gameplay_events WHERE session_id='00000000-0000-4031-b000-000000000001' AND event_type='assignment_replaced' AND payload->>'acceptRelaxedSharing'='true'),'accepted consent is audited');

UPDATE public.matches SET home_score=2 WHERE id='00000000-0000-4031-b000-000000000011';
UPDATE public.participants SET current_drink_total=3 WHERE id='00000000-0000-4031-b000-000000000002';
UPDATE consent_context SET token=private.running_configuration_token('00000000-0000-4031-b000-000000000001'), key=gen_random_uuid(),
 config='{"assignmentPolicyVersion":2,"assignmentMode":"automatic","matchesPerPlayer":1,"sharedMatchesPerPair":1,"playerMatchCounts":{"00000000-0000-4031-b000-000000000003":0},"newMatches":[{"clientId":"draft-added","sourceProvider":"manual","sourceMatchId":null,"homeTeamName":"New Home","awayTeamName":"New Away","kickoffAt":null}],"assignments":[]}';
UPDATE private.assignment_proposals SET created_at=clock_timestamp()-interval '3 seconds' WHERE session_id='00000000-0000-4031-b000-000000000001';
SET LOCAL ROLE authenticated;
UPDATE consent_context SET proposal=(public.prepare_room_assignment_preview('00000000-0000-4031-b000-000000000001','running_save',config,token)->>'proposalId')::uuid;
RESET ROLE;
UPDATE consent_context SET response=public.store_room_assignment_proposal(proposal,
'{"00000000-0000-4031-b000-000000000002":["new:draft-added"],"00000000-0000-4031-b000-000000000003":[]}',
'{"quality":"fallback","summaryComplete":true,"totalDeviation":1,"exactPreferenceAchieved":false,"reason":"solver_unavailable"}');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.save_running_game_configuration_v2('00000000-0000-4031-b000-000000000001',jsonb_set(config,'{matchesPerPlayer}','2'),proposal,token,key,false) FROM consent_context$$,'P0001','configuration_conflict','running save cannot substitute a different draft for the reviewed proposal');
UPDATE consent_context SET response=public.save_running_game_configuration_v2('00000000-0000-4031-b000-000000000001',config,proposal,token,key,false);
SELECT lives_ok($$SELECT public.save_running_game_configuration_v2('00000000-0000-4031-b000-000000000001',config,proposal,token,key,false) FROM consent_context$$,'running automatic save replays after its proposal was consumed');
RESET ROLE;
SELECT ok(EXISTS(SELECT 1 FROM public.assignments a JOIN public.matches m ON m.id=a.match_id WHERE a.participant_id='00000000-0000-4031-b000-000000000002' AND m.home_team_name='New Home'),'reviewed draft match maps to the inserted room match');
SELECT is((SELECT count(*)::integer FROM public.assignments WHERE participant_id='00000000-0000-4031-b000-000000000003'),1,'running zero target keeps common only');
SELECT is((SELECT home_score FROM public.matches WHERE id='00000000-0000-4031-b000-000000000011'),2,'running automatic save preserves old scores');
SELECT is((SELECT current_drink_total::integer FROM public.participants WHERE id='00000000-0000-4031-b000-000000000002'),3,'running automatic save preserves drinks');
SELECT ok(EXISTS(SELECT 1 FROM public.gameplay_events WHERE session_id='00000000-0000-4031-b000-000000000001' AND payload->'previousTargetsByParticipantId' IS NOT NULL AND payload->'targetsByParticipantId' IS NOT NULL),'running edit records previous and accepted targets');
SET LOCAL ROLE authenticated;
SELECT public.end_game_session('00000000-0000-4031-b000-000000000001');
SELECT is((SELECT assignment_policy_version::integer FROM public.completed_session_summaries WHERE session_id='00000000-0000-4031-b000-000000000001'),2,'completed history retains known target policy');
SELECT is((SELECT player_match_counts->>'00000000-0000-4031-b000-000000000003' FROM public.completed_session_summaries WHERE session_id='00000000-0000-4031-b000-000000000001'),'0','completed history retains explicit zero');
RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
