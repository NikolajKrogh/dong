# Data Model: Session Match Discovery

All feature state is in memory. No database schema, RLS policy, migration, backfill or persistent Zustand/AsyncStorage field is added.

## Discovery selection

| Field | Rule |
|---|---|
| `date` | Existing `YYYY-MM-DD` source date; preserve current calendar-date interpretation |
| `leagueCodes` | Required selected identities; trim, deduplicate, sort, and intersect with configured eligible options |
| `startTime`, `endTime` | Existing display filters; never included in a discovery key or request |
| activity | Current picker route focused and application interactive; use existing adapters |

An empty selected-code array produces no discovery queries. Configured chooser options remain available without loading their fixtures. Removing a configured league removes its active demand; it does not delete selected game matches.

## League/date query

Canonical key: `['match-discovery', date, leagueCode]`. The source date comes from the request and matching `group.date`, not from fixture kickoff. Key ordering is stable and excludes account IDs, room IDs and credentials.

| Field | Ownership and meaning |
|---|---|
| `matches` | Existing normalized public fixture projection for this league/source day; catalog/source IDs remain strings |
| `group` | Latest accepted matching discovery-group metadata; null until a valid group has been received |
| `reuseExpiresAt` | Fixed client reuse deadline: group successful source check +60 seconds for an eligible complete snapshot; zero means reuse-outdated |
| `checksIssued` | Shared transport reservations, 0 through 3 inclusive; not one counter per observer |
| `retryAt` | Earliest allowed next check, including server retry guidance |
| `canAutomaticallyRetry` | True only while a pending result has remaining allowance and an eligible delay; Query error state also stops continuation |
| Query metadata | Existing fetch/error/observer/GC state; never treated as proof of provider completeness |

All fields in this table are private implementation state. Cycle bookkeeping may exist before a response; `group === null` is not a checked schedule and must project to an initial/pending state rather than successful-empty. Picker callers receive the explicit view model in the [contract](contracts/match-discovery.md), never these fields or raw Query results. Query owns one retained entry; the loader holds only transient deferred work keyed by date/league. Remove queued/in-flight bookkeeping after completion/failure and release references when the QueryClient is discarded.

## Freshness policy

Freshness and retention are different. `gcTime = 30 minutes` starts when a query becomes inactive and does not grant 30 minutes of fresh fixtures. Active entries and submitted requests follow normal Query retention; this is not a fixed memory-size cap.

This is the client fixture-reuse policy in FR-007, not a reconstruction of private live-score scheduling. An eligible snapshot has exactly one matching group, `availability === available`, `isStale === false`, and a valid non-null `lastSuccessfulCheckAt` no later than the receiving clock. Only fixtures for the requested league are associated with that group.

Set `reuseExpiresAt = parsed group.lastSuccessfulCheckAt + 60 seconds`. Reuse is fresh only while `now < reuseExpiresAt`. A complete checked-empty schedule follows the same rule. An old source check is already outdated even when its saved response has just arrived. Partial/pending/deferred/unavailable groups, server-marked stale groups, invalid/missing/future group timestamps and correspondence failures are not reuse-fresh.

Per-match attempt times, lifecycle scheduling, kickoff deadlines and equality of match/group timestamps do not participate in this rule. An ordinary summary update cannot invalidate the fixture snapshot solely because its match timestamp differs. The picker may reuse a recent snapshot even if the catalog has an earlier private acquisition deadline or a newer live observation; existing live-score reads and authoritative save/start checks remain responsible for those outcomes. Arbitrary device-clock skew is not solved by this phase.

Receipt, retries, observer attachment, partial merges and cycle-state writes never advance the group's accepted source-check time. Query's function-valued `staleTime` uses `max(0, reuseExpiresAt - query.state.dataUpdatedAt)`, or zero without an eligible deadline. Also check the fixed domain deadline before dispatch. This prevents Query's receipt timestamp from renewing old provider evidence. If exact producer expiry is needed later, it must be supplied by the catalog module through a separately reviewed contract change.

## Acceptance and retention transitions

| Incoming result | Retained fixture treatment | User-facing meaning |
|---|---|---|
| Complete matching group with fixtures | Replace that key's discovery set; compute freshness | Current or stale content, according to deadline |
| Complete matching group, zero fixtures | Accept empty set; compute freshness | Checked empty schedule; distinct from no selected game matches |
| Incomplete group with fixtures | Merge by `catalogMatchId`, retain prior rows omitted by incomplete response; no fresh deadline | Usable incomplete/outdated content |
| Incomplete group without fixtures | Retain existing rows; no fresh deadline | Pending/deferred/unavailable, never checked empty |
| Schema-valid response with missing/duplicate/wrong-date group | Preserve affected key's rows; valid corresponding groups may update independently | Per-league error with Retry; never checked empty for the invalid key |
| Transport failure or structurally malformed response body | Preserve prior rows for every key in the submitted batch; accept no rows from that rejected body | Batch members have error/offline status with Retry; independently submitted batches may still succeed |

Keep existing whole-response schema validation before correspondence checks. Do not salvage individual rows from a structurally rejected body. Within a validated body, ignore unrequested groups/matches and isolate correspondence failures or valid per-league unavailable statuses without discarding other valid groups. Previously retained fixtures remain usable through either failure class. Query owns one in-flight operation per exact key; Retry joins it with cancellation disabled, so an older cycle cannot overlap and overwrite a newer cycle. A late response for date A may populate A's cache but cannot be projected as date B.

## Shared loading cycle

1. An eligible activity needs a missing or stale entry: join or create the Query operation, then reserve initial check 1 synchronously at batch dispatch after rechecking active demand. Equivalent in-flight demand joins it.
2. A completed response settles the cycle and disables its interval. Time passing does not start a new cycle.
3. A pending response schedules a possible next check no earlier than `max(15 seconds, relevant server delay)`. Use group and response-level guidance conservatively; store an absolute retry-not-before instant.
4. Pending-only intervals may reserve checks 2 and 3 while an eligible consumer remains, the app is interactive and Query is online. Multiple observers share the reservation and promise. No underlying service follow-up or generic retry adds further checks.
5. Still pending after check 3: mark exhausted, stop the interval and show Retry. A newly attached observer never resets that pending cycle. Resume an unexhausted cycle after focus returns; exhausted pending cycles need explicit Retry.
6. A delay over 60 seconds stops automatic foreground continuation using the current service policy. Keep its full cooldown for Retry. A failure stops automatic continuation and retains prior fixtures.
7. Explicit Retry joins in-flight work, or starts a new cycle after cooldown. It never races another Retry or discards selected game matches. Attempts to Retry early show the remaining wait and dispatch nothing.

No active/focused consumer means no new follow-up dispatch. Already submitted batches may finish into exact-key public cache data; do not cancel a shared query because one consumer unmounted. A paused initial request may resume through existing Query connectivity handling; reconnect alone never refreshes completed results.

## Independent game selection

Existing solo/room game selections, fixed match IDs, draft state, tracking grants and authoritative permissions keep their current owners. Cache eviction, filter changes and refresh omission cannot remove a selected game fixture. Discovery does not apply goal updates, create tracking demand, or write history. Public cached rows can survive sign-in/out; private account caches retain existing cleanup rules.

Implementation refinement: the exact Query key and its shared in-flight promise provide cycle fencing. No redundant cycle ID, second fixture store or cancellation registry is needed. The transient queue is drained before dispatch; requests already submitted remain owned by Query.
