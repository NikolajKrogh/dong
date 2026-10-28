-- One compact current roster/stat set per match, with meaningful goal revisions only.
create table private.provider_match_rosters (
  match_id bigint not null references private.provider_matches(id) on delete cascade,
  side text not null check(side in ('home','away')),
  athlete_key text not null check(length(athlete_key)<=180),
  athlete_id bigint references private.provider_athletes(id) on delete restrict,
  athlete_name text not null check(length(athlete_name) between 1 and 160),
  jersey text check(length(jersey)<=20),position text check(length(position)<=80),
  is_starter boolean,did_play boolean,minutes_played numeric check(minutes_played between 0 and 300),
  display_order smallint not null,projection_sequence bigint not null,
  primary key(match_id,side,athlete_key)
);
create index provider_roster_athlete on private.provider_match_rosters(athlete_id,match_id);
create table private.provider_goal_revisions (
  goal_id bigint not null references private.provider_match_goals(id) on delete cascade,
  revision integer not null,changed_at timestamptz not null,
  side text,source_team_id text,source_athlete_id text,athlete_name text,clock text,period smallint,occurred_at timestamptz,kind text not null,is_retracted boolean not null,
  primary key(goal_id,revision)
);
alter table private.provider_matches add column history_availability text not null default 'unavailable' check(history_availability in ('available','partial','pending','unavailable','deferred')),
  add column history_is_final boolean,add column history_has_more_roster boolean not null default false,add column history_roster_available boolean not null default false;
create table private.provider_capacity_samples (
  sample_day date primary key,measured_at timestamptz not null,feature_bytes bigint not null,database_bytes bigint not null,protected_match_count bigint not null
);
alter table private.provider_budget_state add column reserved_growth_bytes bigint not null default 0 check(reserved_growth_bytes>=0);
alter table private.provider_budget_state add column scheduling_degraded boolean not null default false;
alter table private.provider_match_team_stats add column team_id bigint references private.provider_teams(id) on delete restrict;
create index provider_stats_team on private.provider_match_team_stats(team_id,match_id);
alter table private.provider_match_rosters enable row level security;
alter table private.provider_goal_revisions enable row level security;
alter table private.provider_capacity_samples enable row level security;
revoke all on private.provider_match_rosters,private.provider_goal_revisions,private.provider_capacity_samples from public,anon,authenticated,service_role,match_catalog_backend;

create function private.record_provider_goal_revision() returns trigger language plpgsql security definer set search_path='' as $$
declare next_revision integer;
begin
  if tg_op='UPDATE' and row(new.side,new.source_team_id,new.source_athlete_id,new.athlete_name,new.clock,new.period,new.occurred_at,new.kind,new.is_retracted)
    is not distinct from row(old.side,old.source_team_id,old.source_athlete_id,old.athlete_name,old.clock,old.period,old.occurred_at,old.kind,old.is_retracted) then return null; end if;
  select coalesce(max(revision),0)+1 into next_revision from private.provider_goal_revisions where goal_id=new.id;
  insert into private.provider_goal_revisions(goal_id,revision,changed_at,side,source_team_id,source_athlete_id,athlete_name,clock,period,occurred_at,kind,is_retracted)
  values(new.id,next_revision,new.changed_at,new.side,new.source_team_id,new.source_athlete_id,new.athlete_name,new.clock,new.period,new.occurred_at,new.kind,new.is_retracted);
  return null;
end;
$$;
create trigger provider_goal_revision after insert or update on private.provider_match_goals for each row execute function private.record_provider_goal_revision();
create trigger provider_goal_revision_immutable before update on private.provider_goal_revisions for each row execute function private.reject_provider_observation_update();
revoke all on function private.record_provider_goal_revision() from public,anon,authenticated,service_role,match_catalog_backend;

-- Expanded typed final scalar metrics.
alter table private.provider_match_team_stats
  add column offsides integer check(offsides between 0 and 100000),
  add column saves integer check(saves between 0 and 100000),
  add column blocked_shots integer check(blocked_shots between 0 and 100000),
  add column penalty_kick_goals integer check(penalty_kick_goals between 0 and 100000),
  add column penalty_kick_shots integer check(penalty_kick_shots between 0 and 100000),
  add column accurate_passes integer check(accurate_passes between 0 and 100000),
  add column total_passes integer check(total_passes between 0 and 100000),
  add column pass_pct numeric check(pass_pct between 0 and 100),
  add column accurate_crosses integer check(accurate_crosses between 0 and 100000),
  add column total_crosses integer check(total_crosses between 0 and 100000),
  add column cross_pct numeric check(cross_pct between 0 and 100),
  add column accurate_long_balls integer check(accurate_long_balls between 0 and 100000),
  add column total_long_balls integer check(total_long_balls between 0 and 100000),
  add column longball_pct numeric check(longball_pct between 0 and 100),
  add column effective_tackles integer check(effective_tackles between 0 and 100000),
  add column total_tackles integer check(total_tackles between 0 and 100000),
  add column tackle_pct numeric check(tackle_pct between 0 and 100),
  add column interceptions integer check(interceptions between 0 and 100000),
  add column effective_clearance integer check(effective_clearance between 0 and 100000),
  add column total_clearance integer check(total_clearance between 0 and 100000),
  add column shot_pct numeric check(shot_pct between 0 and 100);
create function private.provider_history_stats(p_match_id bigint,p_side text) returns jsonb language sql stable set search_path='' as $$
select private.provider_stats_projection(p_match_id,p_side) || jsonb_build_object(
  'offsides',stats.offsides,
  'saves',stats.saves,
  'blockedShots',stats.blocked_shots,
  'penaltyKickGoals',stats.penalty_kick_goals,
  'penaltyKickShots',stats.penalty_kick_shots,
  'accuratePasses',stats.accurate_passes,
  'totalPasses',stats.total_passes,
  'passPct',stats.pass_pct,
  'accurateCrosses',stats.accurate_crosses,
  'totalCrosses',stats.total_crosses,
  'crossPct',stats.cross_pct,
  'accurateLongBalls',stats.accurate_long_balls,
  'totalLongBalls',stats.total_long_balls,
  'longballPct',stats.longball_pct,
  'effectiveTackles',stats.effective_tackles,
  'totalTackles',stats.total_tackles,
  'tacklePct',stats.tackle_pct,
  'interceptions',stats.interceptions,
  'effectiveClearance',stats.effective_clearance,
  'totalClearance',stats.total_clearance,
  'shotPct',stats.shot_pct
) from private.provider_match_team_stats stats where match_id=p_match_id and side=p_side;
$$;
create function private.upsert_provider_history_stats(p_match_id bigint,p_side text,p_stats jsonb,p_sequence bigint,p_final boolean,p_time timestamptz) returns void language plpgsql set search_path='' as $$
begin
  if jsonb_typeof(p_stats) is distinct from 'object' or jsonb_strip_nulls(p_stats)='{}'::jsonb then return; end if;
  insert into private.provider_match_team_stats(match_id,side,team_id,is_final,observed_at,projection_sequence,offsides,saves,blocked_shots,penalty_kick_goals,penalty_kick_shots,accurate_passes,total_passes,pass_pct,accurate_crosses,total_crosses,cross_pct,accurate_long_balls,total_long_balls,longball_pct,effective_tackles,total_tackles,tackle_pct,interceptions,effective_clearance,total_clearance,shot_pct)
  select m.id,p_side,case when p_side='home' then m.home_team_id else m.away_team_id end,p_final,p_time,p_sequence,
    (p_stats->>'offsides')::integer,
    (p_stats->>'saves')::integer,
    (p_stats->>'blockedShots')::integer,
    (p_stats->>'penaltyKickGoals')::integer,
    (p_stats->>'penaltyKickShots')::integer,
    (p_stats->>'accuratePasses')::integer,
    (p_stats->>'totalPasses')::integer,
    (p_stats->>'passPct')::numeric,
    (p_stats->>'accurateCrosses')::integer,
    (p_stats->>'totalCrosses')::integer,
    (p_stats->>'crossPct')::numeric,
    (p_stats->>'accurateLongBalls')::integer,
    (p_stats->>'totalLongBalls')::integer,
    (p_stats->>'longballPct')::numeric,
    (p_stats->>'effectiveTackles')::integer,
    (p_stats->>'totalTackles')::integer,
    (p_stats->>'tacklePct')::numeric,
    (p_stats->>'interceptions')::integer,
    (p_stats->>'effectiveClearance')::integer,
    (p_stats->>'totalClearance')::integer,
    (p_stats->>'shotPct')::numeric
  from private.provider_matches m where m.id=p_match_id
  on conflict(match_id,side) do update set team_id=coalesce(excluded.team_id,private.provider_match_team_stats.team_id),is_final=excluded.is_final,observed_at=p_time,projection_sequence=p_sequence,
    offsides=coalesce(excluded.offsides,private.provider_match_team_stats.offsides),
    saves=coalesce(excluded.saves,private.provider_match_team_stats.saves),
    blocked_shots=coalesce(excluded.blocked_shots,private.provider_match_team_stats.blocked_shots),
    penalty_kick_goals=coalesce(excluded.penalty_kick_goals,private.provider_match_team_stats.penalty_kick_goals),
    penalty_kick_shots=coalesce(excluded.penalty_kick_shots,private.provider_match_team_stats.penalty_kick_shots),
    accurate_passes=coalesce(excluded.accurate_passes,private.provider_match_team_stats.accurate_passes),
    total_passes=coalesce(excluded.total_passes,private.provider_match_team_stats.total_passes),
    pass_pct=coalesce(excluded.pass_pct,private.provider_match_team_stats.pass_pct),
    accurate_crosses=coalesce(excluded.accurate_crosses,private.provider_match_team_stats.accurate_crosses),
    total_crosses=coalesce(excluded.total_crosses,private.provider_match_team_stats.total_crosses),
    cross_pct=coalesce(excluded.cross_pct,private.provider_match_team_stats.cross_pct),
    accurate_long_balls=coalesce(excluded.accurate_long_balls,private.provider_match_team_stats.accurate_long_balls),
    total_long_balls=coalesce(excluded.total_long_balls,private.provider_match_team_stats.total_long_balls),
    longball_pct=coalesce(excluded.longball_pct,private.provider_match_team_stats.longball_pct),
    effective_tackles=coalesce(excluded.effective_tackles,private.provider_match_team_stats.effective_tackles),
    total_tackles=coalesce(excluded.total_tackles,private.provider_match_team_stats.total_tackles),
    tackle_pct=coalesce(excluded.tackle_pct,private.provider_match_team_stats.tackle_pct),
    interceptions=coalesce(excluded.interceptions,private.provider_match_team_stats.interceptions),
    effective_clearance=coalesce(excluded.effective_clearance,private.provider_match_team_stats.effective_clearance),
    total_clearance=coalesce(excluded.total_clearance,private.provider_match_team_stats.total_clearance),
    shot_pct=coalesce(excluded.shot_pct,private.provider_match_team_stats.shot_pct)
  where private.provider_match_team_stats.projection_sequence<=p_sequence;
