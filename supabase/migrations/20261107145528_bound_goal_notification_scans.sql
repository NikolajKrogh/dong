-- Bound each scan independently of how many browsers have enrolled.
alter table private.goal_notification_installations
  add column last_scanned_at timestamptz not null default '-infinity';
create index goal_notification_installation_scan
  on private.goal_notification_installations (last_scanned_at, id) where consent;

create or replace function private.register_goal_notification_installation(
  p_id uuid, p_environment text, p_target text,
  p_kind text, p_game uuid, p_account uuid, p_auth_session uuid, p_proof_digest bytea,
  p_control bytea, p_endpoint text, p_key bytea, p_auth_key bytea, p_vapid_key_id text
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_existing bigint;
begin
  -- Serialize admission so concurrent registrations respect the per-owner limit.
  perform from private.goal_notification_policy for update;
  if not coalesce(private.goal_notification_enrollment_enabled(p_target), false) then return null; end if;
  v_owner := private.goal_notification_owner(p_kind, p_game, p_account, p_auth_session, p_proof_digest);
  if v_owner is null then return null; end if;

  select i.generation into v_existing
  from private.goal_notification_installations i
  join private.goal_notification_subscriptions s on s.installation_id = i.id
  where i.id = p_id and i.owner_id = v_owner and i.owner_kind = p_kind and i.control_digest = p_control
    and i.environment = p_environment and i.target = p_target and i.consent
    and s.endpoint = p_endpoint and s.p256dh = p_key and s.auth_key = p_auth_key
    and s.vapid_key_id = p_vapid_key_id and s.invalid_at is null;
  if found then return v_existing; end if;

  if (select count(*) from private.goal_notification_installations
        where consent and owner_kind = p_kind and owner_id = v_owner) >= 3
  then return null; end if;

  begin
    insert into private.goal_notification_installations
      (id, owner_kind, owner_id, control_digest, consent, environment, target)
    values (p_id, p_kind, v_owner, p_control, true, p_environment, p_target);
    insert into private.goal_notification_subscriptions
      (installation_id, endpoint, p256dh, auth_key, vapid_key_id)
    values (p_id, p_endpoint, p_key, p_auth_key, p_vapid_key_id);
  exception when unique_violation then
    return null;
  end;
  return 1;
end;
$$;

create or replace function private.queue_goal_notification_deliveries(p_environment text)
returns void language plpgsql set search_path = '' as $$
declare
  v_policy private.goal_notification_policy%rowtype;
  v_installation uuid;
  v_installations uuid[] := array[]::uuid[];
  v_now timestamptz := clock_timestamp();
begin
  select * into v_policy from private.goal_notification_policy;
  if not coalesce(v_policy.live_enabled, false) then return; end if;
  for v_installation in
    select i.id from private.goal_notification_installations i
    join private.goal_notification_game_associations b on b.installation_id = i.id
    where i.environment = p_environment and i.consent and i.target = any(v_policy.live_targets)
    order by i.last_scanned_at, i.id limit 50 for update of i skip locked
  loop
    perform private.refresh_goal_notification_boundaries(v_installation);
    update private.goal_notification_installations set last_scanned_at = v_now where id = v_installation;
    v_installations := array_append(v_installations, v_installation);
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
  where i.id = any(v_installations) and i.environment = p_environment
    and i.consent and i.target = any(v_policy.live_targets)
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

alter table private.goal_notification_policy drop column max_installations;
