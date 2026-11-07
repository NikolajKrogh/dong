-- Manual test notifications are retired. Only accepted game goals can dispatch.
create or replace function private.goal_notification_enrollment_enabled(p_target text)
returns boolean language sql stable set search_path = '' as $$
  select p.live_enabled and p_target = any(p.live_targets)
  from private.goal_notification_policy p;
$$;

create or replace function private.goal_notification_game_operation(
  p_installation uuid, p_control bytea, p_generation bigint, p_environment text,
  p_kind text, p_room uuid, p_account uuid, p_auth_session uuid, p_proof bytea,
  p_revision bigint, p_notify_common boolean, p_solo_common bigint, p_scope text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i private.goal_notification_installations%rowtype;
  b private.goal_notification_game_associations%rowtype;
  s private.goal_notification_session_scope%rowtype;
  v_owner uuid;
  v_participant uuid;
  v_solo uuid;
  v_preference boolean := p_kind = 'registered' or coalesce(p_notify_common, true);
  v_live boolean;
begin
  select * into i from private.goal_notification_installations
  where id = p_installation and control_digest = p_control and generation = p_generation
    and environment = p_environment and consent and owner_kind = p_kind
  for update;
  if not found or not exists (
    select from private.goal_notification_subscriptions where installation_id = p_installation and invalid_at is null
  ) then return jsonb_build_object('status', 'not_eligible'); end if;

  v_owner := private.goal_notification_owner(p_kind, p_room, p_account, p_auth_session, p_proof);
  if v_owner is distinct from i.owner_id then return jsonb_build_object('status', 'not_eligible'); end if;
  if p_kind = 'solo' then
    v_solo := v_owner;
    if p_solo_common is not null and not exists (
      select from private.solo_tracked_matches
      where grant_id = v_solo and match_id = p_solo_common and admitted_until > statement_timestamp()
    ) then return jsonb_build_object('status', 'not_eligible'); end if;
  else
    select p.id into v_participant from public.participants p
    where p.session_id = p_room and p.left_at is null
      and case when p_kind = 'registered' then p.account_id = v_owner else p.id = v_owner end;
    if v_participant is null or p_solo_common is not null then
      return jsonb_build_object('status', 'not_eligible');
    end if;
  end if;

  select * into b from private.goal_notification_game_associations where installation_id = p_installation;
  if p_scope is not null then
    if b.room_id is distinct from p_room or b.participant_id is distinct from v_participant
      or v_participant is null or p_scope not in ('assigned_and_common', 'all_room_matches')
    then return jsonb_build_object('status', 'not_eligible'); end if;
    insert into private.goal_notification_session_scope (room_id, participant_id)
    values (p_room, v_participant) on conflict do nothing;
    select * into s from private.goal_notification_session_scope where room_id = p_room and participant_id = v_participant for update;
    if s.scope is distinct from p_scope then
      if s.revision is distinct from p_revision then
        return jsonb_build_object('status', 'stale_scope', 'scope', s.scope, 'scopeRevision', s.revision);
      end if;
      update private.goal_notification_session_scope set scope = p_scope, revision = revision + 1
      where room_id = p_room and participant_id = v_participant returning * into s;
    end if;
  elsif b.installation_id is null or
    (b.room_id, b.participant_id, b.solo_grant_id, b.auth_session_id, b.guest_digest, b.notify_common, b.solo_common_match_id)
    is distinct from
    (p_room, v_participant, v_solo, p_auth_session, case when p_kind = 'guest' then p_proof end, v_preference, p_solo_common)
  then
    if b.revision is distinct from p_revision then
      return jsonb_build_object('status', 'stale_binding', 'revision', b.revision,
        'sameGame', (b.room_id, b.participant_id, b.solo_grant_id) is not distinct from (p_room, v_participant, v_solo));
    end if;
    insert into private.goal_notification_game_associations as previous (
      installation_id, room_id, participant_id, solo_grant_id, auth_session_id, guest_digest, notify_common, solo_common_match_id
    ) values (
      p_installation, p_room, v_participant, v_solo, p_auth_session, case when p_kind = 'guest' then p_proof end,
      v_preference, p_solo_common
    )
    on conflict (installation_id) do update set
      room_id = excluded.room_id, participant_id = excluded.participant_id, solo_grant_id = excluded.solo_grant_id,
      auth_session_id = excluded.auth_session_id, guest_digest = excluded.guest_digest,
      notify_common = excluded.notify_common, solo_common_match_id = excluded.solo_common_match_id,
      revision = previous.revision + 1, bound_at = clock_timestamp()
    returning * into b;
  end if;

  perform private.refresh_goal_notification_boundaries(p_installation);
  if p_scope is null and v_participant is not null then
    select * into s from private.goal_notification_session_scope where room_id = p_room and participant_id = v_participant;
  end if;
  select live_enabled and i.target = any(live_targets)
  into v_live from private.goal_notification_policy;
  return jsonb_build_object('status', 'bound', 'revision', b.revision, 'liveEnabled', coalesce(v_live, false),
    'scope', case when v_participant is not null then coalesce(s.scope, 'assigned_and_common') end,
    'scopeRevision', case when v_participant is not null then coalesce(s.revision, 0) end);
end;
$$;

create or replace function private.repair_goal_notification_subscription(
  p_id uuid, p_control bytea, p_generation bigint, p_environment text, p_target text,
  p_kind text, p_game uuid, p_account uuid, p_auth_session uuid, p_proof bytea,
  p_endpoint text, p_key bytea, p_auth_key bytea, p_vapid_key_id text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  i private.goal_notification_installations%rowtype;
  sub private.goal_notification_subscriptions%rowtype;
begin
  select * into i from private.goal_notification_installations
  where id = p_id and control_digest = p_control and generation = p_generation and consent
    and environment = p_environment and target = p_target and owner_kind = p_kind
  for update;
  if not found or not coalesce(private.goal_notification_enrollment_enabled(p_target), false)
    or private.goal_notification_owner(p_kind, p_game, p_account, p_auth_session, p_proof) is distinct from i.owner_id
  then return false; end if;

  select * into sub from private.goal_notification_subscriptions where installation_id = p_id;
  if found and (sub.endpoint, sub.p256dh, sub.auth_key, sub.vapid_key_id)
    is not distinct from (p_endpoint, p_key, p_auth_key, p_vapid_key_id) then
    return sub.invalid_at is null;
  end if;

  begin
    insert into private.goal_notification_subscriptions (installation_id, endpoint, p256dh, auth_key, vapid_key_id)
    values (p_id, p_endpoint, p_key, p_auth_key, p_vapid_key_id)
    on conflict (installation_id) do update set endpoint = excluded.endpoint, p256dh = excluded.p256dh,
      auth_key = excluded.auth_key, vapid_key_id = excluded.vapid_key_id, invalid_at = null;
    update private.goal_notification_game_associations set revision = revision + 1, bound_at = clock_timestamp()
    where installation_id = p_id;
    perform private.refresh_goal_notification_boundaries(p_id);
  exception when unique_violation then
    return false;
  end;
  return true;
end;
$$;

drop function private.reserve_goal_notification_test(uuid, bytea, bigint, text, uuid, text, uuid, uuid, uuid, bytea);
drop function private.complete_goal_notification_test(uuid, bigint, uuid, text);
drop function private.goal_notification_test_enabled(text);
alter table private.goal_notification_policy drop column test_enabled, drop column test_targets;
alter table private.goal_notification_installations
  drop column last_test_id, drop column last_test_at, drop column last_test_outcome;
