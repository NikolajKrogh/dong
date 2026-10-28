-- Disposable feature030 sizing fixture. The runner owns BEGIN/ROLLBACK and the marker.
-- No provider adapter, request reservation, scheduler invocation or HTTP is involved.
create temporary table measurement_parameters on commit drop as
select current_setting('match_catalog.measurement_marker') as marker, gen_random_uuid() as account_id, clock_timestamp() as measured_at;

create temporary table measurement_leagues on commit drop as
select row_number() over(order by league_code)::integer as n,id,league_code from private.provider_leagues
where provider='espn' and league_code in ('eng.1','esp.1','ger.1','ita.1','fra.1');
do $$ begin
  if (select count(*) from measurement_leagues)<>5 then raise exception 'Expected the fixed five measurement leagues'; end if;
  if not exists(select 1 from cron.job where jobname='match-catalog-monitor' and not active) then raise exception 'Owned measurement Cron job must exist and remain disabled'; end if;
end $$;

create temporary table measurement_teams(n integer primary key,id bigint) on commit drop;
with inserted as (
  insert into private.provider_teams(provider,source_team_id,display_name,short_name)
  select 'espn','measure-'||p.marker||'-team-'||n,'Representative Club '||n,'RC'||n from measurement_parameters p cross join generate_series(1,100) n
  returning id,source_team_id
)
insert into measurement_teams select split_part(source_team_id,'-team-',2)::integer,id from inserted;

create temporary table measurement_athletes(n integer primary key,id bigint) on commit drop;
with inserted as (
  insert into private.provider_athletes(provider,source_athlete_id,display_name)
  select 'espn','measure-'||p.marker||'-athlete-'||n,'Representative Player '||n from measurement_parameters p cross join generate_series(1,2000) n
  returning id,source_athlete_id
)
insert into measurement_athletes select split_part(source_athlete_id,'-athlete-',2)::integer,id from inserted;

create temporary table measurement_sources(n integer primary key,id bigint,league_id bigint,league_code text,home_n integer,away_n integer,request_date date,source_event_id text) on commit drop;
with fixtures as (
  select selected.n,l.id as league_id,l.league_code,((selected.n-1)%5)*20+((selected.n-1)/5)%20+1 as home_n,
    ((selected.n-1)%5)*20+(((selected.n-1)/5)%20+1)%20+1 as away_n,
    case when selected.n<=5 then (p.measured_at at time zone 'UTC')::date else (p.measured_at at time zone 'UTC')::date-1-((selected.n-1)/5)%30 end as request_date,
    'measure-'||p.marker||'-event-'||selected.n as source_event_id,p.measured_at
  from generate_series(1,1000) selected(n) join measurement_leagues l on l.n=(selected.n-1)%5+1 cross join measurement_parameters p
), inserted as (
  insert into private.provider_matches(league_id,source_event_id,source_competition_id,home_team_id,away_team_id,home_name,away_name,kickoff_at,kickoff_validity,lifecycle,raw_status,is_completed,
    home_score,away_score,period,clock_seconds,display_clock,season_year,season_type,venue_name,observation_version,last_projection_sequence,last_attempt_at,last_successful_check_at,observed_at,availability,
    completed_at,history_availability,history_is_final,history_roster_available,goals_availability)
  select f.league_id,f.source_event_id,replace(f.source_event_id,'-event-','-competition-'),h.id,a.id,'Representative Club '||home_n,'Representative Club '||away_n,
    case when f.n<=5 then f.measured_at-interval '60 minutes' else f.request_date::timestamptz+interval '18 hours' end,
    'confirmed',case when f.n<=5 then 'live' else 'finished' end,case when f.n<=5 then 'STATUS_IN_PROGRESS' else 'STATUS_FULL_TIME' end,f.n>5,
    3,3,2,5400,'90',2026,'1','Representative Ground',10,f.n*10,f.measured_at-interval '20 seconds',f.measured_at,f.measured_at,'available',
    case when f.n>5 then f.request_date::timestamptz+interval '20 hours' end,'available',f.n>5,true,'available'
  from fixtures f join measurement_teams h on h.n=f.home_n join measurement_teams a on a.n=f.away_n
  returning id,source_event_id
)
insert into measurement_sources select f.n,i.id,f.league_id,f.league_code,f.home_n,f.away_n,f.request_date,f.source_event_id from fixtures f join inserted i using(source_event_id);

