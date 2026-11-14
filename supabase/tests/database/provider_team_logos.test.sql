begin;
select plan(4);

select is(
  private.valid_espn_team_logo('https://a.espncdn.com/i/teamlogos/soccer/500/3129.png'),
  'https://a.espncdn.com/i/teamlogos/soccer/500/3129.png',
  'accepts the exact ESPN badge URL'
);
select is(private.valid_espn_team_logo('http://a.espncdn.com/badge.png'), null::text, 'requires HTTPS');
select is(private.valid_espn_team_logo('https://espncdn.com.example.org/badge.png'), null::text, 'rejects lookalike hosts');

select private.backfill_history_team_logos();
select is(private.backfill_history_team_logos(), 0::bigint, 'history enrichment is repeatable');

select * from finish();
rollback;
