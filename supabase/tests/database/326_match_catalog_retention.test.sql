begin;
select no_plan();
\ir ../fixtures/match_catalog.sql
select ok(to_regclass('private.provider_match_rosters') is not null,'compact participation has a queryable shared relation');
select ok(not has_table_privilege('anon','private.provider_match_rosters','select'),'rosters require sanitized saved projection');
select ok(not has_function_privilege('service_role','private.maintain_catalog_storage()','execute'),'API credential cannot perform retention/measurements');
select is(private.measure_catalog_capacity()->>'ok','true','operator can measure actual relation and database bytes');
select ok((select feature_bytes>0 and database_bytes>feature_bytes and capacity_measured_at is not null from private.provider_budget_state),'measured capacity includes real relation/index allocation');
insert into private.provider_matches(league_id,source_event_id,home_name,away_name,lifecycle,is_completed,completed_at,last_used_at)
select id,'expired-cache','Home','Away','finished',true,clock_timestamp()-interval '40 days',clock_timestamp()-interval '40 days' from private.provider_leagues where league_code='eng.1';
select private.maintain_catalog_storage();
select is((select count(*)::integer from private.provider_matches where source_event_id='expired-cache'),0,'old unreferenced completed cache is evicted');
select is(private.catalog_operator_report()->>'mode','disabled','storage maintenance never activates acquisition');

-- A prepared issuance owns FK references even before finalization creates demand.
update private.provider_budget_state set ownership_mode='catalog',rolling_limit=30,daily_limit=5000,new_demand_allowed=true where provider='espn';
insert into private.provider_matches(league_id,source_event_id,home_name,away_name,lifecycle,kickoff_at,kickoff_validity)
select id,'pending-solo-retention','Home','Away','scheduled',clock_timestamp()+interval '3 days','confirmed'
from private.provider_leagues where league_code='eng.1';
create temporary table pending_retention_grant as select private.prepare_solo_tracking(
  repeat('81',32),repeat('82',32),gen_random_uuid(),'retention-test',
  array[(select id::text from private.provider_matches where source_event_id='pending-solo-retention')]) as result;
select is((select result->>'ok' from pending_retention_grant),'true','a future match can have a prepared solo issuance');
select ok((select grant_digest is null from private.solo_tracking_grants where id=(select (result->>'issuanceId')::uuid from pending_retention_grant)),
  'the abandoned issuance has not been finalized');
select is((select count(*)::integer from private.catalog_demand_matches where catalog_match_id=(select id from private.provider_matches where source_event_id='pending-solo-retention')),0,
  'unfinished issuance creates no acquisition demand');
update private.provider_matches set last_used_at=clock_timestamp()-interval '2 days' where source_event_id='pending-solo-retention';
select lives_ok('select private.maintain_catalog_storage()','retention completes while an unfinished issuance still references an old source');
select is((select count(*)::integer from private.provider_matches where source_event_id='pending-solo-retention'),1,
  'the source remains until its unfinished issuance expires');
update private.solo_tracking_grants set created_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 second'
where id=(select (result->>'issuanceId')::uuid from pending_retention_grant);
select lives_ok('select private.maintain_catalog_storage()','expired unfinished issuance and its old source are cleaned together');
select is((select count(*)::integer from private.provider_matches where source_event_id='pending-solo-retention'),0,
  'expired unfinished issuance does not pin its source permanently');

