# Research: shared match acquisition and compact persistence

**Date**: 2026-10-25  
**Status**: Phase 0 complete. Design choices below are resolved; implementation and release measurements remain required.

Research used three read-only passes covering Postgres/room integration, Edge scheduling/admission, and Java/client compatibility. No new ESPN requests or hosted mutations were made. Supporting evidence: [architecture](architecture.md), [naming review](naming-review.md), [Supabase review](supabase-review.md), [compact storage policy](free-tier-storage.md), and [earlier ESPN samples](../../exa-results/espn-provider-data-2026-10-25/report.md).

## 1. Module and persistence ownership

**Decision**: One Match Catalog module with consumer operations `discoverMatches`, `readSavedMatches`, and `replaceSoloTracking`. Private Postgres operations own demand, request groups, claims, budgets, accepted observations and room progress. One Edge adapter owns provider HTTP and pure extraction. Existing room gameplay owns consequences.

**Rationale**: The existing invariants are already transactional in Postgres. Source acquisition must be independent of presence and room reads. Per-match facts serve arbitrary room permutations while transport remains grouped by actual provider resource.

**Alternatives considered**: Java-owned orchestration adds another privileged deployment/hop and cannot rely on timers in request-billed, minimum-zero Cloud Run. An Edge-led implementation with scheduling policy duplicated in SQL spreads durable decisions. A generic event bus or separate queue product adds no required capability beyond observations and room cursors.

## 2. Identifiers, schedule dates and provider compatibility

**Decision**: Shared catalog IDs are opaque application strings backed initially by compact bigint relational keys. Keep external event/competition IDs as text and existing room UUIDs unchanged. Catalog IDs are serialized as decimal strings, never JavaScript numbers. Provider namespace validation includes league and distinct event/competition identity where supplied.

New discovery accepts an explicit calendar `date: YYYY-MM-DD`. Java compatibility preserves its current `requestedAt` interpretation: the supplied offset datetime's calendar date, or today in UTC when absent. Carry kickoff as an absolute instant throughout; never reconstruct it from mixed UTC-date/local-time display fields. Monitoring request groups follow saved provider request-date mapping and known kickoff, not today's UTC date on a solo device.

**Rationale**: Existing `NormalizedMatch.id` is a provider event ID; room `Match.id` is a room UUID. Current `MatchQuery` uses `OffsetDateTime.toLocalDate()`, while `useMatchData` submits UTC midnight. Existing room uniqueness ignores league, so conflicting legacy records require explicit rejection/reporting rather than promotion into a false shared identity.

**Alternatives considered**: Replacing every `match.id` breaks room contracts and solo persistence. Guessing equivalence between ESPN event and competition IDs loses provenance. Switching to an unverified v3 family is excluded: prior probes did not establish a drop-in soccer scoreboard/summary replacement.

Sources: `utils/commandApiClient.ts`, `hooks/useMatchData.ts`, `utils/roomSnapshot.ts`, `command-api/.../match/MatchQuery.java`, `supabase/migrations/005_create_matches.sql`, earlier ESPN report.

## 3. Scheduling and worker bounds

**Decision**: One global `15 seconds` Cron tick checks indexed due work in SQL. It invokes at most two workers when needed, with separate dispatch leases and source-group claims. No idle Edge call, pre-kickoff score request, per-room job or long-running timer. Each worker admits at most four provider groups concurrently in one HTTP wave, with a 10-second deadline including body reading and a 35-second wall deadline. Source-group and dispatch leases initially last 60 seconds; `pg_net` HTTP timeout is explicitly 45 seconds. Do not admit network work with less than 15 seconds of worker time remaining.

Live `next_attempt_at` is based on the admitted attempt's start plus 60 seconds, not completion. A successful unchanged result advances last-success freshness without appending an observation. The 60-second cadence plus at most 15-second scheduler wait, 10-second provider deadline and 5-second processing target fits the controlled 90-second objective only after jitter/CPU/fan-out are measured. Two four-group workers cover the five-group benchmark in one wave. Broader workloads must fit measured concurrent-group capacity; overload is reported/deferred rather than disguised as healthy freshness. Reserve enough worker slots for live groups due in the next 45 seconds; optional work cannot occupy those slots. Bound pre-acquisition replay to its measured share of the latency margin, yielding to due live work while retaining durable replay priority when network admission is unavailable.

