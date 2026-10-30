# Research: Match Discovery Reuse

**Feature**: 031 | **Date**: 2026-10-30 | **Status**: design questions resolved

Research used current source, two read-only research agents, the project constitution and relevant repository skills. This is source/design evidence, not a new production latency measurement. All paths below are project-relative.

## 1. Demand and existing delay

**Decision**: Drive discovery from selected league codes and source date; retain configured options independently.

**Rationale**: `features/football-matches/useMatchData.ts` currently reads all `configuredLeagues`; `features/game-setup/useMatchListFilters.ts` defaults selection to `eng.1`/`eng.2`. `MatchList` obtains chooser options from the discovery result and synchronizes selection against those options. `useTeamData` independently fetches seven historical team files, and its loading flag is combined with fixture loading. These boundaries need separating so unrelated work cannot block usable fixtures.

**Alternatives considered**: Loading all leagues then filtering repeats unnecessary demand. Loading one request per league loses the endpoint's batching support. Rewriting the manual team directory is outside this feature.

## 2. Existing service, date and compatibility

**Decision**: Add a picker-only one-check factory option to `features/football-matches/footballMatchService.ts`, preserving the default. Bind it behind the discovery module's injected operation and reuse `createMatchDiscoveryApiClient` for the existing normalized public fixture projection.

**Rationale**: `discoverBatchWithFollowUps` currently waits at least 15 seconds before each of up to two follow-ups, repeats the whole batch and returns only its last result. Layering query polling on top would multiply checks and delay partial results. `features/football-matches/useLiveScores.ts` also calls service discovery for legacy identity resolution, so globally removing follow-ups would change score behavior. Transport cancellation exists, but its signal is captured by the service factory; individual consumers must not control a shared batch.

`features/football-matches/matchDiscoveryAdapter.ts` preserves the date using `requestedAt.slice(0, 10)`. The server reads exactly that source date, not a date range. `group.date` identifies the scoreboard source day; a fixture kickoff may fall on another calendar date. The existing normalized client retains all group metadata, including `lastSuccessfulCheckAt`, `isStale` and retry guidance. Those facts are sufficient for the revised client fixture-reuse policy; per-match scheduling fields are unnecessary.

**Alternatives considered**: Bypassing the validated module loses normalization/error handling. Changing the normalization interface or every compatibility consumer adds unnecessary surface. A new endpoint is unnecessary.

## 3. Library and cache ownership

**Decision**: Reuse `@tanstack/react-query` 5.104.0 and the existing application QueryClient, with per-league/date queries and one same-turn batch loader. Keep retained fixtures and shared cycle state in Query data, not another Map/store.

**Rationale**: `lib/queryClient.ts` and `app/_layout.tsx` already provide cache ownership and observation. `lib/QueryLifecycle.tsx` bridges platform visibility and connectivity to Query's managers. Public discovery keys remain outside the existing `['account', accountId]` namespace; sign-out still clears private caches normally. Independent query keys support reuse and deduplication, while a small loader supplies the missing HTTP batching.

**Alternatives considered**: A custom cache with its own subscriptions duplicates installed functionality. A single query keyed by the whole selected set cannot naturally reuse A/B when C is added. `useQueries` alone would issue separate requests and does not enforce a shared domain retry allowance.

