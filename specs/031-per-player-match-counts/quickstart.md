# Quickstart: Per-Player Match Counts

This is a validation/run guide for the planned implementation, not a claim the feature or new commands exist yet. Run from the repository root. See [module interfaces](contracts/assignment-module.md), [room commands](contracts/room-commands.md), [optimization](contracts/assignment-optimization.md), [UI/time](contracts/ui-and-time.md), and [data model](data-model.md).

**Current-run exception (2026-10-30)**: The user requested unit tests instead of E2E and no Android-device testing. Do not perform ARTEMIS/device exploration, author/run E2E tests, or execute browser integration journeys in this run. Retain non-UI unit/database unit tests, static checks and the HiGHS runtime probe. Sections describing device/E2E work remain deferred guidance; their absence must be reported as unverified coverage, never as a pass.

## Prerequisites

- Repository-supported Node/npm (package engines currently specify Node 26.3.1), dependencies installed, Docker and local Supabase available.
- Isolated local/preview accounts: one host, one registered member, and one session-scoped guest. Use synthetic matches and no production/personal data.
- For Android, an installed dev build and one authorized device/emulator. Diagnose with `adb devices -l`; if multiple devices are present, ask the user which serial before an ARTEMIS task.
- Before authoring executable UI test code, explore the target application with ARTEMIS and verify screen transitions and locators. If ARTEMIS errors, run its diagnose/self-heal flow first. Use explicit waits grounded in observed UI state, not assumed delays or arbitrary coordinates.
- Backend/functions must advertise v2 capability before the client exposes individual-target editing. Missing capability must not trigger an unsafe legacy write fallback.

## 1. Runtime compatibility gate before assignment refactoring

Use the selected pinned `highs` 1.15.4 package and bundled WASM in the new Edge function. Verify packaging with the actual local Edge runtime, not just Node/Deno on the host. The existing `supabase/config.toml` uses Deno2; do not infer the hosted engine version solely from that file.

During implementation, discover current CLI flags with help before executing changed CLI workflows:

```powershell
npx supabase functions serve --help
npx supabase migration new --help
npx supabase gen types --help
```

Once the function exists and local test environment is prepared:

```powershell
npm run db:start
npx supabase functions serve room-assignment-preview
```

Keep project/service credentials in the local tool environment, never source fixtures, screenshots, reports or logs. Invoke the function using the isolated host session through the app/integration harness. Verify missing/invalid JWT and nonhost calls fail before solving.

Required runtime observations:

- WASM loads from packaged assets without a CDN, native add-on, Web Worker or Node filesystem assumption unavailable in Edge.
- Cold/warm construction, model build/load, solve, validation and sharing assessment fit below the documented 2-second CPU and 256 MB limits. Start with a 1.5-second entire-generation deadline, at most 0.75 seconds inside HiGHS, and at most 50 ms/50,000 membership comparisons for complete pair assessment; lower budgets if the total approaches the allowance.
- Cases: 3/3/1 K2, 2/2/1 K1, six/eight/ten-player synthetic sets from research; no requirement to prove every case optimal within budget.
- 3/3/1 K2 with four additional pool matches returns exact quotas and the larger pair shares 2.
- Timeout with a valid incumbent returns best effort; no valid incumbent, oversized model or solver load failure uses the independently validated exact-count fallback.
- Oversized solver models use the linear-work fallback without greedy pair-scoring loops. Basic input/output over the 8 MiB/10,000-additional-assignment admission limits returns a capacity error, not a false count-infeasibility error.
- Exercise model-limit cases with the solver skipped entirely; fallback and metric computation must still respect their bounds. Incomplete aggregate assessment is labeled and exposes actual pair overlap on demand, never a zero-deviation claim.
- Expo Android/web builds do not import or package `highs` or its WASM.

Record observed CPU/memory/latency and quality in implementation test artifacts. If HiGHS cannot run within the Edge environment, stop that integration and report evidence before changing the selected hosting architecture. Do not deploy a new Java/native solver service as an implicit fallback.

## 2. Schema and generated contracts

Create a new migration through the existing script during implementation:

```powershell
npm run db:new-migration -- per_player_match_counts
```

Preserve the newest catalog/guest/history guards when replacing function bodies. Work against the local database only. After the migration and types are implemented:

```powershell
npm run db:reset
npm run db:test
npm run db:types
npm run db:types:check
```

Expected: fresh schema validates targets/proposals; preexisting sessions hydrate as v1/null overrides; already-settled assignments and historical totals do not change. A populated legacy upgrade fixture must prove the upgrade path, not just a clean reset. Do not run db:reset against a hosted project.

Extend database suites covering canonical generation (230), host allocation (240), player picks (250), running editor (290), canonical completed history (313), and departure history (314). Add focused proposal/policy authorization, replay, expiry and conflict cases. Test direct proposal-table/service-wrapper access as anon/authenticated host/nonhost/guest, not only app-mediated behavior.

## 3. Focused client and algorithm checks

After implementation, use current existing suites as initial anchors:

```powershell
npm run test:ci -- --runInBand --runTestsByPath __tests__/features/game-setup/createRandomAssignments.test.ts __tests__/features/rooms/roomSnapshotAdapter.test.ts __tests__/features/rooms/useRunningGameDraft.test.ts __tests__/features/football-matches/matchTime.test.ts
```