insert into private.provider_request_groups(provider,league_id,resource_kind,request_date,last_successful_check_at)
select distinct 'espn',s.league_id,'scoreboard',s.request_date,p.measured_at from measurement_sources s cross join measurement_parameters p
on conflict(provider,scope_key) do nothing;
update private.provider_matches m set scoreboard_group_id=g.id from measurement_sources s join private.provider_request_groups g on g.league_id=s.league_id and g.resource_kind='scoreboard' and g.request_date=s.request_date where m.id=s.id;

insert into private.provider_match_observations(match_id,observation_version,accepted_at,attempt_sequence,source_scope,source_event_id,source_competition_id,home_score,away_score,lifecycle,kickoff_at,kickoff_validity)
select m.id,v,m.kickoff_at+v*interval '6 minutes',s.n*10+v,g.scope_key,m.source_event_id,m.source_competition_id,
  case when v<3 then 0 else least(3,(v-1)/2) end,case when v<4 then 0 else least(3,(v-2)/2) end,
  case when v=1 then 'scheduled' when v=9 then 'suspended' when v=10 and s.n>5 then 'finished' else 'live' end,m.kickoff_at,'confirmed'
from measurement_sources s join private.provider_matches m on m.id=s.id join private.provider_request_groups g on g.id=m.scoreboard_group_id cross join generate_series(1,10) v;

insert into private.provider_match_rosters(match_id,side,athlete_key,athlete_id,athlete_name,jersey,position,is_starter,did_play,minutes_played,display_order,projection_sequence)
select s.id,side,case when position=20 then 'name:Unknown Squad Member' else 'source:'||a.id end,case when position=20 then null else a.id end,
  case when position=20 then 'Unknown Squad Member' else 'Representative Player '||a.n end,position::text,case when position=1 then 'Goalkeeper' else 'Outfield' end,
  position<=11,case when position<=15 then true when position<=18 then false else null end,
  case when position<=11 then 90 when position<=15 then 30 when position<=18 then 0 else null end,position,s.n*10
from measurement_sources s cross join (values('home'),('away')) sides(side) cross join generate_series(1,20) position
join measurement_athletes a on a.n=((case when side='home' then s.home_n else s.away_n end)-1)*20+position;

insert into private.provider_match_goals(match_id,goal_key,source_play_id,side,source_team_id,source_athlete_id,athlete_name,clock,period,occurred_at,kind,display_order,changed_at)
select s.id,'play-'||goal,'measure-'||p.marker||'-'||s.n||'-play-'||goal,case when goal%2=1 then 'home' else 'away' end,t.source_team_id,a.source_athlete_id,a.display_name,
  (goal*12)::text,case when goal<=3 then 1 else 2 end,m.kickoff_at+goal*interval '12 minutes',case when goal=5 then 'penalty' else 'goal' end,goal,p.measured_at
from measurement_sources s join private.provider_matches m on m.id=s.id cross join measurement_parameters p cross join generate_series(1,6) goal
join measurement_teams mt on mt.n=case when goal%2=1 then s.home_n else s.away_n end
join private.provider_teams t on t.id=mt.id
join private.provider_athletes a on a.id=(select id from measurement_athletes where n=(mt.n-1)*20+((goal+1)/2));

