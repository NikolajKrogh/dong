begin;
select plan(6);

select ok(not live_enabled and cardinality(live_targets) = 0,
  'a fresh migration cannot send or admit a target')
from private.goal_notification_policy;
select ok(not has_table_privilege('anon', 'private.goal_notification_subscriptions', 'select'),
  'anon cannot read endpoints');
select ok(not has_table_privilege('authenticated', 'private.goal_notification_installations', 'update'),
  'authenticated callers cannot grant themselves consent');
insert into private.goal_notification_installations (id, owner_kind, owner_id, control_digest, consent, environment, target)
values
  ('10000000-0000-4000-8000-000000000001', 'registered', gen_random_uuid(), extensions.digest('first-control', 'sha256'), true, 'production', 'iphone_home_screen'),
  ('10000000-0000-4000-8000-000000000002', 'guest', gen_random_uuid(), extensions.digest('second-control', 'sha256'), true, 'production', 'iphone_home_screen');

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
