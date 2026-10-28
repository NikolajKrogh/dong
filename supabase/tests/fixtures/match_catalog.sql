-- Load only into the disposable dong-feature030 database, inside each test transaction.
insert into private.provider_leagues(provider, league_code, display_name)
values ('espn', 'eng.1', 'English Premier League'), ('espn', 'esp.1', 'La Liga')
on conflict (provider, league_code) do nothing;

insert into private.provider_request_groups(provider, league_id, resource_kind, request_date)
select 'espn', id, 'scoreboard', current_date from private.provider_leagues
where provider = 'espn' and league_code in ('eng.1', 'esp.1')
on conflict do nothing;