end;
$$;
revoke all on function private.provider_history_stats(bigint,text),private.upsert_provider_history_stats(bigint,text,jsonb,bigint,boolean,timestamptz) from public,anon,authenticated,service_role,match_catalog_backend;

alter function private.accept_provider_match_details(bigint,bigint,jsonb,timestamptz) rename to accept_provider_match_details_core;
create function private.accept_provider_match_details(p_match_id bigint,p_sequence bigint,p_item jsonb,p_time timestamptz)
returns void language plpgsql set search_path='' as $$
declare m private.provider_matches%rowtype; details jsonb; entry jsonb; participant jsonb; goal jsonb; saved_athlete bigint; roster_key text; ordinal integer:=0; saved_goal bigint;
begin
  select * into m from private.provider_matches where id=p_match_id for update;
  if not found or m.last_projection_sequence<>p_sequence then return; end if;
  perform private.accept_provider_match_details_core(p_match_id,p_sequence,p_item,p_time);
  if jsonb_typeof(p_item->'goals')='array' then
    for goal in select value from jsonb_array_elements(p_item->'goals') loop
      if goal->>'sourcePlayId' is not null and jsonb_typeof(goal->'participants')='array' then
        select id into saved_goal from private.provider_match_goals where match_id=m.id and source_play_id=goal->>'sourcePlayId';
        delete from private.provider_goal_participants where goal_id=saved_goal;
        for participant in select value from jsonb_array_elements(goal->'participants') loop
          if participant->>'sourceAthleteId' is null or participant->>'athleteName' is null then continue; end if;
          insert into private.provider_athletes(provider,source_athlete_id,display_name) values('espn',participant->>'sourceAthleteId',participant->>'athleteName')
            on conflict(provider,source_athlete_id) do update set display_name=excluded.display_name returning id into saved_athlete;
          insert into private.provider_goal_participants(goal_id,athlete_id,role) values(saved_goal,saved_athlete,case when participant->>'role' in ('scorer','assist','involved') then participant->>'role' else 'unknown' end) on conflict do nothing;
        end loop;
      end if;
    end loop;
    if p_item->>'goalsAvailability'='available' then
      update private.provider_match_goals current_goal set is_retracted=true,changed_at=p_time where match_id=m.id and source_play_id is not null and not is_retracted
        and not exists(select 1 from jsonb_array_elements(p_item->'goals') x where x->>'sourcePlayId'=current_goal.source_play_id);
      if (select count(*) from private.provider_match_goals where match_id=m.id and not is_retracted and kind<>'shootout') is distinct from m.home_score+m.away_score then
        update private.provider_matches set goals_availability='partial' where id=m.id;
      end if;
    end if;
  end if;
  details:=p_item->'historyDetails';
  if jsonb_typeof(details) is distinct from 'object' or p_sequence<m.detail_projection_sequence then return; end if;
  if details->>'availability'='unavailable' then return; end if;
  if not private.reserve_catalog_bytes(50000,true) then
    update private.provider_matches set history_availability=case when history_availability='unavailable' then 'deferred' else history_availability end where id=m.id;
    return;
  end if;
  if jsonb_typeof(details->'rosterEntries')='array' then
    for entry in select value from jsonb_array_elements(details->'rosterEntries') limit 256 loop
      if entry->>'sourceAthleteId' is not null then
        insert into private.provider_athletes(provider,source_athlete_id,display_name) values('espn',entry->>'sourceAthleteId',entry->>'athleteName')
          on conflict(provider,source_athlete_id) do update set display_name=excluded.display_name returning id into saved_athlete;
        roster_key:='source:'||(entry->>'sourceAthleteId');
      else
        saved_athlete:=null;
        roster_key:='derived:'||encode(extensions.digest(concat_ws(':',entry->>'athleteName',entry->>'jersey',entry->>'position'),'sha256'),'hex');
      end if;
      insert into private.provider_match_rosters(match_id,side,athlete_key,athlete_id,athlete_name,jersey,position,is_starter,did_play,minutes_played,display_order,projection_sequence)
      values(m.id,entry->>'side',roster_key,saved_athlete,entry->>'athleteName',entry->>'jersey',entry->>'position',(entry->>'isStarter')::boolean,(entry->>'didPlay')::boolean,(entry->>'minutesPlayed')::numeric,ordinal,p_sequence)
      on conflict(match_id,side,athlete_key) do update set athlete_id=coalesce(excluded.athlete_id,private.provider_match_rosters.athlete_id),athlete_name=excluded.athlete_name,jersey=coalesce(excluded.jersey,private.provider_match_rosters.jersey),position=coalesce(excluded.position,private.provider_match_rosters.position),
        is_starter=coalesce(excluded.is_starter,private.provider_match_rosters.is_starter),did_play=coalesce(excluded.did_play,private.provider_match_rosters.did_play),minutes_played=coalesce(excluded.minutes_played,private.provider_match_rosters.minutes_played),display_order=excluded.display_order,projection_sequence=p_sequence;
      ordinal:=ordinal+1;
    end loop;
  end if;
  perform private.upsert_provider_history_stats(m.id,'home',details#>'{teamStats,home}',p_sequence,(details->>'isFinal')::boolean,p_time);
  perform private.upsert_provider_history_stats(m.id,'away',details#>'{teamStats,away}',p_sequence,(details->>'isFinal')::boolean,p_time);
  update private.provider_matches set detail_projection_sequence=p_sequence,history_roster_available=history_roster_available or coalesce(jsonb_typeof(details->'rosterEntries')='array',false),history_availability=coalesce(details->>'availability','partial'),history_is_final=coalesce((details->>'isFinal')::boolean,history_is_final),
    history_has_more_roster=coalesce((details->>'hasMoreRosterEntries')::boolean,false) or (select count(*)>128 from private.provider_match_rosters where match_id=m.id) where id=m.id;
end;
$$;
revoke all on function private.accept_provider_match_details(bigint,bigint,jsonb,timestamptz) from public,anon,authenticated,service_role,match_catalog_backend;

alter function private.saved_match_projection(bigint,text) rename to saved_match_projection_core;
create function private.saved_match_projection(p_match_id bigint,p_projection text)
returns jsonb language sql stable set search_path='' as $$
select private.saved_match_projection_core(m.id,'live') || case when p_projection='history' then jsonb_build_object('historyDetails',jsonb_build_object(
  'rosterEntries',case when not m.history_roster_available then null else (select coalesce(jsonb_agg(value order by side,display_order,athlete_key),'[]'::jsonb) from (
    select roster.side,roster.display_order,roster.athlete_key,jsonb_build_object('sourceAthleteId',athlete.source_athlete_id,'athleteName',roster.athlete_name,'side',roster.side,'jersey',roster.jersey,'position',roster.position,'isStarter',roster.is_starter,'didPlay',roster.did_play,'minutesPlayed',roster.minutes_played) as value
    from private.provider_match_rosters roster left join private.provider_athletes athlete on athlete.id=roster.athlete_id where roster.match_id=m.id order by roster.side,roster.display_order,roster.athlete_key limit 128
  ) entries) end,
  'teamStats',case when not exists(select 1 from private.provider_match_team_stats where match_id=m.id) then null else jsonb_build_object('home',private.provider_history_stats(m.id,'home'),'away',private.provider_history_stats(m.id,'away')) end,
  'availability',case when m.history_has_more_roster and m.history_availability='available' then 'partial' else m.history_availability end,'isFinal',m.history_is_final,'hasMoreRosterEntries',m.history_has_more_roster)) else '{}'::jsonb end
from private.provider_matches m where id=p_match_id;
$$;
revoke all on function private.saved_match_projection(bigint,text) from public,anon,authenticated,service_role,match_catalog_backend;

create function private.measure_catalog_capacity() returns jsonb
language plpgsql security definer set search_path='' as $$
declare feature_size bigint; database_size bigint; protected_matches bigint; old_sample private.provider_capacity_samples%rowtype;
  daily_growth numeric:=0; projected bigint; t timestamptz:=clock_timestamp(); cron_fraction numeric;
begin
  -- Count shared match/event/history tables in full: conservative attribution, not a payload-size estimate.
  select coalesce(sum(pg_total_relation_size(c.oid)),0) into feature_size from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
  where c.relkind in ('r','S') and (ns.nspname='private' and (c.relname like 'provider_%' or c.relname like 'solo_%')
    or ns.nspname='public' and c.relname in ('matches','gameplay_events','gameplay_command_results','assignment_snapshots'));
  select count(*) filter(where jobid=(select jobid from cron.job where jobname='match-catalog-monitor'))::numeric/greatest(count(*),1) into cron_fraction from cron.job_run_details;
  feature_size:=feature_size+ceil(pg_total_relation_size('cron.job_run_details')*coalesce(cron_fraction,0));
  database_size:=pg_database_size(current_database());
  select count(distinct catalog_match_id) into protected_matches from public.matches where catalog_match_id is not null;
  select * into old_sample from private.provider_capacity_samples where sample_day<(t at time zone 'UTC')::date order by sample_day limit 1;
  if found then daily_growth:=greatest(0,(feature_size-old_sample.feature_bytes)::numeric/greatest(extract(epoch from t-old_sample.measured_at)/86400,1)); end if;
  projected:=feature_size+ceil(daily_growth*30);
  update private.provider_budget_state set feature_bytes=feature_size,database_bytes=database_size,capacity_measured_at=t,reserved_growth_bytes=0,
    optional_work_allowed=feature_size<feature_bytes_limit*0.8 and database_size<450000000,
    new_demand_allowed=feature_size<feature_bytes_limit*0.9 and projected<feature_bytes_limit and database_size<450000000,updated_at=t where provider='espn';
  insert into private.provider_capacity_samples(sample_day,measured_at,feature_bytes,database_bytes,protected_match_count)
  values((t at time zone 'UTC')::date,t,feature_size,database_size,protected_matches)
  on conflict(sample_day) do update set measured_at=excluded.measured_at,feature_bytes=excluded.feature_bytes,database_bytes=excluded.database_bytes,protected_match_count=excluded.protected_match_count;
  return jsonb_build_object('ok',true,'featureBytes',feature_size,'databaseBytes',database_size,'protectedMatchCount',protected_matches,'observedDailyGrowthBytes',daily_growth,'projectedThirtyDayBytes',projected);
end;
$$;

create function private.maintain_catalog_storage() returns jsonb
language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp(); deleted_matches integer;
begin
  perform 1 from private.provider_budget_state where provider='espn' for update;
  perform private.recover_catalog_claims();
  delete from private.solo_tracking_grants where id in (select id from private.solo_tracking_grants where expires_at<=t order by expires_at limit 1000);
  delete from private.provider_admission_counters where ctid in (select ctid from private.provider_admission_counters where window_start<t-interval '2 hours' limit 1000);
  delete from private.provider_request_attempts where id in (select id from private.provider_request_attempts where reserved_at<t-interval '24 hours' and outcome<>'reserved' order by reserved_at limit 1000);
  delete from private.provider_matches source where source.id in (
    select m.id from private.provider_matches m where not exists(select 1 from public.matches room_match where room_match.catalog_match_id=m.id)
      and not exists(select 1 from private.catalog_demand_matches active where active.catalog_match_id=m.id)
      and ((m.lifecycle in ('finished','canceled','abandoned') and coalesce(m.completed_at,m.observed_at,m.created_at)<t-interval '30 days' and m.last_used_at<t-interval '30 days')
        or m.lifecycle not in ('finished','canceled','abandoned') and m.last_used_at<t-interval '24 hours') order by m.last_used_at limit 1000
  );
  get diagnostics deleted_matches=row_count;
  delete from private.provider_request_groups g where g.id in (
    select resource.id from private.provider_request_groups resource where resource.last_used_at<t-interval '24 hours'
      and (resource.lease_until is null or resource.lease_until<=t) and (resource.discovery_until is null or resource.discovery_until<=t)
      and not exists(select 1 from private.provider_matches where scoreboard_group_id=resource.id)
      and not exists(select 1 from private.provider_request_attempts where group_id=resource.id)
      and not exists(select 1 from private.provider_matches m where m.league_id=resource.league_id and m.source_event_id=resource.source_event_id)
    order by resource.last_used_at limit 1000
  );
  delete from private.provider_athletes a where a.id in (select id from private.provider_athletes athlete where not exists(select 1 from private.provider_match_rosters where athlete_id=athlete.id)
    and not exists(select 1 from private.provider_goal_participants where athlete_id=athlete.id) limit 1000);
  delete from private.provider_teams team where team.id in (select id from private.provider_teams candidate where not exists(select 1 from private.provider_matches where home_team_id=candidate.id or away_team_id=candidate.id)
    and not exists(select 1 from private.provider_match_team_stats where team_id=candidate.id) limit 1000);
  delete from private.provider_request_daily_usage where ctid in (select ctid from private.provider_request_daily_usage where usage_day<(t at time zone 'UTC')::date-90 limit 1000);
  delete from private.provider_capacity_samples where sample_day<(t at time zone 'UTC')::date-90;
  delete from cron.job_run_details where runid in (select runid from cron.job_run_details where jobid=(select jobid from cron.job where jobname='match-catalog-monitor') and end_time<t-interval '7 days' order by end_time limit 1000);
  return private.measure_catalog_capacity()||jsonb_build_object('evictedMatches',deleted_matches);
end;
$$;
revoke all on function private.measure_catalog_capacity(),private.maintain_catalog_storage() from public,anon,authenticated,service_role,match_catalog_backend;

create function private.schedule_catalog_completion() returns trigger
language plpgsql security definer set search_path='' as $$
declare resource_id bigint;
begin
  if new.lifecycle<>'finished' then
    update private.provider_request_groups set completion_due_at=null where league_id=new.league_id and resource_kind='summary' and source_event_id=new.source_event_id;
    if new.lifecycle='live' then
      update private.provider_matches set history_is_final=false where id=new.id and history_is_final is true;
      update private.provider_match_team_stats set is_final=false where match_id=new.id and is_final is true;
    end if;
    return null;
  end if;
  if new.is_completed is not true or new.completion_attempt_count>=2 or coalesce(new.completed_at,clock_timestamp())<clock_timestamp()-interval '24 hours'
    or not (select optional_work_allowed and not scheduling_degraded from private.provider_budget_state where provider='espn') then return null; end if;
  if not exists(select 1 from private.catalog_demand_matches where catalog_match_id=new.id)
    and not exists(select 1 from public.matches m join public.game_sessions room on room.id=m.session_id where m.catalog_match_id=new.id
      and (room.common_match_id=m.id or exists(select 1 from public.assignment_snapshots where match_id=m.id))) then return null; end if;
  insert into private.provider_request_groups(provider,league_id,resource_kind,source_event_id,next_attempt_at,completion_due_at)
  values('espn',new.league_id,'summary',new.source_event_id,new.completed_at+interval '5 minutes',new.completed_at+interval '5 minutes')
  on conflict(provider,scope_key) do nothing returning id into resource_id;
  return null;
end;
$$;
create trigger catalog_completion_observed after insert or update of lifecycle,is_completed on private.provider_matches for each row execute function private.schedule_catalog_completion();
revoke all on function private.schedule_catalog_completion() from public,anon,authenticated,service_role,match_catalog_backend;

create function private.catalog_source_date_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare new_group bigint; old_group bigint:=new.scoreboard_group_id;
begin
  if new.kickoff_at is null or new.kickoff_validity<>'confirmed' then return null; end if;
  if exists(select 1 from private.provider_request_groups where id=old_group and request_date=(new.kickoff_at at time zone 'UTC')::date) then
    if new.kickoff_at is distinct from old.kickoff_at then perform private.refresh_catalog_scheduling_capacity(); end if;
    return null;
  end if;
  insert into private.provider_request_groups(provider,league_id,resource_kind,request_date)
  values('espn',new.league_id,'scoreboard',(new.kickoff_at at time zone 'UTC')::date) on conflict(provider,scope_key) do nothing;
  select id into new_group from private.provider_request_groups where league_id=new.league_id and resource_kind='scoreboard' and request_date=(new.kickoff_at at time zone 'UTC')::date;
  update private.provider_matches set scoreboard_group_id=new_group where id=new.id;
  perform private.refresh_catalog_group_due(array[old_group,new_group]);
  perform private.refresh_catalog_scheduling_capacity();
  return null;
end;
$$;
create trigger catalog_source_date_changed after update of kickoff_at,kickoff_validity on private.provider_matches for each row execute function private.catalog_source_date_changed();
revoke all on function private.catalog_source_date_changed() from public,anon,authenticated,service_role,match_catalog_backend;

create function private.refresh_catalog_completion_due() returns void language plpgsql set search_path='' as $$
begin
  insert into private.provider_request_groups(provider,league_id,resource_kind,source_event_id,next_attempt_at,completion_due_at)
  select 'espn',m.league_id,'summary',m.source_event_id,m.completed_at+interval '5 minutes',m.completed_at+interval '5 minutes'
  from private.provider_matches m where m.lifecycle='finished' and m.is_completed is true and m.completed_at>clock_timestamp()-interval '24 hours' and m.completion_attempt_count=0
    and (select optional_work_allowed and not scheduling_degraded from private.provider_budget_state where provider='espn')
    and (exists(select 1 from private.catalog_demand_matches where catalog_match_id=m.id)
      or exists(select 1 from public.matches room_match join public.game_sessions room on room.id=room_match.session_id where room_match.catalog_match_id=m.id
        and (room.common_match_id=room_match.id or exists(select 1 from public.assignment_snapshots where match_id=room_match.id))))
  on conflict(provider,scope_key) do nothing;
  update private.provider_request_groups g set completion_due_at=null where resource_kind='summary' and exists(select 1 from private.provider_matches m where m.league_id=g.league_id and m.source_event_id=g.source_event_id
    and (m.lifecycle<>'finished' or m.completion_attempt_count>=2 or coalesce(m.completion_deadline,m.completed_at+interval '24 hours')<=clock_timestamp()));
end;
$$;
revoke all on function private.refresh_catalog_completion_due() from public,anon,authenticated,service_role,match_catalog_backend;

create function private.catalog_selection_admissible(p_match_ids bigint[],p_exclude_room uuid default null,p_exclude_grant uuid default null) returns boolean
language plpgsql stable set search_path='' as $$
declare policy private.provider_budget_state%rowtype; peak_groups integer; forecast bigint; t timestamptz:=statement_timestamp();
begin
  select * into policy from private.provider_budget_state where provider='espn';
  with selected as (
    select m.* from private.provider_matches m where m.id=any(p_match_ids)
      or exists(select 1 from private.active_catalog_room_matches active where active.catalog_match_id=m.id and active.session_id is distinct from p_exclude_room)
      or exists(select 1 from private.solo_tracked_matches selected join private.solo_tracking_grants grant_row on grant_row.id=selected.grant_id where selected.match_id=m.id and grant_row.id is distinct from p_exclude_grant
        and grant_row.grant_digest is not null and grant_row.ended_at is null and grant_row.expires_at>t and selected.admitted_until>t)
  ), reservations as (
    select scoreboard_group_id as group_id,min(coalesce(kickoff_at,t)) as starts_at,
      max(case when lifecycle='live' or kickoff_at<=t then greatest(coalesce(kickoff_at,t)+interval '4 hours',t+interval '4 hours') else kickoff_at+interval '4 hours' end) as ends_at
    from selected where lifecycle not in ('finished','canceled','abandoned') and scoreboard_group_id is not null and (lifecycle='live' or kickoff_validity='confirmed' and kickoff_at is not null) group by scoreboard_group_id
  ), boundaries as (select starts_at as instant from reservations union select ends_at from reservations)
  select coalesce((select max((select count(*) from reservations r where r.starts_at<=b.instant and r.ends_at>b.instant)) from boundaries b),0),
    coalesce((select sum(ceil(greatest(0,extract(epoch from least(ends_at,date_trunc('day',t at time zone 'UTC') at time zone 'UTC'+interval '1 day')-greatest(starts_at,t)))/60)) from reservations),0)
  into peak_groups,forecast;
  return peak_groups<=policy.max_live_groups and (policy.daily_limit is null or forecast<=greatest(0,policy.daily_limit-case when policy.usage_day=(t at time zone 'UTC')::date then policy.daily_count else 0 end));
end;
$$;

create function private.guard_catalog_room_admission() returns trigger
language plpgsql security definer set search_path='' as $$
declare ids bigint[]; policy private.provider_budget_state%rowtype;
begin
  if new.state<>'in_progress'::public.session_state then return new; end if;
  select coalesce(array_agg(distinct catalog_match_id) filter(where catalog_match_id is not null),'{}'::bigint[]) into ids from public.matches m
  where m.session_id=new.id and (m.id=new.common_match_id or exists(select 1 from public.assignments where session_id=new.id and match_id=m.id));
  if cardinality(ids)=0 then return new; end if;
  select * into policy from private.provider_budget_state where provider='espn' for update;
  if policy.ownership_mode='catalog' and (not policy.new_demand_allowed or not private.catalog_selection_admissible(ids,new.id)) then raise exception 'capacity_limited'; end if;
  return new;
end;
$$;
create trigger catalog_room_admission before update of state,common_match_id on public.game_sessions for each row execute function private.guard_catalog_room_admission();
revoke all on function private.catalog_selection_admissible(bigint[],uuid,uuid),private.guard_catalog_room_admission() from public,anon,authenticated,service_role,match_catalog_backend;

create function private.assert_catalog_room_capacity(p_session_id uuid) returns void language plpgsql set search_path='' as $$
declare ids bigint[];
begin
  perform 1 from private.provider_budget_state where provider='espn' for update;
  if (select ownership_mode from private.provider_budget_state where provider='espn')<>'catalog' then return; end if;
  select coalesce(array_agg(catalog_match_id),'{}'::bigint[]) into ids from private.active_catalog_room_matches where session_id=p_session_id;
  if not private.catalog_selection_admissible(ids,p_session_id) then raise exception 'capacity_limited'; end if;
end;
$$;
create function private.guard_catalog_match_storage() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.source_provider='espn' then
    perform 1 from private.provider_budget_state where provider='espn' for update;
    if not private.reserve_catalog_bytes(16000,false) then raise exception 'capacity_limited'; end if;
  end if;
  return new;
end;
$$;
create trigger catalog_match_storage_admission before insert on public.matches for each row execute function private.guard_catalog_match_storage();
revoke all on function private.assert_catalog_room_capacity(uuid),private.guard_catalog_match_storage() from public,anon,authenticated,service_role,match_catalog_backend;

-- Conservative measured-growth reservations close the interval between physical measurements.
create function private.reserve_catalog_bytes(p_bytes bigint,p_optional boolean) returns boolean language plpgsql set search_path='' as $$
declare policy private.provider_budget_state%rowtype; projected bigint;
begin
  select * into policy from private.provider_budget_state where provider='espn' for update;
  if policy.ownership_mode<>'catalog' then return true; end if;
  if p_bytes is null or p_bytes<0 or p_bytes>1000000 or p_optional is null then return false; end if;
  if policy.scheduling_degraded or (case when p_optional then not policy.optional_work_allowed else not policy.new_demand_allowed end) then return false; end if;
  projected:=policy.feature_bytes+policy.reserved_growth_bytes+p_bytes;
  if projected>=policy.feature_bytes_limit*(case when p_optional then 0.8 else 0.9 end) or policy.database_bytes+policy.reserved_growth_bytes+p_bytes>=450000000 then
    update private.provider_budget_state set optional_work_allowed=false,new_demand_allowed=case when projected>=feature_bytes_limit*0.9 or database_bytes+reserved_growth_bytes+p_bytes>=450000000 then false else new_demand_allowed end where provider='espn';
    return false;
  end if;
  update private.provider_budget_state set reserved_growth_bytes=reserved_growth_bytes+p_bytes,
    optional_work_allowed=optional_work_allowed and projected<feature_bytes_limit*0.8,new_demand_allowed=new_demand_allowed and projected<feature_bytes_limit*0.9 where provider='espn';
  return true;
end;
$$;
revoke all on function private.reserve_catalog_bytes(bigint,boolean) from public,anon,authenticated,service_role,match_catalog_backend;

create function private.refresh_catalog_scheduling_capacity() returns void language plpgsql set search_path='' as $$
declare degraded boolean;
begin
  degraded:=not private.catalog_selection_admissible('{}'::bigint[]);
  update private.provider_budget_state set scheduling_degraded=degraded where provider='espn' and scheduling_degraded is distinct from degraded;
end;
$$;
revoke all on function private.refresh_catalog_scheduling_capacity() from public,anon,authenticated,service_role,match_catalog_backend;










-- Integrate completion and capacity into existing owned operations.
create or replace function private.claim_provider_request(p_group_id bigint, p_purpose text, p_worker_token uuid, p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  b private.provider_budget_state%rowtype;
  g private.provider_request_groups%rowtype;
  slot_id smallint; worker_until timestamptz; t timestamptz := clock_timestamp(); n bigint; attempt_id bigint; token uuid := gen_random_uuid();
begin
  -- This lock order is shared with admission, dispatch and ownership transitions.
  select * into b from private.provider_budget_state where provider='espn' for update;
  t:=clock_timestamp();
  if p_purpose<>'live' and b.scheduling_degraded then return jsonb_build_object('ok',false,'code','capacity_limited'); end if;
  if b.ownership_mode is distinct from 'catalog' then return jsonb_build_object('ok',false,'code','acquisition_paused'); end if;
  if b.rolling_limit is null or b.daily_limit is null then return jsonb_build_object('ok',false,'code','configuration_required'); end if;
  if b.worker_generation is distinct from p_generation then return jsonb_build_object('ok',false,'code','stale_generation'); end if;
  select id,least(lease_until,coalesce(dispatch_started_at,started_at)+interval '35 seconds') into slot_id,worker_until from private.provider_worker_slots where lease_token=p_worker_token and worker_generation=p_generation and lease_until>t;
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
  if p_purpose='completion' then
    if not b.optional_work_allowed then return jsonb_build_object('ok',false,'code','capacity_limited'); end if;
    update private.provider_matches set completion_attempt_count=completion_attempt_count+1,completion_deadline=coalesce(completion_deadline,completed_at+interval '24 hours')
    where league_id=g.league_id and source_event_id=g.source_event_id and lifecycle='finished' and is_completed is true and completion_attempt_count<2
      and coalesce(completion_deadline,completed_at+interval '24 hours')>t;
    if not found then return jsonb_build_object('ok',false,'code','completion_exhausted'); end if;
    update private.provider_request_groups set completion_due_at=case when (select completion_attempt_count from private.provider_matches where league_id=g.league_id and source_event_id=g.source_event_id)<2 then t+interval '15 minutes' else null end where id=g.id;
  end if;
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
create or replace function private.fail_provider_request(p_attempt_id bigint,p_lease_token uuid,p_generation bigint,p_code text,p_http_status integer,p_retry_after_seconds integer)
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
  if p_code in ('match_not_found','invalid_provider_response','provider_response_too_large') then seconds:=greatest(seconds,900); end if;
  next_time:=greatest(t+make_interval(secs=>seconds),t+make_interval(secs=>coalesce(p_retry_after_seconds,0)));
  update private.provider_request_attempts set outcome='failed',error_code=p_code,http_status=p_http_status,finished_at=t where id=a.id;
  update private.provider_request_groups set failure_count=failure_count+1,last_error=p_code,cooldown_until=next_time,next_attempt_at=greatest(next_attempt_at,next_time),
    paused=p_code='provider_access_rejected',lease_token=null,lease_until=null,owner_generation=null where id=g.id;
  if g.resource_kind='scoreboard' then update private.provider_matches set availability='partial',availability_reason=p_code,condition_started_at=case when p_code='match_not_found' then coalesce(condition_started_at,t) else condition_started_at end where scoreboard_group_id=g.id; end if;
  if g.resource_kind='summary' and p_http_status in (404,410) then
    update private.provider_request_groups set completion_due_at=null,paused=true where id=g.id;
    update private.provider_matches set completion_deadline=t,history_availability=case when history_availability='unavailable' then 'unavailable' else 'partial' end where league_id=g.league_id and source_event_id=g.source_event_id;
  end if;
  if p_code='provider_throttled' then update private.provider_budget_state set cooldown_until=greatest(cooldown_until,next_time),updated_at=t where provider='espn'; end if;
  return jsonb_build_object('ok',true,'retryAfterSeconds',ceil(extract(epoch from next_time-t))::integer,'scope',case when p_code='provider_throttled' then 'provider' else 'group' end);
end;
$$;
create or replace function private.prepare_solo_tracking(p_nonce_digest text,p_creation_digest text,p_operation_id uuid,p_key_id text,p_catalog_match_ids text[])
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
  if (not policy.new_demand_allowed or policy.scheduling_degraded) or (select count(*) from private.solo_tracking_grants where ended_at is null and expires_at>t)>=200 then return jsonb_build_object('ok',false,'code','capacity_limited'); end if;
  if not private.catalog_selection_admissible(ids) then return jsonb_build_object('ok',false,'code','capacity_limited'); end if;
  if not private.take_provider_admission('solo_creation','global',100,t) then return jsonb_build_object('ok',false,'code','admission_limited','retryAfterSeconds',60); end if;
  if not private.reserve_catalog_bytes(512+cardinality(ids)*96,false) then return jsonb_build_object('ok',false,'code','capacity_limited'); end if;
  insert into private.solo_tracking_grants(nonce_digest,signing_key_id,creation_operation_id,creation_request_digest,created_at,expires_at)
  values(decode(p_nonce_digest,'hex'),p_key_id,p_operation_id,decode(p_creation_digest,'hex'),t,horizon) returning * into grant_row;
  insert into private.solo_tracked_matches(grant_id,match_id,admitted_until) select grant_row.id,id,horizon from unnest(ids) id;
  update private.provider_matches set last_used_at=t where id=any(ids);
  return private.solo_grant_projection(grant_row.id,false);
end;
$$;
create or replace function private.replace_solo_tracking(p_token_digest text,p_expected_version integer,p_operation_id uuid,p_request_digest text,p_catalog_match_ids text[])
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
    if (has_new_match or horizon>grant_row.expires_at) and (not policy.new_demand_allowed or policy.scheduling_degraded) then return jsonb_build_object('ok',false,'code','capacity_limited'); end if;
  end if;
  if cardinality(ids)>0 and not private.catalog_selection_admissible(ids,null,grant_row.id) then return jsonb_build_object('ok',false,'code','capacity_limited'); end if;
  if not private.take_provider_admission('solo_replacement',grant_row.id::text,30,t) then return jsonb_build_object('ok',false,'code','admission_limited','retryAfterSeconds',60); end if;
  delete from private.solo_tracked_matches where grant_id=grant_row.id;
  insert into private.solo_tracked_matches(grant_id,match_id,admitted_until) select grant_row.id,id,horizon from unnest(ids) id;
  update private.solo_tracking_grants set selection_version=selection_version+1,expires_at=horizon,ended_at=case when cardinality(ids)=0 then t else null end,
    latest_operation_id=p_operation_id,latest_request_digest=decode(p_request_digest,'hex') where id=grant_row.id;
  update private.provider_matches set last_used_at=t where id=any(ids);
  return private.solo_grant_projection(grant_row.id,false);
end;
$$;
create or replace function private.accept_provider_response(p_attempt_id bigint,p_lease_token uuid,p_generation bigint,p_projection jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b private.provider_budget_state%rowtype; a private.provider_request_attempts%rowtype; g private.provider_request_groups%rowtype;
  t timestamptz; item jsonb; accepted integer:=0; rejected integer:=0; saved_id bigint; capacity_rejected boolean:=false;
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
    if not exists(select 1 from private.provider_matches where league_id=g.league_id and source_event_id=item#>>'{identity,sourceEventId}') and not private.reserve_catalog_bytes(25000,false) then rejected:=rejected+1;capacity_rejected:=true;continue;end if;
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
    failure_count=0,last_error=case when capacity_rejected then 'capacity_limited' when rejected>0 then 'identity_unresolved' when p_projection->>'isPartial'='true' then 'partial_provider_response' else null end,lease_until=null,lease_token=null,owner_generation=null where id=g.id;
  if g.resource_kind='summary' and exists(select 1 from private.provider_matches where league_id=g.league_id and source_event_id=g.source_event_id and history_availability='available' and history_is_final is true and goals_availability='available') then
    update private.provider_request_groups set completion_due_at=null where id=g.id;
  end if;
  perform private.refresh_catalog_group_due(array[g.id]);
  if clock_timestamp()>=g.lease_until then raise exception 'Provider claim expired' using errcode='57014'; end if;
  return jsonb_build_object('ok',true,'acceptedMatches',accepted,'rejectedMatches',rejected,'isReplay',false);
end;
$$;
CREATE OR REPLACE FUNCTION private.save_running_game_configuration(p_session_id uuid, p_configuration jsonb, p_expected_token text, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_sessions;
  v_actor uuid;
  v_fingerprint text := md5(jsonb_build_array(p_configuration, p_expected_token)::text);
  v_replay public.gameplay_command_results;
  v_item jsonb;
  v_map jsonb := '{}'::jsonb;
  v_match uuid;
  v_roster uuid[];
  v_pool uuid[];
  v_before jsonb;
  v_response jsonb;
  v_mode public.assignment_mode;
  v_count integer;
  v_shared integer;
  v_effective integer;
  v_required integer;
  v_n integer;
  v_i integer;
  v_j integer;
  v_k integer;
  v_cursor integer := 1;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_host'; END IF;
  v_actor := private.require_registered_participant(p_session_id);
  IF p_idempotency_key IS NULL OR p_expected_token IS NULL OR jsonb_typeof(p_configuration) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_configuration';
  END IF;
  SELECT * INTO v_replay FROM public.gameplay_command_results
    WHERE session_id = p_session_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_replay.command_type <> 'save_running_configuration' OR v_replay.actor_participant_id <> v_actor
      OR v_replay.request_fingerprint <> v_fingerprint THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_replay.response;
  END IF;
  IF v_room.state <> 'in_progress' THEN RAISE EXCEPTION 'game_not_in_progress'; END IF;
  IF private.running_configuration_token(p_session_id) IS DISTINCT FROM p_expected_token THEN
    RAISE EXCEPTION 'configuration_conflict';
  END IF;
  IF jsonb_typeof(p_configuration->'newMatches') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_configuration->'newMatches') > 100
    OR jsonb_typeof(p_configuration->'assignments') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_configuration->'assignments') > 10000 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  BEGIN
    v_mode := (p_configuration->>'assignmentMode')::public.assignment_mode;
    v_count := (p_configuration->>'matchesPerPlayer')::integer;
    v_shared := (p_configuration->>'sharedMatchesPerPair')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'invalid_configuration'; END;
  IF v_mode IS NULL OR v_mode NOT IN ('automatic', 'host_assigned') OR v_count IS NULL OR v_shared IS NULL
    OR v_count NOT BETWEEN 0 AND 100 OR v_shared NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  SELECT array_agg(id ORDER BY id) INTO v_roster FROM public.participants
    WHERE session_id = p_session_id AND left_at IS NULL;
  v_n := cardinality(v_roster);
  IF coalesce(v_n, 0) = 0 THEN RAISE EXCEPTION 'empty_participants'; END IF;
  IF NOT private.drain_catalog_room_cutoff(p_session_id) THEN
    RETURN jsonb_build_object('ok',false,'code','room_processing_pending','retryAfterSeconds',1);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('participantId', a.participant_id, 'matchId', a.match_id)
    ORDER BY a.participant_id, a.match_id), '[]'::jsonb) INTO v_before
    FROM public.assignments a WHERE a.session_id = p_session_id;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_configuration->'newMatches') x
    GROUP BY x->>'clientId' HAVING count(*) > 1) THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_configuration->'newMatches') LOOP
    IF nullif(btrim(v_item->>'clientId'), '') IS NULL OR length(v_item->>'clientId') > 128
      OR nullif(btrim(v_item->>'homeTeamName'), '') IS NULL OR length(v_item->>'homeTeamName') > 120
      OR nullif(btrim(v_item->>'awayTeamName'), '') IS NULL OR length(v_item->>'awayTeamName') > 120
      OR coalesce(v_item->>'sourceProvider','') NOT IN ('manual','espn') THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
    IF v_item->>'sourceProvider' = 'espn' AND
      (nullif(v_item->>'sourceMatchId','') IS NULL OR nullif(v_item->>'sourceLeagueCode','') IS NULL
       OR nullif(v_item->>'kickoffAt','') IS NULL) THEN RAISE EXCEPTION 'invalid_provider_metadata'; END IF;
    INSERT INTO public.matches(session_id, source_provider, source_match_id, source_league_code, home_team_name, away_team_name, kickoff_at)
    VALUES(p_session_id, v_item->>'sourceProvider', nullif(v_item->>'sourceMatchId',''), nullif(v_item->>'sourceLeagueCode',''),
      btrim(v_item->>'homeTeamName'), btrim(v_item->>'awayTeamName'), (v_item->>'kickoffAt')::timestamptz)
    ON CONFLICT (session_id, source_provider, source_match_id) WHERE source_match_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_match;
    IF v_match IS NULL THEN
      SELECT id INTO v_match FROM public.matches WHERE session_id = p_session_id
        AND source_provider = v_item->>'sourceProvider' AND source_match_id = v_item->>'sourceMatchId';
    END IF;
    v_map := v_map || jsonb_build_object(v_item->>'clientId', v_match::text);
  END LOOP;
  SELECT array_agg(id ORDER BY random()) INTO v_pool FROM public.matches
    WHERE session_id = p_session_id AND id <> v_room.common_match_id;
  v_effective := v_count;
  IF v_mode = 'automatic' THEN
    v_effective := greatest(v_count, v_shared * greatest(v_n - 1, 0));
    v_required := (v_n * (v_n - 1) / 2) * v_shared + v_n * (v_effective - v_shared * greatest(v_n - 1, 0));
    IF coalesce(cardinality(v_pool), 0) < v_required THEN RAISE EXCEPTION 'insufficient_match_pool'; END IF;
  ELSIF coalesce(cardinality(v_pool), 0) < v_count THEN RAISE EXCEPTION 'insufficient_match_pool'; END IF;

  -- Only current assignments change. Scores, totals, departed players and historical events are untouched.
  DELETE FROM public.assignments WHERE session_id = p_session_id AND participant_id = ANY(v_roster);
  IF v_mode = 'automatic' THEN
    IF v_n > 1 AND v_shared > 0 THEN
      FOR v_i IN 1..v_n-1 LOOP FOR v_j IN v_i+1..v_n LOOP FOR v_k IN 1..v_shared LOOP
        INSERT INTO public.assignments(session_id, participant_id, match_id)
          VALUES(p_session_id, v_roster[v_i], v_pool[v_cursor]),(p_session_id, v_roster[v_j], v_pool[v_cursor]);
        v_cursor := v_cursor + 1;
      END LOOP; END LOOP; END LOOP;
    END IF;
    FOR v_i IN 1..v_n LOOP
      FOR v_k IN 1..(v_effective - v_shared * greatest(v_n - 1, 0)) LOOP
        INSERT INTO public.assignments(session_id, participant_id, match_id) VALUES(p_session_id, v_roster[v_i], v_pool[v_cursor]);
        v_cursor := v_cursor + 1;
      END LOOP;
    END LOOP;
  ELSE
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_configuration->'assignments') LOOP
      IF (v_item->>'participantId')::uuid IS NULL OR NOT ((v_item->>'participantId')::uuid = ANY(v_roster)) THEN
        RAISE EXCEPTION 'participant_not_in_room';
      END IF;
      v_match := coalesce(v_map->>(v_item->>'matchId'), v_item->>'matchId')::uuid;
      IF v_match IS NULL OR NOT (v_match = ANY(coalesce(v_pool, ARRAY[]::uuid[]))) THEN RAISE EXCEPTION 'match_not_in_room_pool'; END IF;
      INSERT INTO public.assignments(session_id, participant_id, match_id) VALUES(p_session_id, (v_item->>'participantId')::uuid, v_match);
    END LOOP;
    IF EXISTS (SELECT 1 FROM unnest(v_roster) p(id) WHERE
      (SELECT count(*) FROM public.assignments a WHERE a.session_id = p_session_id AND a.participant_id = p.id) <> v_count) THEN
      RAISE EXCEPTION 'assignment_count_mismatch';
    END IF;
  END IF;
  INSERT INTO public.assignments(session_id, participant_id, match_id)
    SELECT p_session_id, unnest(v_roster), v_room.common_match_id;
  UPDATE public.game_sessions SET assignment_mode = v_mode, matches_per_player = v_count,
    shared_matches_per_pair = CASE WHEN v_mode = 'automatic' THEN v_shared ELSE 0 END WHERE id = p_session_id;
  INSERT INTO public.gameplay_events(session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload)
    VALUES(p_session_id, public.allocate_event_sequence(p_session_id), v_actor, 'assignment_replaced', p_idempotency_key::text,
      jsonb_build_object('runningGameEdit', true, 'previousAssignments', v_before,
        'assignments', (SELECT jsonb_agg(jsonb_build_object('participantId', a.participant_id, 'matchId', a.match_id))
          FROM public.assignments a WHERE a.session_id = p_session_id),
        'configuration', p_configuration, 'newMatchIds', v_map));
  PERFORM private.assert_catalog_room_capacity(p_session_id);
  v_response := private.authoritative_snapshot(p_session_id);
  INSERT INTO public.gameplay_command_results(session_id, idempotency_key, command_type, actor_participant_id, request_fingerprint, response)
    VALUES(p_session_id, p_idempotency_key, 'save_running_configuration', v_actor, v_fingerprint, v_response);
  RETURN v_response;
