begin;
select plan(15);

select ok(not test_enabled and not live_enabled and not iphone_verification_enabled
  and cardinality(test_targets) = 0 and cardinality(live_targets) = 0,
  'a fresh migration cannot send or admit a target')
from private.goal_notification_policy;
select is((select max_installations from private.goal_notification_policy), 50, 'bounded initial enrollment cap');
select ok(not has_table_privilege('anon', 'private.goal_notification_subscriptions', 'select'),
  'anon cannot read endpoints');
select ok(not has_table_privilege('authenticated', 'private.goal_notification_installations', 'update'),
  'authenticated callers cannot grant themselves consent');
select ok(not has_function_privilege('anon', 'private.consume_goal_notification_enrollment_grant(bytea,uuid)', 'execute'),
  'grant consumption is server-only');

insert into private.goal_notification_installations (id, owner_kind, owner_id, control_digest, consent, environment, mode, target)
values
  ('10000000-0000-4000-8000-000000000001', 'registered', gen_random_uuid(), extensions.digest('preview-control', 'sha256'), true, 'preview-one', 'preview', 'android_chrome'),
  ('10000000-0000-4000-8000-000000000002', 'guest', gen_random_uuid(), extensions.digest('other-control', 'sha256'), true, 'preview-two', 'preview', 'android_chrome'),
  ('10000000-0000-4000-8000-000000000003', 'solo', gen_random_uuid(), extensions.digest('other-target', 'sha256'), true, 'preview-one', 'preview', 'android_firefox');

insert into private.goal_notification_enrollment_grants (digest, environment, mode, target, expires_at)
values
  (extensions.digest('valid', 'sha256'), 'preview-one', 'preview', 'android_chrome', now() + interval '1 minute'),
  (extensions.digest('expired', 'sha256'), 'preview-one', 'preview', 'android_chrome', now() - interval '1 second');

select ok(not private.consume_goal_notification_enrollment_grant(extensions.digest('expired', 'sha256'),
  '10000000-0000-4000-8000-000000000001'), 'expired grant cannot be consumed');
select ok(not private.consume_goal_notification_enrollment_grant(extensions.digest('valid', 'sha256'),
  '10000000-0000-4000-8000-000000000002'), 'grant is bound to its environment');
select ok(not private.consume_goal_notification_enrollment_grant(extensions.digest('valid', 'sha256'),
  '10000000-0000-4000-8000-000000000003'), 'grant is bound to its target');
select ok(private.consume_goal_notification_enrollment_grant(extensions.digest('valid', 'sha256'),
  '10000000-0000-4000-8000-000000000001'), 'matching grant is consumed once');
select ok(not private.consume_goal_notification_enrollment_grant(extensions.digest('valid', 'sha256'),
  '10000000-0000-4000-8000-000000000001'), 'grant replay is rejected');

insert into private.goal_notification_installations
  (owner_kind, owner_id, control_digest, consent, environment, mode, target, approval_expires_at)
values ('registered', gen_random_uuid(), extensions.digest('iphone-one', 'sha256'), true,
  'production', 'iphone_verification', 'iphone_home_screen', now() + interval '1 day');

select throws_ok($sql$insert into private.goal_notification_installations
  (owner_kind, owner_id, control_digest, consent, environment, mode, target, approval_expires_at)
  values ('registered', gen_random_uuid(), extensions.digest('iphone-two', 'sha256'), true,
    'production', 'iphone_verification', 'iphone_home_screen', now() + interval '1 day')$sql$,
  '23505', null, 'only one consenting production iPhone verification installation is permitted');
select throws_ok($sql$insert into private.goal_notification_installations
  (owner_kind, owner_id, control_digest, consent, environment, mode, target)
  values ('registered', gen_random_uuid(), extensions.digest('iphone-missing-expiry', 'sha256'), true,
    'production', 'iphone_verification', 'iphone_home_screen')$sql$,
  '23514', null, 'production iPhone verification must expire');

insert into private.goal_notification_subscriptions (installation_id, endpoint, p256dh, auth_key, vapid_key_id)
values ('10000000-0000-4000-8000-000000000001', 'https://push.example/endpoint',
  decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture');
select throws_ok($sql$insert into private.goal_notification_subscriptions (installation_id, endpoint, p256dh, auth_key, vapid_key_id)
  values ('10000000-0000-4000-8000-000000000002', 'https://push.example/endpoint',
    decode('04' || repeat('00', 64), 'hex'), decode(repeat('00', 16), 'hex'), 'fixture')$sql$,
  '23505', null, 'an endpoint cannot belong to two installations');
delete from private.goal_notification_subscriptions where installation_id = '10000000-0000-4000-8000-000000000001';
select ok((select consent from private.goal_notification_installations
  where id = '10000000-0000-4000-8000-000000000001'), 'endpoint removal preserves same-identity consent');
select ok((select relrowsecurity from pg_class where oid = 'private.goal_notification_subscriptions'::regclass),
  'subscriptions use row-level security as defense in depth');

select * from finish();
rollback;
