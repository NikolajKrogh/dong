-- Atomic running-game edits and provider freshness use the same authoritative snapshot.
BEGIN;
\ir guest_abuse_setup.inc
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
) VALUES
  ('00000000-0000-4800-8000-000000000101', 'authenticated', 'authenticated', 'gameplay-host@test.local', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false),
  ('00000000-0000-4800-8000-000000000102', 'authenticated', 'authenticated', 'gameplay-member@test.local', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false),
  ('00000000-0000-4800-8000-000000000103', 'authenticated', 'authenticated', 'gameplay-outsider@test.local', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false);

INSERT INTO public.accounts (id, username) VALUES
  ('00000000-0000-4800-8000-000000000101', 'Gameplay_Host'),
  ('00000000-0000-4800-8000-000000000102', 'Gameplay_Member'),
  ('00000000-0000-4800-8000-000000000103', 'Gameplay_Outsider');

INSERT INTO public.game_sessions (id, owner_account_id, join_code, state)
VALUES (
  '00000000-0000-4800-8000-000000000201',
  '00000000-0000-4800-8000-000000000101',
  'GAMEPLAY1',
  'in_progress'::public.session_state
);

UPDATE public.participants
SET id = '00000000-0000-4800-8000-000000000301', display_name = 'Gameplay Host'
WHERE session_id = '00000000-0000-4800-8000-000000000201'
  AND account_id = '00000000-0000-4800-8000-000000000101';

INSERT INTO public.participants (
  id, session_id, account_id, display_name, membership_type, session_role,
  current_drink_total, guest_rejoin_token_hash
) VALUES
  ('00000000-0000-4800-8000-000000000302', '00000000-0000-4800-8000-000000000201', '00000000-0000-4800-8000-000000000102', 'Gameplay Member', 'registered'::public.participant_membership_type, 'member'::public.participant_session_role, 0, NULL),
  ('00000000-0000-4800-8000-000000000303', '00000000-0000-4800-8000-000000000201', NULL, 'Gameplay Guest', 'guest'::public.participant_membership_type, 'member'::public.participant_session_role, 0, encode(extensions.digest('gameplay-guest-token', 'sha256'), 'hex'));

INSERT INTO public.matches (
  id, session_id, source_provider, source_match_id, home_team_name, away_team_name,
  home_score, away_score, source_league_code, kickoff_at
) VALUES
  ('00000000-0000-4800-8000-000000000401', '00000000-0000-4800-8000-000000000201', 'manual', 'manual-1', 'Manual Home', 'Manual Away', 0, 0, NULL, NULL),
  ('00000000-0000-4800-8000-000000000402', '00000000-0000-4800-8000-000000000201', 'espn', 'espn-1', 'Provider Home', 'Provider Away', 0, 0, 'eng.1', '2026-09-03T18:00:00Z'),
  ('00000000-0000-4800-8000-000000000403', '00000000-0000-4800-8000-000000000201', 'espn', 'espn-legacy', 'Legacy Home', 'Legacy Away', 0, 0, NULL, '2026-09-03T20:00:00Z');

INSERT INTO public.assignments (session_id, participant_id, match_id)
VALUES
  ('00000000-0000-4800-8000-000000000201', '00000000-0000-4800-8000-000000000301', '00000000-0000-4800-8000-000000000401'),
  ('00000000-0000-4800-8000-000000000201', '00000000-0000-4800-8000-000000000302', '00000000-0000-4800-8000-000000000401'),
  ('00000000-0000-4800-8000-000000000201', '00000000-0000-4800-8000-000000000303', '00000000-0000-4800-8000-000000000401');


UPDATE public.game_sessions SET common_match_id='00000000-0000-4800-8000-000000000401',
  started_at='2026-10-22T15:00:00Z', matches_per_player=1
