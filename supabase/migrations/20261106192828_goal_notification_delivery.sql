alter table private.goal_notification_policy
  add column live_changed_at timestamptz not null default clock_timestamp();

create function private.fence_goal_notification_policy()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (old.live_enabled, old.live_targets) is distinct from (new.live_enabled, new.live_targets) then
    new.generation := greatest(new.generation, old.generation + 1);
    new.live_changed_at := clock_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function private.fence_goal_notification_policy() from public, anon, authenticated, service_role;
create trigger goal_notification_policy_fence before update on private.goal_notification_policy
for each row execute function private.fence_goal_notification_policy();

create table private.goal_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references private.goal_notification_installations(id) on delete cascade,
  catalog_match_id bigint not null,
  observation_version bigint not null,
  installation_generation bigint not null,
  association_revision bigint not null,
  policy_generation bigint not null,
  accepted_at timestamptz not null,
  deadline timestamptz not null,
  due_at timestamptz not null,
  state text not null default 'pending' check (state in ('pending', 'leased', 'accepted', 'failed', 'suppressed', 'expired')),
  attempts smallint not null default 0 check (attempts between 0 and 3),
  claim_token uuid,
  claim_until timestamptz,
  authorized_at timestamptz,
  uncertain boolean not null default false,
  unique (installation_id, catalog_match_id, observation_version)
);
create index goal_notification_deliveries_due
  on private.goal_notification_deliveries (due_at, id) where state in ('pending', 'leased');
create index goal_notification_deliveries_retention on private.goal_notification_deliveries (accepted_at);

create table private.goal_notification_dispatch_wakes (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index goal_notification_dispatch_wakes_expiry on private.goal_notification_dispatch_wakes (expires_at);
alter table private.goal_notification_deliveries enable row level security;
alter table private.goal_notification_dispatch_wakes enable row level security;
revoke all on table private.goal_notification_deliveries, private.goal_notification_dispatch_wakes
  from public, anon, authenticated, service_role;

create function private.queue_goal_notification_deliveries(p_environment text)
returns void language plpgsql set search_path = '' as $$
declare
  v_policy private.goal_notification_policy%rowtype;
  v_installation uuid;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_policy from private.goal_notification_policy;
  if not coalesce(v_policy.live_enabled, false) then return; end if;
  for v_installation in
    select i.id from private.goal_notification_installations i
    join private.goal_notification_game_associations b on b.installation_id = i.id
    where i.environment = p_environment and i.consent and i.target = any(v_policy.live_targets)
    order by i.id for update of i skip locked
  loop
    perform private.refresh_goal_notification_boundaries(v_installation);
  end loop;

  insert into private.goal_notification_deliveries (
    installation_id, catalog_match_id, observation_version, installation_generation, association_revision,
    policy_generation, accepted_at, deadline, due_at
  )
  select i.id, curr.match_id, curr.observation_version, i.generation, b.revision,
    v_policy.generation, curr.accepted_at, curr.accepted_at + interval '5 minutes', v_now
  from private.goal_notification_match_boundaries boundary
  join private.goal_notification_installations i on i.id = boundary.installation_id
  join private.goal_notification_game_associations b on b.installation_id = i.id
  join private.goal_notification_subscriptions sub on sub.installation_id = i.id and sub.invalid_at is null
  join private.provider_match_observations curr on curr.match_id = boundary.catalog_match_id
    and curr.observation_version > boundary.baseline
    and curr.accepted_at >= v_policy.live_changed_at and curr.accepted_at > v_now - interval '5 minutes'
  join private.provider_match_observations prev on prev.match_id = curr.match_id
    and prev.observation_version = curr.observation_version - 1
  where i.environment = p_environment and i.consent and i.target = any(v_policy.live_targets)
    and curr.lifecycle in ('live', 'finished') and prev.lifecycle in ('scheduled', 'live')
    and curr.shootout_home_score is null and curr.shootout_away_score is null
    and prev.shootout_home_score is null and prev.shootout_away_score is null
    and curr.home_score >= prev.home_score and curr.away_score >= prev.away_score
    and (curr.home_score > prev.home_score or curr.away_score > prev.away_score)
    and not exists (
      select from private.goal_notification_deliveries d where d.installation_id = i.id
        and d.catalog_match_id = curr.match_id and d.observation_version = curr.observation_version
    )
  order by curr.accepted_at, curr.match_id, curr.observation_version, i.id
  limit 25
  on conflict (installation_id, catalog_match_id, observation_version) do nothing;
end;
$$;

create function private.goal_notification_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_environment text;
  v_url text;
  v_secret text;
  v_wake uuid;
begin
  if not pg_try_advisory_xact_lock(33001932) then return; end if;
  if not exists (select from private.goal_notification_policy where live_enabled) then return; end if;

  select decrypted_secret into v_environment from vault.decrypted_secrets where name = 'goal_notification_environment';
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'goal_notification_project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'goal_notification_wake_secret';
  if v_environment is null or v_url is null or length(coalesce(v_secret, '')) < 32 then return; end if;

  perform private.queue_goal_notification_deliveries(v_environment);
  if exists (
    select from private.goal_notification_dispatch_wakes where environment = v_environment
      and consumed_at is null and expires_at > statement_timestamp()
  ) or not exists (
    select from private.goal_notification_deliveries d
    join private.goal_notification_installations i on i.id = d.installation_id and i.environment = v_environment
    where d.state in ('pending', 'leased') and d.due_at <= statement_timestamp() and d.deadline > statement_timestamp()
      and d.attempts < 3 and (d.state = 'pending' or d.claim_until <= statement_timestamp())
  ) then return; end if;

  insert into private.goal_notification_dispatch_wakes (environment, expires_at)
  values (v_environment, clock_timestamp() + interval '30 seconds') returning id into v_wake;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/dispatch-goal-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dong-wake-id', v_wake, 'x-dong-wake-proof',
      encode(extensions.hmac(convert_to(v_wake::text, 'UTF8'), convert_to(v_secret, 'UTF8'), 'sha256'), 'hex')),
    timeout_milliseconds := 40000
  );
