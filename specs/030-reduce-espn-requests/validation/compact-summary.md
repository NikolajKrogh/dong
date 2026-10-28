# Compact summary normalization — 2026-10-26

The pure `normalizeEspnSummary(payload, leagueCode, sourceEventId)` export reuses the existing scoreboard normalization for strict event/competition identity, status, score and kickoff facts. It extracts only roster participation, selected scalar team metrics and identifiable goal events from the already bounded summary response. The shared public `SavedHistoryDetails` contract is unchanged.

Primary-source verification used Exa and the maintainer's repository, without requesting any ESPN endpoint:

- [SportsDataverse soccer Site v2 reference](https://py.sportsdataverse.org/docs/soccer/reference/site) documents summary sections and the reviewed metric/lineup fields.
- [Soccer parser source](https://github.com/sportsdataverse/sportsdataverse-py/blob/main/sportsdataverse/soccer/soccer_espn_parsers.py) confirms `rosters[].roster[]`, `boxscore.teams[].statistics[]`, `keyEvents[].participants[].athlete`, and competition status/finality paths.
- [Common summary parser](https://github.com/sportsdataverse/sportsdataverse-py/blob/main/sportsdataverse/_common_espn_parsers.py) confirms explicit `didNotPlay` appearance metadata in box-score athlete records. Soccer availability of that optional field is not assumed.

The small synthetic fixture uses these verified paths; it is not a newly downloaded provider sample. Shirt/position/name metadata is compact. A starter flag alone does not invent an appearance; explicit substitution/DNP metadata is used where present, contradictory evidence stays unknown, and minutes are never inferred from the clock or a presumed 90-minute duration. Only an explicitly supplied valid numeric `minutesPlayed` is retained; that optional field is not a promised league-coverage feature.

Internal roster projection is capped at 256 entries and flags omitted content. More than 128 retained entries sets the public remaining-detail flag; the SQL public projection still owns its 128-entry response bound. Missing optional sections remain null/unavailable, unknown scalar values remain null, unreviewed metrics and all commentary/news/images/profiles are dropped. Enrichment is matched to the header's team IDs rather than accepted solely on a home/away label.

Identifiable key goal events retain corrections, shootout distinction and involved participant identities. Array order never supplies scorer/assist roles; only an explicit supported role is kept. Own-goal team metadata does not establish which side received the goal, so its credited side stays null. Optional internal `participants` adds correction evidence without changing the public goal contract.

Verification: both pure-provider suites passed **19 tests**; global TypeScript and Deno checks passed; changed-source lint passed. A failing six-case missing-export checkpoint preceded implementation. No device, E2E, provider HTTP or hosted database test was run. Completion attempt scheduling, persistence, roster/stat retention and public projection truncation remain coordinator-owned integration work.