**Rationale**: Minute ticks plus completion-time freshness can skip a tick and yield roughly 120-second updates. A database-only subminute check saves provider/Edge work while reducing that timing error. `pg_net` starts HTTP after transaction commit and uses unlogged queue/response tables, so its request ID is dispatch evidence, not durable completion authority.

**Alternatives considered**: An unconditional minute Edge call uses 43,200 invocations per 30 days even when idle. An unconditional 15-second Edge call would use 172,800. Client timers fail when apps close. Relying on Edge background lifetime or `pg_net` queue survival cannot establish recovery.

Synchronous cold-discovery acquisition uses these same two global slots, claims, budget and live-slot reservations. A public ingress is not an extra uncounted worker; when slots are unavailable it returns saved/pending results.

Sources: [Cron syntax/history](https://supabase.com/docs/guides/cron/quickstart), [pg_net semantics](https://supabase.com/docs/guides/database/extensions/pg_net), [Edge limits](https://supabase.com/docs/guides/functions/limits). The existing project uses Postgres 17; earlier read-only checks found Cron/Vault installed and pg_net available but not installed.

## 4. Lifecycle and missing metadata

**Decision**: Known future kickoff suppresses recurring monitoring. Explicitly live lifecycle, including halftime, allows 60-second checks. Unknown/tentative kickoff stays unknown; only explicit discovery, an already-returned shared result, or an explicitly live status can establish eligibility. Missing league resolves only from an unambiguous saved catalog identity; otherwise return `identity_unresolved`.

Past-kickoff scheduled/delayed/suspended/postponed-without-date work uses 5-minute checks for the first 30 minutes in that condition, 15 minutes until two hours, hourly until 24 hours, then six-hour checks while canonical multiplayer demand persists. A validated future kickoff replaces this schedule; a return to live restores normal cadence. Keep condition-start time stable across repeated unchanged statuses. Confidently mapped terminal canceled/abandoned states stop routine work; unknown raw states are not guessed terminal. Missing a match in a partial/successful board is not proof of cancellation or 0–0.

Final score acceptance stops normal monitoring for that match. One shared summary is eligible five minutes after observed completion; one retry is eligible 15 minutes after the first attempt if incomplete or transiently failed, both within 24 hours. The total dedicated completion allowance is two attempts, including failures, ambiguity and any dedicated confirmation; there is no separate confirmation budget. A terminal unsupported detail resource can stop after one attempt. Another live match's shared board may update final facts without dedicated polling.

**Rationale**: `034_room_expiry.sql` and `210_room_expiry.test.sql` preserve stale `in_progress` rooms; only joinable rooms have the old inactivity expiry. Do not silently terminate active monitoring at a guessed age or change room expiry. Global budgets bound long uncertain matches; unchanged scores do not establish completion.

**Alternatives considered**: Polling unknown fixtures before a known kickoff violates the requirement. Automatically ending after two hours or 24 hours loses suspended games. Querying every league/date to recover missing identity defeats traffic reduction.

## 5. Budget and failure policy

**Decision**: Activation requires explicit valid operator configuration. Initial recommended settings are 30 attempts per rolling 60 seconds and 5,000 per UTC day, counted across all purposes. These are conservative DONG settings, not ESPN-approved limits. Serialize reservations under a provider-budget lock, count retained recent attempt reservations for the rolling window, and use durable daily counters. Retain current-window evidence regardless of diagnostic eviction. Reserve immediately before HTTP, after a valid group claim; count failed/ambiguous reservations conservatively and never refund an uncertain attempt. Every retry requires a new reservation.

Prioritize live monitoring and already accepted room replay; cold discovery and optional enrichment use spare allowance. Admit new distinct concurrent groups only within measured worker and remaining-day capacity; initially at most eight overlapping live groups for the configured two-worker shape. Admission checks future kickoff overlap as well as currently due groups, conservatively reserving four-hour live windows from known kickoff and extending reservations while a match remains live. This is a capacity forecast, not a completion rule. Unexpected reschedules/extra-long matches can still create overload: retain existing games, surface deferred freshness and stop optional/new demand rather than silently dropping tracking. Public/solo demand cannot bypass these limits or evict multiplayer monitoring.

Timeout/network/5xx backoff is 60, 120, 240, 480, then 900 seconds with nonnegative bounded jitter. Valid `Retry-After` takes precedence even beyond that cap; a 429 sets a conservative provider-wide cooldown unless a reliable narrower scope exists. A group's 401/403 pauses that group pending operator recovery unless the response establishes integration-wide scope. Provider-wide throttling or an integration-wide credential/configuration failure may pause the provider; persist scope/reason explicitly. Group-local failures do not block healthy groups. Assess scope from responses, existing configuration and already-due work, never extra diagnostic provider requests. 404/malformed responses preserve saved data, mark the resource unavailable, and retry no faster than 15 minutes when eligible; detail 404 is terminal unavailable. No fallback sweep/inline retry. Only validated successful results reset the affected failure count.

**Rationale**: Five groups for three hours cost about 900 routine attempts regardless of 100 rooms; 20 for four hours cost about 4,800. Sharing does not make unique-group demand free. A calendar-minute counter is not a rolling limit and can burst at a boundary. A failed room application must retry saved observations without spending provider budget.

**Alternatives considered**: Per-room or in-memory limits do not survive restarts or coordinate concurrent workers. Unlimited retries after 403 repeat configuration defects. Returning budget on lease expiry understates possibly dispatched HTTP.

## 6. Anonymous discovery and solo tracking

**Decision**: Allow public facts without a new account. Discovery admits at most 16 allowlisted leagues for one explicit date per call, within seven days before/after today's UTC date. Maintained callers chunk larger configured lists and merge structured outcomes. Default discovery freshness is five minutes, including valid empty results, while a group serving live demand obeys the shared live freshness. A cold discovery request has a finite two-minute demand window; no recurring discovery timer is established. Reads cannot renew demand or acquire data.

Solo tracking accepts at most 20 existing catalog IDs, with known kickoff at most seven days ahead or explicit current live status. Issue a 256-bit opaque grant using server-only, domain-separated WebCrypto HMAC-SHA256 over a server-generated issuance UUID and cryptographically random 256-bit client creation nonce. Persist issuance UUID, nonce/grant digests, key ID and request digest; never plaintext tokens/nonces. Concurrent identical creations share one issuance; matching unexpired retries reconstruct its original token, while changed content conflicts. Expired records reject recovery. After expired metadata is purged, a permitted creation receives a fresh issuance/token and consumes creation allowance even if its nonce repeats; an old token never becomes valid again. Retain signing keys only for unexpired issuance recovery. Expire tracking at the latest selected kickoff plus 24 hours (explicit live/unknown-kickoff admission gets 24 hours). Replacement checks grant/version/admission; clearing ends demand and keeps ended retry metadata until expiry. No private solo names, assignments or local history are uploaded.

Global hard limits initially bound active solo grants to 200, creations to 100/hour, and newly admitted solo-only due groups within the shared eight-live-group envelope. Per-grant replacements are capped at 30/hour. Optional per-caller HMAC counters (10 creations/hour) are used only after a trusted transport address is established; unverified `x-forwarded-for` is not authority. Grant/caller counters are short-lived. Global provider/capacity limits remain the hard protection against address rotation. Reject admission explicitly rather than manufacture an unlimited anonymous work queue.

**Rationale**: Random capabilities prevent forgery but not mass creation. Global hard ceilings work without introducing anonymous accounts or trusting arbitrary client headers. An Edge handler cannot prevent a request already delivered to it from consuming an invocation; stronger public-ingress abuse protection needs supported gateway controls and usage monitoring.

**Alternatives considered**: Requiring accounts would change the product. Client-generated tracking IDs or read-based renewal allow permanent anonymous work. Storing private solo state would merge ownership unnecessarily.

Saved reads retain the compact goalscorer/seven-stat `live` projection already consumed by existing controls. An optional saved-only `history` projection returns bounded held roster/final-stat details for private local snapshots, never provider acquisition or tracking renewal. Capture available solo details on completion or a normal later foreground/history access; preserve local outcomes and captured facts through shared-cache eviction. Details not downloaded before expiry may be unavailable. No permanent anonymous retention pins, local-history uploads, new detail polling or new screen is introduced. Null-aware adapters preserve uncertainty.

## 7. Room provenance, ordering and migration

**Decision**: Separate participant authorization from the trusted saved-observation entrance while reusing one scoring implementation. Existing `gameplay_events.actor_participant_id` is NOT NULL with a room-participant foreign key. Add explicit `actor_kind` and a constrained nullable participant actor for provider-origin events, tied to a saved observation. Preserve participant attribution and the composite foreign key. Do not fabricate a host, weaken command authorization, or write worker progress into participant `gameplay_command_results`.

Add catalog linkage, an observation anchor and last-applied version to existing room matches. Canonical selected common/assigned matches in active rooms determine demand; unused pool rows left by the running editor must not remain monitored solely because they exist. Lifecycle commands update affected due eligibility transactionally. Before assignment/departure/end transitions, capture and drain already accepted versions under the existing room lock, with a bounded cap and retryable `room_processing_pending` result when backlog prevents the transition. Source acceptance never locks rooms; room processing locks one room then its relevant match/progress rows in stable order.

Adoption does not replay all shared pre-link history. Room matches currently default to 0–0, attachment omits score initialization, and there is no separate persisted multiplayer baseline field. Preserve that rule: linking alone changes no room score/cursor. When an in-progress eligible room first consumes latest saved observation N, apply its absolute pair against the existing room pair and atomically set anchor/cursor to N. A new match's first 2–1 yields one 0–0 → 2–1 `provider_score_changed` snapshot event; an existing 2–1 adopted against 3–1 yields one 2–1 → 3–1 event; an identical pair emits none but still consumes N. Do not invent three individual goal events or introduce a new subtractive baseline. Missing trustworthy source data leaves anchor/cursor null until the first valid check. Completed rooms gain references only.

**Rationale**: A source commit before assignment changes but replay afterward can otherwise charge different participants. A cursor set to current while leaving a stale room score would permanently skip a valid delta. Current actor constraints are a concrete migration obligation, not solved by an admin key.

**Alternatives considered**: A separate permanent room-interest/queue record for every version adds volume when existing room rows and version cursors identify pending work. Global cross-room transactions let one room block all source acceptance. Weakening every participant command would grant unrelated powers.

Sources: `005_create_matches.sql`, `008_create_gameplay_events.sql`, `009_helpers_and_triggers.sql`, `035_configure_start_game_rpcs.sql`, `041_mid_game_reassignment.sql`, `042_server_authoritative_gameplay.sql`, `20261022172949_multiplayer_game_editor.sql`, existing room-sync and snapshot adapters.

## 8. Access and worker credentials

Pending room mutations return the normal HTTP-200 JSON outcome `{ "ok": false, "code": "room_processing_pending", "retryAfterSeconds": 1 }` consistently through registered RPC, guest ingress and Java forwarding. Saved processing progress commits without the requested mutation or a terminal success record. Retry at most twice automatically with the original idempotency key/business payload; stale preconditions retain the existing conflict flow. See the exact [worker/room contract](contracts/worker-and-room-processing.md).

**Decision**: Compact entities and coordination live in unexposed schemas. Expose bounded sanitized saved reads through a security-invoker public wrapper calling a private controlled implementation. Explicit grants cover the complete call path; no client access to claim/budget/acceptance operations. Any exposed tables/views require RLS/invoker behavior as appropriate. Worker wrappers are backend-only.

Use a named server secret on `apikey` with `withSupabase({ auth: 'secret:match_monitor' })` or exact equivalent validation. `verify_jwt=false` is acceptable only with that actual validation. Vault/server configuration holds secrets, never Expo variables, migrations or logs. pg_net temporarily holds decrypted request headers in its queue; verify queue grants, database login roles and absence of exposed views. Named project secrets still carry broad backend privilege; naming them does not create a restricted SQL role. Rotate without leaving an unauthenticated worker route.

**Rationale**: Public keys and browser origins cannot authorize privileged background work. Participant routes retain their existing user/guest checks. RLS alone does not control function execution.

Sources: [Function authentication](https://supabase.com/docs/guides/functions/auth), [Key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys), [Scheduling](https://supabase.com/docs/guides/functions/schedule-functions). Changelog TLS deprecation affects supported transport verification, not the chosen module design.

## 9. Compact storage and capacity

**Decision**: Typed current match facts plus meaningful observation evidence, shared team/athlete identities, compact goal revisions/participants, one roster entry per supplied squad member, one current/final scalar team-stat row, and bounded operational state. No latest full JSON source, staging/archive bucket, per-poll roster/stat history or career/profile crawl. Unknown fields may be intentionally discarded. Team-stat extras are restricted numeric known metrics with units, not nested raw payloads.

Keep unused discovery data for at most 24 hours and unreferenced completed data for at most 30 days, subject to earlier eviction. Protect active/replay dependencies and retained room-history references. Request detail lasts at most 24 hours with a 5 MB cap, excluding required live rolling-window evidence and outstanding attempt state. Keep bounded per-group daily aggregates for 30 days and provider/purpose/outcome daily totals for 90 days; aggregate keys copy safe scope labels instead of retaining FKs that pin otherwise evictable matches/groups. Retire request groups after no demand, completion allowance, protected match/progress dependency, outstanding claim or required budget evidence remains. Optional raw diagnostics remain off, or at most 24 hours/5 MB total if explicitly enabled. Feature-owned Cron history has a seven-day maximum and capacity monitoring; cleanup never silently affects unrelated jobs.

Initial feature target is 100,000,000 bytes including indexes and owned diagnostics/scheduler allocation. Stop optional collection at 80% after cleanup; reject new persistent demand at 90%, preserving the final 10% as recording runway. Also require at least 50,000,000 bytes of whole-database application headroom under the current 500 MB allowance. Capacity admission uses measured relation sizes, active growth and outstanding reservations, and may reject earlier; these thresholds are not a guaranteed bound on indefinite protected history. Re-measure actual roster, observation and per-room fan-out costs before activation, and surface operator capacity action before protected growth exhausts the reserve. Never auto-upgrade or silently delete referenced history.

**Rationale**: Existing datum prototypes exclude heap/index overhead; 10–20 KB per roster and 2–5 KB final team metrics are estimates, not measured capacity. More tables are acceptable when they preserve identity and queryability; unbounded versions and large repeated payloads dominate volume.

**Alternatives considered**: Full compressed source archives exceeded the Free-tier goal in measured forecasts. One row per metric/poll and a rich event framework retain unnecessary volume. PostgreSQL compression is not equivalent to wire gzip.

## 10. Compatibility and safe cutover

**Decision**: Preserve public Java `GET /v1/matches` as a temporary array/error compatibility projection over the catalog, using the public discovery credential/adapter rather than the host-JWT transport. Keep registered `refresh-provider-scores` authorization and shape temporarily, returning authorized read/replay/no-op results without provider HTTP. Preserve existing room snapshot and guest transports.

Deploy additive schema and code disabled, link valid legacy records, deploy no-fallback compatibility adapters, fence old SQL claims/acceptance and invalidate leases, drain old deployed revisions/in-flight work, then enable one catalog generation. Deploy migrated clients and verify supported adoption. Old solo tabs/native builds hardcode ESPN: server flags cannot stop those requests. Single-owner/request-savings claims are scoped to migrated clients until refresh/update adoption is established; no new force-update subsystem is silently included.

Safe rollback pauses acquisition/enrichment and serves saved facts with accurate stale/deferred state. Preserve accepted observations/cursors/history; do not revive old independent fetchers. Only a fenced catalog-compatible earlier runner may take over. Schema and Edge deployments are separate verified operations; remote migration inspection must not overwrite canonical local files.

**Alternatives considered**: Permanent parallel legacy fetchers defeat the purpose. A database flag cannot cancel already dispatched HTTP or control code directly calling ESPN on a user device. Dropping the new schema would destroy accepted evidence and replay progress.

## Phase 0 outcome

The agreed analysis remediation makes supported-client scope, failure-pause scope, local solo retention, issuance-bound capability recovery and pending-command outcomes explicit. These policies supersede broader shorthand in earlier proposal notes.

All planning decisions have a selected approach. No unresolved design clarification or unjustified constitution exception remains. Capacity, latency, queue privileges, supported-client adoption and physical-device behavior require implementation-time evidence; they are explicit release gates rather than claims of completion.