end;
$$;

create function private.claim_goal_notification_deliveries(p_wake uuid, p_environment text)
returns table (id uuid, token uuid)
language plpgsql security definer set search_path = '' as $$
begin
  update private.goal_notification_dispatch_wakes
  set consumed_at = clock_timestamp()
  where goal_notification_dispatch_wakes.id = p_wake and environment = p_environment
    and expires_at > clock_timestamp() and consumed_at is null;
  if not found or not exists (select from private.goal_notification_policy where live_enabled) then return; end if;
  return query
  with due as (
    select d.id from private.goal_notification_deliveries d
    join private.goal_notification_installations i on i.id = d.installation_id
    where i.environment = p_environment and d.state in ('pending', 'leased')
      and d.due_at <= statement_timestamp() and d.deadline > statement_timestamp()
      and d.attempts < 3 and (d.state = 'pending' or d.claim_until <= statement_timestamp())
    order by d.due_at, d.id limit 25 for update of d skip locked
  )
  update private.goal_notification_deliveries d
  set state = 'leased', attempts = attempts + 1, claim_token = gen_random_uuid(),
    claim_until = clock_timestamp() + interval '45 seconds', authorized_at = null,
    uncertain = d.uncertain or d.authorized_at is not null
  from due where d.id = due.id returning d.id, d.claim_token;
end;
$$;

