begin;
select no_plan();
\ir ../fixtures/match_catalog.sql
update private.provider_budget_state set ownership_mode='catalog',rolling_limit=30,daily_limit=5000,optional_work_allowed=true,new_demand_allowed=true where provider='espn';
insert into private.provider_matches(league_id,source_event_id,home_name,away_name,lifecycle,is_completed,completed_at)
select id,'completion-cap','Home','Away','finished',true,clock_timestamp()-interval '6 minutes' from private.provider_leagues where league_code='eng.1';
insert into private.provider_request_groups(provider,league_id,resource_kind,source_event_id,completion_due_at,next_attempt_at)
select 'espn',league_id,'summary',source_event_id,clock_timestamp(),clock_timestamp() from private.provider_matches where source_event_id='completion-cap';
create temporary table completion_slot as select private.acquire_provider_worker_slot('completion',1) as result;
create temporary table completion_claim as select private.claim_provider_batch(array[(select id from private.provider_request_groups where source_event_id='completion-cap')],'completion',(select (result->>'dispatchToken')::uuid from completion_slot),1)->'claims'->0 as result;
select is((select completion_attempt_count::integer from private.provider_matches where source_event_id='completion-cap'),1,'dedicated allowance is reserved before HTTP');
select ok((select completion_due_at>clock_timestamp()+interval '14 minutes' from private.provider_request_groups where source_event_id='completion-cap'),'only one optional retry is scheduled fifteen minutes after its reservation');
select private.fail_provider_request((select (result->>'attemptId')::bigint from completion_claim),(select (result->>'leaseToken')::uuid from completion_claim),1,'provider_timeout',null,null);
select is((select completion_attempt_count::integer from private.provider_matches where source_event_id='completion-cap'),1,'failed/ambiguous HTTP does not refund optional allowance');
select private.release_provider_worker_slot((select (result->>'dispatchToken')::uuid from completion_slot),1,'failed');
update private.provider_request_groups set next_attempt_at=clock_timestamp(),completion_due_at=clock_timestamp(),cooldown_until=null where source_event_id='completion-cap';
update completion_slot set result=private.acquire_provider_worker_slot('completion',1);
update completion_claim set result=private.claim_provider_batch(array[(select id from private.provider_request_groups where source_event_id='completion-cap')],'completion',(select (result->>'dispatchToken')::uuid from completion_slot),1)->'claims'->0;
select is((select completion_attempt_count::integer from private.provider_matches where source_event_id='completion-cap'),2,'second shared attempt consumes the last combined allowance');
select private.fail_provider_request((select (result->>'attemptId')::bigint from completion_claim),(select (result->>'leaseToken')::uuid from completion_claim),1,'provider_timeout',null,null);
select private.release_provider_worker_slot((select (result->>'dispatchToken')::uuid from completion_slot),1,'failed');
update private.provider_request_groups set next_attempt_at=clock_timestamp(),completion_due_at=clock_timestamp(),cooldown_until=null where source_event_id='completion-cap';
update completion_slot set result=private.acquire_provider_worker_slot('completion',1);
select is(jsonb_array_length(private.claim_provider_batch(array[(select id from private.provider_request_groups where source_event_id='completion-cap')],'completion',(select (result->>'dispatchToken')::uuid from completion_slot),1)->'claims'),0,'a third dedicated request cannot be reserved even if a stale due flag remains');
select is((select count(*)::integer from private.provider_request_attempts),2,'dedicated confirmation/detail purposes share exactly two failed reservations');
select private.release_provider_worker_slot((select (result->>'dispatchToken')::uuid from completion_slot),1,'completed');

insert into private.provider_matches(league_id,source_event_id,home_name,away_name,lifecycle,is_completed,completed_at)
select id,'completion-success','Home','Away','finished',true,clock_timestamp()-interval '6 minutes' from private.provider_leagues where league_code='eng.1';
insert into private.provider_request_groups(provider,league_id,resource_kind,source_event_id,completion_due_at,next_attempt_at)
select 'espn',league_id,'summary',source_event_id,clock_timestamp(),clock_timestamp() from private.provider_matches where source_event_id='completion-success';
update completion_slot set result=private.acquire_provider_worker_slot('completion',1);
update completion_claim set result=private.claim_provider_batch(array[(select id from private.provider_request_groups where source_event_id='completion-success')],'completion',(select (result->>'dispatchToken')::uuid from completion_slot),1)->'claims'->0;
select is(private.accept_provider_response((select (result->>'attemptId')::bigint from completion_claim),(select (result->>'leaseToken')::uuid from completion_claim),1,
  '{"matches":[{"identity":{"provider":"espn","leagueCode":"eng.1","sourceEventId":"completion-success"},"homeTeam":{"name":"Home"},"awayTeam":{"name":"Away"},"lifecycle":"finished","isCompleted":true,"homeScore":0,"awayScore":0,"availability":"available","goals":[],"goalsAvailability":"available","historyDetails":{"rosterEntries":[],"teamStats":{"home":{"saves":0},"away":{"saves":0}},"availability":"available","isFinal":true,"hasMoreRosterEntries":false}}],"isPartial":false}'::jsonb)->>'ok','true','complete shared detail response is accepted');
select is((select completion_attempt_count::integer from private.provider_matches where source_event_id='completion-success'),1,'successful complete detail needs only one dedicated request');
select is((select completion_due_at from private.provider_request_groups where source_event_id='completion-success'),null::timestamptz,'complete detail stops optional polling instead of spending an unnecessary retry');
select private.release_provider_worker_slot((select (result->>'dispatchToken')::uuid from completion_slot),1,'completed');

update private.provider_budget_state set feature_bytes=79990000,reserved_growth_bytes=0,optional_work_allowed=true,new_demand_allowed=true,database_bytes=50000000 where provider='espn';
select is(private.reserve_catalog_bytes(20000,true),false,'optional growth stops immediately at eighty percent between measurements');
select is((select new_demand_allowed from private.provider_budget_state),true,'optional stop preserves remaining ordinary admission reserve');
update private.provider_budget_state set feature_bytes=89990000,reserved_growth_bytes=0,optional_work_allowed=false,new_demand_allowed=true where provider='espn';
select is(private.reserve_catalog_bytes(20000,false),false,'persistent growth stops immediately at ninety percent between measurements');
select is((select new_demand_allowed from private.provider_budget_state),false,'capacity denial persists until actual maintenance/measurement');
select * from finish();
rollback;
