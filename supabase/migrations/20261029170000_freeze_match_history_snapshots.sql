-- Freeze public provider facts at the room boundary. No live catalog joins in history.
alter table public.matches add column catalog_snapshot jsonb
  check (catalog_snapshot is null or jsonb_typeof(catalog_snapshot)='object');

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

create or replace function private.apply_saved_provider_observation(p_room_match_id uuid,p_observation_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare room_id uuid; room public.game_sessions%rowtype; room_match public.matches%rowtype; source_match private.provider_matches%rowtype;
  observation private.provider_match_observations%rowtype; league private.provider_leagues%rowtype; response jsonb; fingerprint text; captured jsonb;
begin
  select session_id into room_id from public.matches where id=p_room_match_id;
  if room_id is null then return jsonb_build_object('ok',false,'code','match_not_in_room'); end if;
  select * into room from public.game_sessions where id=room_id for update;
  select * into room_match from public.matches where id=p_room_match_id and session_id=room_id for update;
  if room.state<>'in_progress'::public.session_state then return jsonb_build_object('ok',false,'code','not_eligible'); end if;
  if room.common_match_id is distinct from p_room_match_id and not exists(
    select 1 from public.assignments assignment join public.participants participant on participant.session_id=assignment.session_id and participant.id=assignment.participant_id
    where assignment.session_id=room_id and assignment.match_id=p_room_match_id and participant.left_at is null
  ) then return jsonb_build_object('ok',false,'code','not_selected'); end if;
  if room_match.catalog_match_id is null or p_observation_version is null or p_observation_version<1 then return jsonb_build_object('ok',false,'code','identity_unresolved'); end if;
  select * into source_match from private.provider_matches where id=room_match.catalog_match_id;
  select * into league from private.provider_leagues where id=source_match.league_id;
  if room_match.source_provider is distinct from league.provider or room_match.source_match_id is distinct from source_match.source_event_id or room_match.source_league_code is distinct from league.league_code then return jsonb_build_object('ok',false,'code','identity_unresolved'); end if;
  if room_match.last_applied_observation_version>=p_observation_version then return jsonb_build_object('ok',true,'isReplay',true,'changed',false); end if;
  if room_match.tracking_started_observation_version is null and p_observation_version<>source_match.observation_version then return jsonb_build_object('ok',false,'code','reconciliation_required','observationVersion',source_match.observation_version::text); end if;
  if room_match.last_applied_observation_version is not null and p_observation_version<>room_match.last_applied_observation_version+1 then return jsonb_build_object('ok',false,'code','out_of_order'); end if;
  select * into observation from private.provider_match_observations where match_id=source_match.id and observation_version=p_observation_version;
  if not found then return jsonb_build_object('ok',false,'code','observation_unavailable'); end if;
  captured := private.saved_match_projection(source_match.id, 'history') || jsonb_build_object(
    'homeScore', observation.home_score, 'awayScore', observation.away_score,
    'lifecycle', observation.lifecycle, 'observationVersion', p_observation_version::text,
    'kickoffAt', observation.kickoff_at);
  -- Unknown scores still advance the observation cursor; they must never fabricate a 0-0 pair.
  if observation.home_score is null and observation.away_score is null then
    update public.matches set catalog_snapshot=captured,tracking_started_observation_version=coalesce(tracking_started_observation_version,p_observation_version),last_applied_observation_version=p_observation_version,last_provider_applied_at=clock_timestamp() where id=p_room_match_id;
    return jsonb_build_object('ok',true,'changed',false,'observationVersion',p_observation_version::text);
  end if;
  fingerprint:=encode(extensions.digest(concat('catalog:',p_room_match_id::text,':',p_observation_version::text),'sha256'),'hex');
  response:=private.apply_provider_score_consequences(room_id,p_room_match_id,coalesce(observation.home_score,room_match.home_score),coalesce(observation.away_score,room_match.away_score),observation.accepted_at,
    concat('catalog:',p_room_match_id::text,':',p_observation_version::text),fingerprint,null,source_match.id,p_observation_version);
  update public.matches set catalog_snapshot=captured,tracking_started_observation_version=coalesce(tracking_started_observation_version,p_observation_version),last_applied_observation_version=p_observation_version,last_provider_applied_at=clock_timestamp() where id=p_room_match_id;
  return response||jsonb_build_object('ok',true,'isReplay',false,'observationVersion',p_observation_version::text);
end;
$$;

CREATE OR REPLACE FUNCTION private.build_guest_room_snapshot(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT jsonb_build_object(
    'sessionId', game_sessions.id::text,
    'joinCode', game_sessions.join_code,
    'state', game_sessions.state::text,
    'commonMatchId', game_sessions.common_match_id::text,
    'assignmentMode', game_sessions.assignment_mode::text,
    'participants',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', participants.id::text,
            'displayName', participants.display_name,
            'membershipType', participants.membership_type::text,
            'sessionRole', participants.session_role::text,
            'currentDrinkTotal', participants.current_drink_total,
            'leftAt', participants.left_at
          )
          ORDER BY participants.created_at, participants.id
        )
        FROM public.participants participants
        WHERE participants.session_id = game_sessions.id
          AND (participants.left_at IS NULL
            OR (game_sessions.started_at IS NOT NULL
              AND participants.left_at >= game_sessions.started_at))
      ),
      '[]'::jsonb
    ),
    'activeRoster',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', participants.id::text,
            'displayName', participants.display_name,
            'membershipType', participants.membership_type::text,
            'sessionRole', participants.session_role::text,
            'currentDrinkTotal', participants.current_drink_total,
            'leftAt', participants.left_at
          )
          ORDER BY participants.created_at, participants.id
        )
        FROM public.participants participants
        WHERE participants.session_id = game_sessions.id
          AND private.is_active_room_roster_member(
            participants.membership_type::text,
            participants.left_at,
            participants.guest_rejoin_token_hash,
            participants.guest_grant_expires_at
          )
      ),
      '[]'::jsonb
    ),
    'matches',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', matches.id::text,
            'sourceProvider', matches.source_provider,
            'sourceMatchId', matches.source_match_id,
            'sourceLeagueCode', matches.source_league_code,
            'catalogMatchId', matches.catalog_match_id::text,
            'catalogSnapshot', matches.catalog_snapshot,
            'homeTeamName', matches.home_team_name,
            'awayTeamName', matches.away_team_name,
            'kickoffAt', matches.kickoff_at,
            'homeScore', matches.home_score,
            'awayScore', matches.away_score
          )
          ORDER BY matches.created_at, matches.id
        )
        FROM public.matches matches
        WHERE matches.session_id = game_sessions.id
      ),
      '[]'::jsonb
    ),
    'assignments',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'participantId', assignments.participant_id::text,
            'matchId', assignments.match_id::text
          )
          ORDER BY assignments.participant_id, assignments.match_id
        )
        FROM public.assignments assignments
        WHERE assignments.session_id = game_sessions.id
      ),
      '[]'::jsonb
    ),
    'picks',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'participantId', assignment_picks.participant_id::text,
            'matchId', assignment_picks.match_id::text
          )
          ORDER BY assignment_picks.participant_id, assignment_picks.match_id
        )
        FROM public.assignment_picks assignment_picks
        WHERE assignment_picks.session_id = game_sessions.id
      ),
      '[]'::jsonb
    ),
    'assignmentPlan', private.compute_room_assignment_plan(game_sessions.id)
  ) || private.catalog_room_source_status(game_sessions.id)
  FROM public.game_sessions game_sessions
  WHERE game_sessions.id = p_session_id;