WHERE id='00000000-0000-4800-8000-000000000201';
CREATE TEMP TABLE edit_context(token text, config jsonb, response jsonb, checked_at timestamptz);
GRANT ALL ON edit_context TO authenticated, service_role;
INSERT INTO edit_context(token, config) SELECT private.running_configuration_token('00000000-0000-4800-8000-000000000201'),
'{"assignmentMode":"host_assigned","matchesPerPlayer":1,"sharedMatchesPerPair":0,
"newMatches":[{"clientId":"draft-new","sourceProvider":"manual","homeTeamName":"New Home","awayTeamName":"New Away"}],
"assignments":[
{"participantId":"00000000-0000-4800-8000-000000000301","matchId":"draft-new"},
{"participantId":"00000000-0000-4800-8000-000000000302","matchId":"00000000-0000-4800-8000-000000000402"},
{"participantId":"00000000-0000-4800-8000-000000000303","matchId":"00000000-0000-4800-8000-000000000403"}]}'::jsonb;
SELECT is(private.authoritative_snapshot('00000000-0000-4800-8000-000000000201')->'lastScoresCheckedAt','null'::jsonb,'existing games have no invented score-check time');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4800-8000-000000000102',true);
SELECT throws_ok($$SELECT public.save_running_game_configuration('00000000-0000-4800-8000-000000000201',(SELECT config FROM edit_context),(SELECT token FROM edit_context),gen_random_uuid())$$,'P0001','not_host','members cannot save host edits');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4800-8000-000000000101',true);
SELECT public.change_manual_score('00000000-0000-4800-8000-000000000201','00000000-0000-4800-8000-000000000401','home',1,gen_random_uuid());
SELECT public.change_participant_drink('00000000-0000-4800-8000-000000000201','00000000-0000-4800-8000-000000000301',1,gen_random_uuid());
SET LOCAL ROLE postgres;
SELECT is(private.running_configuration_token('00000000-0000-4800-8000-000000000201'),(SELECT token FROM edit_context),'scores and drinks do not invalidate a draft');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.save_running_game_configuration('00000000-0000-4800-8000-000000000201',jsonb_set((SELECT config FROM edit_context),'{assignments}','[]'),(SELECT token FROM edit_context),gen_random_uuid())$$,'P0001','assignment_count_mismatch','invalid allocation rolls back additions and assignment changes');
SELECT is((SELECT count(*)::int FROM public.matches WHERE session_id='00000000-0000-4800-8000-000000000201'),3,'failed save leaves the pool intact');
UPDATE edit_context SET response=public.save_running_game_configuration('00000000-0000-4800-8000-000000000201',config,token,'00000000-0000-4800-8000-000000000901');
SELECT is(public.save_running_game_configuration('00000000-0000-4800-8000-000000000201',(SELECT config FROM edit_context),(SELECT token FROM edit_context),'00000000-0000-4800-8000-000000000901'),(SELECT response FROM edit_context),'retry returns the original snapshot without adding fixtures twice');
SELECT throws_ok($$SELECT public.save_running_game_configuration('00000000-0000-4800-8000-000000000201',jsonb_set((SELECT config FROM edit_context),'{matchesPerPlayer}','0'),(SELECT token FROM edit_context),'00000000-0000-4800-8000-000000000901')$$,'P0001','idempotency_conflict','retry key cannot be reused for another configuration');
SELECT throws_ok($$SELECT public.save_running_game_configuration('00000000-0000-4800-8000-000000000201',(SELECT config FROM edit_context),(SELECT token FROM edit_context),gen_random_uuid())$$,'P0001','configuration_conflict','stale drafts cannot overwrite current configuration');
SET LOCAL ROLE postgres;
SELECT is((SELECT count(*)::int FROM public.matches WHERE session_id='00000000-0000-4800-8000-000000000201'),4,'successful add retains every existing match');
SELECT is((SELECT home_score FROM public.matches WHERE id='00000000-0000-4800-8000-000000000401'),1,'accepted score survives reconfiguration');
SELECT is((SELECT current_drink_total::text FROM public.participants WHERE id='00000000-0000-4800-8000-000000000301'),'0.5','drink total survives reconfiguration');
SELECT is((SELECT started_at FROM public.game_sessions WHERE id='00000000-0000-4800-8000-000000000201'),'2026-10-22T15:00:00Z'::timestamptz,'game start time is unchanged');
SELECT is((SELECT count(*)::int FROM public.assignments WHERE session_id='00000000-0000-4800-8000-000000000201' AND match_id='00000000-0000-4800-8000-000000000401'),3,'fixed common match remains assigned to everyone');
SELECT is((SELECT count(*)::int FROM public.gameplay_events WHERE session_id='00000000-0000-4800-8000-000000000201' AND payload->>'runningGameEdit'='true'),1,'one immutable configuration event is recorded');
UPDATE edit_context SET token=private.running_configuration_token('00000000-0000-4800-8000-000000000201');
SET LOCAL ROLE service_role;
SELECT public.claim_provider_score_refresh('00000000-0000-4800-8000-000000000201','00000000-0000-4800-8000-000000000101','00000000-0000-4800-8000-000000000902');
SELECT public.accept_provider_score_batch_checked_from_edge('00000000-0000-4800-8000-000000000201','00000000-0000-4800-8000-000000000101','00000000-0000-4800-8000-000000000902','[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":0,"awayScore":0}]',true);
SET LOCAL ROLE postgres;
UPDATE edit_context SET checked_at=(SELECT last_scores_checked_at FROM public.game_sessions WHERE id='00000000-0000-4800-8000-000000000201');
SELECT ok((SELECT checked_at IS NOT NULL FROM edit_context),'successful unchanged scores advance freshness');
SELECT is(private.running_configuration_token('00000000-0000-4800-8000-000000000201'),(SELECT token FROM edit_context),'freshness does not invalidate a configuration draft');
SET LOCAL ROLE service_role;
SELECT public.accept_provider_score_batch_checked_from_edge('00000000-0000-4800-8000-000000000201','00000000-0000-4800-8000-000000000101','00000000-0000-4800-8000-000000000902','[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":0,"awayScore":0}]',true);
SET LOCAL ROLE postgres;
SELECT is((SELECT last_scores_checked_at FROM public.game_sessions WHERE id='00000000-0000-4800-8000-000000000201'),(SELECT checked_at FROM edit_context),'replayed refresh does not advance freshness');
UPDATE private.provider_score_refresh_leases SET not_before=now()-interval '1 second' WHERE session_id='00000000-0000-4800-8000-000000000201';
SET LOCAL ROLE service_role;
SELECT public.claim_provider_score_refresh('00000000-0000-4800-8000-000000000201','00000000-0000-4800-8000-000000000101','00000000-0000-4800-8000-000000000903');
SELECT public.accept_provider_score_batch_checked_from_edge('00000000-0000-4800-8000-000000000201','00000000-0000-4800-8000-000000000101','00000000-0000-4800-8000-000000000903','[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":0,"awayScore":0}]',false);
SET LOCAL ROLE postgres;
SELECT is((SELECT last_scores_checked_at FROM public.game_sessions WHERE id='00000000-0000-4800-8000-000000000201'),(SELECT checked_at FROM edit_context),'partial checks retain the last complete timestamp');
SET LOCAL ROLE authenticated;
SELECT is(public.get_room_snapshot('00000000-0000-4800-8000-000000000201')->'lastScoresCheckedAt',(SELECT to_jsonb(checked_at) FROM edit_context),'registered snapshot exposes persisted freshness');
SET LOCAL ROLE service_role;
SELECT is(public.get_guest_room_snapshot('gameplay-guest-token')->'lastScoresCheckedAt',(SELECT to_jsonb(checked_at) FROM edit_context),'guest receives the same complete-check timestamp');
SET LOCAL ROLE postgres;
SELECT is((SELECT last_scores_checked_at FROM public.game_sessions WHERE id='00000000-0000-4800-8000-000000000201'),(SELECT checked_at FROM edit_context),'snapshot polling does not change freshness');
UPDATE edit_context SET token=private.running_configuration_token('00000000-0000-4800-8000-000000000201');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.save_running_game_configuration('00000000-0000-4800-8000-000000000201','{"assignmentMode":"automatic","matchesPerPlayer":1,"sharedMatchesPerPair":0,"newMatches":[],"assignments":[]}',(SELECT token FROM edit_context),gen_random_uuid())$$,'automatic redistribution uses the existing room pool');
SELECT is((SELECT count(*)::int FROM public.assignments WHERE session_id='00000000-0000-4800-8000-000000000201'),6,'redistribution assigns one individual and one common match per player');
RESET ROLE;
GRANT EXECUTE ON FUNCTION public.save_running_game_configuration_v2(uuid,jsonb,uuid,text,uuid,boolean) TO authenticated;
CREATE TEMP TABLE v2_edit AS SELECT private.running_configuration_token(gs.id) AS token,
 jsonb_build_object('assignmentPolicyVersion',2,'assignmentMode','host_assigned','matchesPerPlayer',1,'sharedMatchesPerPair',0,
 'playerMatchCounts',jsonb_build_object('00000000-0000-4800-8000-000000000301',0),'newMatches','[]'::jsonb,
 'assignments',(SELECT coalesce(jsonb_agg(jsonb_build_object('participantId',a.participant_id,'matchId',a.match_id)),'[]')
 FROM public.assignments a JOIN public.participants p ON p.id=a.participant_id AND p.session_id=a.session_id WHERE a.session_id=gs.id
 AND a.participant_id<>'00000000-0000-4800-8000-000000000301' AND a.match_id<>gs.common_match_id
 AND private.is_active_room_roster_member(p.membership_type::text,p.left_at,p.guest_rejoin_token_hash,p.guest_grant_expires_at))) AS config,
 (SELECT jsonb_agg(jsonb_build_array(id,home_score,away_score) ORDER BY id) FROM public.matches WHERE session_id=gs.id) AS scores,
 (SELECT jsonb_agg(jsonb_build_array(id,current_drink_total) ORDER BY id) FROM public.participants WHERE session_id=gs.id) AS drinks,
 (SELECT count(*) FROM public.matches WHERE session_id=gs.id) AS match_count,
 gen_random_uuid() AS key
 FROM public.game_sessions gs WHERE id='00000000-0000-4800-8000-000000000201';
