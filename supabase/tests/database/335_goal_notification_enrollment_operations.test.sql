begin;
select plan(31);

select ok(has_function_privilege('goal_notification_backend',
  'private.goal_notification_status(text,text,bytea,uuid,bytea,bigint)', 'execute'),
  'server login may check enrollment status');
select ok(not has_table_privilege('goal_notification_backend', 'private.goal_notification_subscriptions', 'select'),
  'server login cannot browse subscription material');
select ok(not has_function_privilege('authenticated',
  'private.goal_notification_status(text,text,bytea,uuid,bytea,bigint)', 'execute'),
  'authenticated browser cannot call private operations');

create temp table goal_fixture as
select gen_random_uuid() as solo_id, gen_random_uuid() as installation_id, gen_random_uuid() as test_id,
  extensions.digest('solo-proof', 'sha256') as solo_proof, extensions.digest('installation-proof', 'sha256') as control,
  extensions.digest('enrollment-proof', 'sha256') as enrollment;

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
insert into private.goal_notification_enrollment_grants (digest, environment, mode, target, expires_at)
select enrollment, 'local', 'preview', 'android_chrome', now() + interval '1 hour' from goal_fixture;

select is(private.goal_notification_status('local', 'android_chrome', enrollment, null, null, null),
  'pilot_access_required', 'default policy blocks enrollment despite a valid grant') from goal_fixture;
update private.goal_notification_policy set test_enabled = true, test_targets = array['android_chrome'];
select is(private.goal_notification_status('local', 'android_chrome', enrollment, null, null, null),
  'available', 'approved preview grant exposes enrollment') from goal_fixture;
select is(private.goal_notification_status('production', 'android_chrome', enrollment, null, null, null),
  'pilot_access_required', 'the preview grant cannot be used in production') from goal_fixture;
select is(private.goal_notification_status('production', 'iphone_home_screen', null, null, null, null),
  'awaiting_device_verification', 'public iPhone verification remains gated');

select is(private.register_goal_notification_installation(installation_id, 'local', 'android_chrome', enrollment,
  'solo', null, null, null, solo_proof, control, 'https://fcm.googleapis.com/fcm/send/fixture',
  decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture'),
  1::bigint, 'authorized enrollment consumes the grant') from goal_fixture;
select is(private.register_goal_notification_installation(installation_id, 'local', 'android_chrome', enrollment,
  'solo', null, null, null, solo_proof, control, 'https://fcm.googleapis.com/fcm/send/fixture',
  decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture'),
  1::bigint, 'exact registration replay is safe') from goal_fixture;
select is(private.register_goal_notification_installation(gen_random_uuid(), 'local', 'android_chrome', enrollment,
  'solo', null, null, null, solo_proof, extensions.digest('different-control', 'sha256'), 'https://fcm.googleapis.com/fcm/send/fixture',
  decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture'),
  null::bigint, 'consumed grant cannot enroll another installation') from goal_fixture;
select is(private.reserve_goal_notification_test(installation_id, extensions.digest('wrong', 'sha256'),
  1, 'local', test_id, 'solo', null, null, null, solo_proof)->>'status',
  'not_eligible', 'test send requires the installation credential') from goal_fixture;
select is(private.reserve_goal_notification_test(installation_id, control,
  1, 'local', test_id, 'solo', null, null, null, extensions.digest('wrong', 'sha256'))->>'status',
  'not_eligible', 'test send requires current game authority') from goal_fixture;
select is(private.reserve_goal_notification_test(installation_id, control,
  1, 'local', test_id, 'solo', null, null, null, solo_proof)->>'endpoint',
  'https://fcm.googleapis.com/fcm/send/fixture', 'test destination is the stored endpoint') from goal_fixture;
select is(private.reserve_goal_notification_test(installation_id, control,
  1, 'local', test_id, 'solo', null, null, null, solo_proof)->>'status',
  'pending', 'test replay cannot reserve another send') from goal_fixture;
select is(private.reserve_goal_notification_test(installation_id, control,
  1, 'local', gen_random_uuid(), 'solo', null, null, null, solo_proof)->>'status',
  'rate_limited', 'a different request must respect the cooldown') from goal_fixture;

do $$
begin
  perform private.complete_goal_notification_test(installation_id, 1, test_id, 'invalid_endpoint')
  from goal_fixture;
end;
$$;
select is(private.goal_notification_status('local', 'android_chrome', null, installation_id, control, 1),
  'repair_required', 'provider expiry preserves consent and requests repair') from goal_fixture;
select is(private.cache_goal_notification_apple_authorization('https://web.push.apple.com', 'test-public-key', 'first'),
  'first', 'first Apple header is cached');
select is(private.cache_goal_notification_apple_authorization('https://web.push.apple.com', 'test-public-key', 'second'),
  'first', 'subsequent worker calls reuse the current Apple header');


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
  'revoked Auth session no longer authorizes test sends') from goal_room_fixture;
select is(private.goal_notification_owner('guest', room_id, null, null, guest_proof), guest_id,
  'active guest grant resolves only its participant') from goal_room_fixture;
select is(private.goal_notification_owner('guest', gen_random_uuid(), null, null, guest_proof), null::uuid,
  'guest proof cannot authorize another room') from goal_room_fixture;
update public.participants
set guest_grant_issued_at = now() - interval '2 hours', guest_grant_expires_at = now() - interval '1 hour'
where id = (select guest_id from goal_room_fixture);
select is(private.goal_notification_owner('guest', room_id, null, null, guest_proof), null::uuid,
  'expired guest proof no longer authorizes test sends') from goal_room_fixture;


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