$function$;

CREATE OR REPLACE VIEW private._history_completed_matches WITH (security_invoker = true) AS
SELECT matches.session_id,
	matches.id AS match_id,
	matches.source_provider,
	matches.source_match_id,
	matches.home_team_name,
	matches.away_team_name,
	matches.kickoff_at,
	matches.home_score,
	matches.away_score,
	matches.created_at,
	(matches.home_score + matches.away_score) AS total_goals,
    matches.catalog_match_id, matches.catalog_snapshot
FROM public.matches matches
	JOIN private._history_completed_sessions completed_sessions ON completed_sessions.session_id = matches.session_id;

CREATE OR REPLACE VIEW public.completed_session_summaries WITH (security_invoker = true) AS
SELECT session_rollups.session_id,
  session_rollups.owner_account_id,
  session_rollups.completed_at,
  session_rollups.started_at,
  session_rollups.common_match_id,
  session_rollups.session_total_players,
  session_rollups.session_total_matches,
  session_rollups.session_total_goals,
  session_rollups.session_total_drinks,
  session_rollups.matches_per_player,
  COALESCE(players.players, '[]'::jsonb) AS players,
  COALESCE(matches.matches, '[]'::jsonb) AS matches,
  COALESCE(assignments.player_assignments, '{}'::jsonb) AS player_assignments,
  EXISTS (
    SELECT 1
    FROM public.gameplay_events AS events
    WHERE events.session_id = session_rollups.session_id
      AND events.event_type = 'assignment_reassigned'
  ) AS assignments_changed_during_play
FROM private._history_session_rollups AS session_rollups
LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', participants.participant_id,
        'accountId', participants.account_id,
        'name', participants.display_name,
        'drinksTaken', participants.current_drink_total,
        'membershipType', participants.membership_type,
        'leftAt', participants.left_at
      ) ORDER BY participants.created_at, participants.participant_id
    ),
    '[]'::jsonb
  ) AS players
  FROM private._history_completed_participants AS participants
  WHERE participants.session_id = session_rollups.session_id
) AS players ON TRUE
LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', matches.match_id,
        'catalogMatchId', matches.catalog_match_id::text,
        'catalogSnapshot', matches.catalog_snapshot,
        'sourceProvider', matches.source_provider,
        'sourceMatchId', matches.source_match_id,
        'homeTeam', matches.home_team_name,
        'awayTeam', matches.away_team_name,
        'kickoffAt', matches.kickoff_at,
        'homeGoals', matches.home_score,
        'awayGoals', matches.away_score,
        'goals', matches.total_goals
      ) ORDER BY matches.created_at, matches.match_id
    ),
    '[]'::jsonb
  ) AS matches
  FROM private._history_completed_matches AS matches
  WHERE matches.session_id = session_rollups.session_id
) AS matches ON TRUE
LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_object_agg(assignment_groups.participant_id::text, assignment_groups.match_ids),
    '{}'::jsonb
  ) AS player_assignments
  FROM (
    SELECT assignments.participant_id,
      jsonb_agg(assignments.match_id::text ORDER BY assignments.match_id) AS match_ids
    FROM private._history_completed_assignments AS assignments
    WHERE assignments.session_id = session_rollups.session_id
    GROUP BY assignments.participant_id
  ) AS assignment_groups
) AS assignments ON TRUE
ORDER BY session_rollups.completed_at DESC, session_rollups.session_id DESC;
