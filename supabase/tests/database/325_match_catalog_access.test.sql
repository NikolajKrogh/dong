begin;
select no_plan();
\ir ../fixtures/match_catalog.sql

select ok(not rolcanlogin and not rolsuper and not rolcreaterole and not rolbypassrls,
  'owned backend group cannot log in directly, manage roles or bypass RLS') from pg_roles where rolname='match_catalog_backend';
select ok(not pg_has_role('match_catalog_backend','postgres','MEMBER'),'owned backend is not a member of the database owner role');
with functions(signature) as (values
  ('private.claim_provider_batch(bigint[],text,uuid,bigint)'),('private.accept_provider_response(bigint,uuid,bigint,jsonb)'),
  ('private.fail_provider_request(bigint,uuid,bigint,text,integer,integer)'),('private.acquire_provider_worker_slot(text,bigint)'),
  ('private.begin_catalog_dispatch(uuid,bigint)'),('private.process_catalog_room(uuid,uuid,bigint)'),
  ('private.prepare_solo_tracking(text,text,uuid,text,text[])'),('private.finalize_solo_tracking(uuid,text,text,boolean)'),
  ('private.replace_solo_tracking(text,integer,uuid,text,text[])'),('private.set_catalog_ownership(text,bigint)'),
  ('private.configure_catalog_limits(integer,integer)'),('private.dispatch_catalog_work()'),('private.maintain_catalog_storage()')),
roles(name) as (values('anon'),('authenticated'),('service_role'))
select ok(not exists(select 1 from functions where has_function_privilege(roles.name,functions.signature,'EXECUTE')),
  roles.name||' cannot allocate provider work, accept source facts, mint grants or invoke operators') from roles;
select ok(has_function_privilege('anon','public.read_saved_matches(text[],text)','EXECUTE')
  and has_function_privilege('authenticated','public.read_saved_matches(text[],text)','EXECUTE'),
  'public and registered clients retain the sanitized saved-fact entrance');
select ok(has_function_privilege('match_catalog_backend','private.claim_provider_batch(bigint[],text,uuid,bigint)','EXECUTE')
  and not has_function_privilege('match_catalog_backend','private.claim_provider_request(bigint,text,uuid,bigint)','EXECUTE'),
  'backend acquisition must use the bounded batch entrance');
with functions(signature) as (values('private.set_catalog_ownership(text,bigint)'),('private.configure_catalog_limits(integer,integer)'),
  ('private.resume_catalog_group(bigint,bigint)'),('private.dispatch_catalog_work()'),('private.maintain_catalog_storage()'))
select ok(not exists(select 1 from functions where has_function_privilege('match_catalog_backend',signature,'EXECUTE')),
  'backend cannot change policy, read Vault through dispatch or run retention');
-- Managed Supabase pg_net has required PUBLIC object ACLs owned by
-- supabase_admin; ordinary migrations cannot exclude individual roles. The
-- client boundary is NOLOGIN plus net remaining outside the Data API schemas.
-- The actual local Accept-Profile: net denial is recorded separately in
-- validation/pg-net-security.md, rather than inferred from this SQL session.
select ok(not rolcanlogin,rolname||' cannot open a direct database connection to managed pg_net')
from pg_roles where rolname in ('anon','authenticated','service_role','match_catalog_backend');
select ok(not has_table_privilege('match_catalog_backend','private.provider_matches','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('match_catalog_backend','private.provider_budget_state','SELECT,INSERT,UPDATE,DELETE'),
  'worker group has owned operations rather than unrestricted provider table privileges');

-- Exercise the actual bounded cleanup operator, rather than manually deleting a
-- grant as in basic consumer tests. Reusing a nonce cannot revive old authority.
select private.configure_catalog_limits(30,5000);
select private.set_catalog_ownership('catalog',1);
update private.provider_budget_state set new_demand_allowed=true where provider='espn';
insert into private.provider_matches(league_id,source_event_id,home_name,away_name,lifecycle,kickoff_at,kickoff_validity,scoreboard_group_id)
select league.id,'access-cleanup-event','Home','Away','live',clock_timestamp()-interval '30 minutes','confirmed',resource.id
from private.provider_leagues league join private.provider_request_groups resource on resource.league_id=league.id
where league.league_code='eng.1' and resource.resource_kind='scoreboard' limit 1;
create temporary table cleanup_grant_context as select gen_random_uuid() as operation_id,id::text as match_id from private.provider_matches where source_event_id='access-cleanup-event';
create temporary table cleanup_original_grant as select private.prepare_solo_tracking(repeat('81',32),repeat('82',32),operation_id,'cleanup-key',array[match_id]) as result from cleanup_grant_context;
select is(private.finalize_solo_tracking((select (result->>'issuanceId')::uuid from cleanup_original_grant),repeat('81',32),repeat('83',32),false)->>'ok','true',
  'cleanup fixture starts from an issued finite grant');
update private.solo_tracking_grants set created_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 day';
update private.solo_tracked_matches set admitted_until=clock_timestamp()-interval '1 day';
select is(private.replace_solo_tracking(repeat('83',32),1,gen_random_uuid(),repeat('84',32),array[]::text[])->>'code','tracking_expired',
  'expired authority is rejected before cleanup runs');
select private.maintain_catalog_storage();
select is((select count(*)::integer from private.solo_tracking_grants),0,'real retention removes expired grant metadata and selected links');
select is((select count(*)::integer from private.solo_tracked_matches),0,'expired grants leave no anonymous retention pin');
select is(private.replace_solo_tracking(repeat('83',32),1,gen_random_uuid(),repeat('85',32),array[]::text[])->>'code','invalid_tracking_grant',
  'purged token cannot regain authority through replacement');
create temporary table cleanup_reissued_grant as select private.prepare_solo_tracking(repeat('81',32),repeat('82',32),operation_id,'cleanup-key',array[match_id]) as result from cleanup_grant_context;
select is((select result->>'isReplay' from cleanup_reissued_grant),'false','creation after cleanup is new admission, not an expired replay');
select isnt((select result->>'issuanceId' from cleanup_reissued_grant),(select result->>'issuanceId' from cleanup_original_grant),
  'cleanup followed by the same nonce allocates a different immutable issuance');
select is(private.finalize_solo_tracking((select (result->>'issuanceId')::uuid from cleanup_reissued_grant),repeat('81',32),repeat('86',32),false)->>'ok','true',
  'replacement issuance can bind only its newly issued token digest');
select is(private.replace_solo_tracking(repeat('83',32),1,gen_random_uuid(),repeat('87',32),array[]::text[])->>'code','invalid_tracking_grant',
  'old token remains denied even after a new same-nonce grant is finalized');
select is((select sum(admitted_count)::integer from private.provider_admission_counters where counter_kind='solo_creation' and scope_key='global'),2,
  'post-cleanup issuance consumes fresh global admission capacity');
select is((select count(*)::integer from private.provider_request_attempts),0,'authority checks and cleanup never acquire provider data');
select * from finish();
rollback;
