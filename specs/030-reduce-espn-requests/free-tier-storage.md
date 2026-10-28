# Free-tier storage policy: compact match facts, goals, and rosters

**Date**: 2026-10-25
**Status**: Current storage recommendation; supersedes the full-source-archive proposal in storage-design.md

The user requires remaining on Supabase Free and explicitly wants match rosters retained because seeing who played is useful. Preserve compact data with an identified use; do not build a permanent archive of everything ESPN returned.

## Capacity constraint

Supabase's published Free plan currently includes 500 MB database size and 1 GB file storage. Data, indexes, other application records, and platform usage need headroom. File storage is a separate quota, not a solution for an unlimited source archive. The documentation also distinguishes database-size allowance from physical disk/WAL limits; neither should be treated as a target to fill completely.

Sources checked on 2026-10-25:

- [Supabase pricing](https://supabase.com/pricing)
- [Database size and physical disk behavior](https://supabase.com/docs/guides/platform/database-size)
- [Storage quota](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size)

Initial planning allowance: aim to keep the shared provider feature within 100 MB including its indexes, with bounded disposable cache/diagnostics inside that allowance. This is an operator-adjustable capacity target, not a claim that 100 MB is already available or a guaranteed number of matches. Reserve capacity for accounts, private game history, existing active games, and maintenance. Check organization-wide usage as well as this feature's relations before activation.

## Keep long term for server-referenced matches; snapshot solo detail locally

| Data | Compact retained representation |
| --- | --- |
| Match identity and result | Provider/event/competition/league IDs, home/away team identities and names, kickoff and validity, final status and score, distinct scoring contexts where understood, season, last successful check |
| Gameplay evidence | Meaningful accepted score/schedule/lifecycle changes and observation versions needed to explain or replay retained room history; existing room baselines and consequences remain separate |
| Goals | Available goal ID, credited team, involved player IDs/names, clock/period, provider time when supplied, DONG observation time, penalty/own-goal/shootout distinctions, and corrections relevant to retained gameplay |
| Match squad and participation | Match/player/team links, player name through shared identity, shirt number, position, starter status, explicit appearance/substitution information, and minutes only when supplied or reliably established |
| Expanded final team statistics | One final supported scalar statistic set per team: possession; shots/on-target/blocked shots; penalty attempts/goals; fouls/corners/offsides/saves/cards; passes/crosses/long balls attempted and completed; tackles attempted and successful; interceptions/clearances; and supplied percentages with understood meanings. Unknown remains null. No per-minute statistic history |
| Small optional context | Venue name/ID, season and concise match notes only when already supplied, understood, and inside the capacity allowance |

Keep one provider match and one roster regardless of room count. Provider team/player identity records are shared. Do not repeat full player profiles for every match or store a mutable current club as historical match membership.

Server-side protection lasts while retained multiplayer room history references the match. Solo completion/history access may copy already saved compact goals, roster participation and statistics into a self-contained private local history snapshot, including display values rather than bare server IDs. This uses the bounded saved-only `history` projection and causes no ESPN request or permanent anonymous retention pin. Captured local details survive server-cache eviction under existing local history/deletion rules. Details never downloaded before expiry may be unavailable; this feature does not promise remote preservation of every solo game's uncaptured roster. Do not copy bearer grants into history/export payloads or upload local player data.

### Roster accuracy

An unused substitute was in the squad but did not necessarily play. Preserve separate supplied facts for squad membership, starter status, appearance, and substitutions. Do not label the entire roster as players who appeared. Unavailable participation data must remain unknown.

Store one compact current roster while a match is active and settle it at completion. Do not archive the roster on every poll. Retain meaningful participation records for matches referenced by retained game history. Names/jerseys/positions need no downloaded headshots, biographies, career statistics, or social/media content.

### Expanded final team statistics

Retaining more final scalar team metrics is compatible with the compact policy. The [SportsDataverse soccer summary client reference](https://py.sportsdataverse.org/docs/soccer/reference/site) lists saves, offsides, penalty goals/attempts, passes, crosses, long balls, tackles, interceptions and clearances, alongside the previously selected metrics. This is evidence of supported client fields, not a coverage guarantee for each ESPN league or match. No new ESPN request was made for this documentation check.

Extract the supported values already present in the shared scoreboard or bounded completion summary. Use one current/final row per match/team, with typed commonly queried fields and a small numeric extras map where justified. Do not introduce a row per metric per poll or retain the full box score to save a few numbers. Keep metric identity/units and distinguish counts from percentages. Preserve a supplied percentage as reported if retained; recomputing from rounded counts can differ.

An initial planning allowance of 2-5 KB per match for approximately 20-30 metrics per team would add 2-5 MB per 1,000 matches or 20-50 MB per 10,000. These are illustrative table/payload allowances, not measured PostgreSQL/index sizes. This is substantially smaller than raw timelines, but still counts toward the 100 MB provider target alongside rosters and other records. Confirm actual persisted sizes before activation.

Full player-by-player statistical histories are not added by this choice. Useful compact player figures can be considered when already present in a roster response and their meaning is verified; do not fetch individual athlete endpoints to fill gaps. Rich metrics such as expected goals must not be promised without separate coverage/definition verification.

## Keep briefly, or replace in place

- Current match clock, latest operational state, freshness, due times, fetch ownership, and failure cooldowns.
- Discovered but unused fixtures: a bounded short-lived cache, default 24 hours since last relevant demand; never retain every browsed league indefinitely.
- Completed provider matches not referenced by retained game history: default 30-day cache, then eligible for eviction before referenced match data.
- Optional debug response bodies: disabled by default; when explicitly enabled, maximum 24 hours and 5 MB total, with credentials excluded. This is a diagnostic cap, not a provider-data archive.
- Detailed request diagnostics: short-lived and capped; keep daily aggregate request counts for 90 days. Prefer counters over storing a row for every healthy poll forever.

Data still required by unfinished room processing or an active game is protected from disposable-cache eviction. Account/history deletion continues to follow existing application rules, not a new silent retention policy.

## Do not retain in this feature

- Full scoreboard/summary documents as long-term JSONB or compressed source archives.
- Every poll, every changing match clock, every intermediate statistics snapshot, or every source-field revision.
- Full commentary, articles, videos, images/headshots, odds, predictions, standings snapshots, shot coordinates, and career/player-profile data.
- Every card/substitution as a separate rich event with unlimited revision history. Keep useful card totals and compact match participation; preserve only evidence required by gameplay.
- Unknown fields solely because they might be useful someday. Those fields may be lost; staying on Free takes priority over exhaustive preservation.

The earlier promise that every field and source version could later be reconstructed no longer applies. The retained compact projection is intentional; it is not a lossless copy of all received ESPN data.

## Fetching rosters without undermining request reduction

Use metadata already available in normal budgeted requests first. If a tracked real match needs a roster, one shared completion-summary fetch can supply the final squad/participation and enrich goal details; discard the rest after extracting the selected fields. A single retry may be allowed within the existing bounded completion allowance and global provider budget. Do not fetch a summary separately for every room.

Routine live summary polling remains disabled by default. No dedicated player profile, team-roster, career, commentary, or statistics crawl is required. Missing roster coverage must be shown as unavailable instead of causing a league-wide or player-by-player request sweep. A failed enrichment must never block valid scoreboard processing.

## Lean logical model

- Shared competition/team/player identities, with small display metadata.
- Shared matches with latest state and final result.
- Compact match score/lifecycle observations required for replay and provenance.
- Compact goal occurrences with identified participants and necessary corrections.
- Match/player participation rows for the roster and who appeared.
- One final team-statistics row per match/team.
- Existing room matches referencing shared matches, with authoritative room scores/history and processing receipts preserved.
- Small global fetch/budget state, bounded discovery cache, and capped request diagnostics/aggregates.

No permanent source staging, archive catalogue, object bucket, complete source-document table, full athlete profile history, or generic per-field/per-poll statistic table is required. Keep targeted indexes for match lookup, due work, goal timeline, player participation, and shared-match-to-room processing.

## Space estimates and their limits

Previous real samples measured approximately 11.1 KB compact JSON per scoreboard match and 401 KB for a full summary. The full-timeline model reached approximately 4.6 GB of gzip payloads for 10,000 matches under its 120-plus-six-snapshot assumption, excluding database/metadata overhead. That proposal is unsuitable as the default on this user's Free tier.

A read-only PostgreSQL sizing query measured illustrative typed record datums, not inserted table rows:

| Prototype | pg_column_size |
| --- | ---: |
| Match/player/team link, starter flag, shirt number, position, two optional substitution values | 58 bytes |
| Shared player identity and example display name | 59 bytes |
| Compact goal identity, team, clock, timestamp and two flags | 82 bytes |

These numbers exclude actual heap/page overhead, indexes, extra chosen fields, shared identity references and growth, and maintenance space. They must not be presented as physical per-row capacity guarantees.

For conservative planning, allow roughly 10-20 KB per 40-person match squad after identity/index/field overhead, until insertion benchmarks establish the real figure. That is about 10-20 MB per 1,000 matches or 100-200 MB per 10,000, for roster-related storage alone. Shared identities and narrow internal keys can improve this; bigger squads or retained extras can increase it. Core match records, goals, statistics, and private room history are additional.

The main saving comes from retaining a handful of compact facts per player/event once, rather than 120 copies of large nested documents. Table count is secondary to row width, repeated data, and indexes. Many rooms referencing a match do not duplicate its roster.

## Staying free as usage grows

1. Measure provider-table/index bytes and whole-project usage, not merely payload size.
2. Evict expired unused fixtures and diagnostics first. Stop optional enrichment/extra statistics when their allowance is exhausted; preserve valid scores and existing history.
3. Retain rosters for actually played/referenced matches rather than all discovered fixtures. Do not silently remove referenced rosters or gameplay evidence under generic cache cleanup.
4. Keep the background coordinator shared; avoid one scheduled function invocation per room. The published Free plan also has function, egress, and Realtime allowances, so storage is not the only operational constraint.
5. Before protected data alone exhausts remaining capacity, surface an operator-visible capacity decision and prevent new persistent tracking that cannot fit safely while preserving capacity for existing work. Do not auto-upgrade, introduce paid storage, silently omit accepted goals, or delete history to conceal quota pressure.

An indefinitely growing user base and permanent history cannot be guaranteed within a fixed free allowance. At modest volume this compact design can be practical; growth eventually requires an explicit retention/export policy or limits on new activity. That decision should be based on measured usage, not the assumption that all small records fit forever.

## Implementation evidence still required

Benchmark representative persisted match/goal/roster/stat records, their indexes, and room history growth in a disposable database. Test quota-pressure behavior, bounded cache cleanup, null/unused-substitute handling, shared roster fetches, and replay without raw response archives. No schema or production changes were made by this policy document.
