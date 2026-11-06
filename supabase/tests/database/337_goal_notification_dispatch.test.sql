begin;
select plan(12);

create temp table goal_dispatch_fixture as
select gen_random_uuid() as installation_id, gen_random_uuid() as solo_id,
  extensions.digest('delivery-control', 'sha256') as control,
  extensions.digest('delivery-solo', 'sha256') as proof,
  gen_random_uuid() as wake;

update private.goal_notification_policy set test_enabled = true, live_enabled = true,
  test_targets = array['android_chrome'], live_targets = array['android_chrome'];

insert into private.provider_matches(league_id, source_event_id, home_name, away_name, lifecycle, kickoff_validity,
  home_score, away_score, observation_version)
select id, 'goal-dispatch-fixture', 'Home', 'Away', 'live', 'confirmed', 0, 0, 1
from private.provider_leagues where league_code = 'eng.1';
insert into private.provider_match_observations(match_id, observation_version, accepted_at, attempt_sequence, source_scope,
  source_event_id, home_score, away_score, lifecycle, kickoff_validity)
select id, 1, clock_timestamp(), 1, 'fixture', source_event_id, 0, 0, 'live', 'confirmed'
from private.provider_matches where source_event_id = 'goal-dispatch-fixture';
insert into private.solo_tracking_grants(id, nonce_digest, grant_digest, signing_key_id, creation_operation_id, creation_request_digest, expires_at)
select solo_id, extensions.digest('delivery-nonce', 'sha256'), proof, 'fixture', gen_random_uuid(),
  extensions.digest('delivery-request', 'sha256'), now() + interval '1 hour' from goal_dispatch_fixture;
insert into private.solo_tracked_matches(grant_id, match_id, admitted_until)
select f.solo_id, m.id, now() + interval '1 hour'
from goal_dispatch_fixture f cross join private.provider_matches m where m.source_event_id = 'goal-dispatch-fixture';
insert into private.goal_notification_installations(id, owner_kind, owner_id, control_digest, consent, environment, target)
select installation_id, 'solo', solo_id, control, true, 'local', 'android_chrome' from goal_dispatch_fixture;
insert into private.goal_notification_subscriptions(installation_id, endpoint, p256dh, auth_key, vapid_key_id)
select installation_id, 'https://fcm.googleapis.com/fcm/send/fixture', decode('04' || repeat('00', 64), 'hex'),
  decode(repeat('00', 16), 'hex'), 'fixture' from goal_dispatch_fixture;

select is(private.goal_notification_game_operation(installation_id, control, 1, 'local', 'solo', null, null, null,
  extensions.digest('invalid', 'sha256'), null, true, null, null)->>'status', 'not_eligible',
  'binding requires the active solo grant') from goal_dispatch_fixture;
select is(private.goal_notification_game_operation(installation_id, control, 1, 'local', 'solo', null, null, null,
  proof, null, true, null, null)->>'status', 'bound', 'the active game binds') from goal_dispatch_fixture;
select is((select baseline from private.goal_notification_match_boundaries), 1::bigint, 'binding records the committed score baseline');

select private.queue_goal_notification_deliveries('local');
select is((select count(*) from private.goal_notification_deliveries), 0::bigint, 'the baseline never enqueues an alert');
insert into private.provider_match_observations(match_id, observation_version, accepted_at, attempt_sequence, source_scope,
  source_event_id, home_score, away_score, lifecycle, kickoff_validity)
select id, 2, clock_timestamp(), 2, 'fixture', source_event_id, 1, 0, 'live', 'confirmed'
from private.provider_matches where source_event_id = 'goal-dispatch-fixture';
update private.provider_matches set home_score = 1, observation_version = 2 where source_event_id = 'goal-dispatch-fixture';
select private.queue_goal_notification_deliveries('local');
select private.queue_goal_notification_deliveries('local');
select is((select count(*) from private.goal_notification_deliveries), 1::bigint, 'repeat scans enqueue a fresh score once');
select is((select count(*) from private.claim_goal_notification_deliveries(gen_random_uuid(), 'local')), 0::bigint,
  'a missing scheduler wake cannot claim work');
insert into private.goal_notification_dispatch_wakes(id, environment, expires_at)
select wake, 'local', clock_timestamp() + interval '30 seconds' from goal_dispatch_fixture;
create temp table goal_claim as
select c.* from goal_dispatch_fixture f cross join lateral private.claim_goal_notification_deliveries(f.wake, 'local') c;
select is((select count(*) from goal_claim), 1::bigint, 'one scheduler wake claims the score');
select is((select count(*) from goal_dispatch_fixture f cross join lateral private.claim_goal_notification_deliveries(f.wake, 'local')),
  0::bigint, 'a scheduler wake cannot be replayed');
select is(private.authorize_goal_notification_delivery(id, token, 'local', 'fixture')->>'homeScore',
  '1', 'the claimed score is authorized with the accepted normal score') from goal_claim;
select is(private.authorize_goal_notification_delivery(id, token, 'local', 'fixture'),
  null::jsonb, 'the same claim cannot authorize a second attempt') from goal_claim;
select private.finish_goal_notification_delivery(id, token, 'accepted', 0, false) from goal_claim;
select ok(private.resolve_goal_notification_delivery(c.id, 'local', 'solo', null, null, null, f.proof),
  'an alert resolves to the current authorized game') from goal_claim c cross join goal_dispatch_fixture f;
update private.solo_tracking_grants set ended_at = now() where id = (select solo_id from goal_dispatch_fixture);
select ok(not private.resolve_goal_notification_delivery(c.id, 'local', 'solo', null, null, null, f.proof),
  'an alert cannot reopen an ended game') from goal_claim c cross join goal_dispatch_fixture f;

select * from finish();
rollback;
