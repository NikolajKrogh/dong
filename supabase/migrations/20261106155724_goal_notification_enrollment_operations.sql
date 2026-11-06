-- Expose narrow operations to a dedicated server login. Browser roles cannot call them.
do $$
begin
  if not exists (select from pg_catalog.pg_roles where rolname = 'goal_notification_backend') then
    create role goal_notification_backend nologin noinherit;
  end if;
end;
$$;
grant usage on schema private to goal_notification_backend;

alter table private.goal_notification_installations
  add column last_test_id uuid,
  add column last_test_at timestamptz,
  add column last_test_outcome text check (last_test_outcome in ('pending', 'accepted', 'failed'));

create table private.goal_notification_apple_authorizations (
  origin text not null,
  public_key text not null,
  vapid_header text not null,
  generated_at timestamptz not null default now(),
  primary key (origin, public_key)
);
alter table private.goal_notification_apple_authorizations enable row level security;
revoke all on private.goal_notification_apple_authorizations from public, anon, authenticated, service_role;

create function private.goal_notification_owner(
  p_kind text, p_game uuid, p_account uuid, p_auth_session uuid, p_grant_digest bytea
) returns uuid language sql stable set search_path = '' as $$
  select case p_kind
    when 'registered' then (
      select p.account_id
      from public.participants p
      join public.game_sessions g on g.id = p.session_id
      join auth.sessions a on a.id = p_auth_session and a.user_id = p.account_id
      where p.account_id = p_account and p.session_id = p_game and p.left_at is null
        and p.membership_type = 'registered' and g.state = 'in_progress'
        and (a.not_after is null or a.not_after > statement_timestamp())
    )
    when 'guest' then (
      select p.id
      from public.participants p join public.game_sessions g on g.id = p.session_id
      where p.session_id = p_game and p.left_at is null and p.membership_type = 'guest'
        and p.guest_rejoin_token_hash = encode(p_grant_digest, 'hex')
        and p.guest_grant_expires_at > statement_timestamp() and g.state = 'in_progress'
    )
    when 'solo' then (
      select s.id from private.solo_tracking_grants s
      where s.grant_digest = p_grant_digest and s.ended_at is null and s.expires_at > statement_timestamp()
        and exists (select from private.solo_tracked_matches m
          where m.grant_id = s.id and m.admitted_until > statement_timestamp())
    )
  end;
$$;

create function private.goal_notification_test_enabled(p_environment text, p_mode text, p_target text)
returns boolean language sql stable set search_path = '' as $$
  select p.test_enabled and p_target = any (p.test_targets)
    and case
      when p_mode = 'iphone_verification' then p_environment = 'production'
        and p_target = 'iphone_home_screen' and p.iphone_verification_enabled
      when p_mode = 'preview' then p_environment <> 'production' and p_target <> 'iphone_home_screen'
      when p_mode = 'pilot' then p_environment = 'production' and p_target <> 'iphone_home_screen'
      else false
    end
  from private.goal_notification_policy p;
$$;

create function private.goal_notification_status(
  p_environment text, p_target text, p_grant bytea, p_installation uuid, p_control bytea, p_generation bigint
) returns text language sql stable security definer set search_path = '' as $$
  select case
    when exists (
      select from private.goal_notification_installations i
      where i.id = p_installation and i.control_digest = p_control and i.generation = p_generation
        and i.consent and i.environment = p_environment and i.target = p_target
        and (i.approval_expires_at is null or i.approval_expires_at > statement_timestamp())
        and private.goal_notification_test_enabled(i.environment, i.mode, i.target)
    ) then case when exists (
      select from private.goal_notification_subscriptions s
      where s.installation_id = p_installation and s.invalid_at is null
    ) then 'registered' else 'repair_required' end
    when exists (
      select from private.goal_notification_enrollment_grants g
      where g.digest = p_grant and g.environment = p_environment and g.target = p_target
        and g.consumed_at is null and g.expires_at > statement_timestamp()
        and (g.approval_expires_at is null or g.approval_expires_at > statement_timestamp())
        and private.goal_notification_test_enabled(g.environment, g.mode, g.target)
    ) then 'available'
    when p_environment = 'production' and p_target = 'iphone_home_screen' then 'awaiting_device_verification'
    else 'pilot_access_required'
  end;
$$;

