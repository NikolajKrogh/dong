-- Shared provider facts and durable acquisition ownership. Additive and disabled by default.
create schema if not exists private;

create table private.provider_leagues (
  id bigint generated always as identity primary key,
  provider text not null check (provider = 'espn'),
  league_code text not null check (league_code ~ '^[a-z0-9._-]{1,80}$'),
  source_league_id text check (length(source_league_id) between 1 and 128),
  display_name text not null check (length(display_name) between 1 and 160),
  unique (provider, league_code), unique (id, provider)
);
create table private.provider_teams (
  id bigint generated always as identity primary key,
  provider text not null check (provider = 'espn'),
  source_team_id text not null check (length(source_team_id) between 1 and 128),
  display_name text not null check (length(display_name) between 1 and 160),
  short_name text check (length(short_name) <= 40),
  unique (provider, source_team_id)
);
create table private.provider_athletes (
  id bigint generated always as identity primary key,
  provider text not null check (provider = 'espn'),
  source_athlete_id text not null check (length(source_athlete_id) between 1 and 128),
  display_name text not null check (length(display_name) between 1 and 160),
  unique (provider, source_athlete_id)
);
create table private.provider_budget_state (
  provider text primary key check (provider = 'espn'),
  ownership_mode text not null default 'disabled' check (ownership_mode in ('disabled','legacy','catalog','paused')),
  worker_generation bigint not null default 1 check (worker_generation > 0),
  rolling_seconds integer not null default 60 check (rolling_seconds = 60),
  rolling_limit integer check (rolling_limit between 1 and 1000),
  daily_limit integer check (daily_limit between 1 and 100000),
  usage_day date not null default (now() at time zone 'UTC')::date,
  daily_count bigint not null default 0 check (daily_count >= 0),
  cooldown_until timestamptz,
  pause_reason text check (length(pause_reason) <= 80),
  feature_bytes_limit bigint not null default 100000000 check (feature_bytes_limit > 0),
  feature_bytes bigint not null default 0 check (feature_bytes >= 0),
  database_bytes bigint not null default 0 check (database_bytes >= 0),
  capacity_measured_at timestamptz,
  optional_work_allowed boolean not null default false,
  new_demand_allowed boolean not null default false,
  max_live_groups integer not null default 8 check (max_live_groups between 1 and 8),
  updated_at timestamptz not null default now()
);
insert into private.provider_budget_state(provider) values ('espn');

create table private.provider_worker_slots (
  id smallint primary key check (id in (1,2)),
  lease_token uuid,
  worker_generation bigint,
  lease_until timestamptz,
  started_at timestamptz,
  last_progress_at timestamptz,
  dispatch_request_id bigint,
  outcome text check (length(outcome) <= 80),
  check ((lease_token is null) = (lease_until is null))
);
insert into private.provider_worker_slots(id) values (1),(2);

create table private.provider_request_groups (
  id bigint generated always as identity primary key,
  provider text not null default 'espn' check (provider = 'espn'),
  league_id bigint not null,
  resource_kind text not null check (resource_kind in ('scoreboard','summary')),
  request_date date,
  source_event_id text check (length(source_event_id) between 1 and 128),
  scope_key text generated always as (case when resource_kind = 'scoreboard' then league_id::text || '/board/' || (request_date-date '2000-01-01')::text else league_id::text || '/summary/' || source_event_id end) stored,
  next_attempt_at timestamptz,
  live_due_at timestamptz,
  completion_due_at timestamptz,
  discovery_until timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  owner_generation bigint,
  current_attempt_id bigint,
  last_attempt_at timestamptz,
  last_successful_check_at timestamptz,
  successful_empty boolean not null default false,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_error text check (length(last_error) <= 80),
  cooldown_until timestamptz,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  foreign key (league_id, provider) references private.provider_leagues(id, provider) on delete restrict,
  check ((resource_kind = 'scoreboard' and request_date is not null and source_event_id is null)
    or (resource_kind = 'summary' and request_date is null and source_event_id is not null)),
  unique(provider,scope_key)
);
create index provider_request_groups_due on private.provider_request_groups(next_attempt_at,id) where not paused;
create index provider_request_groups_league on private.provider_request_groups(league_id);

