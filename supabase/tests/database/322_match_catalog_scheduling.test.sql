begin;
select no_plan();
\ir ../fixtures/match_catalog.sql
insert into private.provider_matches(league_id,source_event_id,home_name,away_name,lifecycle,kickoff_at,kickoff_validity)
select id,'schedule-event','Home','Away','scheduled','2030-01-01 12:00Z','confirmed' from private.provider_leagues where league_code='eng.1';
select is(private.catalog_match_due_at(m,'2030-01-01 11:59Z'),timestamptz '2030-01-01 12:00Z','known kickoff is dormant until its exact start') from private.provider_matches m where source_event_id='schedule-event';
update private.provider_matches set lifecycle='live',last_attempt_at='2030-01-01 12:00Z' where source_event_id='schedule-event';
select is(private.catalog_match_due_at(m,'2030-01-01 12:00:10Z'),timestamptz '2030-01-01 12:01Z','live cadence starts at last attempt, not response completion') from private.provider_matches m where source_event_id='schedule-event';
update private.provider_matches set lifecycle='delayed',condition_started_at='2030-01-01 12:00Z' where source_event_id='schedule-event';
select is(private.catalog_match_due_at(m,'2030-01-01 12:20Z'),timestamptz '2030-01-01 12:05Z','early uncertainty cadence is five minutes') from private.provider_matches m where source_event_id='schedule-event';
update private.provider_matches set lifecycle='live',availability_reason='provider_status_unknown' where source_event_id='schedule-event';
select is(private.catalog_match_due_at(m,'2030-01-01 12:20Z'),timestamptz '2030-01-01 12:05Z','uncertain status after a known live score slows acquisition without erasing saved lifecycle') from private.provider_matches m where source_event_id='schedule-event';
update private.provider_matches set lifecycle='delayed',availability_reason=null where source_event_id='schedule-event';
select is(private.catalog_match_due_at(m,'2030-01-01 13:00Z'),timestamptz '2030-01-01 12:15Z','uncertainty cadence becomes fifteen minutes') from private.provider_matches m where source_event_id='schedule-event';
select is(private.catalog_match_due_at(m,'2030-01-01 15:00Z'),timestamptz '2030-01-01 13:00Z','long uncertainty cadence becomes hourly') from private.provider_matches m where source_event_id='schedule-event';
select is(private.catalog_match_due_at(m,'2030-01-03 12:00Z'),timestamptz '2030-01-01 18:00Z','multi-day uncertainty cadence is six hours and never age-completes') from private.provider_matches m where source_event_id='schedule-event';
update private.provider_matches set lifecycle='finished' where source_event_id='schedule-event';
select is(private.catalog_match_due_at(m,'2030-01-01 12:00Z'),null::timestamptz,'explicit terminal state stops normal monitoring') from private.provider_matches m where source_event_id='schedule-event';
update private.provider_matches set lifecycle='unknown',kickoff_at=null,kickoff_validity='unknown',condition_started_at=null where source_event_id='schedule-event';
select is(private.catalog_match_due_at(m,'2030-01-01 12:00Z'),null::timestamptz,'unknown non-live kickoff creates no recurring source work') from private.provider_matches m where source_event_id='schedule-event';
select is(private.dispatch_catalog_work()->>'dispatched','0','empty/disabled tick invokes no Edge worker');
select is((select count(*)::integer from private.provider_worker_slots where lease_token is not null),0,'idle due check does not consume a slot');
select is((select active from cron.job where jobname='match-catalog-monitor'),false,'owned fifteen-second job is installed inactive');
select ok(not has_function_privilege('authenticated','private.dispatch_catalog_work()','execute'),'clients cannot enqueue privileged worker HTTP');
select ok(not has_function_privilege('match_catalog_backend','private.dispatch_catalog_work()','execute'),'worker login cannot read vault or enqueue more workers');

-- An explicitly live match may legitimately have no trustworthy kickoff. A 404
-- must move it to finite uncertainty polling rather than erase all future due work.
update private.provider_budget_state set ownership_mode='catalog',rolling_limit=30,daily_limit=5000 where provider='espn';
update private.provider_matches set lifecycle='live',kickoff_at=null,kickoff_validity='unknown',condition_started_at=null,availability_reason=null,
  scoreboard_group_id=(select g.id from private.provider_request_groups g join private.provider_leagues l on l.id=g.league_id where l.league_code='eng.1' limit 1)