Also run the new shared-assignment and Edge-adapter suites generated by the implementation tasks. Independent assertions recompute exact quotas, distinctness, selected-pool membership and overlap quality. Test solver output with fractional, negative, nonfinite and incorrect-count values; a success status must not bypass validation. Tiny exhaustive-oracle comparisons verify the MILP formulation; randomized larger cases test invariants and termination.

Exercise preview/commit through the RoomAssignments interface using production and in-memory transport adapters, and generation through its single module operation. Cover two overlapping draft revisions, identical-request coalescing, active reservation busy states, expired-lease supersession, late publication rejection, preview-bound relaxation consent, and accepted commit retry after a lost response. Remove obsolete tests of scalar formulas or incidental transport choreography only once equivalent module-interface regression coverage exists. Keep database authorization/history and real UI-journey coverage.

Persistence cases: missing legacy fields, zero overrides, clearing/default changes, renames/duplicate names, player removal, reset, local history save, room reconnect and switching active contexts. Running/history cases preserve prior drinks/scores/departure data and correct actual per-player counts.

## 4. Primary journeys

Once ARTEMIS exploration has established actual controls, author/run BDD and device coverage for:

1. **Local 3/3/1**: create players/pool/Common Match, lower one target, generate offline, review counts/sharing, start, reopen and verify persistence. Changing default preserves the override; Use default clears it.
2. **Hosted automatic 3/3/1 K2**: host/member/guest see correct targets. Preview with at least four additional matches shows larger-pair overlap2. Start commits the same match IDs as preview; retry does not draw again.
3. **Player picks and host allocations**: targets3/1 have different caps; partial picks are filled only to the right individual target. Lowering below existing picks fails until the participant releases extras. Nonhosts cannot change targets or others' picks.
4. **Stale preview**: prepare, then change roster/pool/picks/default/override/mode or hand over host. Old proposal cannot start/save. Draft remains reviewable and a fresh preview is required.
5. **Running edit**: record a score/drink, add a draft new match, lower a target, preview and save. Earlier gameplay is unchanged; new matches/targets/assignments commit atomically; a failed new-match mapping leaves no partial inserts. Reconnect and history show actual participation.
6. **Solver failure**: force time/model/load failures through test adapters; the host sees a valid fallback or best effort with exact counts, never a false pool-shortage claim.
7. **Legacy clients/games**: v1 starts retain behavior; old scalar automatic writes to adopted v2 fail clearly and never erase overrides. An accepted replay still returns after proposal expiry or cleanup.
8. **24-hour times**: en-US/12-hour preferences on Android and phone/desktop web. Shared match lists show 00:00/09:05/12:00/23:59, no AM/PM or24:00; raw/ISO/legacy AM/PM inputs agree; timezone date rollover and unknown kickoff remain correct. Compact grids/Common Match selectors currently show no kickoff and need no new clock UI.
9. **Equal-count relaxation**: three players with target2, sharing1 and only two additional matches can review a relaxed preview. Declining or omitting consent cannot commit; accepting commits those exact assignments and records consent for that proposal. A replacement preview requires fresh consent. A positive equal count below the configured minimum remains an explicit settings error.
10. **Preview ordering**: duplicate requests for an identical preparing draft do not multiply solves; different drafts receive bounded busy delays. After reservation A's lease expires and B is admitted, A's late publication cannot invalidate B. A UI-discarded old response must not alter the newest draft.
11. **Common-Match-only**: all-zero v2 targets with stored sharing1 succeed locally offline and in hosted automatic mode without extra matches or relaxation consent. The stored preference remains1; returning to positive equal targets applies strict rules. V1 fixtures retain their old behavior.

Playwright's current configuration starts Expo web automatically and has phone/desktop projects. Existing BDD helpers use mocked services; update scalar feasibility fixtures and do not mistake mocked RPC success for database security validation. Run one isolated real-backend integration journey for proposal/commit/reconnect in addition to pgTAP and mocked BDD.

```powershell
npm run test:e2e -- --grep 'per-player|player-picked|configure'
```

Use that filter after the implementation assigns matching scenario titles/tags; if tags differ, run the relevant generated feature files or the complete suite. Avoid claiming an empty filtered run as a pass.

## 5. Required completion checks

```powershell
npm run test:ci -- --runInBand
npm run typecheck
npm run lint
npm run typecheck:edge
npm run db:types:check
npm run doctor
npm run test:e2e
git diff --check
```

Add the new preview entry point to `typecheck:edge` during implementation; the current script does not include it. Run local Edge checks on the entire assignment operation, including the no-solver fallback, separately from typechecking. Run database tests after the final migration change. React Doctor applies after React changes; there is no reason to run application tests merely for this planning-only document change.

## 6. Release and recovery

Validate locally, then deploy schema/commands/projections before Edge assets and the capability-gated client. Hosted deployment requires its own authorized execution; this guide does not authorize a production rollout.

Recovery: disable new adoption/previews if needed, retain existing v2 schema/read/commit support and saved overrides, and let adopted games complete. Do not drop target columns, delete events, backfill invented targets, change stored kickoff instants, or re-enable old scalar writers for v2. Verify history, accepted command replays and guest/member access remain functional after recovery.