create table private.provider_request_attempts (
  id bigint generated always as identity primary key,
  group_id bigint not null references private.provider_request_groups(id) on delete restrict,
  purpose text not null check (purpose in ('live','discovery','completion')),
  reserved_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  worker_generation bigint not null,
  lease_token uuid not null,
  worker_slot_id smallint not null references private.provider_worker_slots(id) on delete restrict,
  outcome text not null default 'reserved' check (outcome in ('reserved','accepted','partial','failed','uncertain')),
  error_code text check (length(error_code) <= 80),
  http_status integer check (http_status between 100 and 599),
  response_bytes integer check (response_bytes between 0 and 2097152),
  duration_ms integer check (duration_ms >= 0)
);
create index provider_attempts_recent on private.provider_request_attempts(reserved_at);
create index provider_attempts_group_recent on private.provider_request_attempts(group_id,reserved_at);

create table private.provider_request_daily_usage (
  usage_day date not null,
  provider text not null check (provider='espn'),
  purpose text not null check (purpose in ('live','discovery','completion')),
  outcome text not null check (length(outcome) between 1 and 80),
  scope_label text not null default '' check (length(scope_label) <= 180),
  attempt_count bigint not null default 0 check (attempt_count >= 0),
  primary key (usage_day,provider,purpose,outcome,scope_label)
);

create table private.provider_matches (
  id bigint generated always as identity primary key,
  league_id bigint not null references private.provider_leagues(id) on delete restrict,
  source_event_id text not null check (length(source_event_id) between 1 and 128),
  source_competition_id text check (length(source_competition_id) between 1 and 128),
  home_team_id bigint references private.provider_teams(id) on delete restrict,
  away_team_id bigint references private.provider_teams(id) on delete restrict,
  home_name text not null check (length(home_name) between 1 and 160),
  away_name text not null check (length(away_name) between 1 and 160),
  kickoff_at timestamptz,
  kickoff_validity text not null default 'unknown' check (kickoff_validity in ('confirmed','tentative','unknown')),
  lifecycle text not null default 'unknown' check (lifecycle in ('scheduled','live','delayed','suspended','postponed','finished','canceled','abandoned','unknown')),
  raw_status text check (length(raw_status) <= 80),
  is_completed boolean,
  home_score integer check (home_score between 0 and 999),
  away_score integer check (away_score between 0 and 999),
  shootout_home_score integer check (shootout_home_score between 0 and 999),
  shootout_away_score integer check (shootout_away_score between 0 and 999),
  aggregate_home_score integer check (aggregate_home_score between 0 and 999),
  aggregate_away_score integer check (aggregate_away_score between 0 and 999),
  period smallint check (period between 0 and 20),
  clock_seconds numeric check (clock_seconds between 0 and 100000),
  display_clock text check (length(display_clock) <= 40),
  season_source_id text check (length(season_source_id) <= 128),
  season_year smallint check (season_year between 0 and 9999),
  season_type text check (length(season_type) <= 40),
  venue_source_id text check (length(venue_source_id) <= 128),
  venue_name text check (length(venue_name) <= 160),
  observation_version bigint not null default 0 check (observation_version >= 0),
  last_projection_sequence bigint not null default 0,
  detail_projection_sequence bigint not null default 0,
  scoreboard_group_id bigint references private.provider_request_groups(id) on delete restrict,
  last_attempt_at timestamptz,
  last_successful_check_at timestamptz,
  observed_at timestamptz,
  availability text not null default 'pending' check (availability in ('available','partial','pending','unavailable','deferred')),
  availability_reason text check (length(availability_reason) <= 80),
  condition_started_at timestamptz,
  next_eligible_at timestamptz,
  completed_at timestamptz,
  completion_attempt_count smallint not null default 0 check (completion_attempt_count between 0 and 2),
  completion_deadline timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (league_id,source_event_id),
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id)
);
create index provider_matches_discovery on private.provider_matches(league_id,kickoff_at,id);
create index provider_matches_scoreboard_group on private.provider_matches(scoreboard_group_id);
create index provider_matches_home_team on private.provider_matches(home_team_id);
create index provider_matches_away_team on private.provider_matches(away_team_id);

create table private.provider_match_observations (
  match_id bigint not null references private.provider_matches(id) on delete cascade,
  observation_version bigint not null check (observation_version > 0),
  accepted_at timestamptz not null,
  attempt_sequence bigint not null,
  source_scope text not null check (length(source_scope) between 1 and 180),
  source_event_id text not null,
  source_competition_id text,
  home_score integer check (home_score between 0 and 999),
  away_score integer check (away_score between 0 and 999),
  lifecycle text not null,
  kickoff_at timestamptz,
  kickoff_validity text not null,
  shootout_home_score integer,
  shootout_away_score integer,
  aggregate_home_score integer,
  aggregate_away_score integer,
  primary key(match_id,observation_version)
);

