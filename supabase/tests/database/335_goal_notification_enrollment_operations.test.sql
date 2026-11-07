begin;
select plan(40);

select ok(has_function_privilege('goal_notification_backend',
  'private.goal_notification_status(text,text,uuid,bytea,bigint)', 'execute'),
  'server login may check enrollment status');
select ok(not has_table_privilege('goal_notification_backend', 'private.goal_notification_subscriptions', 'select'),
  'server login cannot browse subscription material');
select ok(not has_function_privilege('authenticated',
  'private.goal_notification_status(text,text,uuid,bytea,bigint)', 'execute'),
  'authenticated browser cannot call private operations');
select ok(has_function_privilege('goal_notification_backend',
  'private.read_goal_notification_apple_authorization(text,text)', 'execute'),
  'the sender can read the cached Apple token through the narrow function');
select ok(not has_function_privilege('authenticated',
  'private.read_goal_notification_apple_authorization(text,text)', 'execute'),
  'browser roles cannot read the cached Apple token through SQL');

create temp table goal_fixture as
select gen_random_uuid() as solo_id, gen_random_uuid() as installation_id, extensions.digest('solo-proof', 'sha256') as solo_proof, extensions.digest('installation-proof', 'sha256') as control;

insert into private.provider_matches(league_id, source_event_id, home_name, away_name, lifecycle, kickoff_validity)
select id, 'goal-notification-fixture', 'Home', 'Away', 'live', 'confirmed'
from private.provider_leagues where league_code = 'eng.1';
insert into private.solo_tracking_grants
  (id, nonce_digest, grant_digest, signing_key_id, creation_operation_id, creation_request_digest, expires_at)
select solo_id, extensions.digest('solo-nonce', 'sha256'), solo_proof, 'fixture',
  gen_random_uuid(), extensions.digest('solo-request', 'sha256'), now() + interval '1 hour'
from goal_fixture;
insert into private.solo_tracked_matches (grant_id, match_id, admitted_until)
select solo_id, m.id, now() + interval '1 hour' from goal_fixture
join private.provider_matches m on m.source_event_id = 'goal-notification-fixture';
select is(private.goal_notification_status('local', 'android_chrome', null, null, null),
  'unavailable', 'default policy blocks enrollment');
