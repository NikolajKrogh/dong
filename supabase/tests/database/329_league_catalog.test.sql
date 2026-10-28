begin;
select no_plan();

select is((select count(*)::integer from private.provider_leagues where provider='espn'),121,'seed preserves every supported league identity');
select is((select display_name from private.provider_leagues where league_code='eng.1'),'Premier League','seed retains the curated readable name');
select is((select category from private.provider_leagues where league_code='eng.1'),'Europe','seed retains geographic grouping');
select is((select array_agg(league_code order by default_order) from private.provider_leagues where default_order is not null),
  array['eng.1','eng.2','ger.1','esp.1','ita.1','fra.1','den.1'],'seven configured defaults retain their ordering');
select is((select array_agg(league_code order by default_order) from private.provider_leagues where is_default_selected),
  array['eng.1','eng.2'],'only the existing two initial selections are selected by default');
select ok(not exists(select 1 from private.provider_leagues where display_name=league_code),'seeded leagues all have readable names');
select ok(not has_table_privilege('anon','private.provider_leagues','SELECT,INSERT,UPDATE,DELETE'),
  'public callers have no direct catalog table privileges');
select ok(not has_table_privilege('authenticated','private.provider_leagues','SELECT,INSERT,UPDATE,DELETE'),
  'registered callers cannot mutate catalog policy');
select ok(to_regprocedure('public.list_leagues()') is null,'no frontend catalog-loading RPC remains');
select ok(to_regprocedure('private.list_leagues()') is null,'no private metadata-loading function remains');

select is(private.prepare_match_discovery(array['eng.1'],(clock_timestamp() at time zone 'UTC')::date)->>'ok','true',
  'a seeded league is accepted by discovery');
select is(private.prepare_match_discovery(array['missing.1'],(clock_timestamp() at time zone 'UTC')::date)->>'code','unsupported_league',
  'unknown leagues remain rejected by the saved catalog');

-- Disabling discovery does not invalidate an already saved match or its tracking cadence.
update private.provider_leagues set is_enabled=false where league_code='eng.1';
select is(private.prepare_match_discovery(array['eng.1'],(clock_timestamp() at time zone 'UTC')::date)->>'code','unsupported_league',
  'disabled league cannot admit new discovery demand');
insert into private.provider_matches(league_id,source_event_id,home_name,away_name,lifecycle,kickoff_at,kickoff_validity)
select id,'disabled-league-event','Home','Away','live',clock_timestamp()-interval '30 minutes','confirmed'
from private.provider_leagues where league_code='eng.1';
select ok(private.catalog_match_due_at(m,clock_timestamp()) is not null,'existing match remains eligible for tracking in a disabled league')
from private.provider_matches m where source_event_id='disabled-league-event';
select is(jsonb_array_length(public.read_saved_matches(array[(select id::text from private.provider_matches where source_event_id='disabled-league-event')])->'matches'),1,
  'existing saved matches remain readable in a disabled league');
select is((select count(*)::integer from private.provider_request_attempts),0,'metadata validation never fetches ESPN');
select * from finish();
rollback;
