# Proposed match-data storage design

**Date**: 2026-10-25
**Status**: Historical full-preservation proposal, superseded by [the free-tier policy](free-tier-storage.md); no schema or production change
**Priority**: Reduce ESPN requests, make common queries straightforward, and preserve already-received source data for future use.

## Recommendation

The user subsequently required remaining on Supabase Free and chose compact rosters while agreeing to omit exhaustive raw archives. The current recommendation is in [free-tier-storage.md](free-tier-storage.md). The remainder of this document preserves the earlier investigation and measurements; its full-source-archive tables and long-term raw retention are not current feature requirements.

Use relational records for identity, current match state, meaningful changes, events, participants, and common statistics. Preserve the latest complete per-match source documents separately as queryable JSONB. Preserve the full received timeline in a private compressed source archive, with short-lived durable staging and a small archive catalogue in Postgres.

This is one shared provider dataset. It is never copied in full into every room. Existing room-specific match IDs, baselines, assignments, manual adjustments, scores, and event history retain their meaning.

Do not restrict the model to a fixed table count. Also do not normalize every arbitrary source field into its own row: common predicates deserve typed columns; sparse and not-yet-understood fields can remain in JSONB and the source archive.

## Evidence collected

- The linked project reports PostgreSQL 17.6 with default TOAST compression `pglz`. Its database occupied approximately 20.5 MB at the read-only check; this is current occupancy, not a quota or future capacity estimate.
- The hosted `public.matches` table is room-specific: it contains `session_id`, source provider/event/league fields, team names, kickoff, and room scores. Replacing its IDs with global match IDs would break the distinction between provider facts and room consequences.
- The existing private refresh lease is keyed by session. Keep room-processing idempotency while moving upstream fetch coordination to the shared request group.
- Two bounded ESPN requests supplied one five-event Premier League scoreboard and one match summary. Measurements were made in memory; complete response bodies were not saved as research artifacts. No production data was changed.
- [Measured sample sizes](../../exa-results/espn-provider-data-2026-10-25/storage-measurements.json) contain the exact byte counts, sample URLs, acquisition timestamp, and forecast assumptions.

## Query patterns that drive the model

1. Fetch the current state of the few matches selected by a room or solo game.
2. Find scheduled/live tracked matches due for monitoring, grouped into league/date requests.
3. Find fixtures for one league/date range or one team without fetching ESPN again while data remains suitable.
4. Read a chronological goal/card timeline for a match, including corrections and identified participants.
5. Find goals involving a particular player, keeping scorer/assister roles unknown unless explicitly established.
6. Compare final possession, shots, corners, or other common statistics across matches and teams.
7. Reconstruct what DONG knew when a particular room consequence was committed.
8. Count provider attempts, reused demand, failures, cooldowns, and budget deferrals.
9. Extract a newly useful field from previously captured documents without new ESPN requests.

Queries 1-8 should use small indexed relational records or bounded latest-document lookups. Rare arbitrary historical source queries may require loading an archive segment or rebuilding a derived projection; compressed object archives are not directly queryable JSONB tables.

## Proposed logical tables

Names below are design vocabulary, not committed migration names. Provider data and write paths belong behind restricted access, with controlled application reads.