GRANT ALL ON v2_edit TO authenticated;
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.save_running_game_configuration_v2('00000000-0000-4800-8000-000000000201',config,null,token,key,false) FROM v2_edit$$,'running host-assigned edits honor an explicit zero target');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.assignments WHERE participant_id='00000000-0000-4800-8000-000000000301'),1,'zero-target host retains only Common Match');
SELECT is((SELECT jsonb_agg(jsonb_build_array(id,home_score,away_score) ORDER BY id) FROM public.matches WHERE session_id='00000000-0000-4800-8000-000000000201'),(SELECT scores FROM v2_edit),'v2 edit preserves recorded scores');
SELECT is((SELECT jsonb_agg(jsonb_build_array(id,current_drink_total) ORDER BY id) FROM public.participants WHERE session_id='00000000-0000-4800-8000-000000000201'),(SELECT drinks FROM v2_edit),'v2 edit preserves drink totals');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.save_running_game_configuration_v2('00000000-0000-4800-8000-000000000201',config,null,token,key,false) FROM v2_edit$$,'running accepted replay precedes stale fence validation');
RESET ROLE;
UPDATE v2_edit SET token=private.running_configuration_token('00000000-0000-4800-8000-000000000201');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.save_running_game_configuration_v2('00000000-0000-4800-8000-000000000201',jsonb_set(jsonb_set(config,'{newMatches}','[{"clientId":"rollback","sourceProvider":"manual","homeTeamName":"New","awayTeamName":"Match"}]'),'{assignments}','[]'),null,token,gen_random_uuid(),false) FROM v2_edit$$,'P0001','assignment_count_mismatch','bad v2 counts roll back new matches and assignment replacement');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.matches WHERE session_id='00000000-0000-4800-8000-000000000201'),(SELECT match_count FROM v2_edit),'failed save inserts no draft matches');
SELECT * FROM finish();
ROLLBACK;