create function private.reject_provider_observation_update() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Provider observations are immutable' using errcode='23514'; end;
$$;
create trigger provider_observations_immutable before update on private.provider_match_observations
for each row execute function private.reject_provider_observation_update();

create function private.claim_provider_request(p_group_id bigint, p_purpose text, p_worker_token uuid, p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  b private.provider_budget_state%rowtype;
  g private.provider_request_groups%rowtype;
  slot_id smallint; worker_until timestamptz; t timestamptz := clock_timestamp(); n bigint; attempt_id bigint; token uuid := gen_random_uuid();
begin
  -- This lock order is shared with admission, dispatch and ownership transitions.
  select * into b from private.provider_budget_state where provider='espn' for update;
  t:=clock_timestamp();
  if b.ownership_mode is distinct from 'catalog' then return jsonb_build_object('ok',false,'code','acquisition_paused'); end if;
  if b.rolling_limit is null or b.daily_limit is null then return jsonb_build_object('ok',false,'code','configuration_required'); end if;
  if b.worker_generation is distinct from p_generation then return jsonb_build_object('ok',false,'code','stale_generation'); end if;
  select id,lease_until into slot_id,worker_until from private.provider_worker_slots where lease_token=p_worker_token and worker_generation=p_generation and lease_until>t;
  if slot_id is null then return jsonb_build_object('ok',false,'code','invalid_dispatch'); end if;
  if b.pause_reason is not null or b.cooldown_until>t then return jsonb_build_object('ok',false,'code','provider_cooldown'); end if;
  select * into g from private.provider_request_groups where id=p_group_id and provider='espn' for update;
  if not found then return jsonb_build_object('ok',false,'code','invalid_group'); end if;
  t:=clock_timestamp();
  if worker_until<=t then return jsonb_build_object('ok',false,'code','invalid_dispatch'); end if;
  if g.lease_until>t then return jsonb_build_object('ok',false,'code','already_claimed'); end if;
  if p_purpose not in ('live','discovery','completion') or p_purpose is null then return jsonb_build_object('ok',false,'code','invalid_purpose'); end if;
  if g.paused or g.cooldown_until>t or g.next_attempt_at>t or g.next_attempt_at is null then return jsonb_build_object('ok',false,'code','not_due'); end if;
  if (p_purpose='discovery' and (g.discovery_until is null or g.discovery_until<=t))
    or (p_purpose='live' and (g.live_due_at is null or g.live_due_at>t))
    or (p_purpose='completion' and (g.completion_due_at is null or g.completion_due_at>t)) then
    return jsonb_build_object('ok',false,'code','not_due');
  end if;
  if b.usage_day <> (t at time zone 'UTC')::date then
    update private.provider_budget_state set usage_day=(t at time zone 'UTC')::date,daily_count=0 where provider='espn'; b.daily_count:=0;
  end if;
  select count(*) into n from private.provider_request_attempts where reserved_at>t-interval '60 seconds';
  if n>=b.rolling_limit or b.daily_count>=b.daily_limit then return jsonb_build_object('ok',false,'code','budget_exhausted'); end if;
  insert into private.provider_request_attempts(group_id,purpose,reserved_at,worker_generation,lease_token,worker_slot_id)
  values(g.id,p_purpose,t,p_generation,token,slot_id) returning id into attempt_id;
  update private.provider_budget_state set daily_count=daily_count+1,updated_at=t where provider='espn';
  update private.provider_request_groups set lease_token=token,lease_until=least(t+interval '60 seconds',worker_until),owner_generation=p_generation,
    current_attempt_id=attempt_id,last_attempt_at=t,next_attempt_at=t+case when p_purpose='live' then interval '60 seconds' else interval '5 minutes' end
  where id=g.id;
  update private.provider_matches set last_attempt_at=t where scoreboard_group_id=g.id;
  insert into private.provider_request_daily_usage(usage_day,provider,purpose,outcome,attempt_count)
  values((t at time zone 'UTC')::date,'espn',p_purpose,'reserved',1)
  on conflict(usage_day,provider,purpose,outcome,scope_label) do update set attempt_count=private.provider_request_daily_usage.attempt_count+1;
  return jsonb_build_object('ok',true,'attemptId',attempt_id::text,'leaseToken',token,'leaseUntil',least(t+interval '60 seconds',worker_until),'startedAt',t,
    'groupId',g.id::text,'kind',g.resource_kind,'leagueCode',(select league_code from private.provider_leagues where id=g.league_id),
    'date',g.request_date,'sourceEventId',g.source_event_id,'workerGeneration',p_generation);
end;
$$;

create function private.accept_compact_provider_match(p_group_id bigint,p_sequence bigint,p_item jsonb,p_time timestamptz)
returns boolean language plpgsql set search_path='' as $$
declare
  g private.provider_request_groups%rowtype; m private.provider_matches%rowtype; previous private.provider_matches%rowtype;
  home_id bigint; away_id bigint; event_id text:=p_item#>>'{identity,sourceEventId}'; competition_id text:=p_item#>>'{identity,sourceCompetitionId}';
  new_home integer; new_away integer; changed boolean;
begin
  select * into g from private.provider_request_groups where id=p_group_id;
  if p_item#>>'{identity,provider}' is distinct from 'espn'
    or p_item#>>'{identity,leagueCode}' is distinct from (select league_code from private.provider_leagues where id=g.league_id)
    or event_id is null or length(event_id) not between 1 and 128
    or coalesce(length(p_item#>>'{homeTeam,name}'),0) not between 1 and 160
    or coalesce(length(p_item#>>'{awayTeam,name}'),0) not between 1 and 160 then return false; end if;
  -- Missing optional fields never erase a previously accepted valid identity or score.
  select * into previous from private.provider_matches where league_id=g.league_id and source_event_id=event_id for update;
  if found then
    if p_sequence<=previous.last_projection_sequence then return true; end if;
    if previous.source_competition_id is not null and competition_id is not null and previous.source_competition_id<>competition_id then return false; end if;
    if (previous.home_team_id is not null and p_item#>>'{homeTeam,sourceTeamId}' is not null and p_item#>>'{homeTeam,sourceTeamId}'<>(select source_team_id from private.provider_teams where id=previous.home_team_id))
      or (previous.away_team_id is not null and p_item#>>'{awayTeam,sourceTeamId}' is not null and p_item#>>'{awayTeam,sourceTeamId}'<>(select source_team_id from private.provider_teams where id=previous.away_team_id)) then return false; end if;
  end if;
  if p_item#>>'{homeTeam,sourceTeamId}' is not null then
    insert into private.provider_teams(provider,source_team_id,display_name,short_name)
    values('espn',p_item#>>'{homeTeam,sourceTeamId}',p_item#>>'{homeTeam,name}',p_item#>>'{homeTeam,shortName}')
    on conflict(provider,source_team_id) do update set display_name=excluded.display_name,short_name=coalesce(excluded.short_name,private.provider_teams.short_name) returning id into home_id;
  end if;
  if p_item#>>'{awayTeam,sourceTeamId}' is not null then
    insert into private.provider_teams(provider,source_team_id,display_name,short_name)
    values('espn',p_item#>>'{awayTeam,sourceTeamId}',p_item#>>'{awayTeam,name}',p_item#>>'{awayTeam,shortName}')
    on conflict(provider,source_team_id) do update set display_name=excluded.display_name,short_name=coalesce(excluded.short_name,private.provider_teams.short_name) returning id into away_id;
  end if;
  if home_id is not null and home_id=away_id then return false; end if;
  if (p_item->>'homeScore') ~ '^\d{1,3}$' and (p_item->>'awayScore') ~ '^\d{1,3}$' then new_home:=(p_item->>'homeScore')::integer;new_away:=(p_item->>'awayScore')::integer; end if;
  insert into private.provider_matches(league_id,source_event_id,home_name,away_name) values(g.league_id,event_id,p_item#>>'{homeTeam,name}',p_item#>>'{awayTeam,name}')
  on conflict(league_id,source_event_id) do nothing;
  select * into m from private.provider_matches where league_id=g.league_id and source_event_id=event_id for update;
  if p_sequence<=m.last_projection_sequence then return true; end if;
  previous:=m;
  update private.provider_matches set
    source_competition_id=coalesce(competition_id,source_competition_id),home_team_id=coalesce(home_id,home_team_id),away_team_id=coalesce(away_id,away_team_id),
    home_name=p_item#>>'{homeTeam,name}',away_name=p_item#>>'{awayTeam,name}',
    kickoff_at=coalesce((p_item->>'kickoffAt')::timestamptz,kickoff_at),
    kickoff_validity=case when p_item->>'kickoffAt' is not null then p_item->>'kickoffValidity' else kickoff_validity end,
    lifecycle=case when p_item->>'lifecycle' is null or p_item->>'lifecycle'='unknown' then lifecycle else p_item->>'lifecycle' end,
    raw_status=coalesce(p_item->>'rawStatus',raw_status),is_completed=coalesce((p_item->>'isCompleted')::boolean,is_completed),
    home_score=coalesce(new_home,home_score),away_score=coalesce(new_away,away_score),
    shootout_home_score=coalesce((p_item->>'shootoutHomeScore')::integer,shootout_home_score),shootout_away_score=coalesce((p_item->>'shootoutAwayScore')::integer,shootout_away_score),
    aggregate_home_score=coalesce((p_item->>'aggregateHomeScore')::integer,aggregate_home_score),aggregate_away_score=coalesce((p_item->>'aggregateAwayScore')::integer,aggregate_away_score),
    period=coalesce((p_item->>'period')::smallint,period),clock_seconds=coalesce((p_item->>'clockSeconds')::numeric,clock_seconds),display_clock=coalesce(p_item->>'displayClock',display_clock),
    season_source_id=coalesce(p_item#>>'{season,sourceId}',season_source_id),season_year=coalesce((p_item#>>'{season,year}')::smallint,season_year),season_type=coalesce(p_item#>>'{season,type}',season_type),
    venue_source_id=coalesce(p_item#>>'{venue,sourceId}',venue_source_id),venue_name=coalesce(p_item#>>'{venue,name}',venue_name),
    scoreboard_group_id=case when g.resource_kind='scoreboard' then g.id else scoreboard_group_id end,
    last_projection_sequence=p_sequence,last_attempt_at=(select reserved_at from private.provider_request_attempts where id=p_sequence),last_successful_check_at=p_time,observed_at=p_time,availability=coalesce(p_item->>'availability','partial'),availability_reason=null,
    completed_at=case when p_item->>'lifecycle'='finished' then coalesce(completed_at,p_time) else completed_at end
  where id=m.id returning * into m;
  changed:=previous.observation_version=0 or row(previous.home_score,previous.away_score,previous.lifecycle,previous.kickoff_at,previous.kickoff_validity,previous.shootout_home_score,previous.shootout_away_score,previous.aggregate_home_score,previous.aggregate_away_score)
    is distinct from row(m.home_score,m.away_score,m.lifecycle,m.kickoff_at,m.kickoff_validity,m.shootout_home_score,m.shootout_away_score,m.aggregate_home_score,m.aggregate_away_score);
  if changed then
    update private.provider_matches set observation_version=observation_version+1 where id=m.id returning observation_version into m.observation_version;
    insert into private.provider_match_observations(match_id,observation_version,accepted_at,attempt_sequence,source_scope,source_event_id,source_competition_id,home_score,away_score,lifecycle,kickoff_at,kickoff_validity,shootout_home_score,shootout_away_score,aggregate_home_score,aggregate_away_score)
    values(m.id,m.observation_version,p_time,p_sequence,g.scope_key,m.source_event_id,m.source_competition_id,m.home_score,m.away_score,m.lifecycle,m.kickoff_at,m.kickoff_validity,m.shootout_home_score,m.shootout_away_score,m.aggregate_home_score,m.aggregate_away_score);
  end if;
  return true;
end;
$$;

create function private.accept_provider_response(p_attempt_id bigint,p_lease_token uuid,p_generation bigint,p_projection jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b private.provider_budget_state%rowtype; a private.provider_request_attempts%rowtype; g private.provider_request_groups%rowtype;
  t timestamptz:=clock_timestamp(); item jsonb; accepted integer:=0; rejected integer:=0;
begin
  select * into b from private.provider_budget_state where provider='espn' for update;
  select * into a from private.provider_request_attempts where id=p_attempt_id;
  if not found then return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  select * into g from private.provider_request_groups where id=a.group_id for update;
  t:=clock_timestamp();
  if b.ownership_mode is distinct from 'catalog' or b.worker_generation is distinct from p_generation or a.worker_generation is distinct from p_generation
    or a.lease_token is distinct from p_lease_token or p_lease_token is null then
    return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  if a.outcome in ('accepted','partial') then return jsonb_build_object('ok',true,'isReplay',true); end if;
  if g.lease_token is distinct from p_lease_token or g.owner_generation is distinct from p_generation then return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  if g.lease_until<=t or g.lease_until is null or a.outcome<>'reserved' then return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  if jsonb_typeof(p_projection->'matches') is distinct from 'array' or jsonb_typeof(p_projection->'isPartial') is distinct from 'boolean' or octet_length(p_projection::text)>2097152 then return jsonb_build_object('ok',false,'code','invalid_provider_response'); end if;
  if jsonb_array_length(p_projection->'matches')>512 then return jsonb_build_object('ok',false,'code','invalid_provider_response'); end if;
  for item in select value from jsonb_array_elements(p_projection->'matches') loop
    if private.accept_compact_provider_match(g.id,a.id,item,t) then accepted:=accepted+1; else rejected:=rejected+1; end if;
  end loop;
  if clock_timestamp()>=g.lease_until then raise exception 'Provider claim expired' using errcode='57014'; end if;
  update private.provider_request_attempts set outcome=case when rejected>0 or p_projection->>'isPartial'='true' then 'partial' else 'accepted' end,finished_at=t where id=a.id;
  update private.provider_request_groups set last_successful_check_at=t,successful_empty=jsonb_array_length(p_projection->'matches')=0 and p_projection->>'isPartial'='false',
    failure_count=0,last_error=case when rejected>0 then 'identity_unresolved' when p_projection->>'isPartial'='true' then 'partial_provider_response' else null end,lease_until=null,lease_token=null,owner_generation=null where id=g.id;
  return jsonb_build_object('ok',true,'acceptedMatches',accepted,'rejectedMatches',rejected,'isReplay',false);
end;
$$;

-- Backend login provisioning is separate. Neither public clients nor service JWTs get these operations.
do $$ declare relation text; begin
  foreach relation in array array['provider_leagues','provider_teams','provider_athletes','provider_budget_state','provider_worker_slots','provider_request_groups','provider_request_attempts','provider_request_daily_usage','provider_matches','provider_match_observations'] loop
    execute format('alter table private.%I enable row level security',relation);
    execute format('revoke all on table private.%I from public,anon,authenticated,service_role',relation);
  end loop;
end $$;
revoke all on function private.reject_provider_observation_update() from public,anon,authenticated,service_role;
revoke all on function private.claim_provider_request(bigint,text,uuid,bigint) from public,anon,authenticated,service_role;
revoke all on function private.accept_compact_provider_match(bigint,bigint,jsonb,timestamptz) from public,anon,authenticated,service_role;
revoke all on function private.accept_provider_response(bigint,uuid,bigint,jsonb) from public,anon,authenticated,service_role;

create function private.acquire_provider_worker_slot(p_purpose text,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b private.provider_budget_state%rowtype; slot_id smallint; t timestamptz:=clock_timestamp(); token uuid:=gen_random_uuid(); live_groups integer; free_slots integer;
begin
  select * into b from private.provider_budget_state where provider='espn' for update;
  t:=clock_timestamp();
  if p_generation is distinct from b.worker_generation then return jsonb_build_object('ok',false,'code','stale_generation'); end if;
  if p_purpose is null or p_purpose not in ('live','discovery','completion','replay') then return jsonb_build_object('ok',false,'code','invalid_purpose'); end if;
  if p_purpose<>'replay' and b.ownership_mode<>'catalog' then return jsonb_build_object('ok',false,'code','acquisition_paused'); end if;
  if p_purpose<>'replay' and (b.rolling_limit is null or b.daily_limit is null) then return jsonb_build_object('ok',false,'code','configuration_required'); end if;
  if p_purpose in ('discovery','completion') then
    select count(*) into live_groups from private.provider_request_groups where live_due_at<=t+interval '45 seconds' and not paused and (lease_until is null or lease_until<=t);
    select count(*) into free_slots from private.provider_worker_slots where lease_until is null or lease_until<=t;
    if free_slots>0 and live_groups>0 and free_slots<=least(2,(live_groups+3)/4) then return jsonb_build_object('ok',false,'code','live_capacity_reserved'); end if;
  end if;
  select id into slot_id from private.provider_worker_slots where lease_until is null or lease_until<=t order by id for update skip locked limit 1;
  if slot_id is null then return jsonb_build_object('ok',false,'code','workers_busy'); end if;
  update private.provider_worker_slots set lease_token=token,worker_generation=p_generation,lease_until=t+interval '60 seconds',started_at=t,last_progress_at=t,dispatch_request_id=null,outcome=null where id=slot_id;
  return jsonb_build_object('ok',true,'slotId',slot_id,'dispatchToken',token,'workerGeneration',p_generation,'leaseUntil',t+interval '60 seconds');
end;
$$;

create function private.release_provider_worker_slot(p_token uuid,p_generation bigint,p_outcome text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_outcome not in ('completed','deadline','failed') or p_outcome is null then raise exception 'Invalid worker outcome' using errcode='22023'; end if;
  update private.provider_worker_slots set lease_token=null,lease_until=null,last_progress_at=clock_timestamp(),outcome=p_outcome
    where lease_token=p_token and worker_generation=p_generation;
end;
$$;

create function private.fail_provider_request(p_attempt_id bigint,p_lease_token uuid,p_generation bigint,p_code text,p_http_status integer,p_retry_after_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b private.provider_budget_state%rowtype; a private.provider_request_attempts%rowtype; g private.provider_request_groups%rowtype; t timestamptz:=clock_timestamp(); next_time timestamptz; seconds integer;
begin
  if p_code is null or p_code not in ('provider_timeout','provider_unavailable','provider_throttled','provider_access_rejected','provider_response_too_large','invalid_provider_response','match_not_found')
    or p_retry_after_seconds<0 or p_http_status<100 or p_http_status>599 then return jsonb_build_object('ok',false,'code','invalid_failure'); end if;
  select * into b from private.provider_budget_state where provider='espn' for update;
  select * into a from private.provider_request_attempts where id=p_attempt_id;
  if not found then return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  select * into g from private.provider_request_groups where id=a.group_id for update;
  t:=clock_timestamp();
  if b.worker_generation is distinct from p_generation or a.worker_generation is distinct from p_generation or a.lease_token is distinct from p_lease_token or p_lease_token is null then return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  if a.outcome<>'reserved' then return jsonb_build_object('ok',true,'isReplay',true); end if;
  if b.ownership_mode<>'catalog' or g.lease_token is distinct from p_lease_token or g.owner_generation is distinct from p_generation or g.lease_until is null or g.lease_until<=t then return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  seconds:=least(900,60*power(2,least(g.failure_count,4))::integer)+floor(random()*15)::integer;
  next_time:=greatest(t+make_interval(secs=>seconds),t+make_interval(secs=>coalesce(p_retry_after_seconds,0)));
  update private.provider_request_attempts set outcome='failed',error_code=p_code,http_status=p_http_status,finished_at=t where id=a.id;
  update private.provider_request_groups set failure_count=failure_count+1,last_error=p_code,cooldown_until=next_time,next_attempt_at=greatest(next_attempt_at,next_time),
    paused=p_code='provider_access_rejected',lease_token=null,lease_until=null,owner_generation=null where id=g.id;
  if p_code='provider_throttled' then update private.provider_budget_state set cooldown_until=greatest(cooldown_until,next_time),updated_at=t where provider='espn'; end if;
  return jsonb_build_object('ok',true,'retryAfterSeconds',ceil(extract(epoch from next_time-t))::integer,'scope',case when p_code='provider_throttled' then 'provider' else 'group' end);
end;
$$;

do $$ begin
  if not exists(select 1 from pg_roles where rolname='match_catalog_backend') then create role match_catalog_backend nologin noinherit; end if;
end $$;
grant usage on schema private to match_catalog_backend;
revoke all on function private.acquire_provider_worker_slot(text,bigint) from public,anon,authenticated,service_role;
revoke all on function private.release_provider_worker_slot(uuid,bigint,text) from public,anon,authenticated,service_role;
revoke all on function private.fail_provider_request(bigint,uuid,bigint,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function private.acquire_provider_worker_slot(text,bigint),private.release_provider_worker_slot(uuid,bigint,text),
  private.claim_provider_request(bigint,text,uuid,bigint),private.accept_provider_response(bigint,uuid,bigint,jsonb),private.fail_provider_request(bigint,uuid,bigint,text,integer,integer)
to match_catalog_backend;
