begin;
select no_plan();
\ir ../fixtures/match_catalog.sql
select is(private.set_catalog_ownership('catalog',1)->>'code','configuration_required','unconfigured acquisition cannot be activated');
select is(private.configure_catalog_limits(30,5000)->>'ok','true','operator can supply explicit finite provider budgets');
select is(private.set_catalog_ownership('catalog',1)->>'workerGeneration','2','activation increments ownership generation');
select cron.alter_job((select jobid from cron.job where jobname='match-catalog-monitor'),active:=true);
select is(private.set_catalog_ownership('paused',1)->>'code','stale_generation','operator transition requires current generation');
select is(private.set_catalog_ownership('paused',2)->>'workerGeneration','3','pause fences in-flight generation');
select is((select active from cron.job where jobname='match-catalog-monitor'),true,'paused acquisition keeps the existing closed-client replay driver active');
select is(private.acquire_provider_worker_slot('live',3)->>'code','acquisition_paused','pause stops source workers');
create temporary table replay_slot as select private.acquire_provider_worker_slot('replay',3) as result;
select is((select result->>'ok' from replay_slot),'true','accepted room replay remains available while paused');
select is(private.begin_catalog_dispatch((select (result->>'dispatchToken')::uuid from replay_slot),3)->>'ok','true','paused replay dispatch can be validated without acquisition authority');
select is(private.begin_catalog_dispatch((select (result->>'dispatchToken')::uuid from replay_slot),3)->>'code','invalid_dispatch','same dispatch ingress cannot execute twice');
select ok(not has_function_privilege('service_role','private.set_catalog_ownership(text,bigint)','execute'),'service JWT cannot change acquisition ownership');
select ok(not has_function_privilege('match_catalog_backend','private.set_catalog_ownership(text,bigint)','execute'),'worker login cannot change ownership');
select ok(not has_function_privilege('anon','private.catalog_operator_report()','execute'),'public readers cannot inspect operational internals');
select is(jsonb_typeof(private.catalog_operator_report()->'attemptsLast24Hours'),'number','operator report exposes bounded safe counts');
select throws_ok($$select private.claim_provider_score_refresh(gen_random_uuid(),gen_random_uuid(),gen_random_uuid())$$,'P0001','legacy_provider_disabled','catalog pause cannot revive obsolete legacy provider ownership');
select is(private.set_catalog_ownership('disabled',3)->>'workerGeneration','4','explicit disable still fences replay dispatch generation');
select is((select active from cron.job where jobname='match-catalog-monitor'),false,'explicit disabled mode deactivates the owned job');

-- Move durable timestamps across policy boundaries without waiting or replacing
-- production clock functions. All reservations below use the real batch entrance.
select private.configure_catalog_limits(1,5000);
select is(private.set_catalog_ownership('catalog',4)->>'workerGeneration','5','recovery fixture enters a fresh acquisition generation');
create temporary table recovery_groups as select
  (select g.id from private.provider_request_groups g join private.provider_leagues l on l.id=g.league_id where l.league_code='eng.1' limit 1) as first_group,
  (select g.id from private.provider_request_groups g join private.provider_leagues l on l.id=g.league_id where l.league_code='esp.1' limit 1) as second_group;
update private.provider_request_groups set next_attempt_at=clock_timestamp(),discovery_until=clock_timestamp()+interval '2 minutes';
create temporary table recovery_first_slot as select private.acquire_provider_worker_slot('discovery',5) as result;
create temporary table recovery_first_claim as select private.claim_provider_batch(array[(select first_group from recovery_groups)],'discovery',
  (select (result->>'dispatchToken')::uuid from recovery_first_slot),5) as result;