create function private.authorize_goal_notification_delivery(p_delivery uuid, p_token uuid, p_environment text, p_public_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_installation uuid;
  v_payload jsonb;
begin
  select i.id into v_installation from private.goal_notification_installations i
  join private.goal_notification_deliveries d on d.installation_id = i.id
  where d.id = p_delivery and i.environment = p_environment for update of i;
  if not found then return null; end if;

  select jsonb_build_object(
    'target', i.target, 'endpoint', sub.endpoint, 'p256dh', encode(sub.p256dh, 'hex'),
    'authKey', encode(sub.auth_key, 'hex'), 'vapidKeyId', sub.vapid_key_id,
    'appleAuthorization', (
      select vapid_header from private.goal_notification_apple_authorizations
      where origin = 'https://' || split_part(sub.endpoint, '/', 3) and public_key = p_public_key
        and generated_at > statement_timestamp() - interval '1 hour'
    ),
    'deadline', d.deadline, 'attempt', d.attempts, 'homeName', source.home_name, 'awayName', source.away_name,
    'homeScore', curr.home_score, 'awayScore', curr.away_score,
    'previousHomeScore', prev.home_score, 'previousAwayScore', prev.away_score
  ) into v_payload
  from private.goal_notification_deliveries d
  join private.goal_notification_installations i on i.id = d.installation_id
  join private.goal_notification_game_associations b on b.installation_id = i.id and b.revision = d.association_revision
  join private.goal_notification_subscriptions sub on sub.installation_id = i.id and sub.invalid_at is null
  join private.goal_notification_policy policy on policy.live_enabled and policy.generation = d.policy_generation
    and i.target = any(policy.live_targets)
  join private.goal_notification_match_boundaries boundary on boundary.installation_id = i.id
    and boundary.catalog_match_id = d.catalog_match_id and boundary.baseline < d.observation_version
  join lateral private.current_goal_notification_matches(i.id) current
    on current.catalog_match_id = boundary.catalog_match_id and current.membership = boundary.membership
  join private.provider_matches source on source.id = d.catalog_match_id
  join private.provider_match_observations curr on curr.match_id = d.catalog_match_id
    and curr.observation_version = d.observation_version
  join private.provider_match_observations prev on prev.match_id = curr.match_id
    and prev.observation_version = curr.observation_version - 1
  where d.id = p_delivery and i.id = v_installation and i.consent and i.generation = d.installation_generation
    and d.state = 'leased' and d.claim_token = p_token and d.claim_until > clock_timestamp()
    and d.deadline > clock_timestamp() and d.authorized_at is null
    and not exists (
      select from private.provider_match_observations later
      where later.match_id = curr.match_id and later.observation_version > curr.observation_version
        and (later.home_score < curr.home_score or later.away_score < curr.away_score
          or later.lifecycle in ('canceled', 'abandoned', 'postponed'))
    )
  for update of d;

  if v_payload is null then
    update private.goal_notification_deliveries set state = 'suppressed'
    where id = p_delivery and installation_id = v_installation and claim_token = p_token
      and state = 'leased' and authorized_at is null;
    return null;
  end if;
  update private.goal_notification_deliveries set authorized_at = clock_timestamp()
  where id = p_delivery;
  return v_payload;
end;
$$;

create function private.finish_goal_notification_delivery(
  p_delivery uuid, p_token uuid, p_outcome text, p_delay integer, p_uncertain boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_delivery private.goal_notification_deliveries%rowtype;
  v_due timestamptz := clock_timestamp() + make_interval(secs => greatest(10, coalesce(p_delay, 0)));
begin
  if p_outcome not in ('accepted', 'failed', 'invalid_endpoint', 'retryable', 'expired') then return; end if;
  if p_outcome = 'invalid_endpoint' then
    perform from private.goal_notification_installations i
    join private.goal_notification_deliveries d on d.installation_id = i.id
    where d.id = p_delivery for update of i;
  end if;
  update private.goal_notification_deliveries
  set state = case
      when p_outcome = 'accepted' then 'accepted'
      when p_outcome = 'expired' or deadline <= clock_timestamp() then 'expired'
      when p_outcome = 'retryable' and attempts < 3 and v_due < deadline then 'pending'
      else 'failed'
    end,
    due_at = v_due, claim_token = null, claim_until = null,
    uncertain = uncertain or coalesce(p_uncertain, false)
  where id = p_delivery and state = 'leased' and claim_token = p_token and authorized_at is not null
  returning * into v_delivery;

  if found and p_outcome = 'invalid_endpoint' then
    update private.goal_notification_subscriptions sub set invalid_at = clock_timestamp()
    from private.goal_notification_installations i
    where i.id = sub.installation_id and i.id = v_delivery.installation_id
      and i.generation = v_delivery.installation_generation and sub.invalid_at is null
      and exists (select from private.goal_notification_game_associations b
        where b.installation_id = i.id and b.revision = v_delivery.association_revision);
  end if;
end;
$$;

create function private.resolve_goal_notification_delivery(
  p_delivery uuid, p_environment text, p_kind text, p_room uuid, p_account uuid,
  p_auth_session uuid, p_proof bytea
) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select from private.goal_notification_deliveries d
    join private.goal_notification_installations i on i.id = d.installation_id
    join private.goal_notification_game_associations b on b.installation_id = i.id and b.revision = d.association_revision
    where d.id = p_delivery and (d.authorized_at is not null or d.uncertain)
      and i.environment = p_environment and i.owner_kind = p_kind
      and b.room_id is not distinct from p_room
      and i.owner_id = private.goal_notification_owner(p_kind, p_room, p_account, p_auth_session, p_proof)
  );
$$;

do $$
begin
  if not exists (select from pg_roles where rolname = 'goal_notification_dispatcher') then
    create role goal_notification_dispatcher nologin noinherit;
  end if;
end;
$$;
grant usage on schema private to goal_notification_dispatcher;
revoke all on function private.queue_goal_notification_deliveries(text), private.goal_notification_tick(),
  private.claim_goal_notification_deliveries(uuid, text), private.authorize_goal_notification_delivery(uuid, uuid, text, text),
  private.finish_goal_notification_delivery(uuid, uuid, text, integer, boolean),
  private.resolve_goal_notification_delivery(uuid, text, text, uuid, uuid, uuid, bytea)
from public, anon, authenticated, service_role;
grant execute on function private.claim_goal_notification_deliveries(uuid, text),
  private.authorize_goal_notification_delivery(uuid, uuid, text, text),
  private.finish_goal_notification_delivery(uuid, uuid, text, integer, boolean),
  private.cache_goal_notification_apple_authorization(text, text, text)
to goal_notification_dispatcher;
grant execute on function private.resolve_goal_notification_delivery(uuid, text, text, uuid, uuid, uuid, bytea)
to goal_notification_backend;

do $$
declare v_job bigint;
begin
  v_job := cron.schedule('dong-goal-notifications', '10 seconds', 'select private.goal_notification_tick()');
  perform cron.alter_job(v_job, active := false);
end;
$$;
