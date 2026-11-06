-- Goal notification state is private and inert until explicitly enabled.
create table private.goal_notification_policy (
  singleton boolean primary key default true check (singleton),
  generation bigint not null default 1 check (generation > 0),
  test_enabled boolean not null default false,
  live_enabled boolean not null default false,
  test_targets text[] not null default '{}' check (
    test_targets <@ array['android_chrome', 'android_firefox', 'android_samsung', 'iphone_home_screen', 'other']
  ),
  live_targets text[] not null default '{}' check (
    live_targets <@ array['android_chrome', 'android_firefox', 'android_samsung', 'iphone_home_screen', 'other']
  ),
  max_installations integer not null default 50 check (max_installations between 1 and 50)
);
insert into private.goal_notification_policy default values;

create table private.goal_notification_installations (
  id uuid primary key default gen_random_uuid(),
  owner_kind text not null check (owner_kind in ('registered', 'guest', 'solo')),
  owner_id uuid not null,
  control_digest bytea not null unique check (octet_length(control_digest) = 32),
  generation bigint not null default 1 check (generation > 0),
  consent boolean not null default false,
  environment text not null check (environment ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  target text not null check (
    target in ('android_chrome', 'android_firefox', 'android_samsung', 'iphone_home_screen', 'other')
  ),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (not consent or revoked_at is null)
);
create index goal_notification_installation_owner
  on private.goal_notification_installations (owner_kind, owner_id) where consent;

create table private.goal_notification_subscriptions (
  installation_id uuid primary key references private.goal_notification_installations (id) on delete cascade,
  endpoint text not null check (length(endpoint) between 9 and 2048 and endpoint like 'https://%'),
  endpoint_hash bytea generated always as (extensions.digest(endpoint, 'sha256')) stored unique,
  p256dh bytea not null check (octet_length(p256dh) = 65 and get_byte(p256dh, 0) = 4),
  auth_key bytea not null check (octet_length(auth_key) = 16),
  vapid_key_id text not null check (length(vapid_key_id) between 1 and 64),
  invalid_at timestamptz
);

alter table private.goal_notification_policy enable row level security;
alter table private.goal_notification_installations enable row level security;
alter table private.goal_notification_subscriptions enable row level security;
revoke all on table private.goal_notification_policy, private.goal_notification_installations,
  private.goal_notification_subscriptions
  from public, anon, authenticated, service_role;
