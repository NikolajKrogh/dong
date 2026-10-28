begin;
select no_plan();
\ir ../fixtures/match_catalog.sql
insert into private.provider_matches(league_id,source_event_id,home_name,away_name,lifecycle,is_completed,observation_version,last_projection_sequence)
select id,'roster-query','Home','Away','finished',true,0,200 from private.provider_leagues where league_code='eng.1';
select private.accept_provider_match_details((select id from private.provider_matches where source_event_id='roster-query'),200,
  '{"historyDetails":{"rosterEntries":[{"sourceAthleteId":"roster-1","athleteName":"Starter","side":"home","jersey":"10","position":"Forward","isStarter":true,"didPlay":true,"minutesPlayed":90},{"sourceAthleteId":"roster-2","athleteName":"Unused substitute","side":"away","isStarter":false,"didPlay":false,"minutesPlayed":0}],"teamStats":{"home":{"totalPasses":400,"passPct":82.5},"away":{"saves":3}},"availability":"available","isFinal":true,"hasMoreRosterEntries":false}}'::jsonb,clock_timestamp());
select is((select count(*)::integer from private.provider_match_rosters),2,'one roster shared by every reference');
select is((select did_play from private.provider_match_rosters where athlete_name='Unused substitute'),false,'unused substitute is not mislabelled as an appearance');
select is((private.saved_match_projection((select id from private.provider_matches where source_event_id='roster-query'),'history')#>>'{historyDetails,teamStats,home,totalPasses}'),'400','expanded final metric is queryable');
select is((private.saved_match_projection((select id from private.provider_matches where source_event_id='roster-query'),'history')#>>'{historyDetails,teamStats,home,passPct}'),'82.5','supplied percentage is preserved without recomputation');
select is((private.saved_match_projection((select id from private.provider_matches where source_event_id='roster-query'),'history')#>>'{historyDetails,teamStats,home,saves}'),null::text,'unknown expanded metric remains null');
select ok(not (private.saved_match_projection((select id from private.provider_matches where source_event_id='roster-query'),'live') ? 'historyDetails'),'live saved projection excludes larger retained detail');
select is((select count(*)::integer from private.provider_request_attempts),0,'history and live saved reads cannot acquire or pin source data');
select private.accept_provider_match_details((select id from private.provider_matches where source_event_id='roster-query'),200,
  jsonb_build_object('historyDetails',jsonb_build_object('rosterEntries',(select jsonb_agg(jsonb_build_object('sourceAthleteId','bounded-'||n,'athleteName','Squad player '||n,'side',case when n<=65 then 'home' else 'away' end)) from generate_series(1,130) n),'availability','available','isFinal',true,'hasMoreRosterEntries',true)),clock_timestamp());
select is(jsonb_array_length(private.saved_match_projection((select id from private.provider_matches where source_event_id='roster-query'),'history')#>'{historyDetails,rosterEntries}'),128,'saved history bounds public roster projection to128 entries');
select is(private.saved_match_projection((select id from private.provider_matches where source_event_id='roster-query'),'history')#>>'{historyDetails,hasMoreRosterEntries}','true','retained roster truncation is explicit');
select is(private.saved_match_projection((select id from private.provider_matches where source_event_id='roster-query'),'history')#>>'{historyDetails,availability}','partial','public roster truncation never claims complete capture');
select is((select count(*)::integer from private.provider_match_rosters),132,'public cap does not discard the full compact retained roster');
select * from finish();
rollback;