insert into private.provider_goal_participants(goal_id,athlete_id,role)
select g.id,a.id,'scorer' from private.provider_match_goals g join measurement_sources s on s.id=g.match_id join private.provider_athletes a on a.source_athlete_id=g.source_athlete_id and a.provider='espn';
insert into private.provider_goal_participants(goal_id,athlete_id,role)
select g.id,a.id,'assist' from private.provider_match_goals g join measurement_sources s on s.id=g.match_id
join measurement_athletes a on a.n=((case when g.side='home' then s.home_n else s.away_n end)-1)*20+11+(g.display_order+1)/2;
-- One meaningful clock correction on 10% of goals; routine identical refreshes add none.
update private.provider_match_goals g set clock=clock||'+1',changed_at=clock_timestamp() from measurement_sources s where g.match_id=s.id and s.n%10=0;

insert into private.provider_match_team_stats(match_id,side,team_id,shot_attempts,shots_on_goal,fouls,yellow_cards,red_cards,corner_kicks,possession,is_final,observed_at,projection_sequence,
  offsides,saves,blocked_shots,penalty_kick_goals,penalty_kick_shots,accurate_passes,total_passes,pass_pct,accurate_crosses,total_crosses,cross_pct,accurate_long_balls,total_long_balls,longball_pct,
  effective_tackles,total_tackles,tackle_pct,interceptions,effective_clearance,total_clearance,shot_pct)
select s.id,side,t.id,12,6,8,2,0,4,case when side='home' then 54.2 else 45.8 end,s.n>5,p.measured_at,s.n*10,
  case when s.n%10=0 then null else 2 end,3,2,1,1,400,500,80,8,16,50,20,40,50,12,20,60,9,10,12,50
from measurement_sources s cross join (values('home'),('away')) sides(side) cross join measurement_parameters p
join measurement_teams t on t.n=case when side='home' then s.home_n else s.away_n end;

insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous)
select account_id,'authenticated','authenticated','measure-'||marker||'@test.local',measured_at,measured_at,measured_at,'{}','{}',false,false from measurement_parameters;
insert into public.accounts(id,username) select account_id,'Measure_'||marker from measurement_parameters;
create temporary table measurement_rooms(n integer primary key,id uuid) on commit drop;
with inserted as (
  insert into public.game_sessions(id,owner_account_id,join_code)
  select gen_random_uuid(),p.account_id,upper(left(p.marker,4))||lpad(n::text,4,'0') from measurement_parameters p cross join generate_series(1,100) n returning id,join_code
) insert into measurement_rooms select right(join_code,4)::integer,id from inserted;
insert into public.matches(id,session_id,source_provider,source_match_id,source_league_code,home_team_name,away_team_name,kickoff_at,catalog_match_id)
select gen_random_uuid(),r.id,'espn',s.source_event_id,s.league_code,m.home_name,m.away_name,m.kickoff_at,s.id from measurement_rooms r cross join measurement_sources s join private.provider_matches m on m.id=s.id where s.n<=5;
insert into public.assignments(session_id,participant_id,match_id)
select m.session_id,p.id,m.id from public.matches m join measurement_rooms r on r.id=m.session_id join public.participants p on p.session_id=r.id;
update public.game_sessions room set state='in_progress',common_match_id=match.id from public.matches match join measurement_sources s on s.id=match.catalog_match_id and s.n=1 where room.id=match.session_id;
-- One first-score reconciliation event per selected match/room, not six fabricated goal events.
select private.apply_saved_provider_observation(match.id,10) from public.matches match join measurement_rooms r on r.id=match.session_id;

-- Actual inserted scheduler log rows quantify the owned seven-day log allowance.
insert into cron.job_run_details(jobid,runid,database,username,command,status,return_message,start_time,end_time)
select job.jobid,-1000000-n,current_database(),'postgres',job.command,'succeeded','1 row',p.measured_at-n*interval '15 seconds',p.measured_at-n*interval '15 seconds'+interval '5 milliseconds'
from cron.job job cross join measurement_parameters p cross join generate_series(1,1000) n where job.jobname='match-catalog-monitor';
