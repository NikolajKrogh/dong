# ESPN soccer data research for DONG

Research date: 2026-10-25. Design research only; no production configuration or application code changed.

## Evidence and limits

Exa returned 10 search results across two searches: soccer scoreboard fields, and soccer match-detail/event fields. Relevant first-hand client documentation and implementation sources were reviewed. Two ESPN response samples were then successfully inspected directly: the English Premier League scoreboard for 2026-10-25 and summary for event 401879254. This is evidence of available fields in those responses, not a coverage guarantee for every league, match, or lifecycle state.

Sources:

- [ESPN scoreboard sample](https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20261025)
- [ESPN summary sample](https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=401879254)
- [SportsDataverse soccer site API client documentation](https://py.sportsdataverse.org/docs/soccer/reference/site)
- [SportsDataverse soccer core game API client documentation](https://py.sportsdataverse.org/docs/soccer/reference/core/game)
- [World Cup client implementation using ESPN](https://docs.rs/wc-data/latest/src/wc_data/backends/espn.rs.html)
- [Community soccer endpoint catalogue](https://github.com/pseudo-r/Public-ESPN-API/blob/main/docs/sports/soccer.md)

Exa could not extract the JSON scoreboard and failed to retrieve the historical summary example from client documentation. A direct historical date-range request also returned HTTP 400. The successful direct samples used a known-working single-date scoreboard query and an event ID obtained from that response. No repeated polling or league sweep was performed. Date-range support was not established by the successful samples.

## Recommended match-level data

Store an individual match once, independent of the room combinations referencing it. Continue batching transport by league/date where the scoreboard supplies multiple matches.

| Data | Observed provider fields | DONG purpose and retention |
| --- | --- | --- |
| Match identity | Event `id`, `uid`; competition `id`, `uid`; league metadata | Long-term identity and joins. Keep IDs as strings. Do not assume event ID and competition ID are always interchangeable. |
| Teams | Competitor `homeAway`; team `id`, `uid`, `displayName`, `shortDisplayName`, `abbreviation`, logo | Stable team joins plus display snapshots for historical games. Team metadata can be shared separately. |
| Schedule | Event `date`; competition `date`, `startDate`, `timeValid` | Schedule first monitoring at the known kickoff. Preserve the provider validity flag and accepted schedule changes. Do not invent a precise kickoff when the time is unknown. |
| Lifecycle | `status.type.id`, `name`, `state`, `completed`, `description`, `detail`, `shortDetail` | Store raw status identifiers and a normalized DONG status. The detailed status is needed to distinguish periods and exceptional states; broad state alone loses information. |
| Match clock | `status.clock`, `displayClock`, `period` | Current match presentation and event context. Keep the original display clock for stoppage time. Update current state without appending a permanent observation on every clock tick. |
| Scores | Competitor `score`, `winner`; summary competitor `linescores` | Store home/away scores and structured period scores where populated. Preserve room history separately from later provider corrections. |
| Season | Event `season.year`, `type`, `slug` | Historical grouping and display. Preserve competition-specific values rather than assuming numeric season type has universal meaning across sports. |
| Venue | Venue `id`, `fullName`, city, country | Low-cost historical display metadata; optional for gameplay. |
| Detail availability | Competition `playByPlayAvailable`, `playByPlayAthletes`, `wasSuspended` | Capability hints and recovery context. Field existence does not guarantee complete event coverage. |
| Provenance | DONG-generated `observed_at`, last successful fetch, relevant-content hash/version, parser version | Explain what DONG knew and when; process room consequences idempotently. These are our metadata, not promised ESPN fields. |

In the inspected scoreboard, a match had broad state `in`, detailed name `STATUS_SECOND_HALF`, `completed: false`, period 2, numeric clock 5400, and display clock `90'+3'`. This illustrates why the raw status and display clock matter alongside normalized state.

## Event details available without an extra request

The scoreboard's competition `details` contained entries with:

- `type.id` and `type.text`;
- `clock.value` and `clock.displayValue`;
- `team.id`;
- `scoreValue`, `scoringPlay`, `redCard`, `yellowCard`;
- `penaltyKick`, `ownGoal`, `shootout`;
- `athletesInvolved` with athlete IDs, names, and sometimes position/jersey metadata.

These fields could enrich a goal/card timeline from the existing scoreboard request. The inspected detail entries did not contain independent event IDs. A constructed fingerprint is a reconciliation aid, not proof of a stable provider event identity. Own goals need explicit crediting logic; the player's team must not automatically be treated as the side awarded the goal.

## Summary adds identifiable events

The inspected summary had `keyEvents`, `commentary`, `header`, `boxscore`, `rosters`, and other sections. A key goal event contained:

| Field | Example from sample |
| --- | --- |
| `id` | `54281457` |
| `type.id`, `type.type` | `70`, `goal` |
| `period.number` | `2` |
| `clock.value`, `clock.displayValue` | `2810`, `47'` |
| `team.id` | `361` |
| `participants[].athlete.id` | Present for two involved athletes |
| `wallclock` | `2026-10-25T15:03:33Z` |
| `scoringPlay`, `shootout` | `true`, `false` |
| `source.id`, `source.description` | Present |

The summary also exposed a root `wallclockAvailable` field. Persist a supplied event timestamp separately from DONG's `observed_at`, and permit missing event timestamps. Neither timestamp should overwrite the other.

Preserve involved participants and explicit roles when supplied. The inspected participant array did not identify roles explicitly, so its array order alone is insufficient to label scorer versus assister. Avoid deriving important gameplay facts by parsing narrative commentary.

For future use, individual provider events could be stored with match ID, provider event ID, type, team, involved athletes, period/clock, optional provider timestamp, first/last observed timestamps, and revision information. Notification deduplication should additionally include recipient and notification kind. Provider ID presence in one response is not proof that IDs never change during corrections.

## Optional statistics and richer data

The scoreboard already included team statistics such as possession percentage, total shots, shots on target, fouls, corners, assists, and goals. Save selected statistics at completion if a historical match-detail screen needs them; fetching them does not require extra requests when they are present in a scoreboard already being consumed.

The summary/client documentation also exposes lineups, player participation, formations, substitutions, detailed statistics, commentary, and shootout data. These are candidates for optional enrichment, not prerequisites for recording score changes. Coordinate meanings and coverage should be validated before building shot maps.

The inspected ongoing league match did not establish penalty-shootout or aggregate-score semantics. Treat in-match penalty goals, shootout attempts, aggregate scores, match scores, and winner flags as distinct concepts. Verify a cup/shootout fixture before defining those contracts.

Odds, articles, videos, and full commentary are low priority for DONG's current scheduling/history requirement and should not drive additional routine requests.

## Request-conscious enrichment policy

1. Discovery acquires fixtures and known kickoff times; save the useful fields already present.
2. No recurring score polling before known kickoff, as requested by the user.
3. Due live matches share one bounded league/date fetch, with persistent leases, freshness, and a global request budget.
4. Accept scoreboard observations and room consequences independently of optional detail enrichment.
5. When scores change, optionally request one shared match summary to reconcile identified goal events and enrich notifications. Summaries are per real match, not per room or recipient. Coalesce multiple changes and respect the budget.
6. A summary failure must not prevent accepted score updates. Retry enrichment with cooldown and an explicit delayed-notification policy.
7. Perform a bounded completion reconciliation if details are enabled; do not poll archived matches indefinitely.

A score change between polls may represent several goals. Scoreboard totals still need a working fallback when event detail is incomplete. Summary fetching only on score changes also cannot guarantee discovery of every card, non-score event, or score-neutral correction. Do not promise complete play-by-play under that policy.

## Corrections and historical integrity

Store immutable accepted score/status changes, and provider event revisions where useful. Do not treat a missing event in one partial response as a confirmed retraction. The samples did not establish a dependable VAR/retraction contract; this requires separate targeted validation before automated reversal behavior.

Latest shared provider state may change while completed room history retains its original observations, assignments, and committed consequences. Any later room correction should be explicit and auditable.

## Proposed first scope

Keep match identities, team identities/display metadata, known kickoff plus validity, raw/normalized status, latest scores, selected match-clock fields, season/league identity, optional venue, and provenance. Preserve meaningful score/status/schedule changes, not every identical poll.

Add identified goal events through optional summary enrichment if richer notifications/history justify the additional requests. Save cheap final team-stat snapshots only when a product feature will use them. Defer full commentary, rosters, shot maps, media, and odds.

The research did not establish an official ESPN rate allowance, long-term schema guarantees, complete coverage across DONG's supported leagues, stable event-ID behavior under VAR corrections, or historical availability for all fixtures. No database schema, worker, or notification implementation was changed.

## Follow-up: should DONG switch to ESPN v3?

Investigated on 2026-10-25 using two further Exa searches (10 returned results), the current endpoint catalogue, ESPN's Core v3 WADL, and direct soccer Site v3 probes.

Different API families must be distinguished:

- Site v2: `site.api.espn.com/apis/site/v2/...`, used by DONG for soccer discovery and scores and inspected successfully in the original research.
- Candidate Site v3: `site.api.espn.com/apis/site/v3/...`. The current community catalogue marks this section as unverified; older forks still describe it as richer. This is not evidence of a working soccer migration path.
- Core v3: `sports.core.api.espn.com/v3/...`. Its endpoint description is reachable, but this does not make Core v3 a replacement for the Site scoreboard/summary family.
- Common/Web v3: `site.web.api.espn.com/apis/common/v3/...`, another API family covering resources such as athlete profiles in client documentation.

Direct evidence:

| Request | Result |
| --- | --- |
| [Site v3 soccer scoreboard, eng.1, 20261025](https://site.api.espn.com/apis/site/v3/sports/soccer/eng.1/scoreboard?dates=20261025) | HTTP 404, `{"code":404}` |
| [Site v3 soccer summary, event 401879254](https://site.api.espn.com/apis/site/v3/sports/soccer/eng.1/summary?event=401879254) | HTTP 404, `{"code":404}` |
| [Core v3 application.wadl](https://sports.core.api.espn.com/v3/application.wadl) | HTTP 200; endpoint description includes athlete and related resource paths. Advertisement is not proof that every route works for soccer. |

The first probe command received the responses but its body-formatting code failed on byte-array content. The two Site v3 requests were repeated once with curl to record their statuses and bodies. No working Site v3 schema was obtained, so a genuine field-by-field v2/v3 soccer migration comparison is not possible from this evidence.

Current caller impact, checked against DONG source:

- Java `RestClientEspnClient` constructs a league/date scoreboard URL and deserializes into `EspnScoreboardResponse`; errors propagate into discovery. Changing to the tested Site v3 URL would break fixture loading.
- Multiplayer Edge `fetchScoreboards` expects an `events` scoreboard and `normalizeProviderResults` matches provider event IDs and competitor scores. Changing to the tested Site v3 URL would fail upstream fetches and leave accepted room scores stale.
- Solo `useLiveScores` has hardcoded Site v2 scoreboard URLs and `processApiMatch` reads the Site v2 event/competition structure. Changing the Java or Edge base URL does not migrate solo callers.
- Existing room history need not change merely because the transport changes, provided a future adapter preserves provider identity, normalized observations, and idempotent processing. Identity equivalence must be checked before a new family is adopted.

Recommendation: retain Site v2 scoreboard and summary for the proposed cache, scheduling, and richer match storage. Keep raw provider schemas at the ingestion boundary and store a stable DONG representation with source endpoint/family and parser version for provenance. Evaluate individual v3 resources only when they provide a verified missing capability. Do not run permanent duplicate v2/v3 polling to compare them; use a small bounded sample and saved response fixtures if a working candidate is supplied.

Additional source links:

- [Current catalogue: Site API v3 unverified](https://github.com/pseudo-r/Public-ESPN-API#site-api-v3-unverified)
- [SportsDataverse API family architecture](https://py.sportsdataverse.org/docs/architecture/espn-cross-league)

No code, database, deployment, or production configuration was changed by this follow-up.