insert into private.goal_notification_installations(owner_kind, owner_id, control_digest, consent, environment, target)
select 'solo', gen_random_uuid(), extensions.digest(gen_random_uuid()::text, 'sha256'), true, 'local', 'android_chrome'
from generate_series(1, 50);
select is(private.register_goal_notification_installation(installation_id, 'local', 'android_chrome',
  'solo', null, null, null, solo_proof, control, 'https://fcm.googleapis.com/fcm/send/fixture',
  decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture'),
  null::bigint, 'disabled policy blocks registration even with current game authority') from goal_fixture;
update private.goal_notification_policy set live_enabled = true, live_targets = array['android_chrome'];
select is(private.goal_notification_status('local', 'android_chrome', null, null, null),
  'available', 'enabled browsers can enroll without an invite');
select is(private.goal_notification_status('production', 'iphone_home_screen', null, null, null),
  'unavailable', 'targets outside the configured rollout are unavailable');
update private.goal_notification_policy set live_targets = array['android_chrome', 'iphone_home_screen'];
select is(private.goal_notification_status('production', 'iphone_home_screen', null, null, null),
  'available', 'enabled iPhone Home Screen uses the same enrollment flow');

select is(private.register_goal_notification_installation(installation_id, 'local', 'android_chrome',
  'solo', null, null, null, extensions.digest('wrong', 'sha256'), control, 'https://fcm.googleapis.com/fcm/send/fixture',
  decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture'),
  null::bigint, 'registration still requires current game authority') from goal_fixture;
select is(private.register_goal_notification_installation(installation_id, 'local', 'android_chrome',
  'solo', null, null, null, solo_proof, control, 'https://fcm.googleapis.com/fcm/send/fixture',
  decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture'),
  1::bigint, 'authorized enrollment succeeds beyond fifty existing installations') from goal_fixture;
select is(private.register_goal_notification_installation(installation_id, 'local', 'android_chrome',
  'solo', null, null, null, solo_proof, control, 'https://fcm.googleapis.com/fcm/send/fixture',
  decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture'),
  1::bigint, 'exact registration replay is safe') from goal_fixture;
select is(private.register_goal_notification_installation(gen_random_uuid(), 'local', 'android_chrome',
  'solo', null, null, null, solo_proof, extensions.digest('different-control', 'sha256'), 'https://fcm.googleapis.com/fcm/send/fixture',
  decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture'),
  null::bigint, 'duplicate endpoint cannot enroll another installation') from goal_fixture;
select is(private.goal_notification_status('production', 'android_chrome', installation_id, control, 1),
  'unavailable', 'installation credentials remain scoped to the environment') from goal_fixture;
select is(private.register_goal_notification_installation(gen_random_uuid(), 'production', 'iphone_home_screen',
  'solo', null, null, null, solo_proof, extensions.digest('iphone-control-one', 'sha256'), 'https://web.push.apple.com/fixture-one',
  decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture'),
  1::bigint, 'an iPhone Home Screen installation can enroll directly') from goal_fixture;
select is(private.register_goal_notification_installation(gen_random_uuid(), 'production', 'iphone_home_screen',
  'solo', null, null, null, solo_proof, extensions.digest('iphone-control-two', 'sha256'), 'https://web.push.apple.com/fixture-two',
  decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture'),
  1::bigint, 'a second iPhone installation uses the same opt-in') from goal_fixture;
select is(private.register_goal_notification_installation(gen_random_uuid(), 'production', 'iphone_home_screen',
  'solo', null, null, null, solo_proof, extensions.digest('iphone-control-three', 'sha256'), 'https://web.push.apple.com/fixture-three',
  decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture'),
  null::bigint, 'the per-owner installation cap still applies') from goal_fixture;
update private.goal_notification_subscriptions set invalid_at = clock_timestamp()
where installation_id = (select installation_id from goal_fixture);
select is(private.goal_notification_status('local', 'android_chrome', installation_id, control, 1),
  'repair_required', 'provider expiry preserves consent and requests repair') from goal_fixture;
select is(private.read_goal_notification_apple_authorization('https://web.push.apple.com', 'test-public-key'),
  null::text, 'an empty Apple cache has no token');
select is(private.cache_goal_notification_apple_authorization('https://web.push.apple.com', 'test-public-key', 'first'),
  'first', 'first Apple header is cached');
create temp table goal_cached_apple_token as
select ctid::text as row_version from private.goal_notification_apple_authorizations
where origin = 'https://web.push.apple.com' and public_key = 'test-public-key';
select is(private.read_goal_notification_apple_authorization('https://web.push.apple.com', 'test-public-key'),
  'first', 'the sender can reuse a fresh Apple token without offering a replacement');
select is(private.cache_goal_notification_apple_authorization('https://web.push.apple.com', 'test-public-key', 'second'),
  'first', 'subsequent worker calls reuse the current Apple header');
select is(a.ctid::text, f.row_version, 'the cache hit and redundant refresh attempt leave the row untouched')
from private.goal_notification_apple_authorizations a cross join goal_cached_apple_token f
where a.origin = 'https://web.push.apple.com' and a.public_key = 'test-public-key';
update private.goal_notification_apple_authorizations set generated_at = now() - interval '61 minutes'
where origin = 'https://web.push.apple.com' and public_key = 'test-public-key';
select is(private.read_goal_notification_apple_authorization('https://web.push.apple.com', 'test-public-key'),
  null::text, 'an expired cache entry requests a fresh Apple token');
select is(private.cache_goal_notification_apple_authorization('https://web.push.apple.com', 'test-public-key', 'replacement'),
  'replacement', 'an expired Apple token can be refreshed');
select is(private.read_goal_notification_apple_authorization('https://web.push.apple.com', 'test-public-key'),
  'replacement', 'the replacement is immediately reusable');

create temp table goal_room_fixture as
select gen_random_uuid() as owner_id, gen_random_uuid() as auth_id, gen_random_uuid() as room_id,
  gen_random_uuid() as guest_id, extensions.digest(repeat('a', 64), 'sha256') as guest_proof;

insert into auth.users(id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
select owner_id, 'authenticated', 'authenticated', 'goal-enrollment-fixture@test.local', now(), now(), now(),
  '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false from goal_room_fixture;
insert into public.accounts(id, username)
select owner_id, 'Goal_Enroll_Fixture' from goal_room_fixture;
insert into auth.sessions(id, user_id, created_at, updated_at)
select auth_id, owner_id, now(), now() from goal_room_fixture;
insert into public.game_sessions(id, owner_account_id, join_code, state)
select room_id, owner_id, 'GE000001', 'in_progress' from goal_room_fixture;
insert into public.participants(id, session_id, account_id, display_name, membership_type, session_role)
select gen_random_uuid(), room_id, owner_id, 'Fixture owner', 'registered', 'owner'
from goal_room_fixture f where not exists (
  select from public.participants p where p.session_id = f.room_id and p.account_id = f.owner_id
);
insert into public.participants(id, session_id, display_name, membership_type, session_role,
  guest_rejoin_token_hash, guest_grant_issued_at, guest_grant_expires_at)
select guest_id, room_id, 'Fixture guest', 'guest', 'member', encode(guest_proof, 'hex'), now(), now() + interval '1 hour'
from goal_room_fixture;

select is(private.goal_notification_owner('registered', room_id, owner_id, auth_id, null), owner_id,
  'registered room authority requires the live Auth session and participant') from goal_room_fixture;
delete from auth.sessions where id = (select auth_id from goal_room_fixture);
select is(private.goal_notification_owner('registered', room_id, owner_id, auth_id, null), null::uuid,
  'revoked Auth session no longer authorizes notifications') from goal_room_fixture;
select is(private.goal_notification_owner('guest', room_id, null, null, guest_proof), guest_id,
  'active guest grant resolves only its participant') from goal_room_fixture;
select is(private.goal_notification_owner('guest', gen_random_uuid(), null, null, guest_proof), null::uuid,
  'guest proof cannot authorize another room') from goal_room_fixture;
update public.participants
set guest_grant_issued_at = now() - interval '2 hours', guest_grant_expires_at = now() - interval '1 hour'
where id = (select guest_id from goal_room_fixture);
select is(private.goal_notification_owner('guest', room_id, null, null, guest_proof), null::uuid,
  'expired guest proof no longer authorizes notifications') from goal_room_fixture;


select ok(not has_function_privilege('authenticated',
  'private.disable_goal_notification_installation(uuid,bytea,bigint,text)', 'execute'),
  'browser roles cannot revoke installations through SQL');
select ok(not private.disable_goal_notification_installation(installation_id, extensions.digest('wrong', 'sha256'), 1, 'local'),
  'wrong control credential cannot stop a registered installation') from goal_fixture;
select ok(not private.disable_goal_notification_installation(installation_id, control, 2, 'local'),
  'future generation cannot stop the current registration') from goal_fixture;
select ok(not private.disable_goal_notification_installation(installation_id, control, null, 'local'),
  'missing generation cannot stop the current registration') from goal_fixture;
select ok(private.disable_goal_notification_installation(installation_id, control, 1, 'local'),
  'valid control stops the installation') from goal_fixture;
select ok(not i.consent and i.generation = 2 and s.installation_id is null,
  'stop clears consent, advances the generation and removes the endpoint')
from goal_fixture f join private.goal_notification_installations i on i.id = f.installation_id
left join private.goal_notification_subscriptions s on s.installation_id = i.id;
update private.goal_notification_installations set consent = true, revoked_at = null
where id = (select installation_id from goal_fixture);
select ok(private.disable_goal_notification_installation(installation_id, control, 1, 'local'),
  'an old stop retry is acknowledged idempotently') from goal_fixture;
select ok(i.consent and i.generation = 2, 'the old stop cannot revoke a newer generation')
from goal_fixture f join private.goal_notification_installations i on i.id = f.installation_id;

select * from finish();
rollback;