END;
$function$;
CREATE OR REPLACE FUNCTION private.reassign_participant_matches(p_session_id uuid, p_participant_id uuid, p_match_ids uuid[], p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_host_participant_ids uuid[];
  v_host_participant_id uuid;
  v_requested_match_ids uuid[];
  v_existing_payload jsonb;
  v_existing_event_type text;
  v_request_fingerprint text;
  v_current_count integer;
  v_sequence_number bigint;
  v_added_match_ids uuid[];
  v_removed_match_ids uuid[];
  v_response jsonb;
  v_event_payload jsonb;
BEGIN
  -- Authorization is deliberately before idempotency replay. A guessed key
  -- must never disclose a previous host response.
  IF v_account IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_room
  FROM public.game_sessions AS gs
  WHERE gs.id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;

  IF v_room.owner_account_id IS DISTINCT FROM v_account THEN
    RAISE EXCEPTION 'not_host';
  END IF;

  SELECT array_agg(p.id ORDER BY p.id)
  INTO v_host_participant_ids
  FROM public.participants AS p
  WHERE p.session_id = p_session_id
    AND p.account_id = v_account
    AND p.session_role = 'owner'::public.participant_session_role
    AND p.left_at IS NULL;

  IF cardinality(v_host_participant_ids) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'host_participant_not_found';
  END IF;
  v_host_participant_id := v_host_participant_ids[1];

  IF p_participant_id IS NULL
     OR p_match_ids IS NULL
     OR p_idempotency_key IS NULL
     OR EXISTS (
       SELECT 1
       FROM unnest(p_match_ids) AS input_match(match_id)
       WHERE input_match.match_id IS NULL
     ) THEN
    RAISE EXCEPTION 'invalid_reassignment_input';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT input_match.match_id ORDER BY input_match.match_id), ARRAY[]::uuid[])
  INTO v_requested_match_ids
  FROM unnest(p_match_ids) AS input_match(match_id);

  IF cardinality(v_requested_match_ids) IS DISTINCT FROM cardinality(p_match_ids) THEN
    RAISE EXCEPTION 'invalid_reassignment_input';
  END IF;

  v_request_fingerprint := encode(
    extensions.digest(
      concat(
        p_participant_id::text,
        ':',
        array_to_string(v_requested_match_ids, ',')
      ),
      'sha256'
    ),
    'hex'
  );

  -- Replays happen after authorization and structural input validation, but
  -- before room-state/target checks so a lost response can be retried after
  -- the game completes.
  SELECT e.payload, e.event_type
  INTO v_existing_payload, v_existing_event_type
  FROM public.gameplay_events AS e
  WHERE e.session_id = p_session_id
    AND e.idempotency_key = p_idempotency_key::text;

  IF FOUND THEN
    IF v_existing_event_type = 'assignment_reassigned'
       AND v_existing_payload ->> 'requestFingerprint' = v_request_fingerprint
       AND v_existing_payload ->> 'participantId' = p_participant_id::text
       AND v_existing_payload -> 'requestedMatchIds' = to_jsonb(v_requested_match_ids) THEN
      RETURN v_existing_payload;
    END IF;
    RAISE EXCEPTION 'idempotency_key_reused';
  END IF;

  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'game_not_in_progress';
  END IF;

  PERFORM 1
  FROM public.participants AS p
  WHERE p.session_id = p_session_id
    AND p.id = p_participant_id
    AND p.left_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_in_room';
  END IF;

  IF v_room.common_match_id IS NOT NULL
     AND v_room.common_match_id = ANY(v_requested_match_ids) THEN
    RAISE EXCEPTION 'cannot_reassign_common_match';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_requested_match_ids) AS input_match(match_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.matches AS m
      WHERE m.session_id = p_session_id
        AND m.id = input_match.match_id
    )
  ) THEN
    RAISE EXCEPTION 'match_not_in_room_pool';
  END IF;

  SELECT count(*)::integer
  INTO v_current_count
  FROM public.assignments AS a
  WHERE a.session_id = p_session_id
    AND a.participant_id = p_participant_id
    AND (v_room.common_match_id IS NULL OR a.match_id <> v_room.common_match_id);

  IF cardinality(v_requested_match_ids) IS DISTINCT FROM v_current_count THEN
    RAISE EXCEPTION 'assignment_count_mismatch';
  END IF;

  IF NOT private.drain_catalog_room_cutoff(p_session_id) THEN
    RETURN jsonb_build_object('ok',false,'code','room_processing_pending','retryAfterSeconds',1);
  END IF;

  SELECT COALESCE(array_agg(a.match_id ORDER BY a.match_id), ARRAY[]::uuid[])
  INTO v_removed_match_ids
  FROM public.assignments AS a
  WHERE a.session_id = p_session_id
    AND a.participant_id = p_participant_id
    AND (v_room.common_match_id IS NULL OR a.match_id <> v_room.common_match_id)
    AND NOT (a.match_id = ANY(v_requested_match_ids));

  SELECT COALESCE(array_agg(input_match.match_id ORDER BY input_match.match_id), ARRAY[]::uuid[])
  INTO v_added_match_ids
  FROM unnest(v_requested_match_ids) AS input_match(match_id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.assignments AS a
    WHERE a.session_id = p_session_id
      AND a.participant_id = p_participant_id
      AND a.match_id = input_match.match_id
  );

  -- A no-op is a successful request but not a reassignment event. In
  -- particular, it must not make history claim that assignments changed.
  IF cardinality(v_added_match_ids) = 0 AND cardinality(v_removed_match_ids) = 0 THEN
    RETURN jsonb_build_object(
      'sessionId', p_session_id::text,
      'participantId', p_participant_id::text,
      'addedMatchIds', to_jsonb(v_added_match_ids),
      'removedMatchIds', to_jsonb(v_removed_match_ids),
      'matchIds', to_jsonb(v_requested_match_ids),
      'sequenceNumber', NULL,
      'requestFingerprint', v_request_fingerprint,
      'requestedMatchIds', to_jsonb(v_requested_match_ids)
    );
  END IF;

  BEGIN
    -- Keep the row delta and its event in one savepoint. If a caller outside
    -- this RPC races the idempotency unique index, the whole attempted write
    -- is rolled back before the winning event is replayed below.
    DELETE FROM public.assignments AS a
    WHERE a.session_id = p_session_id
      AND a.participant_id = p_participant_id
      AND a.match_id = ANY(v_removed_match_ids)
      AND (v_room.common_match_id IS NULL OR a.match_id <> v_room.common_match_id);

    INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
    SELECT p_session_id, p_participant_id, input_match.match_id, now()
    FROM unnest(v_added_match_ids) AS input_match(match_id);

    v_sequence_number := public.allocate_event_sequence(p_session_id);
    v_response := jsonb_build_object(
      'sessionId', p_session_id::text,
      'participantId', p_participant_id::text,
      'addedMatchIds', to_jsonb(v_added_match_ids),
      'removedMatchIds', to_jsonb(v_removed_match_ids),
      'matchIds', to_jsonb(v_requested_match_ids),
      'sequenceNumber', v_sequence_number,
      'requestFingerprint', v_request_fingerprint,
      'requestedMatchIds', to_jsonb(v_requested_match_ids)
    );
    v_event_payload := v_response || jsonb_build_object(
      'resultingMatchIds', to_jsonb(v_requested_match_ids)
    );

    INSERT INTO public.gameplay_events (
      session_id,
      sequence_number,
      actor_participant_id,
      event_type,
      idempotency_key,
      payload,
      created_at
    ) VALUES (
      p_session_id,
      v_sequence_number,
      v_host_participant_id,
      'assignment_reassigned',
      p_idempotency_key::text,
      v_event_payload,
      now()
    );

    PERFORM private.assert_catalog_room_capacity(p_session_id);
  RETURN v_response;
  EXCEPTION WHEN unique_violation THEN
    SELECT e.payload, e.event_type
    INTO v_existing_payload, v_existing_event_type
    FROM public.gameplay_events AS e
    WHERE e.session_id = p_session_id
      AND e.idempotency_key = p_idempotency_key::text;

    IF FOUND
       AND v_existing_event_type = 'assignment_reassigned'
       AND v_existing_payload ->> 'requestFingerprint' = v_request_fingerprint
       AND v_existing_payload ->> 'participantId' = p_participant_id::text
       AND v_existing_payload -> 'requestedMatchIds' = to_jsonb(v_requested_match_ids) THEN
      RETURN v_existing_payload;
    END IF;

    RAISE EXCEPTION 'idempotency_key_reused';
  END;
