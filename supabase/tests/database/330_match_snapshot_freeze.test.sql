begin;
select no_plan();
\ir ../fixtures/match_catalog.sql.inc
select ok(private.accept_compact_provider_match((select g.id from private.provider_request_groups g join private.provider_leagues l on l.id=g.league_id where l.league_code='eng.1' limit 1),100,
  jsonb_set('{"identity":{"provider":"espn","leagueCode":"eng.1","sourceEventId":"catalog-event","sourceCompetitionId":"catalog-competition"},"homeTeam":{"sourceTeamId":"h","name":"Home"},"awayTeam":{"sourceTeamId":"a","name":"Away"},"kickoffValidity":"confirmed","lifecycle":"live","homeScore":2,"awayScore":1,"availability":"available"}'::jsonb,'{kickoffAt}',to_jsonb(clock_timestamp()-interval '5 minutes')),clock_timestamp()),'seed accepted shared fact');

create temporary table catalog_fixture as select id::text as id from private.provider_matches where source_event_id='catalog-event';
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous)
values('00000000-0000-4030-8000-000000000101','authenticated','authenticated','catalog-host@test.local',now(),now(),now(),'{"provider":"email"}','{}',false,false);
insert into public.accounts(id,username) values('00000000-0000-4030-8000-000000000101','Catalog_Host');
insert into public.game_sessions(id,owner_account_id,join_code,state)
values('00000000-0000-4030-8000-000000000201','00000000-0000-4030-8000-000000000101','CATALOG1','in_progress');
insert into public.matches(id,session_id,source_provider,source_match_id,source_league_code,home_team_name,away_team_name,catalog_match_id)
values('00000000-0000-4030-8000-000000000401','00000000-0000-4030-8000-000000000201','espn','catalog-event','eng.1','Home','Away',(select id::bigint from catalog_fixture));
update public.game_sessions set common_match_id='00000000-0000-4030-8000-000000000401' where id='00000000-0000-4030-8000-000000000201';

update public.participants set current_drink_total=4 where session_id='00000000-0000-4030-8000-000000000201' and account_id='00000000-0000-4030-8000-000000000101';
create function pg_temp.observe(home integer,away integer,status text) returns boolean language sql as $$
 select private.accept_compact_provider_match(
   (select g.id from private.provider_request_groups g join private.provider_leagues l on l.id=g.league_id where l.league_code='eng.1' limit 1),(select last_projection_sequence+1 from private.provider_matches where source_event_id='catalog-event'),
   jsonb_build_object('identity',jsonb_build_object('provider','espn','leagueCode','eng.1','sourceEventId','catalog-event','sourceCompetitionId','catalog-competition'),
     'homeTeam',jsonb_build_object('sourceTeamId','h','name','Home'),'awayTeam',jsonb_build_object('sourceTeamId','a','name','Away'),
     'kickoffValidity','confirmed','kickoffAt',clock_timestamp()-interval '5 minutes','lifecycle',status,'homeScore',home,'awayScore',away,'availability','available'),clock_timestamp());
$$;
select is(private.apply_saved_provider_observation('00000000-0000-4030-8000-000000000401',1)->>'changed','true','initial saved pair applies');
select is((select catalog_snapshot->>'lifecycle' from public.matches where id='00000000-0000-4030-8000-000000000401'),'live','room captures canonical lifecycle');
select ok(pg_temp.observe(1,null,'suspended'),'new partial correction accepted');
select is(private.apply_saved_provider_observation('00000000-0000-4030-8000-000000000401',2)->>'changed','true','known corrected side applies even when other side is unknown');
select is((select home_score::text||'-'||away_score from public.matches where id='00000000-0000-4030-8000-000000000401'),'1-1','correction lowers accepted goals and unknown side preserves prior accepted score');
select is((select catalog_snapshot->>'awayScore' from public.matches where id='00000000-0000-4030-8000-000000000401'),null::text,'unknown projected score stays null');
select is((select current_drink_total::text from public.participants where session_id='00000000-0000-4030-8000-000000000201' and account_id='00000000-0000-4030-8000-000000000101'),'4.0','correction never changes user-entered drinks');
select is(private.apply_saved_provider_observation('00000000-0000-4030-8000-000000000401',2)->>'isReplay','true','correction replay is idempotent');
select is(private.apply_saved_provider_observation('00000000-0000-4030-8000-000000000401',1)->>'isReplay','true','stale observation cannot reverse correction');
select is((select count(*)::integer from public.gameplay_events where session_id='00000000-0000-4030-8000-000000000201' and event_type='provider_score_changed'),2,'two accepted score changes produce two audit events');
select ok(pg_temp.observe(null,null,'canceled'),'status-only cancellation accepted');
select private.apply_saved_provider_observation('00000000-0000-4030-8000-000000000401',3);
select is((select home_score+away_score from public.matches where id='00000000-0000-4030-8000-000000000401'),2,'cancellation preserves accepted goals and weighted obligations');
select is(private.build_guest_room_snapshot('00000000-0000-4030-8000-000000000201')#>>'{matches,0,catalogSnapshot,lifecycle}','canceled','guest projection keeps persistent cancellation label');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4030-8000-000000000101","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.end_game_session('00000000-0000-4030-8000-000000000201')$$,'host freezes ended game');
reset role;
create temporary table frozen_history as select matches from public.completed_session_summaries where session_id='00000000-0000-4030-8000-000000000201';
select is((select matches#>>'{0,catalogSnapshot,lifecycle}' from frozen_history),'canceled','completed history includes captured lifecycle');
select ok(pg_temp.observe(8,8,'finished'),'later catalog observation accepted');
select is(private.apply_saved_provider_observation('00000000-0000-4030-8000-000000000401',4)->>'code','not_eligible','ended room refuses later catalog updates');
select is((select matches from public.completed_session_summaries where session_id='00000000-0000-4030-8000-000000000201'),(select matches from frozen_history),'ended history remains byte-equivalent after later score and lifecycle');
select is((select current_drink_total::text from public.participants where session_id='00000000-0000-4030-8000-000000000201' and account_id='00000000-0000-4030-8000-000000000101'),'4.0','completion and later updates preserve user consumption');
select ok(not has_function_privilege('anon','private.apply_saved_provider_observation(uuid,bigint)','execute'),'snapshot migration does not grant anonymous write authority');
select * from finish();
rollback;