-- Reserve future simultaneous source groups even before any of them is due.
-- The capacity unit is a league/date request group, not one match or room.
update private.provider_budget_state set ownership_mode='catalog',rolling_limit=30,daily_limit=5000,new_demand_allowed=true,max_live_groups=8 where provider='espn';
create temporary table future_overlap_context as
select date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC'+interval '1 day 18 hours' as kickoff;
insert into private.provider_request_groups(provider,league_id,resource_kind,request_date)
select 'espn',league.id,'scoreboard',(context.kickoff at time zone 'UTC')::date
from private.provider_leagues league cross join future_overlap_context context
where league.league_code in ('eng.1','eng.2','eng.3','eng.4','eng.fa','eng.league_cup','esp.1','esp.2','esp.copa_del_rey') on conflict do nothing;
insert into private.provider_matches(league_id,source_event_id,home_name,away_name,lifecycle,kickoff_at,kickoff_validity,scoreboard_group_id)
select league.id,'future-overlap-'||league.league_code,'Home','Away','scheduled',context.kickoff,'confirmed',resource.id
from private.provider_leagues league cross join future_overlap_context context
join private.provider_request_groups resource on resource.league_id=league.id and resource.resource_kind='scoreboard' and resource.request_date=(context.kickoff at time zone 'UTC')::date
where league.league_code in ('eng.1','eng.2','eng.3','eng.4','eng.fa','eng.league_cup','esp.1','esp.2','esp.copa_del_rey');
select ok(private.catalog_selection_admissible(array(select id from private.provider_matches where source_event_id like 'future-overlap-%' order by id limit 8)),
  'eight future overlapping groups fit the configured bound before kickoff');
select ok(not private.catalog_selection_admissible(array(select id from private.provider_matches where source_event_id like 'future-overlap-%' order by id)),
  'a ninth future simultaneous group is rejected before it can become live work');
select is(private.prepare_solo_tracking(repeat('61',32),repeat('62',32),gen_random_uuid(),'overlap-test',
  array(select id::text from private.provider_matches where source_event_id like 'future-overlap-%' order by id))->>'code','capacity_limited',
  'public tracking admission cannot bypass the future overlap reservation');
select is((select count(*)::integer from private.solo_tracking_grants),0,'denied future selection allocates no grant or permanent tracking pin');
select is((select count(*)::integer from private.provider_request_attempts),0,'future overlap validation makes no source reservation');
select is((select count(*)::integer from private.provider_worker_slots where lease_token is not null),0,'future overlap validation dispatches no worker');
insert into private.provider_matches(league_id,source_event_id,home_name,away_name,lifecycle,kickoff_at,kickoff_validity,scoreboard_group_id)
select league_id,'future-extra-same-group','Other Home','Other Away','scheduled',kickoff_at,'confirmed',scoreboard_group_id
from private.provider_matches where source_event_id like 'future-overlap-%' order by id limit 1;
select ok(private.catalog_selection_admissible(array(select id from private.provider_matches where id in (
  select id from private.provider_matches where source_event_id like 'future-overlap-%' order by id limit 8)
  or source_event_id='future-extra-same-group')),'additional matches sharing an admitted group do not consume another future group slot');
-- Previously admitted groups may later overlap after a provider reschedule.
update private.provider_matches set kickoff_at=(select kickoff+interval '5 hours' from future_overlap_context)
where id=(select max(id) from private.provider_matches where source_event_id like 'future-overlap-%');
create temporary table reschedule_grant as select private.prepare_solo_tracking(repeat('71',32),repeat('72',32),gen_random_uuid(),'reschedule-test',
  array(select id::text from private.provider_matches where source_event_id like 'future-overlap-%' order by id)) as result;
select is((select result->>'ok' from reschedule_grant),'true','nine groups in nonoverlapping windows may be admitted');
select private.finalize_solo_tracking((select (result->>'issuanceId')::uuid from reschedule_grant),repeat('71',32),repeat('73',32),false);
update private.provider_matches set kickoff_at=(select kickoff from future_overlap_context)
where id=(select max(id) from private.provider_matches where source_event_id like 'future-overlap-%');
select is((select scheduling_degraded from private.provider_budget_state),true,'provider reschedule detects overload without ending an existing match');
select is(private.reserve_catalog_bytes(100,true),false,'overload defers optional work before it can compete with recording');
select is((select count(*)::integer from private.catalog_demand_matches),9,'overload preserves all previously admitted recording demand');
select private.replace_solo_tracking(repeat('73',32),1,gen_random_uuid(),repeat('74',32),array[]::text[]);
select private.refresh_catalog_scheduling_capacity();
select is((select scheduling_degraded from private.provider_budget_state),false,'ending demand clears scheduling overload without deleting history or resetting budgets');
select * from finish();
rollback;