END;
$function$;
create or replace function private.dispatch_catalog_work() returns jsonb
language plpgsql security definer set search_path='' as $$
declare policy private.provider_budget_state%rowtype; ids bigint[]; groups_due integer; live_due integer; rooms_due integer; recent integer;
  work_count integer; dispatched integer:=0; slot jsonb; project_url text; api_key text; request_id bigint; t timestamptz;
begin
  select * into policy from private.provider_budget_state where provider='espn' for update;
  if policy.capacity_measured_at is null or policy.capacity_measured_at<clock_timestamp()-interval '1 hour' then perform private.maintain_catalog_storage(); end if;
  perform private.refresh_catalog_scheduling_capacity();
  select * into policy from private.provider_budget_state where provider='espn';
  perform private.refresh_catalog_completion_due();
  t:=clock_timestamp();
  if policy.ownership_mode not in ('catalog','paused') then return jsonb_build_object('dispatched',0); end if;
  select coalesce(array_agg(id),'{}'::bigint[]) into ids from private.provider_request_groups;
  perform private.refresh_catalog_group_due(ids);
  select jsonb_array_length(private.pending_catalog_rooms(null)) into rooms_due;
  select count(*) into recent from private.provider_request_attempts where reserved_at>t-interval '60 seconds';
  select count(*),count(*) filter(where live_due_at<=t) into groups_due,live_due from private.provider_request_groups
  where policy.ownership_mode='catalog' and policy.pause_reason is null and policy.rolling_limit is not null and policy.daily_limit is not null
    and recent<policy.rolling_limit and (policy.usage_day<>(t at time zone 'UTC')::date or policy.daily_count<policy.daily_limit)
    and (policy.cooldown_until is null or policy.cooldown_until<=t) and not paused and next_attempt_at<=t
    and (cooldown_until is null or cooldown_until<=t) and (lease_until is null or lease_until<=t)
    and (live_due_at<=t or discovery_until>t or completion_due_at<=t);
  work_count:=least(2,greatest(ceil(groups_due/4.0)::integer,ceil(rooms_due/100.0)::integer));
  if work_count=0 then return jsonb_build_object('dispatched',0); end if;
  select decrypted_secret into project_url from vault.decrypted_secrets where name='match_catalog_project_url';
  select decrypted_secret into api_key from vault.decrypted_secrets where name='match_catalog_monitor_key';
  if project_url is null or project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' or api_key is null or api_key not like 'sb_secret_%' then
    return jsonb_build_object('dispatched',0,'code','configuration_required');
  end if;
  for n in 1..work_count loop
    slot:=private.acquire_provider_worker_slot(case when live_due>0 then 'live' when groups_due>0 then 'discovery' else 'replay' end,policy.worker_generation);
    exit when slot->>'ok' is distinct from 'true';
    update private.provider_worker_slots set dispatch_started_at=null where lease_token=(slot->>'dispatchToken')::uuid;
    request_id:=net.http_post(url:=project_url||'/functions/v1/run-match-monitor',headers:=jsonb_build_object('Content-Type','application/json','apikey',api_key),
      body:=jsonb_build_object('dispatchToken',slot->>'dispatchToken','workerGeneration',policy.worker_generation),timeout_milliseconds:=45000);
    update private.provider_worker_slots set dispatch_request_id=request_id where lease_token=(slot->>'dispatchToken')::uuid;
    dispatched:=dispatched+1;
  end loop;
  return jsonb_build_object('dispatched',dispatched);