Official references: [query defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [useQuery controls](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery), [QueryClient writes](https://tanstack.com/query/latest/docs/reference/QueryClient), [query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation). The installed v5 source is the compatibility check for these options.

## 4. Client fixture reuse without a backend contract change

**Decision**: Use an explicit 60-second client fixture-reuse period measured from the group's `lastSuccessfulCheckAt`. Only complete groups not marked stale by the server qualify. Retention is separate; receiving saved information never renews source age.

**Rationale**: The picker needs recently checked fixtures, while the catalog owns live scores and save/start authority. Private live-scope membership and exact acquisition deadlines are not exposed. The previous design attempted to reconstruct those deadlines from match attempts, kickoff times and equality of match/group timestamps. Normal summary updates can break that equality, reducing reuse for reasons unrelated to the fixture list and coupling client code to private scheduling.

The revised rule makes a narrower, explicit promise: a complete, server-nonstale snapshot whose source check is less than 60 seconds old may be reused for fixture selection. It does not guarantee that the server has no earlier live acquisition deadline or newer observation. A later summary timestamp alone does not invalidate that snapshot. Existing authoritative actions and live-score reads continue unchanged. Invalid/missing/future group timing or incomplete/stale groups remain retained-but-outdated.

TanStack advances `dataUpdatedAt` on query success and cycle-state writes. Derive function-valued `staleTime` from the fixed source-check +60s deadline, never from receipt. Recheck that deadline before dispatch. The rule is specified in FR-007 and [data-model.md](data-model.md); SC-008 uses two such client periods, explicitly 120 seconds.

Production correction, 2026-10-30: the client deadline determines eligibility for another request, not a user-facing outdated warning. Scheduled backend results can remain fresh for five minutes, so successful retries may return the same source timestamp after the client minute expires. Complete results with valid timing and `isStale: false` remain available/empty; server-stale or uncertain-timing responses still warn.

**Alternatives considered**: A receipt-based TTL renews old data. Reconstructing exact private expiry duplicates server policy and can unnecessarily defeat reuse. If exact producer freshness becomes a requirement, the catalog module should expose its own expiry fact in a separate contract change; it is not inferred in this client-only phase.

## 5. Cycles, lifecycle and retention

**Decision**: Three checks maximum per pending cycle, reserved atomically in shared query data; pending-only Query intervals. Use the existing minimum 15-second delay, honor longer retry guidance and stop automatic foreground continuation for delays above 60 seconds. Retain the exact retry-not-before time so manual Retry cannot bypass a longer delay.

**Rationale**: Independent observers must not receive independent budgets. Query retry is disabled; ordinary completed-query reconnect refresh and intervals are disabled. No active/focused consumer or noninteractive app means no follow-up dispatch. Submitted requests may finish into their exact-key entries without aborting shared work. Returning resumes remaining pending allowance; exhausted pending results require explicit Retry. Freshness expiration alone never dispatches a completed-result request.

Use `gcTime: 30 * 60_000` after queries become inactive. Query retains active/in-flight work normally; there is no persistent cache. This is time-bounded retention, not a hard byte limit. Current date/league admission limits constrain ordinary demand. An LRU cap can be considered only if measured memory warrants it.

**Alternatives considered**: Per-component timers duplicate work and budgets. Unbounded pending polling conflicts with clarification. Cancel-on-detach breaks another consumer; a shared abort multiplexer adds no required outcome here. A second LRU cache adds bookkeeping without current evidence.

## 6. Deployment, contracts and verification

**Decision**: Client-only rollout; no migration, backfill, backend deployment or new dependency. Keep the recently restored `lottie-react-native` football feedback and existing reduced-motion handling.

**Rationale**: `types/footballMatch.ts`, existing schemas/transport and `discover-matches` already supply the public fixtures, per-group source timestamp, availability and retry guidance needed. Add request/group correspondence checks locally: absent or wrong-date groups cannot become checked-empty results. Backend policies, live-score tracking and room mutation paths remain untouched. Supabase's current changelog was consulted; no Supabase feature is being introduced.

**Alternatives considered**: Redis, longer SQL freshness, a new catalog API and additional animation wrappers are outside the agreed client phase.

Required implementation evidence: discovery module interface coverage, existing parser/service compatibility coverage, one controlled setup BDD journey, room/score regressions, web observations and ARTEMIS Android observations. Keep controlled timing, hosted endpoint behavior and real device evidence separate. See [quickstart.md](quickstart.md).

## 7. Module interface and failure granularity after design review

**Decision**: Keep one picker-facing interface, `useMatchData(selection)`, with fixture/team projections, explicit per-league states, waiting/updating facts and guarded Retry. Query options, raw response parsing, cycle counters and the one-check mode are private. Compose the module with an injected normalized discovery operation and QueryClient so production and controlled tests cross the same seam.

**Rationale**: Callers should not know retry ordering, cancellation flags or source-age calculations. `createMatchDiscoveryApiClient` already accepts an injected football-match implementation and preserves needed group metadata. Reusing it avoids another projection. Query behavior tests use the module interface and controlled adapter; hook tests stay focused on wiring/projection instead of duplicating all policy tests.

Whole-response validation in `utils/footballMatchSchemas.ts` is intentionally strict: one structurally invalid field rejects the submitted response. Therefore transport/malformed-body failures affect every key in that batch, retaining prior fixtures. Only after schema validation can group correspondence or a valid per-league pending/error status be isolated per key. Independently submitted batches can still succeed. This resolves the former claim that every malformed league could be salvaged independently without changing the parser.

**Alternatives considered**: A tolerant parser would expand scope and weaken the existing trust seam. Exporting counters/helpers for tests or making callers configure Query retry settings increases the interface without adding caller leverage.
