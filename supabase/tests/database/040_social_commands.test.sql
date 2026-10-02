-- Updated contract for the retired direct-write friendship API.
-- Not executed in the unit-only feature 027 implementation session.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();
CREATE TEMP TABLE social_context AS SELECT
  '00000000-0000-4000-8000-000000000001'::uuid AS actor,
  '00000000-0000-4000-8000-000000000002'::uuid AS target,
  (SELECT username FROM public.accounts WHERE id='00000000-0000-4000-8000-000000000002') AS target_name,
  gen_random_uuid() AS operation, NULL::uuid AS request, NULL::jsonb AS response;
GRANT SELECT, UPDATE ON social_context TO authenticated;
DELETE FROM public.friendships WHERE requester_account_id IN (SELECT actor FROM social_context UNION SELECT target FROM social_context)
  OR addressee_account_id IN (SELECT actor FROM social_context UNION SELECT target FROM social_context);
SELECT ok(NOT has_table_privilege('authenticated','public.friendships','SELECT'), 'raw friendship reads are revoked');
SELECT ok(NOT has_table_privilege('authenticated','public.friendships','INSERT'), 'raw friendship writes are revoked');
SELECT ok(NOT has_table_privilege('authenticated','private.account_blocks','SELECT'), 'raw blocks are private');
SELECT ok(NOT has_table_privilege('authenticated','private.social_receipts','SELECT'), 'raw receipts are private');
SELECT ok(NOT has_function_privilege('anon','public.send_friend_request(uuid,text,uuid)','EXECUTE'), 'anonymous sends are denied');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT actor::text FROM social_context), true);
SELECT throws_ok($$SELECT * FROM public.friendships$$, '42501', NULL, 'authenticated callers cannot bypass projections');
SELECT is((SELECT count(*)::integer FROM public.search_accounts_by_username_prefix('Sc')),0,'short search returns no accounts');
SELECT is((SELECT count(*)::integer FROM public.search_accounts_by_username_prefix('Scout')),20,'eligible prefix search is capped');
UPDATE social_context SET response=public.send_friend_request(target,target_name,operation);
SELECT is((SELECT response->>'disposition' FROM social_context),'sent','request is sent');
UPDATE social_context SET request=(response->>'request_id')::uuid;
SELECT is((SELECT public.send_friend_request(target,target_name,operation)->>'replayed' FROM social_context),'true','same operation replays');
SELECT throws_ok($$SELECT public.respond_friend_request(target,request,'accept',gen_random_uuid()) FROM social_context$$,
  'P0001','request_not_allowed','requester cannot accept');
SELECT set_config('request.jwt.claim.sub', (SELECT target::text FROM social_context), true);
SELECT is((SELECT public.respond_friend_request(actor,request,'accept',gen_random_uuid())->>'current_relationship' FROM social_context),
  'friends','recipient accepts');
SELECT set_config('request.jwt.claim.sub', (SELECT actor::text FROM social_context), true);
SELECT throws_ok($$SELECT public.cancel_friendship(target,request,'pending',gen_random_uuid()) FROM social_context$$,
  'P0001','request_conflict','late cancellation cannot unfriend an accepted request');
UPDATE social_context SET response=public.block_account(target,gen_random_uuid());
SELECT is((SELECT response->>'current_relationship' FROM social_context),'unavailable','blocking revokes current friendship');
SELECT throws_ok($$SELECT public.send_friend_request(target,target_name,gen_random_uuid()) FROM social_context$$,
  'P0001','target_unavailable','blocked pairs cannot send');
SELECT is((SELECT public.unblock_account(target,(response->>'own_block_id')::uuid,gen_random_uuid())->>'current_relationship' FROM social_context),
  'none','unblocking does not restore friendship');
SELECT * FROM finish();
ROLLBACK;