| Table or existing record | Responsibility and grain |
| --- | --- |
| `provider_competitions` | One provider competition/league identity and display metadata. Season identifiers remain explicit on matches; a separate season table is needed only when season-level relationships justify it. |
| `provider_teams` | One provider team identity with current display metadata. Historical match documents and game display snapshots retain older names/logos. |
| `provider_athletes` | One provider athlete identity, current display metadata, and provider references. Team membership belongs to match participation, not an overwritten global athlete-team field. |
| `provider_matches` | One shared real match: competition and source IDs, team references, kickoff and validity, detailed/normalized lifecycle, current scores, period/clock, optional venue/season data, and current accepted observation/version. Keep this record small. |
| `provider_match_changes` | Append-only meaningful score, status, schedule, or correction observations. Contains the accepted version, observation time, optional provider time, relevant before/after values, and source document reference. Do not emit a gameplay change for every clock tick. |
| `provider_match_team_stats` | At most one current/final statistics row per match/team. Typed nullable columns for common metrics; JSONB extras preserve sparse supported metrics. Do not create one row per statistic per poll. |
| `provider_match_players` | One match/athlete participation record where supplied: team, starter status, position, jersey, substitutions, and selected player statistics, with JSONB extras. Do not infer absent lineup information. |
| `provider_events` | One logical provider occurrence anchored to a match and source namespace, with the latest accepted event revision. An internal key does not imply a missing external event ID is known. |
| `provider_event_versions` | Append-only substantive revisions of an event: kind, credited team, period/clock, optional occurrence time, score context when supplied, and source references/qualifiers. This preserves corrections without appending the same event at every fetch. |
| `provider_event_participants` | Participants attached to an event revision, with athlete identity, supplied role, and original participant order. Roles can be null; order is never treated as proof of a scorer or assist. |
| `provider_match_documents` | One latest document per match/resource kind, such as scoreboard event or match summary, plus limited shared context. JSONB retains all supplied fields for bounded ad hoc queries. Large documents are separate from frequently read match rows. |
| `provider_snapshot_staging` | Durable short-lived source captures awaiting verified archive packing. Includes full per-match document, resource/fetch context reference, timestamps, hash, and capture sequence. Repeated identical adjacent responses can share content while preserving their observation range/count. |
| `provider_archive_segments` | A small searchable catalogue of immutable compressed match/resource segments: match, kind, time range, sequence range, count, content hash, storage key, bytes, codec, and verification state. Each segment contains its own version/timestamp manifest. |
| `provider_fetch_state` | Small mutable request coordination keyed by provider/league/request date and relevant request options: due time, lease/fencing token, cooldown, failure category, and demand. No raw document and no room ownership here. |
| `provider_request_budget_state` | Global request allowance and consumption used once per actual upstream attempt. Retry/enrichment/discovery attempts consume the same budget. |
| `provider_request_attempts` | Short-lived operational records of request purpose, group, timings, outcomes, and safe cache/response metadata. Keep aggregate usage longer than individual attempts if useful. |
| Existing room matches and processing receipts | Add a validated shared-provider-match reference while preserving existing room match UUIDs, baseline, and history. Record consumed provider versions/receipts to make room processing effectively once. Do not embed shared source payloads here. |

The latest records are convenient projections; source documents and append-only accepted changes preserve the evidence used to produce them. A projection can be rebuilt without re-fetching ESPN.

## Identity, constraints, and types

- Use compact internal relational keys for provider-only entities, while preserving external identifiers as text. Keep existing room UUIDs unchanged. Internal key choice does not determine the externally exposed contract.
- Match identity must include the provider and validated competition/event namespace. Do not merge events across leagues or assume event ID equals competition ID without evidence. Track multiple source identifiers explicitly if a new resource requires them.
- Use foreign keys and uniqueness constraints for canonical identities, match/team stats, match/athlete participation, provider event identities when supplied, and room-processing receipts. Missing external event IDs must not be replaced by a supposedly authoritative hash identity.
- Match scores and count statistics are nullable non-negative integers. A null is unknown, not zero. Percentages and other measured values use appropriate numeric types and per-field validity checks. Do not force unrelated period/shootout/aggregate values into the normal score.
- Absolute instants use timezone-aware timestamps. Period and source match-clock values remain separate from absolute provider occurrence and DONG observation times. Preserve stoppage-time display text.
- Prefer explicit typed predicates for frequently queried attributes and modest JSONB extras for sparse facts. No full-text index or wide JSONB index is needed merely to preserve information.
- Do not cascade deletion of a shared provider match into room history. Retained references constrain archival/deletion policy, and source/player records contain no room credentials or private user drafts.

## Query-oriented indexes

Choose final indexes from actual queries and measured execution plans. Initial candidates:

- Unique provider identity indexes for competitions, teams, athletes, and matches.
- Matches: `(competition_id, kickoff_at, id)` for discovery; `(home_team_id, kickoff_at, id)` and `(away_team_id, kickoff_at, id)` when team history is queried. Match-ID joins use the primary key.
- Fetch state: `(next_attempt_at, id)` with a static partial predicate for enabled work. Do not put `now()` into a partial-index predicate. Expired lease and due-time conditions belong in the claim query.
- Match changes: unique `(match_id, observation_version)` and chronological `(match_id, observed_at, id)` when both ordering modes are needed.
- Events: `(match_id, event_order, id)` and an external-identity uniqueness rule scoped to its verified source namespace. Event versions use `(event_id, revision)`; participant queries use `(athlete_id, event_version_id)`.
- Team stats: primary/unique `(match_id, team_id)` and `(team_id, match_id)` when cross-match team queries need it. Player participation has analogous match/player and player/match access.
- Documents: unique `(match_id, resource_kind)`; archive catalogue: `(match_id, resource_kind, first_observed_at, id)`.
- Existing room matches: index the new shared-match foreign key so one observation can find eligible rooms. Keep room authorization and lifecycle filters.
- Attempts: a time-oriented index for bounded reporting and retention; add BRIN or partitioning only when observed volume/access makes it useful.

