# Match Catalog naming review

**Date**: 2026-10-25  
**Scope**: Feature 030's proposed interface, types, files, endpoints, and compact persistence terminology. Existing client/Edge names were checked for context. This is not a repository-wide rename or schema migration.

## Findings and decisions

The highest-impact issues concern replacement semantics, credential authority, and identities. `FootballMatchService` remains a useful module name: discovery, saved facts, and tracking belong behind its interface. `runDueMatchWork` remains appropriate because a pass also resumes room processing and completion enrichment; calling it only `pollScores` would hide that work.

The following proposal changes are applied in [architecture.md](architecture.md):

| Previous proposal | Selected name | Reason |
| --- | --- | --- |
| `followSolo` | `replaceSoloTracking` | Replaces the scoped selection; does not merely append another followed match or subscribe to UI events. |
| `SoloSelection` | `SoloTrackingSelection` | Identifies the tracking command's input rather than a private game draft. |
| `SoloFollowReceipt` | `SoloTrackingGrant` | The opaque handle conveys limited authority for subsequent tracking changes. A receipt alone suggests evidence of completion. |
| `read` | `readSavedMatches` | Makes the read-only, saved-data behavior visible at call sites. It never starts an upstream refresh. |
| `ProviderMatchId` | `SavedMatchId` | Identifies the shared catalog record, distinct from ESPN's source ID and an existing room match UUID. |
| `MatchBundle` | `SavedMatchesResult` | States what is returned; includes availability, versions, and freshness rather than implying an unexplained package. |
| `discover`, `DiscoverySelection`, `DiscoveryResult` | `discoverMatches`, `MatchDiscoverySelection`, `MatchDiscoveryResult` | Keeps the domain explicit when imported or logged independently. Discovery may admit acquisition; it is not a saved-data-only read. |
| `espn.ts`, `normalize.ts` | `espnHttpClient.ts`, `espnMatchNormalizer.ts` | Distinguishes provider HTTP from pure projection and improves searchability. Keep one cohesive normalization file until a real need justifies splitting it. |
| `match-discovery`, `match-monitor` | `discover-matches`, `run-match-monitor` | HTTP entry names describe invoked operations. Monitoring runs a bounded pass; it is not a persistent subscription. |

Use `createFootballMatchService` / `getFootballMatchService` only for client construction/access, following the existing `createProviderScoreRefreshClient` / `getProviderScoreRefreshClient` pattern. Getting a client must not acquire match data. Existing `getRoomSnapshot`, `addRoomMatch`, and SQL `add_room_match` illustrate the project's camelCase application / snake_case SQL mapping.

## Persistence terminology for planning

These are naming recommendations for the lean logical model, not a fixed list of tables. The full-archive table inventory in `storage-design.md` is historical and must not become a migration checklist.

| Concept | Recommended name | Meaning |
| --- | --- | --- |
| Shared real match | `provider_matches` | One provider-scoped identity and compact current/final state, independent of room count. |
| Supported league identity | `provider_leagues` | Distinguishes the league, such as `eng.1`, from ESPN's per-event competition ID; no ID equivalence is implied. |
| Accepted gameplay-relevant match version | `provider_match_observations` | Meaningful score, schedule, or lifecycle observations needed for replay. Not a row for every unchanged check. |
| Squad membership and supplied participation | `provider_match_roster_entries` | Can include unused substitutes. `appearances` would falsely imply everyone played. |
| Current/final team metrics | `provider_match_team_stats` | One set per match/team. `stats` is a familiar domain abbreviation and does not need expansion purely for style. |
| Compact goal occurrence | `provider_match_goals` | Distinct from a score snapshot, an ESPN fixture/event ID, and an immutable DONG room event. Required correction evidence remains associated with the goal. |
| Durable acquisition coordination | `provider_request_groups` | Keyed by actual request scope such as provider/league/date/options, rather than by room or individual match. |
| Short-lived HTTP attempt diagnostic | `provider_request_attempts` | One attempted acquisition, including failure. Distinct from an accepted observation and from aggregated usage. |

Keep one consistent identity vocabulary:

- `SavedMatchId` / `catalogMatchId`: shared record identity in the application contract. Do not assume the internal SQL key's representation is the public contract.
- `RoomMatchId` / `roomMatchId`: existing room match UUID when both identities occur in new internal code. Preserve existing deployed `matchId` fields and map explicitly at their adapter.
- `ProviderMatchIdentity`: validated external provider and event/competition namespace; retain `sourceMatchId` and `sourceLeagueCode` where existing contracts use them. Do not label a composite namespace as a single interchangeable match ID.
- `athleteId`: a footballer's identity where it could be confused with a DONG participant. Existing provider `athletes` terminology is reasonable; roster entries link that identity to a historical match/team. `participantId` remains a room participant in application gameplay contracts.

Use exact time and progress names rather than generic `updatedAt`, `syncedAt`, `version`, or `processed` when the distinction affects behavior:

| Proposed field | Meaning |
| --- | --- |
| `lastAttemptAt` / `last_attempt_at` | Most recent provider attempt, including failure. |
| `lastSuccessfulCheckAt` / `last_successful_check_at` | Successful validated check, even when facts did not change. |
| `observedAt` / `observed_at` | When DONG observed the source information. |
| `providerOccurredAt` / `provider_occurred_at` | Source-supplied occurrence time, nullable; never substituted with observation time. |
| `nextAttemptAt` / `next_attempt_at` | Earliest next eligible acquisition time. Existing kickoff, cooldown, budget, and claim rules still apply. |
| `leaseExpiresAt` / `lease_expires_at` | Expiry of temporary worker ownership, distinct from tracking expiry or cache freshness. |
| `observationVersion` / `observation_version` | Accepted shared match progression. |
| `lastAppliedObservationVersion` / `last_applied_observation_version` | Room processing progress; distinct from the room's existing event sequence. |

Keep nullable participation facts explicit: `isStarter`, `hasAppeared`, and corresponding snake_case columns, only when supported by supplied evidence. Unknown remains null; an unused substitute and unknown appearance are different. Do not rename an error object to `hasError`, a lifecycle enum to `isActive`, or a source-defined field simply to satisfy a boolean-prefix rule.

Constants with units should use names such as `LIVE_POLL_INTERVAL_SECONDS` and `PROVIDER_STORAGE_TARGET_BYTES`. An enrichment attempt limit must say `MAX_COMPLETION_ENRICHMENT_ATTEMPTS`, not `MAX_RETRIES`: the allowance includes the first attempt and any retry. Attempt, retry, successful check, and accepted observation must not become interchangeable terms in counters or tests.

## Existing code and compatibility

Do not spend migration effort renaming the old `refresh-provider-scores` endpoint or `ProviderScoreRefreshClient`; the architecture already plans to retire or adapt them. Likewise, do not rename existing room UUID fields globally. New operations should have the selected names from introduction, with explicit mappings for deployed consumers. No runtime symbols, database objects, or deployed endpoints were changed by this review.