create function private.register_goal_notification_installation(
  p_id uuid, p_environment text, p_target text, p_enrollment_grant bytea,
  p_kind text, p_game uuid, p_account uuid, p_auth_session uuid, p_proof_digest bytea,
  p_control bytea, p_endpoint text, p_key bytea, p_auth_key bytea, p_vapid_key_id text
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_cap integer;
  v_grant private.goal_notification_enrollment_grants%rowtype;
  v_existing bigint;
begin
  -- Serialize registration with grant consumption and the global admission cap.
  select max_installations into v_cap from private.goal_notification_policy for update;
  v_owner := private.goal_notification_owner(p_kind, p_game, p_account, p_auth_session, p_proof_digest);
  if v_owner is null then return null; end if;

  select i.generation into v_existing
  from private.goal_notification_installations i
  join private.goal_notification_subscriptions s on s.installation_id = i.id
  where i.id = p_id and i.owner_id = v_owner and i.owner_kind = p_kind and i.control_digest = p_control
    and i.environment = p_environment and i.target = p_target and i.consent
    and s.endpoint = p_endpoint and s.p256dh = p_key and s.auth_key = p_auth_key
    and s.vapid_key_id = p_vapid_key_id and s.invalid_at is null
    and (i.approval_expires_at is null or i.approval_expires_at > statement_timestamp())
    and private.goal_notification_test_enabled(i.environment, i.mode, i.target);
  if found then return v_existing; end if;

  select * into v_grant from private.goal_notification_enrollment_grants
  where digest = p_enrollment_grant and environment = p_environment and target = p_target
    and consumed_at is null and expires_at > statement_timestamp()
    and (approval_expires_at is null or approval_expires_at > statement_timestamp());
  if not found or not private.goal_notification_test_enabled(p_environment, v_grant.mode, p_target) then
    return null;
  end if;
  if (select count(*) from private.goal_notification_installations where consent) >= v_cap
    or (select count(*) from private.goal_notification_installations
        where consent and owner_kind = p_kind and owner_id = v_owner) >= 3
  then return null; end if;

  begin
    insert into private.goal_notification_installations
      (id, owner_kind, owner_id, control_digest, consent, environment, mode, target, approval_expires_at)
    values (p_id, p_kind, v_owner, p_control, true, p_environment, v_grant.mode, p_target, v_grant.approval_expires_at);
    insert into private.goal_notification_subscriptions
      (installation_id, endpoint, p256dh, auth_key, vapid_key_id)
    values (p_id, p_endpoint, p_key, p_auth_key, p_vapid_key_id);
    if not private.consume_goal_notification_enrollment_grant(p_enrollment_grant, p_id) then
      raise exception 'grant_unavailable' using errcode = 'P0001';
    end if;
  exception when unique_violation or raise_exception then
    return null;
  end;
  return 1;
end;
$$;

create function private.reserve_goal_notification_test(
  p_id uuid, p_control bytea, p_generation bigint, p_environment text, p_request uuid,
  p_kind text, p_game uuid, p_account uuid, p_auth_session uuid, p_proof_digest bytea
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_installation private.goal_notification_installations%rowtype;
  v_subscription private.goal_notification_subscriptions%rowtype;
  v_owner uuid;
begin
  select * into v_installation from private.goal_notification_installations
  where id = p_id and control_digest = p_control and generation = p_generation
    and consent and environment = p_environment and owner_kind = p_kind
    and (approval_expires_at is null or approval_expires_at > statement_timestamp())
  for update;
  if not found or not private.goal_notification_test_enabled(
    v_installation.environment, v_installation.mode, v_installation.target
  ) then return jsonb_build_object('status', 'not_eligible'); end if;
  v_owner := private.goal_notification_owner(p_kind, p_game, p_account, p_auth_session, p_proof_digest);
  if v_owner is distinct from v_installation.owner_id then return jsonb_build_object('status', 'not_eligible'); end if;
  if v_installation.last_test_id = p_request then
    return jsonb_build_object('status', v_installation.last_test_outcome);
  end if;
  if v_installation.last_test_at > statement_timestamp() - interval '1 minute' then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  select * into v_subscription from private.goal_notification_subscriptions
  where installation_id = p_id and invalid_at is null;
  if not found then return jsonb_build_object('status', 'not_eligible'); end if;

  update private.goal_notification_installations
  set last_test_id = p_request, last_test_at = statement_timestamp(), last_test_outcome = 'pending'
  where id = p_id;
  return jsonb_build_object(
    'status', 'reserved', 'target', v_installation.target, 'endpoint', v_subscription.endpoint,
    'p256dh', encode(v_subscription.p256dh, 'hex'), 'authKey', encode(v_subscription.auth_key, 'hex'),
    'vapidKeyId', v_subscription.vapid_key_id
  );
end;
$$;

create function private.complete_goal_notification_test(
  p_id uuid, p_generation bigint, p_request uuid, p_outcome text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_outcome not in ('accepted', 'failed', 'invalid_endpoint') then return; end if;
  update private.goal_notification_installations
  set last_test_outcome = case when p_outcome = 'accepted' then 'accepted' else 'failed' end
  where id = p_id and generation = p_generation and last_test_id = p_request and last_test_outcome = 'pending';
  if found and p_outcome = 'invalid_endpoint' then
    update private.goal_notification_subscriptions set invalid_at = statement_timestamp() where installation_id = p_id;
  end if;
end;
$$;

create function private.cache_goal_notification_apple_authorization(p_origin text, p_key text, p_header text)
returns text language sql security definer set search_path = '' as $$
  insert into private.goal_notification_apple_authorizations as a (origin, public_key, vapid_header)
  values (p_origin, p_key, p_header)
  on conflict (origin, public_key) do update set
    vapid_header = case when a.generated_at <= statement_timestamp() - interval '1 hour'
      then excluded.vapid_header else a.vapid_header end,
    generated_at = case when a.generated_at <= statement_timestamp() - interval '1 hour'
      then statement_timestamp() else a.generated_at end
  returning vapid_header;
$$;

revoke all on function private.goal_notification_owner(text, uuid, uuid, uuid, bytea),
  private.goal_notification_test_enabled(text, text, text),
  private.goal_notification_status(text, text, bytea, uuid, bytea, bigint),
  private.register_goal_notification_installation(uuid, text, text, bytea, text, uuid, uuid, uuid, bytea, bytea, text, bytea, bytea, text),
  private.reserve_goal_notification_test(uuid, bytea, bigint, text, uuid, text, uuid, uuid, uuid, bytea),
  private.complete_goal_notification_test(uuid, bigint, uuid, text),
  private.cache_goal_notification_apple_authorization(text, text, text)
from public, anon, authenticated, service_role;
grant execute on function private.goal_notification_status(text, text, bytea, uuid, bytea, bigint),
  private.register_goal_notification_installation(uuid, text, text, bytea, text, uuid, uuid, uuid, bytea, bytea, text, bytea, bytea, text),
  private.reserve_goal_notification_test(uuid, bytea, bigint, text, uuid, text, uuid, uuid, uuid, bytea),
  private.complete_goal_notification_test(uuid, bigint, uuid, text),
  private.cache_goal_notification_apple_authorization(text, text, text)
to goal_notification_backend;