Avoid indexing every possible JSON property. If a future query routinely filters an extra field, promote it to a typed column or add a targeted expression index. A GIN index is useful for demonstrated containment workloads, not every archival payload.

## Preserve all acquired data without duplicating it per room

1. Record the actual fetch context once: resource family/version, provider league/date/options, safe response metadata, and acquisition time. Never archive authentication headers, guest tokens, or private room data.
2. Split scoreboard events into individual match documents. Preserve relevant response-level metadata as a shared context document referenced by the captures; do not duplicate the full league envelope into every match.
3. Persist each received per-match snapshot durably before considering its capture complete. Unknown fields must survive even when the gameplay parser ignores them or rejects a normalized projection.
4. Hash a defined canonical JSON representation including all supplied field values. Do not omit clocks/statistics to claim lossless deduplication. Source-capture identity is independent of semantic gameplay-change identity.
5. If the same content reappears after an intervening change, preserve the new occurrence in the capture timeline even when the underlying content can be reused. An A -> B -> A sequence must not collapse to A -> B.
6. Preserve all distinct captures in an immutable, compressed match/resource segment, with acquisition times, resource/context references, schema/codec version, and hashes. Pack bounded segments periodically or after completion; do not create a permanent database row or object per tiny poll when the same queryability can be maintained by a segment manifest.
7. Keep a full latest/final match document in JSONB for direct queries. Keep normalized current facts and substantive event versions readily queryable. Older raw timelines are recoverable from the archive, not discarded.
8. Upload through the Storage API, verify checksum/content/manifest, commit the catalogue location, and only then remove staged payloads. Storage upload and database writes are not a single transaction; retries must be idempotent, and unverified staging cannot be age-purged. Handle orphan uploads with a separate verified reconciliation process.

This preserves parsed JSON information. JSONB does not preserve original whitespace, object-key ordering, or duplicate object keys. If byte-for-byte HTTP evidence becomes a requirement, archive original response bytes as a separate explicitly defined artifact; the per-match semantic archive is not a claim to retain exact wire bytes.

## Why separate the archive from the operational database?

Postgres JSONB is useful for queryable current/final documents. Large values may be TOAST-compressed, but that does not make a forever-growing raw timeline free or equivalent to gzip. Large JSONB indexes, repeated updates, index maintenance, WAL, backups, and vacuum add costs beyond JSON string length.

A private Supabase Storage bucket can hold immutable compressed archive objects while Postgres holds the records needed for gameplay and queries. This uses an existing project platform, not a new third-party service. Supabase Storage stores object metadata in Postgres and object bytes outside it; metadata and indexes still consume database space. Storage bytes, requests, and egress have their own capacity/cost implications.

Cross-system archive recovery and access must be designed before implementation. Start with simple gzip segments and a versioned manifest rather than a custom chain of JSON patches: independent segments are easier to verify and replay. Segment size limits must prevent a long-running or anomalous match from creating an unbounded object or memory task.

If all history must remain directly queryable through ordinary SQL without archive extraction, retain the source timeline in a separate Postgres JSONB table instead. That is simpler to query but accepts the larger database and index footprint. The recommendation favors easy routine queries plus recoverable future data over immediate SQL access to every old raw field.

## Measured sizes and transparent forecasts

The measurement fetched one scoreboard containing five matches and one summary. It measured compact UTF-8 JSON and individual gzip compression in memory. The summary included rosters, commentary, articles/media metadata, and other sections; none were removed to make the estimate look smaller.

| Sample | Compact JSON bytes | Gzip bytes |
| --- | ---: | ---: |
| Individual scoreboard match, observed range | 8,987-13,855 | 1,927-2,447 |
| Average individual match | 11,145 | 2,188 |
| Entire five-match scoreboard, including envelope | 58,400 | 6,748 |
| One full match summary | 401,300 | 33,417 |

The whole-board gzip result is smaller than separately compressing its events because compression can reuse repeated content. It does not require storing room-specific scoreboard permutations. A shared storage container or match-timeline segment can similarly pack individual records without changing their logical identity; savings must be measured rather than promised.

For illustration, assume 120 distinct match snapshots and six distinct full summaries per match. These are modelling inputs, not a mandated polling duration or enrichment count. A match with no score changes, missing summary coverage, more goals, extra time, or different metadata will differ.

| Unique real matches | Per-snapshot catalogue rows if stored individually | Compact source JSON, decimal GB | Individually gzip-compressed source payloads, decimal GB |
| --- | ---: | ---: | ---: |
| 1,000 | 126,000 | 3.745 | 0.463 |
| 10,000 | 1,260,000 | 37.452 | 4.631 |
| 100,000 | 12,600,000 | 374.520 | 46.306 |

