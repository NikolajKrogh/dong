# Implementation and validation — 2026-10-30

Per-player counts are implemented in local setup, all multiplayer lobby modes, and the running-game editor. The shared kickoff formatter uses HH:mm. The unit-only validation exception remains in force: no E2E, browser journey, ARTEMIS or Android-device checks were performed.

## Delivered behavior

- Default additional count plus sparse overrides by stable player identity. Missing override inherits, explicit zero is Common-Match-only, and Use default removes the override. Default changes preserve overrides; reductions below saved selections fail without trimming them.
- Exact individual quotas in automatic, host-assigned and player-picked modes. Registered and session-scoped guest caps use each participant's authoritative target. Host controls include the host's own player-picked target.
- Portable offline generation and server-only HiGHS optimization. Unequal counts prefer configured sharing, including the 3/3/1 K2 construction. Equal positive counts retain exact sharing where the construction fits; a short pool requires consent bound to a reviewed relaxed proposal. Zero targets retain the stored sharing preference.
- Explicit review of per-player allocations, result quality, incomplete summaries and on-demand pair overlap. The shared lifecycle owns immutable handles, reservation ordering, bounded retries, expiry, supersession and frozen replay after an unknown commit outcome.
- Atomic running saves map draft matches to canonical IDs, preserve scores/drinks/departed players/frozen provider metadata, retain drafts on rejection, and expose reloadable conflicts. Existing assignment events record prior and accepted configuration/targets/assignments and consent.
- New maintained rooms explicitly use v2. Recovered/existing legacy rooms stay v1 until explicit host adoption; older servers retain the legacy create fallback. Incomplete v2 target projections stop editing/picking rather than guessing scalar counts.

## Validation

| Check | Verified outcome |
| --- | --- |
| Client CI units |173 suites,1182 tests passed; exit0|
| Database units |74 files,1240 pgTAP assertions passed|
| Deno ingress units |4 passed|
| Client and Edge typechecks |Passed|
| ESLint and Knip |Passed with no warnings/issues|
| Generated database type check |Matches final local schema|
| League catalog |121 leagues agree|
| React Doctor scoped static scan |Completed; no errors,8 reviewed warnings|
| Git diff check |Code passes; the immutable deployed hardening migration retains one blank-line-at-EOF warning|

All database assertions include the preserved legacy suites. The production function was packaged with its WASM asset; unauthenticated hosted requests return401. Successful authenticated generation was exercised in an isolated actual Edge user worker against real local proposal preparation/publication SQL, rather than against hosted user data.

The constrained integrated worker used256MiB, CPU soft1500ms/hard2000ms, per-request accounting and10s lifetime. Measured near-limit14-player total operation:720ms cold/514ms warm; oversized40-player model:77ms fallback; no-solver10-player case:48ms fallback. Counts/membership were independently validated before publication. These include request parsing, SQL preparation/publication, generation and bounded assessment; memory readings are post-operation, not peak RSS. Harness/logs remain under test-results/per-player-match-counts/.

React Doctor's scoped static scan completed without errors. Remaining warnings concern two complex UI/draft functions, constant-size two-player selection lookups, bounded test/probe lookups and intentionally sequential test cases. No rules were suppressed and no numeric score was requested. The initial unbounded/default-base scan was stopped; the completed scan used the multiplayer base and a90s budget.

## Simplification follow-up

The preview's pair inspection now owns its selection state, draft pool requirements are calculated once per render, and nested labels/error branches are explicit. Public preview/commit behavior, consent reset identity, legacy formulas and frozen retries are unchanged. Five affected client suites pass46 tests, including four new legacy/v2 pool-rule cases; TypeScript, ESLint, Knip and the working diff check pass. The scoped React Doctor scan reports no errors and two reviewed warnings (the draft hook's complexity and a lookup over at most two selected players). This client-only refactor requires no database or Edge deployment; E2E/Android remain deferred.

## Supabase rollout

Deployed to DONG qccvlhblytuedgmlqfef using CLI migration versions and explicit function packaging. Dry runs contained only the named migrations, with no seed, roles or Vault changes. All three files are immutable:

- 20261030144426_per_player_match_counts.sql — LF-normalized SHA256 0295a711dbc33dce8a04fe3f756ebb600473b6c1b888676b2c4f583e86451b94
- 20261030155644_per_player_assignment_workflows.sql — LF-normalized SHA256 567c1473a89bcb938c54f60b6cc6af31979d46988989f5f8a0c2a6ba3665d109
- 20261030163739_per_player_assignment_hardening.sql — LF-normalized SHA256 cff7f73657e2372bb85077729dad94b23a99698de3fa3a096f1b95a306311e5b

Before/after checks found39 existing games on policy1 and zero overrides; no existing room was adopted. Target/preview capabilities are now true. Anon cannot adopt v2, and neither anon nor authenticated clients can publish trusted solver results. Host/state/token checks remain inside the private commands. The owner FK has a covering index. Intentional private RLS-without-policy and authenticated SECURITY DEFINER wrapper advisories follow the repository's restricted RPC design; neither grants direct proposal-table access.

## Task/path adjustments

Current code uses GuestRoomContent.tsx, replacing the older GuestJoinLobby.tsx named by the plan. Interface fixtures stay in their owning test files instead of adding unused shared fixture modules. V2 preview transport lives in roomAssignmentTransport.ts and binds through useAssignmentPreview.ts; existing v1 hook transports remain as compatibility paths. Unequal selection/save SQL cases live in per_player_modes.test.sql alongside the preserved legacy suites. Browser fixtures were not expanded under the user's validation exception.

## Recovery and limits

Use forward migrations for corrections. Never edit/replay these deployed files, reset hosted data, drop adopted targets, or revert v2 games to a scalar writer. A temporary client rollback must keep v2 games unavailable to old start/save commands, which reject unsafe writes. Deploy a maintained client from this PR to expose the implemented UI. No merge, app-store release or frontend publication is implied by backend deployment.

Visual layout, authenticated hosted UI journeys, device behavior, and observed real-client reconnect timing remain unverified by explicit user choice. Static/unit/database coverage is not a claim that those runtime checks passed.