end;
$$;
create or replace function private.read_match_discovery(p_league_codes text[],p_request_date date)
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
        when (not policy.new_demand_allowed or policy.scheduling_degraded) and not has_demand then 'capacity_limited' else null end as blocked_reason
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
create or replace function private.prepare_match_discovery(p_league_codes text[],p_request_date date)
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
  if can_admit_source and (policy.new_demand_allowed and not policy.scheduling_degraded) then
    insert into private.provider_request_groups(provider,league_id,resource_kind,request_date,next_attempt_at)
    select 'espn',id,'scoreboard',p_request_date,t from private.provider_leagues where provider='espn' and league_code=any(codes) on conflict(provider,scope_key) do nothing;
  end if;
  select coalesce(array_agg(g.id),'{}'::bigint[]) into ids from private.provider_request_groups g join private.provider_leagues league on league.id=g.league_id
  where league.provider='espn' and league.league_code=any(codes) and g.resource_kind='scoreboard' and g.request_date=p_request_date;
  perform private.refresh_catalog_group_due(ids);
  if can_admit_source and (policy.new_demand_allowed and not policy.scheduling_degraded) then
    update private.provider_request_groups set discovery_until=case when discovery_until>t then discovery_until else t+interval '2 minutes' end,last_used_at=t
    where id=any(ids) and (last_successful_check_at is null or last_successful_check_at<t-interval '5 minutes') and not paused and (cooldown_until is null or cooldown_until<=t);
  end if;
  update private.provider_matches set last_used_at=t where scoreboard_group_id=any(ids);
  t:=clock_timestamp();
  select coalesce(jsonb_agg(id::text order by id),'[]'::jsonb) into work_ids from private.provider_request_groups
    where can_admit_source and id=any(ids) and not paused and (lease_until is null or lease_until<=t) and (cooldown_until is null or cooldown_until<=t) and next_attempt_at<=t
    and (live_due_at<=t or discovery_until>t and (last_successful_check_at is null or last_successful_check_at<t-interval '5 minutes'));
  return jsonb_build_object('ok',true,'workerGeneration',policy.worker_generation,'workGroupIds',work_ids,'selection',jsonb_build_object('leagueCodes',codes,'date',p_request_date),'result',case when jsonb_array_length(work_ids)=0 then private.finish_match_discovery(codes,p_request_date) else private.read_match_discovery(codes,p_request_date) end);
end;
$$;
create or replace function private.catalog_room_source_status(p_room_id uuid) returns jsonb language sql stable set search_path='' as $$
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
  jsonb_build_object('lastScoresCheckedAt',status.last_checked,'providerAvailabilityReason',case when (select scheduling_degraded from private.provider_budget_state where provider='espn') then 'capacity_degraded' else status.reason end,'roomProcessingPending',status.processing)
  else jsonb_build_object('lastScoresCheckedAt',(select last_scores_checked_at from public.game_sessions where id=p_room_id),'providerAvailabilityReason',null,'roomProcessingPending',false) end from status;
$$;
