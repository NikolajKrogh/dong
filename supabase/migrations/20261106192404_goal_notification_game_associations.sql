create table private.goal_notification_game_associations (
  installation_id uuid primary key references private.goal_notification_installations(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  room_id uuid,
  participant_id uuid,
  solo_grant_id uuid,
  auth_session_id uuid,
  guest_digest bytea,
  notify_common boolean not null default true,
  solo_common_match_id bigint,
  bound_at timestamptz not null default clock_timestamp(),
  check (
    (solo_grant_id is not null and room_id is null and participant_id is null and auth_session_id is null and guest_digest is null)
    or (solo_grant_id is null and room_id is not null and participant_id is not null
      and (auth_session_id is null) <> (guest_digest is null) and solo_common_match_id is null)
  )
);

create table private.goal_notification_session_scope (
  room_id uuid not null,
  participant_id uuid not null,
  scope text not null default 'assigned_and_common'
    check (scope in ('assigned_and_common', 'all_room_matches')),
  revision bigint not null default 0 check (revision >= 0),
  primary key (room_id, participant_id)
);

create table private.goal_notification_match_boundaries (
  installation_id uuid not null references private.goal_notification_game_associations(installation_id) on delete cascade,
  catalog_match_id bigint not null,
  membership jsonb not null,
  baseline bigint not null check (baseline >= 0),
  primary key (installation_id, catalog_match_id)
);

alter table private.goal_notification_game_associations enable row level security;
alter table private.goal_notification_session_scope enable row level security;
alter table private.goal_notification_match_boundaries enable row level security;
revoke all on table private.goal_notification_game_associations, private.goal_notification_session_scope,
  private.goal_notification_match_boundaries from public, anon, authenticated, service_role;

create function private.current_goal_notification_matches(p_installation uuid)
returns table (catalog_match_id bigint, membership jsonb, baseline bigint)
language sql stable set search_path = '' as $$
  with binding as (
    select b.*, i.owner_kind, i.owner_id
    from private.goal_notification_game_associations b
    join private.goal_notification_installations i on i.id = b.installation_id
    where b.installation_id = p_installation and i.consent
  )
  select distinct on (eligible.catalog_match_id) eligible.*
  from (
    select m.catalog_match_id,
      jsonb_build_array(b.revision, m.id, m.tracking_started_observation_version,
        case when m.id = g.common_match_id then 'common' when s.scope = 'all_room_matches' then 'all' else 'assigned' end,
        case when m.id is distinct from g.common_match_id then s.revision end,
        case when m.id is distinct from g.common_match_id and coalesce(s.scope, 'assigned_and_common') = 'assigned_and_common'
          then a.created_at end,
        case when m.id = g.common_match_id then settings.updated_at end) as membership,
      source.observation_version as baseline
    from binding b
    join public.game_sessions g on g.id = b.room_id and g.state = 'in_progress'
    join public.participants p on p.id = b.participant_id and p.session_id = g.id and p.left_at is null
    join public.matches m on m.session_id = g.id
    join private.provider_matches source on source.id = m.catalog_match_id
    left join private.goal_notification_session_scope s on s.room_id = g.id and s.participant_id = p.id
    left join public.assignments a on a.session_id = g.id and a.participant_id = p.id and a.match_id = m.id
    left join public.settings settings on b.owner_kind = 'registered' and settings.account_id = b.owner_id
    where private.goal_notification_owner(b.owner_kind, b.room_id, b.owner_id, b.auth_session_id, b.guest_digest) =
      case when b.owner_kind = 'registered' then b.owner_id else b.participant_id end
      and case when m.id = g.common_match_id then
        case when b.owner_kind = 'registered'
          then (settings.settings_data->'commonMatchNotificationsEnabled') is distinct from 'false'::jsonb
          else b.notify_common end
        else coalesce(s.scope = 'all_room_matches', false) or a.match_id is not null end

    union all

    select m.match_id, jsonb_build_array(b.revision, g.selection_version, m.admitted_until), source.observation_version
    from binding b
    join private.solo_tracking_grants g on g.id = b.solo_grant_id and g.id = b.owner_id
      and g.grant_digest is not null and g.ended_at is null and g.expires_at > statement_timestamp()
    join private.solo_tracked_matches m on m.grant_id = g.id and m.admitted_until > statement_timestamp()
    join private.provider_matches source on source.id = m.match_id
    where b.owner_kind = 'solo' and (b.notify_common or m.match_id is distinct from b.solo_common_match_id)
  ) eligible
  order by eligible.catalog_match_id, eligible.membership;
$$;

create function private.refresh_goal_notification_boundaries(p_installation uuid)
returns void language sql set search_path = '' as $$
  with current_matches as materialized (
    select * from private.current_goal_notification_matches(p_installation)
  ), removed as (
    delete from private.goal_notification_match_boundaries old
    where old.installation_id = p_installation and not exists (
      select from current_matches current where current.catalog_match_id = old.catalog_match_id
    )
  )
  insert into private.goal_notification_match_boundaries as old (installation_id, catalog_match_id, membership, baseline)
  select p_installation, catalog_match_id, membership, baseline from current_matches
  on conflict (installation_id, catalog_match_id) do update
    set membership = excluded.membership, baseline = excluded.baseline
    where old.membership is distinct from excluded.membership;
$$;

create function private.goal_notification_game_operation(
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
  v_test boolean;
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
  select live_enabled and i.target = any(live_targets), test_enabled and i.target = any(test_targets)
  into v_live, v_test from private.goal_notification_policy;
  return jsonb_build_object('status', 'bound', 'revision', b.revision, 'liveEnabled', coalesce(v_live, false),
    'testEnabled', coalesce(v_test, false),
    'scope', case when v_participant is not null then coalesce(s.scope, 'assigned_and_common') end,
    'scopeRevision', case when v_participant is not null then coalesce(s.revision, 0) end);
end;
$$;

revoke all on function private.current_goal_notification_matches(uuid),
  private.refresh_goal_notification_boundaries(uuid),
  private.goal_notification_game_operation(uuid, bytea, bigint, text, text, uuid, uuid, uuid, bytea, bigint, boolean, bigint, text)
from public, anon, authenticated, service_role;
grant execute on function private.goal_notification_game_operation(uuid, bytea, bigint, text, text, uuid, uuid, uuid, bytea, bigint, boolean, bigint, text)
to goal_notification_backend;