select is((select jsonb_array_length(result->'claims') from recovery_first_claim),1,'first bounded reservation consumes the single rolling allowance');
update private.provider_request_groups set lease_until=clock_timestamp()-interval '1 second' where id=(select first_group from recovery_groups);
select private.recover_catalog_claims();
select is((select outcome from private.provider_request_attempts where id=(select (result#>>'{claims,0,attemptId}')::bigint from recovery_first_claim)),
  'uncertain','lost dispatch is retained as uncertain after lease expiry');
select is((select daily_count from private.provider_budget_state where provider='espn'),1::bigint,'uncertain reservation is never refunded from daily usage');
select private.recover_catalog_claims();
select is((select count(*)::integer from private.provider_request_attempts where outcome='uncertain'),1,'repeated recovery neither duplicates nor deletes the ambiguous reservation');
update private.provider_request_attempts set reserved_at=clock_timestamp()-interval '59 seconds'
where id=(select (result#>>'{claims,0,attemptId}')::bigint from recovery_first_claim);
create temporary table recovery_inside_slot as select private.acquire_provider_worker_slot('discovery',5) as result;
select is(jsonb_array_length(private.claim_provider_batch(array[(select second_group from recovery_groups)],'discovery',
  (select (result->>'dispatchToken')::uuid from recovery_inside_slot),5)->'claims'),0,'uncertain reservation inside the rolling sixty seconds blocks a different group');
select is((select count(*)::integer from private.provider_request_attempts),1,'rolling denial makes no second source reservation');
select private.release_provider_worker_slot((select (result->>'dispatchToken')::uuid from recovery_first_slot),5,'completed');
select private.release_provider_worker_slot((select (result->>'dispatchToken')::uuid from recovery_inside_slot),5,'completed');
update private.provider_request_attempts set reserved_at=clock_timestamp()-interval '61 seconds'
where id=(select (result#>>'{claims,0,attemptId}')::bigint from recovery_first_claim);
create temporary table recovery_outside_slot as select private.acquire_provider_worker_slot('discovery',5) as result;
create temporary table recovery_outside_claim as select private.claim_provider_batch(array[(select second_group from recovery_groups)],'discovery',
  (select (result->>'dispatchToken')::uuid from recovery_outside_slot),5) as result;
select is((select jsonb_array_length(result->'claims') from recovery_outside_claim),1,'reservation outside sixty seconds releases rolling capacity without a refund');
select is((select daily_count from private.provider_budget_state where provider='espn'),2::bigint,'expired rolling entries still count against the UTC daily budget');
select private.release_provider_worker_slot((select (result->>'dispatchToken')::uuid from recovery_outside_slot),5,'completed');

-- Simulate persisted state immediately after the UTC day changes. Prior-day
-- reservations remain evidence, while only the new day's counter starts again.
update private.provider_request_attempts set reserved_at=(date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')-interval '1 hour';
update private.provider_request_groups set lease_until=clock_timestamp()-interval '1 second' where lease_token is not null;
select private.recover_catalog_claims();
update private.provider_budget_state set rolling_limit=30,usage_day=(clock_timestamp() at time zone 'UTC')::date-1,daily_count=5000 where provider='espn';
update private.provider_request_groups set next_attempt_at=clock_timestamp(),discovery_until=clock_timestamp()+interval '2 minutes'
where id=(select first_group from recovery_groups);
create temporary table recovery_rollover_slot as select private.acquire_provider_worker_slot('discovery',5) as result;
create temporary table recovery_rollover_claim as select private.claim_provider_batch(array[(select first_group from recovery_groups)],'discovery',
  (select (result->>'dispatchToken')::uuid from recovery_rollover_slot),5) as result;
select is((select jsonb_array_length(result->'claims') from recovery_rollover_claim),1,'prior exhausted UTC day does not deny the first new-day request');
select is((select usage_day from private.provider_budget_state where provider='espn'),(clock_timestamp() at time zone 'UTC')::date,'day rollover is based on database UTC');
select is((select daily_count from private.provider_budget_state where provider='espn'),1::bigint,'new-day reservation increments the freshly reset counter once');
select is((select count(*)::integer from private.provider_request_attempts),3,'day rollover preserves earlier reservation evidence');
select is(private.set_catalog_ownership('catalog',5)->>'workerGeneration','6','replacement generation fences a response already in flight');
select is(private.accept_provider_response(
  (select (result#>>'{claims,0,attemptId}')::bigint from recovery_rollover_claim),
  (select (result#>>'{claims,0,leaseToken}')::uuid from recovery_rollover_claim),5,'{"matches":[],"isPartial":false}'::jsonb)->>'code',
  'stale_claim','old generation cannot commit even a well-formed successful response');
select is((select last_successful_check_at from private.provider_request_groups where id=(select first_group from recovery_groups)),null::timestamptz,
  'stale response does not claim a successful empty board');

-- A resource-local access rejection must not become an integration-wide pause.
insert into private.provider_request_groups(provider,league_id,resource_kind,request_date,next_attempt_at,discovery_until)
select 'espn',id,'scoreboard',current_date+n,clock_timestamp(),clock_timestamp()+interval '2 minutes'
from private.provider_leagues cross join generate_series(1,2) n where league_code='eng.1';
update private.provider_request_groups set next_attempt_at=clock_timestamp(),discovery_until=clock_timestamp()+interval '2 minutes',cooldown_until=null,paused=false;
create temporary table recovery_failure_slot as select private.acquire_provider_worker_slot('discovery',6) as result;
create temporary table recovery_failure_claims as select private.claim_provider_batch(
  array[(select first_group from recovery_groups),(select second_group from recovery_groups)],'discovery',
  (select (result->>'dispatchToken')::uuid from recovery_failure_slot),6) as result;
select is(private.fail_provider_request(a.id,a.lease_token,6,'provider_access_rejected',403,null)->>'scope','group','403 rejection is explicitly local to its request group')
from private.provider_request_attempts a where a.group_id=(select first_group from recovery_groups) and a.worker_generation=6;
select ok((select paused from private.provider_request_groups where id=(select first_group from recovery_groups)),'403 group remains durably paused');
select ok(not (select paused from private.provider_request_groups where id=(select second_group from recovery_groups)),'403 does not pause a healthy overlapping group');
select is((select cooldown_until from private.provider_budget_state where provider='espn'),null::timestamptz,'403 does not create a provider-wide cooldown');
create temporary table recovery_healthy_slot as select private.acquire_provider_worker_slot('discovery',6) as result;
select is(jsonb_array_length(private.claim_provider_batch(array[(select id from private.provider_request_groups where request_date=current_date+1 and league_id=(select id from private.provider_leagues where league_code='eng.1'))],
  'discovery',(select (result->>'dispatchToken')::uuid from recovery_healthy_slot),6)->'claims'),1,'another resource can acquire after a neighboring 403');
select is(private.fail_provider_request(a.id,a.lease_token,6,'provider_throttled',429,1200)->>'scope','provider','429 rejection establishes a shared provider cooldown')
from private.provider_request_attempts a where a.group_id=(select second_group from recovery_groups) and a.worker_generation=6;
select ok((select b.cooldown_until>=a.finished_at+interval '1200 seconds' from private.provider_budget_state b cross join private.provider_request_attempts a
  where b.provider='espn' and a.group_id=(select second_group from recovery_groups) and a.worker_generation=6),'Retry-After longer than ordinary backoff survives in durable provider policy');
select private.release_provider_worker_slot((select (result->>'dispatchToken')::uuid from recovery_healthy_slot),6,'completed');
create temporary table recovery_throttled_slot as select private.acquire_provider_worker_slot('discovery',6) as result;
select is(jsonb_array_length(private.claim_provider_batch(array[(select id from private.provider_request_groups where request_date=current_date+2 and league_id=(select id from private.provider_leagues where league_code='eng.1'))],
  'discovery',(select (result->>'dispatchToken')::uuid from recovery_throttled_slot),6)->'claims'),0,'shared cooldown blocks a new unrelated request group');
select is((select count(*)::integer from private.provider_request_attempts a join private.provider_request_groups g on g.id=a.group_id
  where g.request_date=current_date+2),0,'provider cooldown denial consumes no additional reservation');
create temporary table attempts_before_metrics as select count(*) as total from private.provider_request_attempts;
select private.finish_match_discovery(array['eng.1'],current_date);
select is((select count(*) from private.provider_request_attempts),(select total from attempts_before_metrics),'consumer observability cannot reserve source work');
select ok(exists(select 1 from private.provider_request_daily_usage where consumer_count>0 and scope_label like 'eng.1/%'),'reuse/deferral aggregates retain a copied league/date group label');
select ok(private.catalog_operator_report() ? 'groupUsageLast24Hours','operator report includes bounded attempt counts by group and purpose');
select * from finish();
rollback;
