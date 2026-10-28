begin;
select no_plan();
\ir ../fixtures/match_catalog.sql
create temporary table application_match as
select jsonb_build_object('identity',jsonb_build_object('provider','espn','leagueCode','eng.1','sourceEventId','application-event'),
  'homeTeam',jsonb_build_object('name','Home','sourceTeamId','app-h'),'awayTeam',jsonb_build_object('name','Away','sourceTeamId','app-a'),
  'lifecycle','live','homeScore',1,'awayScore',0,'availability','available','goalsAvailability','available','hasMoreGoals',false,
  'homeTeamStatistics',jsonb_build_object('shotAttempts',5,'possession',60),'awayTeamStatistics',jsonb_build_object('shotAttempts',null),
  'goals',jsonb_build_array(jsonb_build_object('sourcePlayId','play-1','side','home','sourceTeamId','app-h','sourceAthleteId','scorer-1','athleteName','Scorer','clock','12','kind','goal','isRetracted',false))) as item;
select ok(private.accept_compact_provider_match((select id from private.provider_request_groups limit 1),100,(select item from application_match),clock_timestamp()),'accept base match');
select lives_ok($$select private.accept_provider_match_details((select id from private.provider_matches where source_event_id='application-event'),100,(select item from application_match),clock_timestamp())$$,'save compact detail');
select is((select count(*)::integer from private.provider_match_goals),1,'one compact goal stored');
select is((select count(*)::integer from private.provider_match_team_stats),1,'all-null stat object does not allocate a row');
select is((select count(*)::integer from private.provider_goal_participants),1,'scorer identity is queryable without an athlete profile');
select is((private.saved_match_projection((select id from private.provider_matches where source_event_id='application-event'),'live')#>>'{homeTeamStatistics,shotAttempts}'),'5','saved live projection exposes accepted current metrics');
select is((private.saved_match_projection((select id from private.provider_matches where source_event_id='application-event'),'live')#>>'{homeTeamStatistics,fouls}'),null::text,'unknown metrics remain null');
select lives_ok($$select private.accept_provider_match_details((select id from private.provider_matches where source_event_id='application-event'),100,(select item from application_match),clock_timestamp())$$,'repeated detail acceptance is idempotent');
select is((select count(*)::integer from private.provider_match_goals),1,'repeated goal is not duplicated');
select private.accept_provider_match_details((select id from private.provider_matches where source_event_id='application-event'),99,'{"homeTeamStatistics":{"shotAttempts":1},"goals":[{"sourcePlayId":"older","kind":"goal"}]}'::jsonb,clock_timestamp());
select is((select shot_attempts from private.provider_match_team_stats limit 1),5,'older cross-resource detail cannot replace a newer metric');
select is((select count(*)::integer from private.provider_match_goals),1,'older cross-resource detail cannot append misleading goals');
select ok(not has_function_privilege('anon','private.accept_provider_match_details(bigint,bigint,jsonb,timestamptz)','execute'),'detail ingest is not public');
select * from finish();
rollback;
