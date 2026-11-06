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
  iphone_verification_enabled boolean not null default false,
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
  mode text not null check (mode in ('preview', 'pilot', 'iphone_verification', 'public')),
  target text not null check (
    target in ('android_chrome', 'android_firefox', 'android_samsung', 'iphone_home_screen', 'other')
  ),
  approval_expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (not consent or revoked_at is null),
  check (
    mode <> 'iphone_verification'
    or (environment = 'production' and target = 'iphone_home_screen' and approval_expires_at is not null)
  )
);
create unique index goal_notification_single_iphone_verification
  on private.goal_notification_installations (mode)
  where mode = 'iphone_verification' and consent;
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

create table private.goal_notification_enrollment_grants (
  digest bytea primary key check (octet_length(digest) = 32),
  environment text not null check (environment ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  mode text not null check (mode in ('preview', 'pilot', 'iphone_verification')),
  target text not null check (
    target in ('android_chrome', 'android_firefox', 'android_samsung', 'iphone_home_screen', 'other')
  ),
  expires_at timestamptz not null,
  approval_expires_at timestamptz,
  consumed_at timestamptz,
  installation_id uuid references private.goal_notification_installations (id) on delete set null,
  check (consumed_at is not null or installation_id is null),
  check (
    mode <> 'iphone_verification'
    or (environment = 'production' and target = 'iphone_home_screen' and approval_expires_at is not null)
  )
);

-- Consume in the registration transaction after inserting the matching installation.
create function private.consume_goal_notification_enrollment_grant(
  p_digest bytea, p_installation_id uuid
) returns boolean language sql set search_path = ''
as $$
  with claimed as (
    update private.goal_notification_enrollment_grants as g
    set consumed_at = pg_catalog.statement_timestamp(), installation_id = i.id
    from private.goal_notification_installations as i
    where g.digest = p_digest
      and i.id = p_installation_id
      and i.consent
      and g.environment = i.environment and g.mode = i.mode and g.target = i.target
      and g.approval_expires_at is not distinct from i.approval_expires_at
      and g.expires_at > pg_catalog.statement_timestamp()
      and (g.approval_expires_at is null or g.approval_expires_at > pg_catalog.statement_timestamp())
      and g.consumed_at is null
    returning 1
  )
  select exists (select from claimed);
$$;

alter table private.goal_notification_policy enable row level security;
alter table private.goal_notification_installations enable row level security;
alter table private.goal_notification_subscriptions enable row level security;
alter table private.goal_notification_enrollment_grants enable row level security;
revoke all on table private.goal_notification_policy, private.goal_notification_installations,
  private.goal_notification_subscriptions, private.goal_notification_enrollment_grants
  from public, anon, authenticated, service_role;
revoke all on function private.consume_goal_notification_enrollment_grant(bytea, uuid)
  from public, anon, authenticated, service_role;
