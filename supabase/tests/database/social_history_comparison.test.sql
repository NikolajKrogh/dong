BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT no_plan();
\ir ../fixtures/social_history.inc
INSERT INTO public.friendships(requester_account_id,addressee_account_id,status) SELECT a,c,'accepted' FROM social_fixture;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT a::text FROM social_fixture),true);
SELECT is(public.get_social_history((SELECT c FROM social_fixture))->'target'->>'games_participated','0','no participation has zero count');
SELECT is(public.get_social_history((SELECT c FROM social_fixture))->'target'->>'average_drinks',NULL,'no participation average is unavailable');
SELECT is(jsonb_array_length(public.get_social_history((SELECT c FROM social_fixture))->'games'->'items'),0,'no-shared friend has empty list');
SELECT is(public.list_social_shared_timeline((SELECT b FROM social_fixture))->'items'->0->>'viewer_left_at','2026-10-01T12:30:00+00:00','timeline preserves departure');
SELECT is((public.list_social_shared_timeline((SELECT b FROM social_fixture))->'items'->0->>'viewer_drinks')::numeric,2::numeric,'timeline uses frozen drinks');
RESET ROLE;
UPDATE public.accounts SET username='Renamed028' WHERE id=(SELECT b FROM social_fixture);
SET LOCAL ROLE authenticated;
SELECT is(public.get_social_history((SELECT b FROM social_fixture))->'target'->>'username','Renamed028','current name labels stable account');
SELECT is(public.get_social_history((SELECT b FROM social_fixture))->'games'->'items'->0->'players'->0->>'name','Recorded name','recorded names remain snapshots');
RESET ROLE;
INSERT INTO public.participants(session_id,display_name,membership_type,guest_rejoin_token_hash,current_drink_total)
VALUES ('28000000-0000-4000-8000-000000000001','Recorded name','guest','guest-one-028',99),
       ('28000000-0000-4000-8000-000000000002','Recorded name','guest','guest-two-028',99);
SELECT is((SELECT count(*)::integer FROM private.social_history_participants WHERE account_id=(SELECT a FROM social_fixture)),3,'same-name guests never acquire account contributions');
INSERT INTO public.game_sessions(id,owner_account_id,join_code,state,started_at)
SELECT '28000000-0000-4000-8000-000000000007',a,'000007','in_progress','2026-10-01T12:00Z' FROM social_fixture;
INSERT INTO public.gameplay_events(session_id,sequence_number,actor_participant_id,event_type,idempotency_key,payload)
SELECT '28000000-0000-4000-8000-000000000007',1,id,'session_created','legacy-import:fixture','{"imported":true}'::jsonb
FROM public.participants WHERE session_id='28000000-0000-4000-8000-000000000007' AND account_id=(SELECT a FROM social_fixture);
UPDATE public.game_sessions SET state='completed',completed_at='2026-10-01T13:00Z' WHERE id='28000000-0000-4000-8000-000000000007';
SELECT is((SELECT count(*)::integer FROM private.social_history_participants WHERE account_id=(SELECT a FROM social_fixture)),3,'import event excludes zero-match session even with numeric code');
UPDATE public.participants SET current_drink_total=0 WHERE session_id='28000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT is(public.get_social_history((SELECT b FROM social_fixture))->'shared'->>'tied_count','1','zero-drink games count as precise ties');
SELECT is((public.get_social_history((SELECT b FROM social_fixture))->'shared'->>'viewer_average_drinks')::numeric,1::numeric,'zero game remains in denominator');
RESET ROLE;
-- More results than either page size: totals must never derive from the page.
INSERT INTO public.game_sessions(id,owner_account_id,join_code,state,started_at,completed_at)
SELECT ('28000000-0000-4000-8001-'||lpad(n::text,12,'0'))::uuid,a,lpad((100+n)::text,6,'0'),'completed',
 '2026-10-01T12:00Z','2026-10-10T12:00Z' FROM social_fixture CROSS JOIN generate_series(1,105) n;
INSERT INTO public.participants(session_id,account_id,display_name,membership_type,current_drink_total)
SELECT ('28000000-0000-4000-8001-'||lpad(n::text,12,'0'))::uuid,b,'Recorded name','registered',0
FROM social_fixture CROSS JOIN generate_series(1,105) n;
SET LOCAL ROLE authenticated;
SELECT is(public.get_social_history((SELECT b FROM social_fixture),1)->'shared'->>'shared_games','107','totals remain complete beyond first page');
SELECT is(jsonb_array_length(public.get_social_history((SELECT b FROM social_fixture),1)->'games'->'items'),1,'summary keeps bounded initial page');
SELECT is(jsonb_array_length(public.list_social_shared_timeline((SELECT b FROM social_fixture),NULL,100)->'items'),100,'large timeline bounded independently of totals');
SELECT ok(public.list_social_shared_timeline((SELECT b FROM social_fixture),NULL,100)->>'next_cursor' IS NOT NULL,'large timeline signals partial results');
SELECT * FROM finish();
ROLLBACK;
