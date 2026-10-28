begin;
select no_plan();
\ir ../fixtures/match_catalog.sql

select ok(private.accept_compact_provider_match((select g.id from private.provider_request_groups g join private.provider_leagues l on l.id=g.league_id where l.league_code='eng.1' limit 1),100,
  jsonb_set('{"identity":{"provider":"espn","leagueCode":"eng.1","sourceEventId":"catalog-event","sourceCompetitionId":"catalog-competition"},"homeTeam":{"sourceTeamId":"h","name":"Home"},"awayTeam":{"sourceTeamId":"a","name":"Away"},"kickoffValidity":"confirmed","lifecycle":"live","homeScore":2,"awayScore":1,"availability":"available"}'::jsonb,'{kickoffAt}',to_jsonb(clock_timestamp()-interval '5 minutes')),clock_timestamp()),'seed accepted shared fact');

create temporary table catalog_fixture as select id::text as id from private.provider_matches where source_event_id='catalog-event';
grant select on catalog_fixture to anon,authenticated;
create temporary table attempts_before as select count(*) as total from private.provider_request_attempts;
create temporary table use_before as select last_used_at from private.provider_matches where source_event_id='catalog-event';

set local role anon;
select is(jsonb_array_length(public.read_saved_matches(array[(select id from catalog_fixture)])->'matches'),1,'anonymous client can read sanitized public match facts');
select is(public.read_saved_matches(array[(select id from catalog_fixture)])#>>'{matches,0,identity,sourceCompetitionId}','catalog-competition','actual competition identity survives public projection');
select is(public.read_saved_matches(array[(select id from catalog_fixture)])#>>'{matches,0,homeScore}','2','saved score is readable without provider work');
select is(public.read_saved_matches(array[(select id from catalog_fixture)])#>>'{matches,0,period}',null::text,'missing period is not zero');
select ok(not ((public.read_saved_matches(array[(select id from catalog_fixture)])#>'{matches,0}') ? 'leaseToken'),'public projection excludes acquisition authority');
select is(jsonb_array_length(public.read_saved_matches(array[]::text[])->'matches'),0,'empty saved read succeeds');
select is(public.read_saved_matches(array['9223372036854775807'])->'missingCatalogMatchIds','["9223372036854775807"]'::jsonb,'opaque missing bigint IDs remain strings');
select throws_ok($$select public.read_saved_matches(array['-1'])$$,'22023','invalid_selection','invalid ID rejected before coercion');
select throws_ok($$select public.read_saved_matches(array['9223372036854775808'])$$,'22023','invalid_selection','overflowing ID safely rejected');
select throws_ok($$select public.read_saved_matches(array['1'],'raw')$$,'22023','invalid_selection','unknown projection rejected');
select throws_ok($$select public.read_saved_matches(array(select n::text from generate_series(1,101) n))$$,'22023','projection_too_large','live read has 100-ID bound');
select throws_ok($$select public.read_saved_matches(array(select n::text from generate_series(1,21) n),'history')$$,'22023','projection_too_large','history read has 20-ID bound');
select ok((public.read_saved_matches(array[(select id from catalog_fixture)],'history')#>'{matches,0,historyDetails}') ? 'rosterEntries','history projection reports saved detail availability');
reset role;

select is((select count(*) from private.provider_request_attempts),(select total from attempts_before),'saved reads create no source attempts');
select is((select last_used_at from private.provider_matches where source_event_id='catalog-event'),(select last_used_at from use_before),'saved reads do not renew demand/cache lifetime');
select ok(not has_table_privilege('anon','private.provider_matches','select'),'sanitized reader gives no table access');
select ok(not has_function_privilege('anon','private.accept_provider_response(bigint,uuid,bigint,jsonb)','execute'),'saved reader gives no write authority');

with sized as (
  insert into private.provider_matches(league_id,source_event_id,home_name,away_name,home_score,away_score,goals_availability)
  select (select league_id from private.provider_matches where source_event_id='catalog-event'),'sized-'||n,'Home','Away',100,0,'available' from generate_series(1,5) n returning id
)
insert into private.provider_match_goals(match_id,goal_key,source_play_id,source_team_id,source_athlete_id,athlete_name,clock,kind,display_order)
select sized.id,'play-'||n,'play-'||n||repeat('x',100),repeat('t',128),repeat('a',128),repeat('n',160),repeat('c',40),'goal',n from sized cross join generate_series(1,100) n;
set local role anon;
select throws_ok($$select public.read_saved_matches(array(select id::text from private.provider_matches where source_event_id like 'sized-%'))$$,'42501',null,'public caller cannot enumerate internal rows to bypass bounded reader');
reset role;
select throws_ok($$select public.read_saved_matches(array(select id::text from private.provider_matches where source_event_id like 'sized-%'))$$,'22023','projection_too_large','serialized saved projection has a 256-KB cap');

insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous)
values('00000000-0000-4030-8000-000000000101','authenticated','authenticated','catalog-host@test.local',now(),now(),now(),'{"provider":"email"}','{}',false,false);
insert into public.accounts(id,username) values('00000000-0000-4030-8000-000000000101','Catalog_Host');
insert into public.game_sessions(id,owner_account_id,join_code,state)
values('00000000-0000-4030-8000-000000000201','00000000-0000-4030-8000-000000000101','CATALOG1','in_progress');
insert into public.matches(id,session_id,source_provider,source_match_id,source_league_code,home_team_name,away_team_name,catalog_match_id)
values('00000000-0000-4030-8000-000000000401','00000000-0000-4030-8000-000000000201','espn','catalog-event','eng.1','Home','Away',(select id::bigint from catalog_fixture));
update public.game_sessions set common_match_id='00000000-0000-4030-8000-000000000401' where id='00000000-0000-4030-8000-000000000201';
select is(private.apply_saved_provider_observation('00000000-0000-4030-8000-000000000401',1)->>'changed','true','first saved pair reconciles a selected active room');
select is((select home_score::text||'-'||away_score from public.matches where id='00000000-0000-4030-8000-000000000401'),'2-1','initial absolute score preserves existing 0-0 adoption semantics');
select is((select count(*)::integer from public.gameplay_events where session_id='00000000-0000-4030-8000-000000000201' and event_type='provider_score_changed'),1,'score jump produces one snapshot event, not invented individual goals');
select ok((select actor_kind='provider' and actor_participant_id is null and room_match_id='00000000-0000-4030-8000-000000000401' and provider_observation_version=1 from public.gameplay_events where session_id='00000000-0000-4030-8000-000000000201' and event_type='provider_score_changed'),'trusted provider attribution has typed source evidence and no imaginary participant');
select is(private.apply_saved_provider_observation('00000000-0000-4030-8000-000000000401',1)->>'isReplay','true','saved observation replay is idempotent');
select is((select count(*)::integer from public.gameplay_events where session_id='00000000-0000-4030-8000-000000000201' and event_type='provider_score_changed'),1,'replay creates no duplicate consequence');
select throws_ok($$insert into public.gameplay_events(session_id,sequence_number,event_type,idempotency_key,payload,actor_kind) values('00000000-0000-4030-8000-000000000201',999,'provider_score_changed','missing-actor','{}','participant')$$,'23514',null,'participant event still requires a real participant actor');
select ok(not has_function_privilege('authenticated','private.apply_saved_provider_observation(uuid,bigint)','execute'),'user cannot apply source evidence directly');
select ok(not has_function_privilege('anon','private.apply_saved_provider_observation(uuid,bigint)','execute'),'public match reader cannot invoke trusted room processing');

insert into public.game_sessions(id,owner_account_id,join_code,state)
values('00000000-0000-4030-8000-000000000209','00000000-0000-4030-8000-000000000101','CATPURGE','in_progress');
insert into public.matches(id,session_id,source_provider,source_match_id,source_league_code,home_team_name,away_team_name,catalog_match_id)
values('00000000-0000-4030-8000-000000000409','00000000-0000-4030-8000-000000000209','espn','catalog-event','eng.1','Home','Away',(select id::bigint from catalog_fixture));
update public.game_sessions set common_match_id='00000000-0000-4030-8000-000000000409' where id='00000000-0000-4030-8000-000000000209';
select private.apply_saved_provider_observation('00000000-0000-4030-8000-000000000409',1);
update public.game_sessions set common_match_id=null where id='00000000-0000-4030-8000-000000000209';
select throws_ok($$delete from public.matches where id='00000000-0000-4030-8000-000000000409'$$,'23503',null,'retained provider events protect their typed room-match evidence');
select lives_ok($$delete from public.gameplay_events where session_id='00000000-0000-4030-8000-000000000209';
  delete from public.matches where session_id='00000000-0000-4030-8000-000000000209';
  delete from public.participants where session_id='00000000-0000-4030-8000-000000000209';
  delete from public.game_sessions where id='00000000-0000-4030-8000-000000000209'$$,'explicit ordered session cleanup remains possible without orphaning provider evidence');

update private.provider_budget_state set ownership_mode='catalog',rolling_limit=30,daily_limit=5000,new_demand_allowed=true where provider='espn';
create temporary table issuance as select private.prepare_solo_tracking(repeat('11',32),repeat('22',32),'00000000-0000-4030-8000-000000000501','key-1',array[(select id from catalog_fixture)]) as result;
select is((select result->>'ok' from issuance),'true','finite selected solo demand can be admitted');
select is((private.prepare_solo_tracking(repeat('11',32),repeat('22',32),'00000000-0000-4030-8000-000000000501','key-2',array[(select id from catalog_fixture)])->>'issuanceId'),(select result->>'issuanceId' from issuance),'unexpired creation recovers the original server issuance across current-key changes');
select is((private.prepare_solo_tracking(repeat('11',32),repeat('99',32),'00000000-0000-4030-8000-000000000501','key-1',array[(select id from catalog_fixture)])->>'code'),'operation_conflict','changed creation body cannot reuse nonce authority');
select is((private.finalize_solo_tracking((select (result->>'issuanceId')::uuid from issuance),repeat('11',32),repeat('33',32),false)->>'selectionVersion'),'1','capability digest is finalized without plaintext storage');
select ok((select octet_length(nonce_digest)=32 and octet_length(grant_digest)=32 from private.solo_tracking_grants),'only fixed-length credential digests are stored');
select is((private.replace_solo_tracking(repeat('33',32),1,'00000000-0000-4030-8000-000000000502',repeat('44',32),array[]::text[])->>'state'),'ended','empty replacement ends finite demand');
select is((private.replace_solo_tracking(repeat('33',32),1,'00000000-0000-4030-8000-000000000502',repeat('44',32),array[]::text[])->>'isReplay'),'true','identical end replay consumes no new admission');
select is((private.replace_solo_tracking(repeat('33',32),1,'00000000-0000-4030-8000-000000000502',repeat('99',32),array[]::text[])->>'code'),'operation_conflict','same operation with changed content cannot replay');
select is((private.replace_solo_tracking(repeat('33',32),1,'00000000-0000-4030-8000-000000000504',repeat('88',32),array[]::text[])->>'code'),'tracking_conflict','fresh operation cannot bypass a stale selection version');
select is((private.prepare_solo_tracking(repeat('11',32),repeat('22',32),'00000000-0000-4030-8000-000000000501','key-1',array[(select id from catalog_fixture)])->>'state'),'ended','creation recovery does not restore a replaced/ended selection');
update private.solo_tracking_grants set created_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute';
select is((private.replace_solo_tracking(repeat('33',32),2,'00000000-0000-4030-8000-000000000505',repeat('77',32),array[]::text[])->>'code'),'tracking_expired','expired token is denied before any replacement');
select is((private.prepare_solo_tracking(repeat('11',32),repeat('22',32),'00000000-0000-4030-8000-000000000501','key-1',array[(select id from catalog_fixture)])->>'code'),'tracking_expired','expired issuance cannot recover authority');
delete from private.solo_tracking_grants;
create temporary table fresh_issuance as select private.prepare_solo_tracking(repeat('11',32),repeat('22',32),'00000000-0000-4030-8000-000000000501','key-1',array[(select id from catalog_fixture)]) as result;
select isnt((select result->>'issuanceId' from fresh_issuance),(select result->>'issuanceId' from issuance),'post-cleanup admission allocates a new immutable issuance identity');
select is((select result->>'isReplay' from fresh_issuance),'false','post-cleanup admission is counted as new');
select is((private.replace_solo_tracking(repeat('33',32),1,'00000000-0000-4030-8000-000000000503',repeat('66',32),array[]::text[])->>'code'),'invalid_tracking_grant','purged issuance never revives the previous token');
select ok(not has_function_privilege('anon','private.prepare_solo_tracking(text,text,uuid,text,text[])','execute'),'public client cannot allocate authority directly in SQL');

select ok(private.accept_compact_provider_match((select g.id from private.provider_request_groups g join private.provider_leagues l on l.id=g.league_id where l.league_code='eng.1' limit 1),101,
  '{"identity":{"provider":"espn","leagueCode":"eng.1","sourceEventId":"other-event","sourceCompetitionId":"other-competition"},"homeTeam":{"sourceTeamId":"h","name":"Home"},"awayTeam":{"sourceTeamId":"a","name":"Away"},"lifecycle":"live","homeScore":3,"awayScore":1,"availability":"available"}'::jsonb,clock_timestamp()),'second valid observation belongs to another shared match');
select throws_ok($$insert into public.gameplay_events(session_id,sequence_number,event_type,idempotency_key,payload,actor_kind,room_match_id,catalog_match_id,provider_observation_version)
  select '00000000-0000-4030-8000-000000000201',999,'provider_score_changed','wrong-source','{}','provider','00000000-0000-4030-8000-000000000401',id,1 from private.provider_matches where source_event_id='other-event'$$,
  '23503',null,'valid observation for a different catalog match cannot authorize this room match');
select throws_ok($$insert into public.gameplay_command_results(session_id,idempotency_key,command_type,actor_participant_id,request_fingerprint,response)
  values('00000000-0000-4030-8000-000000000201','00000000-0000-4030-8000-000000000599','provider_score',null,'fake','{}')$$,'23502',null,'participant command results still forbid an absent actor');

insert into private.provider_request_groups(provider,league_id,resource_kind,request_date)
select 'espn',(select id from private.provider_leagues where league_code='eng.1'),'scoreboard',current_date+n from generate_series(1,3) n;
update private.provider_request_groups set next_attempt_at=clock_timestamp(),discovery_until=clock_timestamp()+interval '2 minutes';
create temporary table first_slot as select private.acquire_provider_worker_slot('live',1) as result;
create temporary table second_slot as select private.acquire_provider_worker_slot('live',1) as result;
select is(private.acquire_provider_worker_slot('discovery',1)->>'code','workers_busy','a third source owner cannot allocate another slot');
create temporary table first_wave as select private.claim_provider_batch(array(select id from private.provider_request_groups),'discovery',(select (result->>'dispatchToken')::uuid from first_slot),1) as result;
create temporary table second_wave as select private.claim_provider_batch(array(select id from private.provider_request_groups),'discovery',(select (result->>'dispatchToken')::uuid from second_slot),1) as result;
select is(jsonb_array_length((select result->'claims' from first_wave)),4,'one worker reserves at most four groups in one wave');
select is(jsonb_array_length((select result->'claims' from second_wave)),1,'the second worker skips owned groups and reserves the fifth shared group');
select is((select count(*)::integer from private.provider_request_attempts),5,'the two waves reserve each of five groups once');
insert into private.provider_request_groups(provider,league_id,resource_kind,request_date,next_attempt_at,discovery_until)
select 'espn',(select id from private.provider_leagues where league_code='eng.1'),'scoreboard',current_date+4,clock_timestamp(),clock_timestamp()+interval '2 minutes';
select is(jsonb_array_length(private.claim_provider_batch(array(select id from private.provider_request_groups),'discovery',(select (result->>'dispatchToken')::uuid from second_slot),1)->'claims'),0,'reused dispatch cannot start another wave even when its first wave had one group');
select ok(not has_function_privilege('match_catalog_backend','private.claim_provider_request(bigint,text,uuid,bigint)','execute'),'backend must use the bounded batch entrance');

insert into private.provider_leagues(provider,league_code,display_name) values('espn','ger.1','Bundesliga') on conflict do nothing;
select is(private.prepare_match_discovery(array['../../bad'],current_date)->>'code','unsupported_league','unsupported discovery never falls back to a sweep');
select is(private.prepare_match_discovery(array['eng.1'],current_date+8)->>'code','date_out_of_range','discovery calendar range is bounded by database UTC day');
select is(private.prepare_match_discovery(array[]::text[],current_date)#>>'{result,availability}','available','empty explicit discovery succeeds without source work');
create temporary table cold_discovery as select private.prepare_match_discovery(array[' ger.1 ','ger.1'],current_date) as result;
select is((select result#>>'{result,availability}' from cold_discovery),'pending','cold data is pending rather than a successfully empty match day');
select is(jsonb_array_length((select result->'workGroupIds' from cold_discovery)),1,'cold duplicate league requests share one canonical group');
create temporary table cold_expiry as select discovery_until from private.provider_request_groups where league_id=(select id from private.provider_leagues where league_code='ger.1');
select is(private.read_match_discovery(array['ger.1'],current_date)->>'availability','pending','saved discovery status can be read without acquiring');
select is((select discovery_until from private.provider_request_groups where league_id=(select id from private.provider_leagues where league_code='ger.1')),(select discovery_until from cold_expiry),'saved discovery read does not renew finite cold demand');
select is((select count(*)::integer from private.provider_request_attempts),5,'discovery preparation and reads make no HTTP reservations');
select is(private.accept_provider_response(a.id,a.lease_token,1,'{"matches":[],"isPartial":false}'::jsonb)->>'ok','true','controlled valid empty board is accepted')
from private.provider_request_attempts a join private.provider_request_groups g on g.id=a.group_id join private.provider_leagues l on l.id=g.league_id where l.league_code='esp.1';
select is(private.prepare_match_discovery(array['esp.1'],current_date)#>>'{result,availability}','available','fresh successfully empty discovery is reused');
select is(jsonb_array_length(private.prepare_match_discovery(array['esp.1'],current_date)->'workGroupIds'),0,'fresh overlap admits no additional source work');

insert into private.provider_leagues(provider,league_code,display_name) values('espn','fra.1','French League') on conflict do nothing;
update private.provider_budget_state set daily_count=daily_limit where provider='espn';
select is(private.prepare_match_discovery(array['fra.1'],current_date)#>>'{result,groups,0,reason}','budget_exhausted','budget exhaustion remains an explicit deferral');
select is((select count(*)::integer from private.provider_request_groups where league_id=(select id from private.provider_leagues where league_code='fra.1')),0,'a budget-denied request does not enqueue a cold group');
update private.provider_budget_state set daily_count=0,cooldown_until=clock_timestamp()+interval '10 minutes' where provider='espn';
select is(private.prepare_match_discovery(array['fra.1'],current_date)#>>'{result,groups,0,reason}','provider_cooldown','provider cooldown survives a new discovery request');
select is((select count(*)::integer from private.provider_request_groups where league_id=(select id from private.provider_leagues where league_code='fra.1')),0,'a cooldown-denied request does not enqueue a cold group');

select * from finish();
rollback;
