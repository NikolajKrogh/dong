-- Public saved projections, finite anonymous demand and typed room provenance.
-- Initial snapshot of AVAILABLE_LEAGUES in constants/leagues.ts; later catalogue changes use migrations.
insert into private.provider_leagues(provider,league_code,display_name) values
('espn','eng.1','eng.1'),
('espn','eng.2','eng.2'),
('espn','eng.3','eng.3'),
('espn','eng.4','eng.4'),
('espn','eng.league_cup','eng.league_cup'),
('espn','eng.fa','eng.fa'),
('espn','esp.1','esp.1'),
('espn','esp.2','esp.2'),
('espn','esp.copa_del_rey','esp.copa_del_rey'),
('espn','ger.1','ger.1'),
('espn','ger.2','ger.2'),
('espn','ger.dfb_pokal','ger.dfb_pokal'),
('espn','ita.1','ita.1'),
('espn','ita.2','ita.2'),
('espn','ita.coppa_italia','ita.coppa_italia'),
('espn','fra.1','fra.1'),
('espn','fra.2','fra.2'),
('espn','fra.coupe_de_france','fra.coupe_de_france'),
('espn','por.1','por.1'),
('espn','ned.1','ned.1'),
('espn','ned.cup','ned.cup'),
('espn','sco.1','sco.1'),
('espn','sco.3','sco.3'),
('espn','sco.4','sco.4'),
('espn','bel.1','bel.1'),
('espn','rus.1','rus.1'),
('espn','tur.1','tur.1'),
('espn','gre.1','gre.1'),
('espn','sui.1','sui.1'),
('espn','aut.1','aut.1'),
('espn','den.1','den.1'),
('espn','nor.1','nor.1'),
('espn','swe.1','swe.1'),
('espn','irl.1','irl.1'),
('espn','uefa.champions','uefa.champions'),
('espn','uefa.europa','uefa.europa'),
('espn','uefa.europa.conf','uefa.europa.conf'),
('espn','uefa.wchampions','uefa.wchampions'),
('espn','usa.1','usa.1'),
('espn','usa.nwsl','usa.nwsl'),
('espn','usa.usl.1','usa.usl.1'),
('espn','usa.usl.l1','usa.usl.l1'),
('espn','usa.open','usa.open'),
('espn','usa.nwsl.cup','usa.nwsl.cup'),
('espn','mex.1','mex.1'),
('espn','mex.2','mex.2'),
('espn','mex.copa_mx','mex.copa_mx'),
('espn','concacaf.champions','concacaf.champions'),
('espn','concacaf.gold','concacaf.gold'),
('espn','crc.1','crc.1'),
('espn','hon.1','hon.1'),
('espn','gua.1','gua.1'),
('espn','slv.1','slv.1'),
('espn','bra.1','bra.1'),
('espn','bra.2','bra.2'),
('espn','bra.copa_do_brazil','bra.copa_do_brazil'),
('espn','bra.camp.gaucho','bra.camp.gaucho'),
('espn','bra.camp.paulista','bra.camp.paulista'),
('espn','bra.camp.carioca','bra.camp.carioca'),
('espn','bra.camp.mineiro','bra.camp.mineiro'),
('espn','arg.1','arg.1'),
('espn','arg.2','arg.2'),
('espn','arg.3','arg.3'),
('espn','arg.4','arg.4'),
('espn','arg.5','arg.5'),
('espn','arg.copa','arg.copa'),
('espn','arg.copa_lpf','arg.copa_lpf'),
('espn','col.1','col.1'),
('espn','col.2','col.2'),
('espn','col.copa','col.copa'),
('espn','chi.1','chi.1'),
('espn','chi.copa_chi','chi.copa_chi'),
('espn','ecu.1','ecu.1'),
('espn','uru.1','uru.1'),
('espn','ven.1','ven.1'),
('espn','par.1','par.1'),
('espn','per.1','per.1'),
('espn','bol.1','bol.1'),
('espn','conmebol.libertadores','conmebol.libertadores'),
('espn','conmebol.sudamericana','conmebol.sudamericana'),
('espn','conmebol.america','conmebol.america'),
('espn','fifa.world','fifa.world'),
('espn','fifa.cwc','fifa.cwc'),
('espn','fifa.worldq.uefa','fifa.worldq.uefa'),
('espn','fifa.worldq.concacaf','fifa.worldq.concacaf'),
('espn','fifa.worldq.conmebol','fifa.worldq.conmebol'),
('espn','fifa.worldq.afc','fifa.worldq.afc'),
('espn','fifa.worldq.caf','fifa.worldq.caf'),
('espn','fifa.worldq.ofc','fifa.worldq.ofc'),
('espn','fifa.wwc','fifa.wwc'),
('espn','fifa.world.u20','fifa.world.u20'),
('espn','fifa.world.u17','fifa.world.u17'),
('espn','fifa.olympics','fifa.olympics'),
('espn','fifa.w.olympics','fifa.w.olympics'),
('espn','fifa.friendly','fifa.friendly'),
('espn','fifa.friendly.w','fifa.friendly.w'),
('espn','uefa.euro','uefa.euro'),
('espn','uefa.nations','uefa.nations'),
('espn','uefa.euro_u21','uefa.euro_u21'),
('espn','uefa.euro.u19','uefa.euro.u19'),
('espn','uefa.euroq','uefa.euroq'),
('espn','uefa.weuro','uefa.weuro'),
('espn','concacaf.womens.championship','concacaf.womens.championship'),
('espn','club.friendly','club.friendly'),
('espn','afc.champions','afc.champions'),
('espn','afc.cup','afc.cup'),
('espn','afc.asian.cup','afc.asian.cup'),
('espn','afc.cupq','afc.cupq'),
('espn','ksa.1','ksa.1'),
('espn','aus.1','aus.1'),
('espn','aus.w.1','aus.w.1'),
('espn','jpn.1','jpn.1'),
('espn','chn.1','chn.1'),
('espn','ind.1','ind.1'),
('espn','idn.1','idn.1'),
('espn','mys.1','mys.1'),
('espn','sgp.1','sgp.1'),
('espn','tha.1','tha.1'),
('espn','aff.championship','aff.championship'),
('espn','caf.champions','caf.champions'),
('espn','caf.nations','caf.nations')
on conflict(provider,league_code) do nothing;

alter table private.provider_matches
  add column goals_availability text not null default 'unavailable' check (goals_availability in ('available','partial','pending','unavailable','deferred')),
  add column has_more_goals boolean not null default false;

create table private.provider_match_goals (
  id bigint generated always as identity primary key,
  match_id bigint not null references private.provider_matches(id) on delete cascade,
  goal_key text not null check (length(goal_key) between 1 and 180),
  source_play_id text check (length(source_play_id) between 1 and 128),
  side text check (side in ('home','away')),
  source_team_id text check (length(source_team_id) <= 128),
  source_athlete_id text check (length(source_athlete_id) <= 128),
  athlete_name text check (length(athlete_name) <= 160),
  clock text check (length(clock) <= 40),
  period smallint check (period between 0 and 20),
  occurred_at timestamptz,
  kind text not null check (kind in ('goal','penalty','own_goal','shootout','unknown')),
  is_retracted boolean not null default false,
  display_order integer not null check (display_order>=0),
  changed_at timestamptz not null default now(),
  unique(match_id,goal_key)
);
create index provider_goals_timeline on private.provider_match_goals(match_id,display_order,id);
create table private.provider_goal_participants (
  goal_id bigint not null references private.provider_match_goals(id) on delete cascade,
  athlete_id bigint not null references private.provider_athletes(id) on delete restrict,
  role text not null check (role in ('scorer','assist','involved','unknown')),
  primary key(goal_id,athlete_id,role)
);
create index provider_goal_participants_athlete on private.provider_goal_participants(athlete_id,goal_id);
create table private.provider_match_team_stats (
  match_id bigint not null references private.provider_matches(id) on delete cascade,
  side text not null check (side in ('home','away')),
  shot_attempts integer check (shot_attempts between 0 and 100000),
  shots_on_goal integer check (shots_on_goal between 0 and 100000),
  fouls integer check (fouls between 0 and 100000),
  yellow_cards integer check (yellow_cards between 0 and 100000),
  red_cards integer check (red_cards between 0 and 100000),
  corner_kicks integer check (corner_kicks between 0 and 100000),
  possession numeric check (possession between 0 and 100),
  is_final boolean,
  observed_at timestamptz not null,
  projection_sequence bigint not null,
  primary key(match_id,side)
);