These numbers exclude normalized records, database row/index overhead, Storage metadata, replicas, backups, WAL, and network transfer. Gzip bytes estimate a compressed object payload, not PostgreSQL on-disk JSONB. The project currently uses pglz TOAST compression, which must be measured separately on representative inserted records.

Keeping one metadata row per raw version is itself material: at a hypothetical 250 bytes per manifest row, 1.26 million rows add approximately 315 MB before separate indexes. Bounded segment catalogues avoid that long-term per-poll row cost while retaining every snapshot entry inside the compressed manifest. Short-lived staging still needs a measured capacity allowance.

For normalized records, a deliberately illustrative allowance of 50 KiB per unique match gives about 51 MB per 1,000 matches, 512 MB per 10,000, and 5.12 GB per 100,000 before index/page overhead. This is a planning allowance, not a benchmark: event counts, player participation, revision volume, retained latest JSONB documents, and chosen columns can move it substantially. Latest/final full source documents are additional: one average scoreboard document plus one measured summary per match gives approximately 412 KB of JSON before Postgres representation/compression and indexes.

At 10,000 matches/year, this same source-timeline model averages about 103 MB/day of compact JSON before compression. Even one day of staging is not negligible. Archive promptly in bounded batches and monitor staging backlog; a storage outage must not silently delete captured data or stop core score processing.

Storage grows with unique real matches and acquired versions, not room permutations. More rooms add small references, processing receipts, and their own game events, not copies of every source snapshot. More tables do not solve or cause the main volume issue; repeated large payloads and indexing policy dominate it.

## Retention and queryability

- Keep normalized match facts, substantive accepted changes, event revisions, and verified source archives as long-term records; no seven-day source-archive deletion default.
- Keep latest/final documents queryable. A later field promotion can be rebuilt locally from archives without ESPN requests. Match-clock/statistic history remains captured even when not normalized into a row per poll.
- Keep operational attempt details briefly, with longer-lived aggregate usage. Request diagnostics and source evidence are different retention classes.
- Remove staging only after durable archive verification. Keep retry state/cursors until processing is confirmed. Preserve room references and historical evidence during any later retention-policy change.
- Avoid permanent retention of repeated identical payload copies and routine clock-only gameplay events; retain the source occurrence/time information in the archive manifest instead.
- Monitor bytes by table/index/TOAST, archive bytes/object count, oldest unarchived capture, source bytes per match/resource, and rows per accepted event. Do not infer future footprint solely from HTTP response size.

## Migration and verification before implementation

1. Add shared identities/references without replacing existing room match IDs or scores. Validate historical identity links and report ambiguity instead of scanning every league.
2. Move fetch demand to global coordination and budget enforcement while preserving authoritative room acceptance. Fence legacy fetchers before the new path runs; a temporary parallel shadow poll would undermine the feature's purpose.
3. Make observation saving, accepted-state projection, and room-processing receipts replayable. Archive packing is recoverable separate work, not a prerequisite to displaying a valid accepted score once capture is durable.
4. Validate uniqueness, foreign keys, nullable optional data, archive A -> B -> A reconstruction, source/context preservation, and upload/catalogue/staging failure recovery.
5. Benchmark representative inserted Postgres records and indexes in a disposable database. Measure `pg_column_size` for stored values and `pg_total_relation_size` including indexes/TOAST. Measure WAL/vacuum behavior for hot updates separately.
6. Inspect representative discovery, room-state, event-timeline, due-work, and player-history query plans. Add partitions or more indexes only when workload/retention evidence justifies them; a million rows does not by itself require partitioning.
7. Verify private source-archive access and existing host/member/guest boundaries. No source data endpoint may grant new room access or allow clients to write provider truth.

## Documentation consulted

- [PostgreSQL 17 JSON types and indexes](https://www.postgresql.org/docs/17/datatype-json.html)
- [PostgreSQL 17 TOAST storage](https://www.postgresql.org/docs/17/storage-toast.html)
- [PostgreSQL 17 storage measurement functions](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-ADMIN-DBSIZE)
- [Supabase Storage schema and object separation](https://supabase.com/docs/guides/storage/schema/design)
- [ESPN field research and coverage limits](../../exa-results/espn-provider-data-2026-10-25/report.md)

The requested Database Design Expert skill provides general normalization, relationship, history, and indexing principles, but many examples target SQLite. PostgreSQL-specific behavior in this proposal was checked against the linked project's version and PostgreSQL/Supabase documentation rather than copying those examples.