where source_event_id='schedule-event';
update private.provider_request_groups set next_attempt_at=clock_timestamp(),live_due_at=clock_timestamp()
where id=(select scoreboard_group_id from private.provider_matches where source_event_id='schedule-event');
create temporary table missing_kickoff_slot as select private.acquire_provider_worker_slot('live',1) as result;
create temporary table missing_kickoff_claim as select private.claim_provider_batch(
  array[(select scoreboard_group_id from private.provider_matches where source_event_id='schedule-event')],
  'live',(select (result->>'dispatchToken')::uuid from missing_kickoff_slot),1) as result;
select is((select jsonb_array_length(result->'claims') from missing_kickoff_claim),1,'unknown kickoff does not reject explicitly live source ownership');
select is(private.fail_provider_request(
  (select (result#>>'{claims,0,attemptId}')::bigint from missing_kickoff_claim),
  (select (result#>>'{claims,0,leaseToken}')::uuid from missing_kickoff_claim),1,'match_not_found',404,null)->>'ok','true','missing live source response is durably classified');
select ok(condition_started_at is not null,'404 establishes uncertainty start even when kickoff is unknown') from private.provider_matches where source_event_id='schedule-event';
select ok(private.catalog_match_due_at(m,clock_timestamp()) is not null
  and private.catalog_match_due_at(m,clock_timestamp())>=m.last_attempt_at+interval '5 minutes',
  'unknown-kickoff live match remains eligible on a finite slower cadence after 404') from private.provider_matches m where source_event_id='schedule-event';

-- A single admitted consumer follows the provider's new UTC kickoff date. The
-- local date embedded in an offset string is deliberately a different day.
create temporary table moved_date_context as
select gen_random_uuid() as grant_id,m.scoreboard_group_id as old_group,
  (((clock_timestamp() at time zone 'UTC')::date+2)::text||'T00:30:00+14:00') as kickoff_input
from private.provider_matches m where source_event_id='schedule-event';
insert into private.solo_tracking_grants(id,nonce_digest,grant_digest,signing_key_id,creation_operation_id,creation_request_digest,expires_at)
select grant_id,decode(repeat('31',32),'hex'),decode(repeat('32',32),'hex'),'date-move-test',gen_random_uuid(),decode(repeat('33',32),'hex'),clock_timestamp()+interval '3 days'
from moved_date_context;
insert into private.solo_tracked_matches(grant_id,match_id,admitted_until)
select context.grant_id,m.id,clock_timestamp()+interval '3 days' from moved_date_context context cross join private.provider_matches m where m.source_event_id='schedule-event';
select private.refresh_catalog_group_due(array[(select old_group from moved_date_context)]);
select ok((select live_due_at is not null from private.provider_request_groups where id=(select old_group from moved_date_context)),
  'sole tracked consumer initially owns its old board due time');
update private.provider_matches set lifecycle='scheduled',availability_reason=null,condition_started_at=null,
  kickoff_at=(select kickoff_input::timestamptz from moved_date_context),kickoff_validity='confirmed'
where source_event_id='schedule-event';
select isnt((select scoreboard_group_id from private.provider_matches where source_event_id='schedule-event'),
  (select old_group from moved_date_context),'confirmed date movement links a different actual-date board');
select is((select g.request_date from private.provider_matches m join private.provider_request_groups g on g.id=m.scoreboard_group_id where m.source_event_id='schedule-event'),
  (select (kickoff_input::timestamptz at time zone 'UTC')::date from moved_date_context),'new request scope follows the kickoff UTC date');
select isnt((select g.request_date from private.provider_matches m join private.provider_request_groups g on g.id=m.scoreboard_group_id where m.source_event_id='schedule-event'),
  (select left(kickoff_input,10)::date from moved_date_context),'provider offset calendar date is not substituted for the UTC board scope');
select is((select live_due_at from private.provider_request_groups where id=(select old_group from moved_date_context)),null::timestamptz,
  'old board loses live demand when its only consumer moves dates');
select is((select g.live_due_at from private.provider_matches m join private.provider_request_groups g on g.id=m.scoreboard_group_id where m.source_event_id='schedule-event'),
  (select kickoff_at from private.provider_matches where source_event_id='schedule-event'),'new board remains dormant until the moved kickoff');
select * from finish();
rollback;