create table private.solo_tracking_grants (
  id uuid primary key default gen_random_uuid(),
  nonce_digest bytea not null unique check (octet_length(nonce_digest)=32),
  grant_digest bytea unique check (octet_length(grant_digest)=32),
  signing_key_id text not null check (length(signing_key_id) between 1 and 64),
  creation_operation_id uuid not null,
  creation_request_digest bytea not null check (octet_length(creation_request_digest)=32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  selection_version integer not null default 1 check (selection_version>0),
  latest_operation_id uuid,
  latest_request_digest bytea check (octet_length(latest_request_digest)=32),
  check (expires_at>created_at)
);
create index solo_tracking_grants_expiry on private.solo_tracking_grants(expires_at);
create table private.solo_tracked_matches (
  grant_id uuid not null references private.solo_tracking_grants(id) on delete cascade,
  match_id bigint not null references private.provider_matches(id) on delete restrict,
  admitted_until timestamptz not null,
  primary key(grant_id,match_id)
);
create index solo_tracked_matches_match on private.solo_tracked_matches(match_id,grant_id);
create table private.provider_admission_counters (
  counter_kind text not null check (counter_kind in ('solo_creation','solo_replacement','trusted_caller')),
  scope_key text not null check (length(scope_key)<=128),
  window_start timestamptz not null,
  admitted_count integer not null check (admitted_count>=0),
  primary key(counter_kind,scope_key,window_start)
);

alter table public.matches
  add column catalog_match_id bigint references private.provider_matches(id) on delete restrict,
  add column tracking_started_observation_version bigint,
  add column last_applied_observation_version bigint,
  add column last_provider_applied_at timestamptz,
  add constraint matches_catalog_start_observation foreign key(catalog_match_id,tracking_started_observation_version) references private.provider_match_observations(match_id,observation_version) on delete restrict,
  add constraint matches_catalog_cursor_observation foreign key(catalog_match_id,last_applied_observation_version) references private.provider_match_observations(match_id,observation_version) on delete restrict,
  add constraint matches_catalog_cursor_valid check ((tracking_started_observation_version is null or catalog_match_id is not null) and (last_applied_observation_version is null or catalog_match_id is not null)
    and (tracking_started_observation_version is null or last_applied_observation_version is null or tracking_started_observation_version<=last_applied_observation_version)),
  add constraint matches_id_catalog_unique unique(id,catalog_match_id);
create index matches_catalog_reference on public.matches(catalog_match_id);

alter table public.gameplay_events
  alter column actor_participant_id drop not null,
  add column actor_kind text not null default 'participant',
  add column room_match_id uuid,
  add column catalog_match_id bigint,
  add column provider_observation_version bigint,
  add constraint gameplay_events_provider_room_match foreign key(session_id,room_match_id) references public.matches(session_id,id) on delete restrict,
  add constraint gameplay_events_provider_catalog_match foreign key(room_match_id,catalog_match_id) references public.matches(id,catalog_match_id) on delete restrict,
  add constraint gameplay_events_provider_observation foreign key(catalog_match_id,provider_observation_version) references private.provider_match_observations(match_id,observation_version) on delete restrict,
  add constraint gameplay_events_actor_origin check (
    (actor_kind='participant' and actor_participant_id is not null and room_match_id is null and catalog_match_id is null and provider_observation_version is null)
    or (actor_kind='provider' and actor_participant_id is null and room_match_id is not null and catalog_match_id is not null and provider_observation_version is not null and event_type='provider_score_changed')
  );
create index gameplay_events_provider_observation_reference on public.gameplay_events(catalog_match_id,provider_observation_version) where catalog_match_id is not null;
create index gameplay_events_provider_room_match_reference on public.gameplay_events(room_match_id,catalog_match_id) where room_match_id is not null;

create function private.provider_stats_projection(p_match_id bigint,p_side text)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('shotAttempts',shot_attempts,'shotsOnGoal',shots_on_goal,'fouls',fouls,'yellowCards',yellow_cards,'redCards',red_cards,'cornerKicks',corner_kicks,'possession',possession)
  from private.provider_match_team_stats where match_id=p_match_id and side=p_side;
$$;

create function private.saved_match_projection(p_match_id bigint,p_projection text)
returns jsonb language sql stable set search_path='' as $$
select jsonb_build_object(
  'catalogMatchId',m.id::text,
  'identity',jsonb_build_object('provider',l.provider,'leagueCode',l.league_code,'sourceEventId',m.source_event_id,'sourceCompetitionId',m.source_competition_id),
  'homeTeam',jsonb_build_object('sourceTeamId',h.source_team_id,'name',m.home_name,'shortName',h.short_name),
  'awayTeam',jsonb_build_object('sourceTeamId',a.source_team_id,'name',m.away_name,'shortName',a.short_name),
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

create function private.read_saved_matches(p_catalog_match_ids text[],p_projection text default 'live')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ids text[]; result jsonb; saved jsonb; missing jsonb; id_count integer;
begin
  if p_catalog_match_ids is null or p_projection is null or p_projection not in ('live','history') then raise exception 'invalid_selection' using errcode='22023'; end if;
  if cardinality(p_catalog_match_ids)>100 then raise exception 'projection_too_large' using errcode='22023'; end if;
  if exists(select 1 from unnest(p_catalog_match_ids) x where x is null or x !~ '^[1-9][0-9]{0,18}$') then raise exception 'invalid_selection' using errcode='22023'; end if;
  if exists(select 1 from unnest(p_catalog_match_ids) x where x::numeric>9223372036854775807) then raise exception 'invalid_selection' using errcode='22023'; end if;
  select coalesce(array_agg(distinct x),'{}'::text[]) into ids from unnest(p_catalog_match_ids) x;
  id_count:=cardinality(ids);
  if p_projection='history' and id_count>20 then raise exception 'projection_too_large' using errcode='22023'; end if;
  select coalesce(jsonb_agg(private.saved_match_projection(m.id,p_projection) order by m.id),'[]'::jsonb) into saved from private.provider_matches m where m.id=any(ids::bigint[]);
  select coalesce(jsonb_agg(x order by x),'[]'::jsonb) into missing from unnest(ids) x where not exists(select 1 from private.provider_matches m where m.id=x::bigint);
  result:=jsonb_build_object('matches',saved,'missingCatalogMatchIds',missing,'availability',case when id_count=0 or jsonb_array_length(missing)=0 then 'available' when jsonb_array_length(saved)=0 then 'unavailable' else 'partial' end,'retryAfterSeconds',null);
  if octet_length(result::text)>262144 then raise exception 'projection_too_large' using errcode='22023'; end if;
  return result;
end;
$$;
create function public.read_saved_matches(catalog_match_ids text[],projection text default 'live')
returns jsonb language sql stable security invoker set search_path='' as $$
select private.read_saved_matches(catalog_match_ids,projection);
$$;

do $$ declare relation text; begin
  foreach relation in array array['provider_match_goals','provider_goal_participants','provider_match_team_stats','solo_tracking_grants','solo_tracked_matches','provider_admission_counters'] loop
    execute format('alter table private.%I enable row level security',relation);
    execute format('revoke all on table private.%I from public,anon,authenticated,service_role',relation);
  end loop;
end $$;
revoke all on function private.provider_stats_projection(bigint,text),private.saved_match_projection(bigint,text),private.read_saved_matches(text[],text),public.read_saved_matches(text[],text) from public,anon,authenticated,service_role;
grant execute on function private.read_saved_matches(text[],text),public.read_saved_matches(text[],text) to anon,authenticated;
grant execute on function private.read_saved_matches(text[],text) to match_catalog_backend;

-- One score-consequence implementation, entered through separately checked authorities.
create function private.apply_provider_score_consequences(
  p_session_id uuid,p_room_match_id uuid,p_home_score integer,p_away_score integer,p_observed_at timestamptz,
  p_event_key text,p_fingerprint text,p_actor_participant_id uuid,p_catalog_match_id bigint,p_observation_version bigint
) returns jsonb language plpgsql set search_path='' as $$
declare room public.game_sessions%rowtype; room_match public.matches%rowtype; changed boolean; sequence bigint; event_id uuid;
begin
  select * into room from public.game_sessions where id=p_session_id for update;
  if not found or room.state<>'in_progress'::public.session_state then raise exception 'invalid_room_state'; end if;
  select * into room_match from public.matches where session_id=p_session_id and id=p_room_match_id for update;
  if not found then raise exception 'match_not_in_room'; end if;
  if p_home_score is null or p_away_score is null or p_home_score<0 or p_away_score<0 then raise exception 'invalid_provider_score'; end if;
  changed:=room_match.home_score<>p_home_score or room_match.away_score<>p_away_score;
  update public.matches set home_score=p_home_score,away_score=p_away_score where id=p_room_match_id;
  if changed then
    sequence:=public.allocate_event_sequence(p_session_id);
    insert into public.gameplay_events(session_id,sequence_number,actor_participant_id,event_type,idempotency_key,payload,created_at,actor_kind,room_match_id,catalog_match_id,provider_observation_version)
    values(p_session_id,sequence,p_actor_participant_id,'provider_score_changed',p_event_key,
      jsonb_build_object('sessionId',p_session_id::text,'matchId',p_room_match_id::text,'provider',room_match.source_provider,'sourceMatchId',room_match.source_match_id,
        'previousHomeScore',room_match.home_score,'previousAwayScore',room_match.away_score,'resultingHomeScore',p_home_score,'resultingAwayScore',p_away_score,
        'origin','provider','observedAt',p_observed_at,'requestFingerprint',p_fingerprint,'sequenceNumber',sequence,'replayed',false),now(),
      case when p_observation_version is null then 'participant' else 'provider' end,
      case when p_observation_version is null then null else p_room_match_id end,p_catalog_match_id,p_observation_version) returning id into event_id;
  else sequence:=room.last_event_sequence;
  end if;
  return jsonb_build_object('sessionId',p_session_id::text,'matchId',p_room_match_id::text,'provider',room_match.source_provider,'sourceMatchId',room_match.source_match_id,
    'homeScore',p_home_score,'awayScore',p_away_score,'origin','provider','changed',changed,'eventId',event_id::text,'sequenceNumber',sequence,'replayed',false,'requestFingerprint',p_fingerprint);
end;
$$;

create or replace function private.accept_provider_score_for_actor(
  p_session_id uuid,p_actor_participant_id uuid,p_match_id uuid,p_provider text,p_source_match_id text,
  p_home_score integer,p_away_score integer,p_observed_at timestamptz,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare room public.game_sessions%rowtype; room_match public.matches%rowtype; fingerprint text; replay jsonb; response jsonb;
begin
  if p_session_id is null or p_actor_participant_id is null or p_match_id is null or p_idempotency_key is null
    or nullif(btrim(coalesce(p_provider,'')),'') is null or nullif(btrim(coalesce(p_source_match_id,'')),'') is null
    or p_home_score is null or p_away_score is null or p_home_score<0 or p_away_score<0 then raise exception 'invalid_provider_score'; end if;
  select * into room from public.game_sessions where id=p_session_id for update;
  if not found then raise exception 'room_not_found'; end if;
  if not exists(select 1 from public.participants where session_id=p_session_id and id=p_actor_participant_id and membership_type='registered'::public.participant_membership_type and left_at is null) then raise exception 'not_room_participant'; end if;
  fingerprint:=encode(extensions.digest(concat('provider:',p_match_id::text,':',p_provider,':',p_source_match_id,':',p_home_score::text,':',p_away_score::text),'sha256'),'hex');
  replay:=private.command_result_or_conflict(p_session_id,p_idempotency_key,'provider_score',p_actor_participant_id,fingerprint);
  if replay is not null then return replay; end if;
  if room.state<>'in_progress'::public.session_state then raise exception 'invalid_room_state'; end if;
  select * into room_match from public.matches where session_id=p_session_id and id=p_match_id for update;
  if not found then raise exception 'match_not_in_room'; end if;
  if lower(room_match.source_provider)='manual' or room_match.source_provider<>p_provider or room_match.source_match_id is distinct from p_source_match_id then raise exception 'provider_match_mismatch'; end if;
  response:=private.apply_provider_score_consequences(p_session_id,p_match_id,p_home_score,p_away_score,p_observed_at,p_idempotency_key::text,fingerprint,p_actor_participant_id,null,null);
  insert into public.gameplay_command_results(session_id,idempotency_key,command_type,actor_participant_id,request_fingerprint,response)
  values(p_session_id,p_idempotency_key,'provider_score',p_actor_participant_id,fingerprint,response);
  return response;
end;
$$;

create function private.apply_saved_provider_observation(p_room_match_id uuid,p_observation_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare room_id uuid; room public.game_sessions%rowtype; room_match public.matches%rowtype; source_match private.provider_matches%rowtype;
  observation private.provider_match_observations%rowtype; league private.provider_leagues%rowtype; response jsonb; fingerprint text;
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
  -- Unknown scores still advance the observation cursor; they must never fabricate a 0-0 pair.
  if observation.home_score is null or observation.away_score is null then
    update public.matches set tracking_started_observation_version=coalesce(tracking_started_observation_version,p_observation_version),last_applied_observation_version=p_observation_version,last_provider_applied_at=clock_timestamp() where id=p_room_match_id;
    return jsonb_build_object('ok',true,'changed',false,'observationVersion',p_observation_version::text);
  end if;
  fingerprint:=encode(extensions.digest(concat('catalog:',p_room_match_id::text,':',p_observation_version::text),'sha256'),'hex');
  response:=private.apply_provider_score_consequences(room_id,p_room_match_id,observation.home_score,observation.away_score,observation.accepted_at,
    concat('catalog:',p_room_match_id::text,':',p_observation_version::text),fingerprint,null,source_match.id,p_observation_version);
  update public.matches set tracking_started_observation_version=coalesce(tracking_started_observation_version,p_observation_version),last_applied_observation_version=p_observation_version,last_provider_applied_at=clock_timestamp() where id=p_room_match_id;
  return response||jsonb_build_object('ok',true,'isReplay',false,'observationVersion',p_observation_version::text);
end;
$$;
revoke all on function private.apply_provider_score_consequences(uuid,uuid,integer,integer,timestamptz,text,text,uuid,bigint,bigint),private.apply_saved_provider_observation(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function private.apply_saved_provider_observation(uuid,bigint) to match_catalog_backend;

create function private.solo_catalog_ids(p_ids text[]) returns bigint[] language plpgsql immutable set search_path='' as $$
declare ids bigint[];
begin
  if p_ids is null or cardinality(p_ids)>20 or exists(select 1 from unnest(p_ids) x where x is null or x !~ '^[1-9][0-9]{0,18}$') then return null; end if;
  if exists(select 1 from unnest(p_ids) x where x::numeric>9223372036854775807) then return null; end if;
  select coalesce(array_agg(distinct x::bigint order by x::bigint),'{}'::bigint[]) into ids from unnest(p_ids) x;
  return ids;
end;
$$;
create function private.solo_selection_horizon(p_ids bigint[],p_now timestamptz) returns timestamptz language sql stable set search_path='' as $$
  select case when count(*)=cardinality(p_ids) and count(*)>0 then max(coalesce(kickoff_at+interval '24 hours',p_now+interval '24 hours')) else null end
  from private.provider_matches where id=any(p_ids) and lifecycle not in ('finished','canceled','abandoned')
    and ((kickoff_at is not null and kickoff_validity='confirmed' and kickoff_at<=p_now+interval '7 days') or lifecycle='live');
$$;
create function private.take_provider_admission(p_kind text,p_scope text,p_limit integer,p_now timestamptz)
returns boolean language plpgsql set search_path='' as $$
declare used integer;
begin
  -- Callers hold the shared provider admission lock. Whole minute buckets are conservative at the hour boundary.
  select coalesce(sum(admitted_count),0) into used from private.provider_admission_counters where counter_kind=p_kind and scope_key=p_scope and window_start>=date_trunc('minute',p_now-interval '1 hour');
  if used>=p_limit then return false; end if;
  insert into private.provider_admission_counters(counter_kind,scope_key,window_start,admitted_count) values(p_kind,p_scope,date_trunc('minute',p_now),1)
  on conflict(counter_kind,scope_key,window_start) do update set admitted_count=private.provider_admission_counters.admitted_count+1;
  return true;
end;
$$;
create function private.solo_grant_projection(p_id uuid,p_is_replay boolean) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('ok',true,'issuanceId',g.id,'signingKeyId',g.signing_key_id,'selectionVersion',g.selection_version,'isReplay',p_is_replay,
    'catalogMatchIds',coalesce((select jsonb_agg(match_id::text order by match_id) from private.solo_tracked_matches where grant_id=g.id),'[]'::jsonb),
    'expiresAt',g.expires_at,'state',case when g.ended_at is null then 'active' else 'ended' end)
  from private.solo_tracking_grants g where g.id=p_id;
$$;

create function private.prepare_solo_tracking(p_nonce_digest text,p_creation_digest text,p_operation_id uuid,p_key_id text,p_catalog_match_ids text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy private.provider_budget_state%rowtype; grant_row private.solo_tracking_grants%rowtype;
  ids bigint[]; horizon timestamptz; t timestamptz:=clock_timestamp();
begin
  if p_nonce_digest is null or p_nonce_digest !~ '^[0-9a-f]{64}$' or p_creation_digest is null or p_creation_digest !~ '^[0-9a-f]{64}$' or p_operation_id is null then return jsonb_build_object('ok',false,'code','invalid_selection'); end if;
  if p_key_id is null or length(p_key_id) not between 1 and 64 then return jsonb_build_object('ok',false,'code','configuration_required'); end if;
  select * into policy from private.provider_budget_state where provider='espn' for update;
  select * into grant_row from private.solo_tracking_grants where nonce_digest=decode(p_nonce_digest,'hex') for update;
  t:=clock_timestamp();
  if found then
    if grant_row.expires_at<=t then return jsonb_build_object('ok',false,'code','tracking_expired'); end if;
    if grant_row.creation_request_digest<>decode(p_creation_digest,'hex') or grant_row.creation_operation_id<>p_operation_id then return jsonb_build_object('ok',false,'code','operation_conflict'); end if;
    return private.solo_grant_projection(grant_row.id,true);
  end if;
  ids:=private.solo_catalog_ids(p_catalog_match_ids);
  if ids is null or cardinality(ids)=0 then return jsonb_build_object('ok',false,'code','invalid_selection'); end if;
  horizon:=private.solo_selection_horizon(ids,t);
  if horizon is null or horizon<=t then return jsonb_build_object('ok',false,'code','invalid_selection'); end if;
  if policy.ownership_mode<>'catalog' then return jsonb_build_object('ok',false,'code','acquisition_paused'); end if;
  if policy.rolling_limit is null or policy.daily_limit is null then return jsonb_build_object('ok',false,'code','configuration_required'); end if;
  if not policy.new_demand_allowed or (select count(*) from private.solo_tracking_grants where ended_at is null and expires_at>t)>=200 then return jsonb_build_object('ok',false,'code','capacity_limited'); end if;
  if not private.take_provider_admission('solo_creation','global',100,t) then return jsonb_build_object('ok',false,'code','admission_limited','retryAfterSeconds',60); end if;
  insert into private.solo_tracking_grants(nonce_digest,signing_key_id,creation_operation_id,creation_request_digest,created_at,expires_at)
  values(decode(p_nonce_digest,'hex'),p_key_id,p_operation_id,decode(p_creation_digest,'hex'),t,horizon) returning * into grant_row;
  insert into private.solo_tracked_matches(grant_id,match_id,admitted_until) select grant_row.id,id,horizon from unnest(ids) id;
  update private.provider_matches set last_used_at=t where id=any(ids);
  return private.solo_grant_projection(grant_row.id,false);
end;
$$;

create function private.finalize_solo_tracking(p_issuance_id uuid,p_nonce_digest text,p_token_digest text,p_is_replay boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare grant_row private.solo_tracking_grants%rowtype;
begin
  if p_nonce_digest is null or p_nonce_digest !~ '^[0-9a-f]{64}$' or p_token_digest is null or p_token_digest !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'code','invalid_tracking_grant'); end if;
  select * into grant_row from private.solo_tracking_grants where id=p_issuance_id and nonce_digest=decode(p_nonce_digest,'hex') for update;
  if not found then return jsonb_build_object('ok',false,'code','invalid_tracking_grant'); end if;
  if grant_row.expires_at<=clock_timestamp() then return jsonb_build_object('ok',false,'code','tracking_expired'); end if;
  if grant_row.grant_digest is not null and grant_row.grant_digest<>decode(p_token_digest,'hex') then return jsonb_build_object('ok',false,'code','operation_conflict'); end if;
  update private.solo_tracking_grants set grant_digest=decode(p_token_digest,'hex') where id=grant_row.id and grant_digest is null;
  return private.solo_grant_projection(grant_row.id,coalesce(p_is_replay,false));
end;
$$;

create function private.replace_solo_tracking(p_token_digest text,p_expected_version integer,p_operation_id uuid,p_request_digest text,p_catalog_match_ids text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy private.provider_budget_state%rowtype; grant_row private.solo_tracking_grants%rowtype; ids bigint[]; horizon timestamptz; t timestamptz:=clock_timestamp(); has_new_match boolean;
begin
  if p_token_digest is null or p_token_digest !~ '^[0-9a-f]{64}$' or p_request_digest is null or p_request_digest !~ '^[0-9a-f]{64}$' or p_operation_id is null or p_expected_version is null then return jsonb_build_object('ok',false,'code','invalid_tracking_grant'); end if;
  select * into policy from private.provider_budget_state where provider='espn' for update;
  select * into grant_row from private.solo_tracking_grants where grant_digest=decode(p_token_digest,'hex') for update;
  t:=clock_timestamp();
  if not found then return jsonb_build_object('ok',false,'code','invalid_tracking_grant'); end if;
  if grant_row.expires_at<=t then return jsonb_build_object('ok',false,'code','tracking_expired'); end if;
  if grant_row.latest_operation_id=p_operation_id then
    if grant_row.latest_request_digest<>decode(p_request_digest,'hex') then return jsonb_build_object('ok',false,'code','operation_conflict'); end if;
    return private.solo_grant_projection(grant_row.id,true);
  end if;
  if grant_row.selection_version<>p_expected_version or grant_row.ended_at is not null then return jsonb_build_object('ok',false,'code','tracking_conflict'); end if;
  ids:=private.solo_catalog_ids(p_catalog_match_ids);
  if ids is null then return jsonb_build_object('ok',false,'code','invalid_selection'); end if;
  horizon:=grant_row.expires_at;
  if cardinality(ids)>0 then
    horizon:=private.solo_selection_horizon(ids,t);
    if horizon is null or horizon<=t then return jsonb_build_object('ok',false,'code','invalid_selection'); end if;
    select exists(select 1 from unnest(ids) id where not exists(select 1 from private.solo_tracked_matches where grant_id=grant_row.id and match_id=id)) into has_new_match;
    if has_new_match and policy.ownership_mode<>'catalog' then return jsonb_build_object('ok',false,'code','acquisition_paused'); end if;
    if (has_new_match or horizon>grant_row.expires_at) and not policy.new_demand_allowed then return jsonb_build_object('ok',false,'code','capacity_limited'); end if;
  end if;
  if not private.take_provider_admission('solo_replacement',grant_row.id::text,30,t) then return jsonb_build_object('ok',false,'code','admission_limited','retryAfterSeconds',60); end if;
  delete from private.solo_tracked_matches where grant_id=grant_row.id;
  insert into private.solo_tracked_matches(grant_id,match_id,admitted_until) select grant_row.id,id,horizon from unnest(ids) id;
  update private.solo_tracking_grants set selection_version=selection_version+1,expires_at=horizon,ended_at=case when cardinality(ids)=0 then t else null end,
    latest_operation_id=p_operation_id,latest_request_digest=decode(p_request_digest,'hex') where id=grant_row.id;
  update private.provider_matches set last_used_at=t where id=any(ids);
  return private.solo_grant_projection(grant_row.id,false);
end;
$$;
revoke all on function private.solo_catalog_ids(text[]),private.solo_selection_horizon(bigint[],timestamptz),private.take_provider_admission(text,text,integer,timestamptz),private.solo_grant_projection(uuid,boolean),
  private.prepare_solo_tracking(text,text,uuid,text,text[]),private.finalize_solo_tracking(uuid,text,text,boolean),private.replace_solo_tracking(text,integer,uuid,text,text[]) from public,anon,authenticated,service_role;
grant execute on function private.prepare_solo_tracking(text,text,uuid,text,text[]),private.finalize_solo_tracking(uuid,text,text,boolean),private.replace_solo_tracking(text,integer,uuid,text,text[]) to match_catalog_backend;

alter table private.provider_worker_slots add column last_acquisition_token uuid;
create function private.claim_provider_batch(p_group_ids bigint[],p_purpose text,p_worker_token uuid,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy private.provider_budget_state%rowtype; slot private.provider_worker_slots%rowtype; group_id bigint; claim jsonb; claims jsonb:='[]'::jsonb; used integer; t timestamptz:=clock_timestamp(); actual_purpose text;
begin
  if p_group_ids is null or cardinality(p_group_ids)>16 or p_purpose is null or p_purpose not in ('live','discovery','completion') then return jsonb_build_object('ok',false,'code','invalid_work_batch','claims',claims); end if;
  select * into policy from private.provider_budget_state where provider='espn' for update;
  t:=clock_timestamp();
  select * into slot from private.provider_worker_slots where lease_token=p_worker_token and worker_generation=p_generation and lease_until>t and started_at is not null for update;
  if not found then return jsonb_build_object('ok',false,'code','invalid_dispatch','claims',claims); end if;
  if slot.last_acquisition_token=p_worker_token then return jsonb_build_object('ok',true,'claims',claims); end if;
  update private.provider_worker_slots set last_acquisition_token=p_worker_token where id=slot.id;
  select count(*) into used from private.provider_request_attempts where worker_slot_id=slot.id and worker_generation=p_generation and reserved_at>=slot.started_at;
  if used>=4 then return jsonb_build_object('ok',true,'claims',claims); end if;
  for group_id in select g.id from private.provider_request_groups g where g.id=any(p_group_ids)
    order by case when g.live_due_at<=t then 0 else 1 end,g.next_attempt_at,g.id loop
    select case when live_due_at<=t then 'live' when discovery_until>t then 'discovery' when completion_due_at<=t then 'completion' else p_purpose end
      into actual_purpose from private.provider_request_groups where id=group_id;
    claim:=private.claim_provider_request(group_id,actual_purpose,p_worker_token,p_generation);
    if claim->>'ok'='true' then claims:=claims||jsonb_build_array(claim); used:=used+1; end if;
    exit when used>=4;
  end loop;
  return jsonb_build_object('ok',true,'claims',claims);
end;
$$;
revoke all on function private.claim_provider_batch(bigint[],text,uuid,bigint) from public,anon,authenticated,service_role;
revoke all on function private.claim_provider_request(bigint,text,uuid,bigint) from match_catalog_backend;
grant execute on function private.claim_provider_batch(bigint[],text,uuid,bigint) to match_catalog_backend;

create view private.active_catalog_room_matches with(security_invoker=true) as
select m.id as room_match_id,m.session_id,m.catalog_match_id
from public.matches m join public.game_sessions room on room.id=m.session_id
join private.provider_matches source on source.id=m.catalog_match_id join private.provider_leagues league on league.id=source.league_id
where room.state='in_progress'::public.session_state and m.source_provider=league.provider and m.source_match_id=source.source_event_id and m.source_league_code=league.league_code
  and (room.common_match_id=m.id or exists(select 1 from public.assignments assignment join public.participants participant on participant.session_id=assignment.session_id and participant.id=assignment.participant_id
    where assignment.session_id=m.session_id and assignment.match_id=m.id and participant.left_at is null));
create view private.catalog_demand_matches with(security_invoker=true) as
select catalog_match_id from private.active_catalog_room_matches
union
select selected.match_id from private.solo_tracked_matches selected join private.solo_tracking_grants grant_row on grant_row.id=selected.grant_id
where grant_row.grant_digest is not null and grant_row.ended_at is null and grant_row.expires_at>statement_timestamp() and selected.admitted_until>statement_timestamp();
revoke all on private.active_catalog_room_matches,private.catalog_demand_matches from public,anon,authenticated,service_role;

create function private.catalog_match_due_at(p_match private.provider_matches,p_now timestamptz)
returns timestamptz language plpgsql stable set search_path='' as $$
declare condition_start timestamptz; cadence interval;
begin
  if p_match.lifecycle in ('finished','canceled','abandoned') then return null; end if;
  if p_match.lifecycle='live' and coalesce(p_match.availability_reason,'') not in ('match_not_found','provider_status_unknown') then return coalesce(p_match.last_attempt_at+interval '60 seconds',p_now); end if;
  if p_match.kickoff_validity='confirmed' and p_match.kickoff_at>p_now then return p_match.kickoff_at; end if;
  condition_start:=coalesce(p_match.condition_started_at,case when p_match.kickoff_validity='confirmed' then p_match.kickoff_at else null end);
  if condition_start is null or condition_start>p_now then return null; end if;
  cadence:=case when p_now-condition_start<interval '30 minutes' then interval '5 minutes'
    when p_now-condition_start<interval '2 hours' then interval '15 minutes'
    when p_now-condition_start<interval '24 hours' then interval '1 hour' else interval '6 hours' end;
  return greatest(condition_start,coalesce(p_match.last_attempt_at+cadence,p_now));
end;
$$;
create function private.refresh_catalog_group_due(p_group_ids bigint[])
returns void language plpgsql set search_path='' as $$
declare t timestamptz:=clock_timestamp();
begin
  with due as (
    select source.scoreboard_group_id as group_id,min(private.catalog_match_due_at(source,t)) as next_due
    from private.provider_matches source join private.catalog_demand_matches demand on demand.catalog_match_id=source.id
    where source.scoreboard_group_id=any(p_group_ids) group by source.scoreboard_group_id
  )
  update private.provider_request_groups g set live_due_at=due.next_due,
    next_attempt_at=greatest(coalesce(due.next_due,g.last_successful_check_at+interval '5 minutes',g.last_attempt_at+interval '5 minutes',t),g.cooldown_until)
  from (select requested.id,d.next_due from unnest(p_group_ids) requested(id) left join due d on d.group_id=requested.id) due where g.id=due.id;
end;
$$;

create function private.read_match_discovery(p_league_codes text[],p_request_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare policy private.provider_budget_state%rowtype; groups jsonb; matches jsonb; states text[]; overall text; t timestamptz:=statement_timestamp(); recent_attempts integer;
begin
  select * into policy from private.provider_budget_state where provider='espn';
  select count(*) into recent_attempts from private.provider_request_attempts where reserved_at>t-interval '60 seconds';
  with scopes as (
    select league.league_code,g.*,
      exists(select 1 from private.provider_matches source join private.catalog_demand_matches demand on demand.catalog_match_id=source.id where source.scoreboard_group_id=g.id) as has_demand,
      exists(select 1 from private.provider_matches source join private.catalog_demand_matches demand on demand.catalog_match_id=source.id where source.scoreboard_group_id=g.id and
        (source.lifecycle='live' or source.kickoff_validity='confirmed' and source.kickoff_at<=t) and source.lifecycle not in ('finished','canceled','abandoned')) as live_scope
    from private.provider_leagues league left join private.provider_request_groups g on g.league_id=league.id and g.resource_kind='scoreboard' and g.request_date=p_request_date
    where league.provider='espn' and league.league_code=any(p_league_codes)
  ), flags as (
    select scopes.*,last_successful_check_at is not null and last_successful_check_at>=t-case when live_scope then interval '60 seconds' else interval '5 minutes' end
      and (not live_scope or live_due_at>t) as fresh,
      case when policy.ownership_mode is distinct from 'catalog' then 'acquisition_paused'
        when policy.rolling_limit is null or policy.daily_limit is null then 'configuration_required'
        when paused then 'provider_access_rejected'
        when cooldown_until>t or policy.cooldown_until>t then 'provider_cooldown'
        when recent_attempts>=policy.rolling_limit or policy.usage_day=(t at time zone 'UTC')::date and policy.daily_count>=policy.daily_limit then 'budget_exhausted'
        when not policy.new_demand_allowed and not has_demand then 'capacity_limited' else null end as blocked_reason
    from scopes
  ), outcomes as (
    select *,case when fresh and last_error is null then 'available' when fresh then 'partial' when blocked_reason is not null then 'deferred' else 'pending' end as state from flags
  )
  select coalesce(jsonb_agg(jsonb_build_object('leagueCode',league_code,'date',p_request_date,'availability',state,'lastSuccessfulCheckAt',last_successful_check_at,
    'isStale',not coalesce(fresh,false),'reason',case when state='available' then null else coalesce(blocked_reason,last_error,'acquisition_pending') end,
    'retryAfterSeconds',case when state in ('pending','deferred') then 15 else null end) order by league_code),'[]'::jsonb),coalesce(array_agg(state),'{}'::text[])
  into groups,states from outcomes;
  select coalesce(jsonb_agg(private.saved_match_projection(source.id,'live') order by source.kickoff_at,source.id),'[]'::jsonb) into matches
  from private.provider_matches source join private.provider_request_groups g on g.id=source.scoreboard_group_id join private.provider_leagues league on league.id=g.league_id
  where g.resource_kind='scoreboard' and g.request_date=p_request_date and league.provider='espn' and league.league_code=any(p_league_codes);
  overall:=case when cardinality(states)=0 or states<@array['available']::text[] then 'available'
    when states&&array['available','partial']::text[] then 'partial' when 'pending'=any(states) then 'pending' when 'deferred'=any(states) then 'deferred' else 'unavailable' end;
  return jsonb_build_object('matches',matches,'groups',groups,'availability',overall,'retryAfterSeconds',case when states&&array['pending','deferred']::text[] then 15 else null end);
end;
$$;

create function private.prepare_match_discovery(p_league_codes text[],p_request_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy private.provider_budget_state%rowtype; codes text[]; ids bigint[]; work_ids jsonb; t timestamptz:=clock_timestamp(); can_admit_source boolean; recent_attempts integer;
begin
  if p_league_codes is null or cardinality(p_league_codes)>128 or p_request_date is null or exists(select 1 from unnest(p_league_codes) x where x is null) then return jsonb_build_object('ok',false,'code','invalid_selection'); end if;
  if p_request_date not between (t at time zone 'UTC')::date-7 and (t at time zone 'UTC')::date+7 then return jsonb_build_object('ok',false,'code','date_out_of_range'); end if;
  select coalesce(array_agg(distinct btrim(x) order by btrim(x)),'{}'::text[]) into codes from unnest(p_league_codes) x where btrim(x)<>'';
  if cardinality(codes)>16 then return jsonb_build_object('ok',false,'code','invalid_selection'); end if;
  if exists(select 1 from unnest(codes) x where not exists(select 1 from private.provider_leagues where provider='espn' and league_code=x)) then return jsonb_build_object('ok',false,'code','unsupported_league'); end if;
  select * into policy from private.provider_budget_state where provider='espn' for update;
  t:=clock_timestamp();
  select count(*) into recent_attempts from private.provider_request_attempts where reserved_at>t-interval '60 seconds';
  can_admit_source:=policy.ownership_mode='catalog' and policy.rolling_limit is not null and policy.daily_limit is not null
    and policy.pause_reason is null and (policy.cooldown_until is null or policy.cooldown_until<=t) and recent_attempts<policy.rolling_limit
    and (policy.usage_day<>(t at time zone 'UTC')::date or policy.daily_count<policy.daily_limit);
  if can_admit_source and policy.new_demand_allowed then
    insert into private.provider_request_groups(provider,league_id,resource_kind,request_date,next_attempt_at)
    select 'espn',id,'scoreboard',p_request_date,t from private.provider_leagues where provider='espn' and league_code=any(codes) on conflict(provider,scope_key) do nothing;
  end if;
  select coalesce(array_agg(g.id),'{}'::bigint[]) into ids from private.provider_request_groups g join private.provider_leagues league on league.id=g.league_id
  where league.provider='espn' and league.league_code=any(codes) and g.resource_kind='scoreboard' and g.request_date=p_request_date;
  perform private.refresh_catalog_group_due(ids);
  if can_admit_source and policy.new_demand_allowed then
    update private.provider_request_groups set discovery_until=case when discovery_until>t then discovery_until else t+interval '2 minutes' end,last_used_at=t
    where id=any(ids) and (last_successful_check_at is null or last_successful_check_at<t-interval '5 minutes') and not paused and (cooldown_until is null or cooldown_until<=t);
  end if;
  update private.provider_matches set last_used_at=t where scoreboard_group_id=any(ids);
  t:=clock_timestamp();
  select coalesce(jsonb_agg(id::text order by id),'[]'::jsonb) into work_ids from private.provider_request_groups
    where can_admit_source and id=any(ids) and not paused and (lease_until is null or lease_until<=t) and (cooldown_until is null or cooldown_until<=t) and next_attempt_at<=t
    and (live_due_at<=t or discovery_until>t and (last_successful_check_at is null or last_successful_check_at<t-interval '5 minutes'));
  return jsonb_build_object('ok',true,'workerGeneration',policy.worker_generation,'workGroupIds',work_ids,'selection',jsonb_build_object('leagueCodes',codes,'date',p_request_date),'result',private.read_match_discovery(codes,p_request_date));
end;
$$;
revoke all on function private.catalog_match_due_at(private.provider_matches,timestamptz),private.refresh_catalog_group_due(bigint[]),private.read_match_discovery(text[],date),private.prepare_match_discovery(text[],date) from public,anon,authenticated,service_role;
grant execute on function private.read_match_discovery(text[],date),private.prepare_match_discovery(text[],date) to match_catalog_backend;

-- Detail is projected once per accepted resource, never fetched by a saved reader.
create function private.accept_provider_match_details(p_match_id bigint,p_sequence bigint,p_item jsonb,p_time timestamptz)
returns void language plpgsql set search_path='' as $$
declare m private.provider_matches%rowtype; item jsonb; stats jsonb; match_side text; ordinal integer:=0; key text; saved_goal_id bigint; saved_athlete_id bigint;
begin
  select * into m from private.provider_matches where id=p_match_id for update;
  if not found or m.last_projection_sequence<>p_sequence then return; end if;
  if jsonb_typeof(p_item->'goals')='array' then
    for item in select value from jsonb_array_elements(p_item->'goals') loop
      key:=case when item->>'sourcePlayId' is not null then 'source:'||(item->>'sourcePlayId') else
        'derived:'||encode(extensions.digest(concat_ws(':',item->>'side',item->>'sourceTeamId',item->>'sourceAthleteId',item->>'clock',item->>'period',item->>'kind'),'sha256'),'hex') end;
      insert into private.provider_match_goals(match_id,goal_key,source_play_id,side,source_team_id,source_athlete_id,athlete_name,clock,period,occurred_at,kind,is_retracted,display_order,changed_at)
      values(m.id,key,item->>'sourcePlayId',item->>'side',item->>'sourceTeamId',item->>'sourceAthleteId',item->>'athleteName',item->>'clock',(item->>'period')::smallint,(item->>'occurredAt')::timestamptz,coalesce(item->>'kind','unknown'),coalesce((item->>'isRetracted')::boolean,false),ordinal,p_time)
      on conflict(match_id,goal_key) do update set side=coalesce(excluded.side,private.provider_match_goals.side),source_team_id=coalesce(excluded.source_team_id,private.provider_match_goals.source_team_id),
        source_athlete_id=coalesce(excluded.source_athlete_id,private.provider_match_goals.source_athlete_id),athlete_name=coalesce(excluded.athlete_name,private.provider_match_goals.athlete_name),
        clock=coalesce(excluded.clock,private.provider_match_goals.clock),period=coalesce(excluded.period,private.provider_match_goals.period),occurred_at=coalesce(excluded.occurred_at,private.provider_match_goals.occurred_at),
        kind=case when excluded.kind='unknown' then private.provider_match_goals.kind else excluded.kind end,is_retracted=excluded.is_retracted,display_order=excluded.display_order,changed_at=p_time
      returning id into saved_goal_id;
      if item->>'sourceAthleteId' is not null and item->>'athleteName' is not null then
        insert into private.provider_athletes(provider,source_athlete_id,display_name) values('espn',item->>'sourceAthleteId',item->>'athleteName')
        on conflict(provider,source_athlete_id) do update set display_name=excluded.display_name returning id into saved_athlete_id;
        delete from private.provider_goal_participants where goal_id=saved_goal_id and role='unknown' and athlete_id<>saved_athlete_id;
        insert into private.provider_goal_participants(goal_id,athlete_id,role) values(saved_goal_id,saved_athlete_id,'unknown') on conflict do nothing;
      end if;
      ordinal:=ordinal+1;
    end loop;
    update private.provider_matches set goals_availability=coalesce(p_item->>'goalsAvailability','partial'),has_more_goals=coalesce((p_item->>'hasMoreGoals')::boolean,false) where id=m.id;
  end if;
  foreach match_side in array array['home','away'] loop
    stats:=p_item->(match_side||'TeamStatistics');
    if jsonb_typeof(stats)='object' and jsonb_strip_nulls(stats)<>'{}'::jsonb then
      insert into private.provider_match_team_stats(match_id,side,shot_attempts,shots_on_goal,fouls,yellow_cards,red_cards,corner_kicks,possession,is_final,observed_at,projection_sequence)
      values(m.id,match_side,(stats->>'shotAttempts')::integer,(stats->>'shotsOnGoal')::integer,(stats->>'fouls')::integer,(stats->>'yellowCards')::integer,(stats->>'redCards')::integer,(stats->>'cornerKicks')::integer,(stats->>'possession')::numeric,m.lifecycle='finished' and m.is_completed is true,p_time,p_sequence)
      on conflict(match_id,side) do update set shot_attempts=coalesce(excluded.shot_attempts,private.provider_match_team_stats.shot_attempts),shots_on_goal=coalesce(excluded.shots_on_goal,private.provider_match_team_stats.shots_on_goal),
        fouls=coalesce(excluded.fouls,private.provider_match_team_stats.fouls),yellow_cards=coalesce(excluded.yellow_cards,private.provider_match_team_stats.yellow_cards),red_cards=coalesce(excluded.red_cards,private.provider_match_team_stats.red_cards),
        corner_kicks=coalesce(excluded.corner_kicks,private.provider_match_team_stats.corner_kicks),possession=coalesce(excluded.possession,private.provider_match_team_stats.possession),is_final=excluded.is_final,observed_at=p_time,projection_sequence=p_sequence
      where private.provider_match_team_stats.projection_sequence<=p_sequence;
    end if;
  end loop;
end;
$$;
revoke all on function private.accept_provider_match_details(bigint,bigint,jsonb,timestamptz) from public,anon,authenticated,service_role;

create function private.pending_catalog_rooms(p_group_ids bigint[] default null)
returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(session_id::text order by oldest,session_id),'[]'::jsonb) from (
  select active.session_id,min(coalesce(room_match.last_provider_applied_at,'epoch'::timestamptz)) as oldest
  from private.active_catalog_room_matches active join public.matches room_match on room_match.id=active.room_match_id
  join private.provider_matches source on source.id=active.catalog_match_id
  where source.observation_version>coalesce(room_match.last_applied_observation_version,0) and (p_group_ids is null or source.scoreboard_group_id=any(p_group_ids))
  group by active.session_id order by oldest,active.session_id limit 100
) pending;
$$;

create function private.process_catalog_room(p_room_id uuid,p_worker_token uuid,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare room_id uuid; candidate record; response jsonb; processed integer:=0; deadline timestamptz;
begin
  select least(lease_until,started_at+interval '35 seconds') into deadline from private.provider_worker_slots where lease_token=p_worker_token and worker_generation=p_generation
    and worker_generation=(select worker_generation from private.provider_budget_state where provider='espn') and lease_until>clock_timestamp();
  if not found then return jsonb_build_object('ok',false,'code','invalid_dispatch'); end if;
  select id into room_id from public.game_sessions where id=p_room_id and state='in_progress'::public.session_state for update skip locked;
  if not found then return jsonb_build_object('ok',false,'code','room_busy'); end if;
  while processed<20 and clock_timestamp()<deadline-interval '5 seconds' loop
    select active.room_match_id,case when room_match.tracking_started_observation_version is null then source.observation_version else room_match.last_applied_observation_version+1 end as version
    into candidate from private.active_catalog_room_matches active join public.matches room_match on room_match.id=active.room_match_id
      join private.provider_matches source on source.id=active.catalog_match_id
    where active.session_id=p_room_id and source.observation_version>coalesce(room_match.last_applied_observation_version,0)
    order by room_match.last_provider_applied_at nulls first,active.room_match_id limit 1;
    exit when not found;
    response:=private.apply_saved_provider_observation(candidate.room_match_id,candidate.version);
    exit when response->>'ok' is distinct from 'true';
    processed:=processed+1;
  end loop;
  if clock_timestamp()>=deadline then raise exception 'Provider dispatch expired' using errcode='57014'; end if;
  return jsonb_build_object('ok',true,'processedObservations',processed);
end;
$$;
revoke all on function private.pending_catalog_rooms(bigint[]),private.process_catalog_room(uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function private.pending_catalog_rooms(bigint[]),private.process_catalog_room(uuid,uuid,bigint) to match_catalog_backend;

create or replace function private.accept_provider_response(p_attempt_id bigint,p_lease_token uuid,p_generation bigint,p_projection jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b private.provider_budget_state%rowtype; a private.provider_request_attempts%rowtype; g private.provider_request_groups%rowtype;
  t timestamptz; item jsonb; accepted integer:=0; rejected integer:=0; saved_id bigint;
begin
  select * into b from private.provider_budget_state where provider='espn' for update;
  select * into a from private.provider_request_attempts where id=p_attempt_id;
  if not found then return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  select * into g from private.provider_request_groups where id=a.group_id for update;
  t:=clock_timestamp();
  if b.ownership_mode is distinct from 'catalog' or b.worker_generation is distinct from p_generation or a.worker_generation is distinct from p_generation
    or a.lease_token is distinct from p_lease_token or p_lease_token is null then return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  if a.outcome in ('accepted','partial') then return jsonb_build_object('ok',true,'isReplay',true); end if;
  if g.lease_token is distinct from p_lease_token or g.owner_generation is distinct from p_generation or g.lease_until<=t or g.lease_until is null or a.outcome<>'reserved' then return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  if jsonb_typeof(p_projection->'matches') is distinct from 'array' or jsonb_typeof(p_projection->'isPartial') is distinct from 'boolean' or octet_length(p_projection::text)>2097152 then return jsonb_build_object('ok',false,'code','invalid_provider_response'); end if;
  if jsonb_array_length(p_projection->'matches')>512 then return jsonb_build_object('ok',false,'code','invalid_provider_response'); end if;
  for item in select value from jsonb_array_elements(p_projection->'matches') loop
    if private.accept_compact_provider_match(g.id,a.id,item,t) then
      accepted:=accepted+1;
      select id into saved_id from private.provider_matches where league_id=g.league_id and source_event_id=item#>>'{identity,sourceEventId}' and last_projection_sequence=a.id;
      if found then
        perform private.accept_provider_match_details(saved_id,a.id,item,t);
        update private.provider_matches set condition_started_at=case when item->>'lifecycle' in ('unknown','delayed','suspended','postponed') then coalesce(condition_started_at,t) else null end,
          availability_reason=case when item->>'lifecycle'='unknown' then 'provider_status_unknown' when item->>'availability'='partial' then 'partial_provider_response' else null end where id=saved_id;
      end if;
    else rejected:=rejected+1; end if;
  end loop;
  if g.resource_kind='scoreboard' then
    update private.provider_matches source set availability='partial',availability_reason='match_not_found',condition_started_at=coalesce(condition_started_at,t)
    where source.scoreboard_group_id=g.id and source.last_projection_sequence<a.id and exists(select 1 from private.catalog_demand_matches demand where demand.catalog_match_id=source.id)
      and not exists(select 1 from jsonb_array_elements(p_projection->'matches') x where x#>>'{identity,sourceEventId}'=source.source_event_id);
  end if;
  update private.provider_request_attempts set outcome=case when rejected>0 or p_projection->>'isPartial'='true' then 'partial' else 'accepted' end,finished_at=t where id=a.id;
  update private.provider_request_groups set last_successful_check_at=t,successful_empty=jsonb_array_length(p_projection->'matches')=0 and p_projection->>'isPartial'='false',
    failure_count=0,last_error=case when rejected>0 then 'identity_unresolved' when p_projection->>'isPartial'='true' then 'partial_provider_response' else null end,lease_until=null,lease_token=null,owner_generation=null where id=g.id;
  perform private.refresh_catalog_group_due(array[g.id]);
  if clock_timestamp()>=g.lease_until then raise exception 'Provider claim expired' using errcode='57014'; end if;
  return jsonb_build_object('ok',true,'acceptedMatches',accepted,'rejectedMatches',rejected,'isReplay',false);
end;
$$;



-- Additive opaque catalog linkage in the shared registered/guest snapshot.
create function private.catalog_room_source_status(p_room_id uuid) returns jsonb language sql stable set search_path='' as $$
with selected as (
  select m.* from public.matches m join public.game_sessions room on room.id=m.session_id where m.session_id=p_room_id and m.source_provider='espn'
    and (room.common_match_id=m.id or exists(select 1 from public.assignments a join public.participants p on p.id=a.participant_id and p.session_id=a.session_id where a.session_id=p_room_id and a.match_id=m.id and p.left_at is null))
), status as (
  select case when count(*)>0 and count(*)=count(source.last_successful_check_at) then min(source.last_successful_check_at) else null end as last_checked,
    coalesce(bool_or(source.observation_version>coalesce(selected.last_applied_observation_version,0)),false) as processing,
    case when bool_or(source.id is null) then 'identity_unresolved' when bool_or(source.last_successful_check_at is null) then 'acquisition_pending'
      else (array_agg(source.availability_reason order by source.last_successful_check_at) filter(where source.availability_reason is not null))[1] end as reason
  from selected left join private.provider_matches source on source.id=selected.catalog_match_id
)
select case when (select ownership_mode from private.provider_budget_state where provider='espn') in ('catalog','paused') then
  jsonb_build_object('lastScoresCheckedAt',status.last_checked,'providerAvailabilityReason',status.reason,'roomProcessingPending',status.processing)
  else jsonb_build_object('lastScoresCheckedAt',(select last_scores_checked_at from public.game_sessions where id=p_room_id),'providerAvailabilityReason',null,'roomProcessingPending',false) end from status;
$$;
revoke all on function private.catalog_room_source_status(uuid) from public,anon,authenticated,service_role,match_catalog_backend;
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
CREATE OR REPLACE FUNCTION private.authoritative_snapshot(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_snapshot jsonb;
  v_matches jsonb;
BEGIN
  v_snapshot := private.build_guest_room_snapshot(p_session_id);

  SELECT COALESCE(
    jsonb_agg(
      match_item.value || jsonb_build_object(
        'sourceLeagueCode', matches.source_league_code
      )
      ORDER BY match_item.ordinality
    ),
    '[]'::jsonb
  ) INTO v_matches
  FROM jsonb_array_elements(COALESCE(v_snapshot->'matches', '[]'::jsonb))
    WITH ORDINALITY AS match_item(value, ordinality)
  JOIN public.matches matches
    ON matches.id = (match_item.value->>'id')::uuid
   AND matches.session_id = p_session_id;

  RETURN jsonb_set(v_snapshot, '{matches}', v_matches, true)
    || jsonb_build_object(
      'lastScoresCheckedAt', v_snapshot->'lastScoresCheckedAt',
      'configurationToken', private.running_configuration_token(p_session_id),
      'ownerParticipantId', (
        SELECT p.id::text
        FROM public.participants p
        JOIN public.game_sessions gs ON gs.owner_account_id = p.account_id
          AND gs.id = p_session_id
        WHERE p.session_id = p_session_id
          AND p.session_role = 'owner'::public.participant_session_role
          AND p.left_at IS NULL
        ORDER BY p.created_at, p.id
        LIMIT 1
      ),
      'lastEventSequence', (
        SELECT gs.last_event_sequence
        FROM public.game_sessions gs
        WHERE gs.id = p_session_id
      )
    );
END;
$$;
