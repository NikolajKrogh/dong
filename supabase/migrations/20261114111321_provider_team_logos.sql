create function private.valid_espn_team_logo(p_url text)
returns text language sql immutable set search_path='' as $$
  select case when length(p_url) <= 2048
    and p_url ~* '^https://([a-z0-9-]+[.])*espncdn[.]com/[^[:space:]]+$'
    then p_url end;
$$;

revoke all on function private.valid_espn_team_logo(text) from public, anon, authenticated;

alter table private.provider_teams add column logo_url text
  check (logo_url is null or private.valid_espn_team_logo(logo_url) is not null);

create or replace function private.accept_compact_provider_match(p_group_id bigint,p_sequence bigint,p_item jsonb,p_time timestamptz)
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
  -- Preserve source identity; current nullable scores describe only this observation.
  select * into previous from private.provider_matches where league_id=g.league_id and source_event_id=event_id for update;
  if found then
    if p_sequence<=previous.last_projection_sequence then return true; end if;
    if previous.source_competition_id is not null and competition_id is not null and previous.source_competition_id<>competition_id then return false; end if;
    if (previous.home_team_id is not null and p_item#>>'{homeTeam,sourceTeamId}' is not null and p_item#>>'{homeTeam,sourceTeamId}'<>(select source_team_id from private.provider_teams where id=previous.home_team_id))
      or (previous.away_team_id is not null and p_item#>>'{awayTeam,sourceTeamId}' is not null and p_item#>>'{awayTeam,sourceTeamId}'<>(select source_team_id from private.provider_teams where id=previous.away_team_id)) then return false; end if;
  end if;
  if p_item#>>'{homeTeam,sourceTeamId}' is not null then
    insert into private.provider_teams(provider,source_team_id,display_name,short_name,logo_url)
    values('espn',p_item#>>'{homeTeam,sourceTeamId}',p_item#>>'{homeTeam,name}',p_item#>>'{homeTeam,shortName}',private.valid_espn_team_logo(p_item#>>'{homeTeam,logoUrl}'))
    on conflict(provider,source_team_id) do update set display_name=excluded.display_name,short_name=coalesce(excluded.short_name,private.provider_teams.short_name),logo_url=coalesce(excluded.logo_url,private.provider_teams.logo_url) returning id into home_id;
  end if;
  if p_item#>>'{awayTeam,sourceTeamId}' is not null then
    insert into private.provider_teams(provider,source_team_id,display_name,short_name,logo_url)
    values('espn',p_item#>>'{awayTeam,sourceTeamId}',p_item#>>'{awayTeam,name}',p_item#>>'{awayTeam,shortName}',private.valid_espn_team_logo(p_item#>>'{awayTeam,logoUrl}'))
    on conflict(provider,source_team_id) do update set display_name=excluded.display_name,short_name=coalesce(excluded.short_name,private.provider_teams.short_name),logo_url=coalesce(excluded.logo_url,private.provider_teams.logo_url) returning id into away_id;
  end if;
  if home_id is not null and home_id=away_id then return false; end if;
  if (p_item->>'homeScore') ~ '^\d{1,3}$' then new_home:=(p_item->>'homeScore')::integer; end if;
  if (p_item->>'awayScore') ~ '^\d{1,3}$' then new_away:=(p_item->>'awayScore')::integer; end if;
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
    home_score=new_home,away_score=new_away,
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

create or replace function private.saved_match_projection_core(p_match_id bigint,p_projection text)
returns jsonb language sql stable set search_path='' as $$
select jsonb_build_object(
  'catalogMatchId',m.id::text,
  'identity',jsonb_build_object('provider',l.provider,'leagueCode',l.league_code,'sourceEventId',m.source_event_id,'sourceCompetitionId',m.source_competition_id),
  'homeTeam',jsonb_build_object('sourceTeamId',h.source_team_id,'name',m.home_name,'shortName',h.short_name,'logoUrl',h.logo_url),
  'awayTeam',jsonb_build_object('sourceTeamId',a.source_team_id,'name',m.away_name,'shortName',a.short_name,'logoUrl',a.logo_url),
  'kickoffAt',m.kickoff_at,'kickoffValidity',m.kickoff_validity,'lifecycle',m.lifecycle,'rawStatus',m.raw_status,'isCompleted',m.is_completed,
  'homeScore',m.home_score,'awayScore',m.away_score,'shootoutHomeScore',m.shootout_home_score,'shootoutAwayScore',m.shootout_away_score,
  'aggregateHomeScore',m.aggregate_home_score,'aggregateAwayScore',m.aggregate_away_score,'period',m.period,'clockSeconds',m.clock_seconds,'displayClock',m.display_clock,
  'season',case when m.season_source_id is null and m.season_year is null and m.season_type is null then null else jsonb_build_object('sourceId',m.season_source_id,'year',m.season_year,'type',m.season_type) end,
  'venue',case when m.venue_source_id is null and m.venue_name is null then null else jsonb_build_object('sourceId',m.venue_source_id,'name',m.venue_name) end,
  'observationVersion',m.observation_version::text,'availability',m.availability,
  'freshness',jsonb_build_object('lastAttemptAt',m.last_attempt_at,'lastSuccessfulCheckAt',m.last_successful_check_at,'observedAt',m.observed_at,
    'isStale',m.last_successful_check_at is null or m.last_successful_check_at<statement_timestamp()-case when m.lifecycle='live' then interval '60 seconds' else interval '5 minutes' end,'availabilityReason',m.availability_reason),
  'goals',case when m.goals_availability='unavailable' then null else coalesce((select jsonb_agg(x.value order by x.display_order,x.id) from (
    select g.id,g.display_order,jsonb_build_object('sourcePlayId',g.source_play_id,'side',g.side,'sourceAthleteId',g.source_athlete_id,'athleteName',g.athlete_name,'sourceTeamId',g.source_team_id,
      'clock',g.clock,'period',g.period,'occurredAt',g.occurred_at,'kind',g.kind,'isRetracted',g.is_retracted) as value
    from private.provider_match_goals g where g.match_id=m.id order by g.display_order,g.id limit 100) x),'[]'::jsonb) end,
  'goalsAvailability',m.goals_availability,'hasMoreGoals',m.has_more_goals or (select count(*)>100 from private.provider_match_goals where match_id=m.id),
  'homeTeamStatistics',private.provider_stats_projection(m.id,'home'),'awayTeamStatistics',private.provider_stats_projection(m.id,'away')
) || case when p_projection='history' then jsonb_build_object('historyDetails',jsonb_build_object('rosterEntries',null,'teamStats',null,'availability','unavailable','isFinal',null,'hasMoreRosterEntries',false)) else '{}'::jsonb end
from private.provider_matches m join private.provider_leagues l on l.id=m.league_id
left join private.provider_teams h on h.id=m.home_team_id left join private.provider_teams a on a.id=m.away_team_id where m.id=p_match_id;
$$;

-- Enrich only the team objects in frozen snapshots. All match facts stay frozen.
create function private.backfill_history_team_logos()
returns bigint language plpgsql set search_path='' as $$
declare
  updated bigint;
begin
  with candidates as (
    select room_match.id, room_match.catalog_snapshot,
      home.source_team_id as home_id, home.logo_url as home_logo,
      away.source_team_id as away_id, away.logo_url as away_logo
    from public.matches room_match
    join public.game_sessions session on session.id=room_match.session_id
    join private.provider_matches source on source.id=room_match.catalog_match_id
    join private.provider_leagues league on league.id=source.league_id
    join private.provider_teams home on home.id=source.home_team_id
    join private.provider_teams away on away.id=source.away_team_id
    where session.state='completed'
      and room_match.source_provider='espn'
      and room_match.source_match_id=source.source_event_id
      and room_match.source_league_code=league.league_code
      and room_match.catalog_snapshot#>>'{homeTeam,name}'=source.home_name
      and room_match.catalog_snapshot#>>'{awayTeam,name}'=source.away_name
      and coalesce(room_match.catalog_snapshot#>>'{homeTeam,sourceTeamId}',home.source_team_id)=home.source_team_id
      and coalesce(room_match.catalog_snapshot#>>'{awayTeam,sourceTeamId}',away.source_team_id)=away.source_team_id
  ), enriched as (
    select id, catalog_snapshot as previous_snapshot, catalog_snapshot || jsonb_build_object(
      'homeTeam', catalog_snapshot->'homeTeam' || jsonb_strip_nulls(jsonb_build_object(
        'sourceTeamId', home_id, 'logoUrl', coalesce(catalog_snapshot#>>'{homeTeam,logoUrl}',home_logo))),
      'awayTeam', catalog_snapshot->'awayTeam' || jsonb_strip_nulls(jsonb_build_object(
        'sourceTeamId', away_id, 'logoUrl', coalesce(catalog_snapshot#>>'{awayTeam,logoUrl}',away_logo)))
    ) as snapshot from candidates
  )
  update public.matches match set catalog_snapshot=enriched.snapshot
    from enriched where match.id=enriched.id
      and match.catalog_snapshot=enriched.previous_snapshot
      and match.catalog_snapshot is distinct from enriched.snapshot;
  get diagnostics updated=row_count;
  return updated;
end;
$$;

revoke all on function private.backfill_history_team_logos() from public, anon, authenticated, service_role;
select private.backfill_history_team_logos();
