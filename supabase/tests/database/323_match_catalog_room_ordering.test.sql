begin;
select no_plan();
\ir ../fixtures/match_catalog.sql
create temporary table ordering_context as select gen_random_uuid() as host,gen_random_uuid() as room,gen_random_uuid() as match;
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous)
select host,'authenticated','authenticated',host::text||'@order.test',now(),now(),now(),'{}','{}',false,false from ordering_context;
insert into public.accounts(id,username) select host,'OrderingHost' from ordering_context;
insert into public.game_sessions(id,owner_account_id,join_code,state) select room,host,'CATORDER','in_progress' from ordering_context;
insert into public.matches(id,session_id,source_provider,source_match_id,source_league_code,home_team_name,away_team_name,kickoff_at)
select match,room,'espn','ordering-event','eng.1','Home','Away',clock_timestamp()-interval '5 minutes' from ordering_context;
update public.game_sessions set common_match_id=(select match from ordering_context) where id=(select room from ordering_context);
select ok((select catalog_match_id is not null from public.matches where id=(select match from ordering_context)),'existing room source metadata is linked without HTTP');
select is((select observation_version from private.provider_matches where source_event_id='ordering-event'),0::bigint,'linking does not invent provider evidence');
select ok(exists(select 1 from private.catalog_demand_matches where catalog_match_id=(select catalog_match_id from public.matches where id=(select match from ordering_context))),'selected running room alone owns demand with no connected client');
select private.accept_compact_provider_match((select id from private.provider_request_groups where league_id=(select id from private.provider_leagues where league_code='eng.1') limit 1),1000,
  '{"identity":{"provider":"espn","leagueCode":"eng.1","sourceEventId":"ordering-event"},"homeTeam":{"name":"Home"},"awayTeam":{"name":"Away"},"lifecycle":"live","homeScore":1,"awayScore":0}'::jsonb,clock_timestamp());
select private.apply_saved_provider_observation((select match from ordering_context),1);

-- Saving the same selected noncommon match performs an internal delete/insert of
-- assignments. That intermediate SQL shape is not an inactive tracking interval.
create temporary table retained_selection as select gen_random_uuid() as match;
insert into public.matches(id,session_id,source_provider,source_match_id,source_league_code,home_team_name,away_team_name,kickoff_at)
select retained.match,context.room,'espn','ordering-retained','eng.1','Retained Home','Retained Away',clock_timestamp()-interval '5 minutes'
from retained_selection retained cross join ordering_context context;
insert into public.assignments(session_id,participant_id,match_id)
select context.room,participant.id,retained.match from ordering_context context cross join retained_selection retained
join public.participants participant on participant.session_id=context.room and participant.account_id=context.host;
select private.accept_compact_provider_match((select id from private.provider_request_groups where league_id=(select id from private.provider_leagues where league_code='eng.1') limit 1),2000,
  '{"identity":{"provider":"espn","leagueCode":"eng.1","sourceEventId":"ordering-retained"},"homeTeam":{"name":"Retained Home"},"awayTeam":{"name":"Retained Away"},"lifecycle":"live","homeScore":2,"awayScore":0}'::jsonb,clock_timestamp());
select private.apply_saved_provider_observation((select match from retained_selection),1);
select set_config('request.jwt.claim.sub',(select host::text from ordering_context),true);
select lives_ok($configuration$
  select private.save_running_game_configuration(context.room,jsonb_build_object(
    'assignmentMode','host_assigned','matchesPerPlayer',1,'sharedMatchesPerPair',0,'newMatches','[]'::jsonb,
    'assignments',jsonb_build_array(jsonb_build_object('participantId',participant.id,'matchId',retained.match))),
    private.running_configuration_token(context.room),gen_random_uuid())
  from ordering_context context cross join retained_selection retained
  join public.participants participant on participant.session_id=context.room and participant.account_id=context.host
$configuration$,'unchanged selected match can be saved through the existing configuration command');
set constraints all immediate;
select is((select tracking_started_observation_version from public.matches where id=(select match from retained_selection)),1::bigint,'unchanged noncommon selection preserves its original accepted tracking anchor');
select is((select last_applied_observation_version from public.matches where id=(select match from retained_selection)),1::bigint,'intermediate assignment replacement cannot erase the durable source cursor');
set constraints all deferred;

select private.accept_compact_provider_match((select id from private.provider_request_groups where league_id=(select id from private.provider_leagues where league_code='eng.1') limit 1),1000+n,
  jsonb_build_object('identity',jsonb_build_object('provider','espn','leagueCode','eng.1','sourceEventId','ordering-event'),'homeTeam',jsonb_build_object('name','Home'),'awayTeam',jsonb_build_object('name','Away'),'lifecycle','live','homeScore',n+1,'awayScore',0),clock_timestamp()) from generate_series(1,25) n;
select set_config('request.jwt.claim.sub',(select host::text from ordering_context),true);
select is(private.end_game_session((select room from ordering_context)),'{"ok":false,"code":"room_processing_pending","retryAfterSeconds":1}'::jsonb,'bounded cutoff returns exact committed pending response');
select is((select state::text from public.game_sessions where id=(select room from ordering_context)),'in_progress','pending does not complete requested game');
select is((select last_applied_observation_version from public.matches where id=(select match from ordering_context)),21::bigint,'twenty accepted observations commit before pending');
select is((select count(*)::integer from public.gameplay_events where session_id=(select room from ordering_context) and event_type='session_completed'),0,'pending does not record terminal success');
select is(private.end_game_session((select room from ordering_context))->>'status','completed','original request can complete after remaining cutoff drains');
select is((select last_applied_observation_version from public.matches where id=(select match from ordering_context)),26::bigint,'completion drains every accepted cutoff observation');
select is((select home_score from public.matches where id=(select match from ordering_context)),26,'completion history sees accepted score');
select ok(not exists(select 1 from private.catalog_demand_matches where catalog_match_id=(select catalog_match_id from public.matches where id=(select match from ordering_context))),'completed room stops normal demand');
select is((select count(*)::integer from private.provider_request_attempts),0,'command retries and saved consequence work acquire nothing');
select * from finish();
rollback;
