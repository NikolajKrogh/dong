begin;
select plan(40);

select has_table('private', 'provider_matches', 'compact match identity exists');
select has_table('private', 'provider_match_observations', 'meaningful versions exist');
select has_table('private', 'provider_request_attempts', 'reservations are durable');
select is((select ownership_mode from private.provider_budget_state where provider = 'espn'), 'disabled', 'new acquisition defaults disabled');
select is((select count(*)::integer from private.provider_worker_slots), 2, 'exactly two worker slots');
select ok(not has_table_privilege('anon', 'private.provider_matches', 'select'), 'anon cannot read internal rows');
select ok(not has_table_privilege('authenticated', 'private.provider_request_attempts', 'select'), 'users cannot inspect attempt internals');
select ok(not has_function_privilege('anon', 'private.claim_provider_request(bigint,text,uuid,bigint)', 'execute'), 'public caller cannot claim budget');
select ok(not has_function_privilege('authenticated', 'private.accept_provider_response(bigint,uuid,bigint,jsonb)', 'execute'), 'user cannot supply source facts');

insert into private.provider_leagues(provider, league_code, display_name) values ('espn','test.1','Test League');
insert into private.provider_request_groups(provider, league_id, resource_kind, request_date)
select 'espn', id, 'scoreboard', current_date from private.provider_leagues where league_code = 'test.1';
select is((private.claim_provider_request((select id from private.provider_request_groups limit 1), 'discovery', gen_random_uuid(), 1)->>'code'), 'acquisition_paused', 'disabled owner makes no attempt');
select is((select count(*)::integer from private.provider_request_attempts), 0, 'rejected claim costs no allowance');

update private.provider_budget_state set ownership_mode='catalog', rolling_limit=2, daily_limit=3 where provider='espn';
update private.provider_worker_slots set lease_token=gen_random_uuid(), worker_generation=1, lease_until=clock_timestamp()+interval '60 seconds' where id=1;
update private.provider_request_groups set discovery_until=clock_timestamp()+interval '2 minutes', next_attempt_at=clock_timestamp();
create temporary table claimed as select private.claim_provider_request((select id from private.provider_request_groups limit 1),'discovery',(select lease_token from private.provider_worker_slots where id=1),1) as result;
select is((select result->>'ok' from claimed), 'true', 'configured due resource admits once');
select is((private.claim_provider_request((select id from private.provider_request_groups limit 1), 'discovery', (select lease_token from private.provider_worker_slots where id=1), 1)->>'code'), 'already_claimed', 'parallel owner cannot duplicate claimed resource');
select is((select daily_count from private.provider_budget_state where provider='espn'), 1::bigint, 'reservation increments durable daily count');
select is((select count(*)::integer from private.provider_request_attempts), 1, 'one claim creates one counted reservation');

select is((private.accept_provider_response((select (result->>'attemptId')::bigint from claimed), gen_random_uuid(), 1, '{"matches":[],"isPartial":false}'::jsonb)->>'code'), 'stale_claim', 'wrong token cannot accept');
select is((private.accept_provider_response((select (result->>'attemptId')::bigint from claimed), (select (result->>'leaseToken')::uuid from claimed), 2, '{"matches":[],"isPartial":false}'::jsonb)->>'code'), 'stale_claim', 'wrong generation cannot accept');
select is((private.accept_provider_response((select (result->>'attemptId')::bigint from claimed), (select (result->>'leaseToken')::uuid from claimed), 1, '{"matches":[],"isPartial":false}'::jsonb)->>'ok'), 'true', 'valid empty resource accepted');
select ok((select successful_empty from private.provider_request_groups limit 1), 'empty success is retained');

create temporary table compact_input as select '{"identity":{"provider":"espn","leagueCode":"test.1","sourceEventId":"event-1","sourceCompetitionId":"competition-2"},"homeTeam":{"sourceTeamId":"home-1","name":"Home"},"awayTeam":{"sourceTeamId":"away-2","name":"Away"},"lifecycle":"live","homeScore":2,"awayScore":0,"availability":"available","displayClock":"60"}'::jsonb as value;
select ok(private.accept_compact_provider_match((select id from private.provider_request_groups limit 1),10,(select value from compact_input),clock_timestamp()), 'valid compact match accepts');
select is((select observation_version from private.provider_matches),1::bigint,'first meaningful state has version one');
select is((select source_competition_id from private.provider_matches),'competition-2','competition ID is independent of event ID');
select ok((select period is null from private.provider_matches),'unknown period remains null');
select is((select away_score from private.provider_matches),0,'known zero is saved');
select ok(private.accept_compact_provider_match((select id from private.provider_request_groups limit 1),11,(select value||'{"displayClock":"61"}'::jsonb from compact_input),clock_timestamp()), 'unchanged score with clock accepts');
select is((select count(*)::integer from private.provider_match_observations),1,'clock-only change does not append history');
select is((select display_clock from private.provider_matches),'61','current clock updates independently');
select ok(private.accept_compact_provider_match((select id from private.provider_request_groups limit 1),12,(select value||'{"homeScore":1}'::jsonb from compact_input),clock_timestamp()), 'source correction accepts');
select is((select observation_version from private.provider_matches),2::bigint,'correction appends one meaningful version');
select ok(private.accept_compact_provider_match((select id from private.provider_request_groups limit 1),11,(select value from compact_input),clock_timestamp()), 'obsolete cross-resource projection is safely ignored');
select is((select home_score from private.provider_matches),1,'late older resource cannot overwrite newer score');
select ok(not private.accept_compact_provider_match((select id from private.provider_request_groups limit 1),13,(select jsonb_set(value,'{identity,sourceCompetitionId}','"other-competition"') from compact_input),clock_timestamp()), 'conflicting known competition is rejected');
select ok(not private.accept_compact_provider_match((select id from private.provider_request_groups limit 1),13,(select jsonb_set(value,'{homeTeam,sourceTeamId}','"other-team"') from compact_input),clock_timestamp()), 'conflicting known team is rejected');
select ok(private.accept_compact_provider_match((select id from private.provider_request_groups limit 1),13,(select value- 'homeScore' from compact_input),clock_timestamp()), 'partial score check retains prior accepted pair');
select is((select home_score from private.provider_matches),1,'omitted score never becomes zero or replaces half of a pair');
select throws_ok('update private.provider_match_observations set home_score=99','23514','Provider observations are immutable','accepted observation cannot be changed');

update private.provider_request_groups set next_attempt_at=clock_timestamp();
create temporary table second_claim as select private.claim_provider_request((select id from private.provider_request_groups limit 1),'discovery',(select lease_token from private.provider_worker_slots where id=1),1) as result;
select is((select result->>'ok' from second_claim),'true','second available rolling reservation accepts');
update private.provider_request_groups set lease_until=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp();
select is((private.claim_provider_request((select id from private.provider_request_groups limit 1),'discovery',(select lease_token from private.provider_worker_slots where id=1),1)->>'code'),'budget_exhausted','expired ambiguous reservation still counts against rolling budget');
select is((select daily_count from private.provider_budget_state where provider='espn'),2::bigint,'ambiguous attempt is never refunded');
select is((private.accept_provider_response((select (result->>'attemptId')::bigint from second_claim),(select (result->>'leaseToken')::uuid from second_claim),null,'{"matches":[],"isPartial":false}'::jsonb)->>'code'),'stale_claim','null generation cannot authorize acceptance');

select * from finish();
rollback;
