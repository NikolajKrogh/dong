-- Association revisions restart after cleanup; deliveries must also pin the association identity.
alter table private.goal_notification_game_associations
  add column association_id uuid not null default gen_random_uuid() unique;
alter table private.goal_notification_deliveries add column association_id uuid;
-- Existing deliveries have no trustworthy association identity and intentionally fail closed.

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
    installation_id, catalog_match_id, observation_version, installation_generation, association_revision, association_id,
    policy_generation, accepted_at, deadline, due_at
  )
  select i.id, curr.match_id, curr.observation_version, i.generation, b.revision, b.association_id,
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

create or replace function private.authorize_goal_notification_delivery(p_delivery uuid, p_token uuid, p_environment text, p_public_key text)
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
    and b.association_id = d.association_id
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

create or replace function private.finish_goal_notification_delivery(
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
        where b.installation_id = i.id and b.revision = v_delivery.association_revision
          and b.association_id = v_delivery.association_id);
  end if;
end;
$$;

create or replace function private.resolve_goal_notification_delivery(
  p_delivery uuid, p_environment text, p_kind text, p_room uuid, p_account uuid,
  p_auth_session uuid, p_proof bytea
) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select from private.goal_notification_deliveries d
    join private.goal_notification_installations i on i.id = d.installation_id
    join private.goal_notification_game_associations b on b.installation_id = i.id and b.revision = d.association_revision
      and b.association_id = d.association_id
    where d.id = p_delivery and (d.authorized_at is not null or d.uncertain)
      and i.environment = p_environment and i.owner_kind = p_kind
      and b.room_id is not distinct from p_room
      and i.owner_id = private.goal_notification_owner(p_kind, p_room, p_account, p_auth_session, p_proof)
  );
$$;

create or replace function private.disable_goal_notification_installation(
  p_id uuid, p_control bytea, p_generation bigint, p_environment text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  i private.goal_notification_installations%rowtype;
begin
  if p_generation is null or p_generation < 1 then return false; end if;
  select * into i from private.goal_notification_installations where id = p_id for update;
  -- Retention may already have removed a successfully revoked installation.
  if not found then return true; end if;
  if i.control_digest is distinct from p_control or i.environment is distinct from p_environment
    or p_generation > i.generation then return false; end if;
  if p_generation < i.generation then return true; end if;

  update private.goal_notification_installations
  set consent = false, revoked_at = clock_timestamp(), generation = generation + 1
  where id = p_id;
  delete from private.goal_notification_subscriptions where installation_id = p_id;
  return true;
end;
$$;
