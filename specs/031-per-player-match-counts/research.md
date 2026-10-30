# Research: Per-Player Match Counts

Date: 2026-10-30. Status: Phase 0 complete; user selected Option B (hosted HiGHS with offline fallback), and Phase 1 design is complete in the accompanying artifacts.

## Confirmed product decisions

- Individual additional-match counts are mandatory; Common Match is separate.
- Unequal counts use sharing as a preference. A 3/3/1 group with preference 2 must retain two shared additional matches between the players with 3 when the pool allows.
- Equal-count behavior remains compatible, including explicit relaxation.
- Match times always use 24-hour HH:mm.
- User permits refactoring existing assignment code and requested Exa library research before another design question.

## R1 — Existing implementation and necessary reach

**Decision**: Keep game configuration and accepted multiplayer assignments authoritative in Postgres. Local games remain offline-capable. Extend existing components rather than add another setup flow.

**Rationale and source evidence**:

| Boundary | Current owning source | Change implication |
| --- | --- | --- |
| Local generation | `features/game-setup/createRandomAssignments.ts:273` | Hardcodes one shared additional match per pair; called by `SetupGameScreen.tsx:357`. |
| Lobby plan and start | `supabase/migrations/20260926155808_guest_active_roster.sql` | `private.compute_room_assignment_plan` and `private.start_game_session` use a single scalar and active-roster filtering. |
| Lobby settings | `supabase/migrations/037_host_assigned_mode.sql:196` | Current validation imposes the automatic minimum and no explicit maximum. |
| Running editor commit | `supabase/migrations/20261026164719_match_catalog_retention.sql:645` | Latest implementation includes catalog drain/capacity checks; never copy an obsolete body from an earlier migration. |
| Running configuration token | `supabase/migrations/20261022172949_multiplayer_game_editor.sql` | Must include individual targets and any persisted preview identity. |
| Registered picks | `supabase/migrations/038_player_picked_mode.sql` | Replace scalar cap with caller participant's resolved target. |
| Guest picks | `supabase/migrations/20260920095616_harden_guest_room_access.sql` | Retain room-token identity boundary and resolve that participant's cap. |
| Snapshots and history | `supabase/migrations/20261029170000_freeze_match_history_snapshots.sql` | Latest snapshot/history projection must retain frozen catalog history. |
| Departed players | `supabase/migrations/20260928163507_preserve_in_game_leavers.sql` | Immutable departure snapshot needs actual targets and assignment counts. |
| Local state and history | `store/gameStore.ts` | Add sparse overrides to persistence, resets, removal, history saves, and hydration. |
| Local hydration | `features/rooms/roomSnapshotAdapter.ts` | Currently hydrates players/matches/assignments, not target settings. |
| Interfaces | `types/room.ts`, `types/guestRoom.ts`, `features/rooms/roomRpcClient.ts` | Extend requests and snapshots additively; remove scalar assumptions from consumers. |
| Editor preview | `features/rooms/useRunningGameDraft.ts` | Currently duplicates scalar minimum/pool formulas client-side. |
| Lobby consumers | `useLobbyAssignmentController.ts`, `RoomLobbyWizard.tsx`, `RoomAssignmentPlayers.tsx`, `GuestJoinLobby.tsx`, `PlayerPickPanel.tsx` | Per-player caps, progress, feasibility, and displayed totals. |
| Default controls | `features/rooms/AssignmentSettingsPanel.tsx`, `features/game-setup/AssignmentSection.tsx`, `AssignmentControls.tsx` | Reuse counter/card patterns; player-specific labels and reset-to-default action. |
| Retired importer | `supabase/migrations/20261001172204_retire_history_import.sql` | Do not resurrect history import to support this feature. |
| BDD fixtures | `e2e/steps/browser-flow.helpers.ts` | Recomputes scalar feasibility and must evolve with contracts. |

**Alternatives considered**: Adding Java assignment CRUD duplicates the existing database boundary. A separate target table adds lifecycle/RLS work that a nullable participant column avoids.

## R2 — Persistence proposal independent of solver selection

**Decision**: Retain `game_sessions.matches_per_player` as group default. Add nullable `participants.additional_match_count`; null follows default, zero means Common Match only. Local state uses a sparse `playerMatchCounts` map keyed by stable player ID.

**Rationale**: Stable identity and existing participant lifetime already exist. No new table or per-player account preference is necessary. Add override/resolved count to room participant projections and preserve actual counts in history.

**Validation and compatibility**:

- Running editing currently bounds count/sharing to 0..100, added matches to 100, and submitted assignment rows to 10,000. Lobby currently lacks the same explicit upper count bound. Implementation must deliberately unify new edits at 0..100 without retroactively rewriting legacy games.
- Additive migration defaults overrides to null; no backfill of invented targets, no assignment regeneration, no historical score/drink changes.
- Host-only atomic settings writes must validate default, sharing, overrides, roster membership, and existing picks/allocations together. A reduction below current lobby selections fails until selections are explicitly released.
- Extend configuration fingerprint and replay payload with target settings. Replays of accepted operations return accepted results before stale-token checks, following running-save precedent.
- Keep omission of overrides distinct from explicit replacement/clearing. Legacy writes preserve existing overrides and validate against them, or fail clearly if unsafe.
- Persist old/new targets in the existing assignment-replacement event payload; do not introduce a second history system.
- Server-first rollout, capability-advertised editing, retained legacy read fields, regenerated database types. Rollback disables new override creation but retains schema and unequal-game-aware readers/writers until those games finish.
- Any library proposal must be independently validated before commit: active participants, pool membership, distinct matches, exact individual counts, Common Match, expected configuration token, authorization, and replay key.

## R3 — Why best-effort versus perfect sharing needs an explicit decision

**Finding**: Existing automatic construction allocates distinct matches to pairs and then private extras. It is fast but not a complete search over all possible shared sets.

Example: targets 2/2/1 with preference 1 can meet every pair's preference by sharing one additional match among all three and giving the two larger players one private match each. Pair-exclusive construction cannot represent this solution.

No hard roster limit was found. Complete search over arbitrary match membership is combinatorial. A solver can find and sometimes prove an optimal arrangement, but no library guarantees short running time for every unrestricted input. Timeouts or numerical failures must never be reported as proof that counts are infeasible.

**Decision**: Following the library trials and explicit explanation of time-limit behavior, the user selected Option B: stronger hosted HiGHS optimization with a separate offline fallback. Exact counts remain mandatory; global optimality after timeout is not promised. FR-008 and its acceptance scenarios now express this bounded guarantee.

## R4 — Exa library comparison

Primary project documentation and published package metadata checked on 2026-10-30. Repository main branches and published packages are distinguished below.

| Candidate | Evidence | Fit and limitation |
| --- | --- | --- |
| YALPS 0.6.4 | [README](https://github.com/IanManske/YALPS), [published metadata](https://registry.npmjs.org/yalps/0.6.4) | MIT, TypeScript, browser support, one runtime dependency (`heap`). Small mixed-integer solver with explicit optimal/timedout/cycled statuses. Dense matrix; author recommends small problems. No React Native or Supabase Edge runtime validation performed. |
| HiGHS JS 1.15.4 (`highs`) | [README](https://github.com/lovasoa/highs-js), [package](https://www.npmjs.com/package/highs) | MIT, WebAssembly, documented Node/browser support; stronger optimizer. Needs WASM initialization/assets. React Native Hermes compatibility is not established; offline Android cannot be assumed to run it. |
| javascript-lp-solver 1.0.3 | [repository](https://github.com/JWally/jsLPSolver), [published metadata](https://registry.npmjs.org/javascript-lp-solver/latest) | Unlicense, no runtime dependencies, JS/TS, browser/Node support. Current master README describes substantial fixes beyond published 1.0.3 and reports incorrect vectors in older solver work; do not treat master benchmarks as published-version guarantees. Not benchmarked for DONG. |
| GLPK.js 5.0.0 | [repository](https://github.com/jvail/glpk.js), [published metadata](https://registry.npmjs.org/glpk.js) | LP/MILP, Node/browser WebAssembly. GPL-3.0 and WASM integration offer no clear simplicity advantage over MIT HiGHS for this app. Not benchmarked for DONG. |

**Selected**: HiGHS JS (`highs`), initially pinning the researched 1.15.4 release for the server compatibility spike. Keep WASM out of the native bundle and use a portable local fallback. YALPS and javascript-lp-solver are not added. No application dependencies were installed during planning.

## R5 — Synthetic experiments actually executed

Packages were installed only in disposable tool temporary directories with install scripts disabled. Repository package.json and lockfile were not changed. Synthetic Node trials used no personal or production data.

A small membership-group model used one nonnegative integer per nonempty subset of players: how many distinct matches belong to exactly that subset. Constraints fix each player's count and bound distinct pool usage. Pair shortfall/excess variables minimize the sum of absolute deviations from the requested overlap. This avoids assigning particular match IDs during optimization; labels can be shuffled afterward without changing counts or overlap.

The model has `2^N - 1` membership variables, so this prototype is unsuitable for an unrestricted roster. A production design needs a model-size guard or a different formulation, plus a fallback or explicit supported-size policy. An incidence formulation instead grows with players, pool size, and player pairs; it also requires benchmarking.

Independent checks recomputed individual counts, nonnegative integrality, pool usage, and pair deviation rather than trusting solver status alone.

| Synthetic case | YALPS 0.6.4 | HiGHS JS 1.15.4 |
| --- | --- | --- |
| 3/3/1, preference 2, 4 additional pool matches | Optimal; about 1 ms; overlaps 2/1/1 | Optimal; about 34 ms; overlaps 2/1/1 |
| 2/2/1, preference 1, 3 additional pool matches | Optimal; under 1 ms; all pair overlaps 1 | Optimal; about 6 ms; all pair overlaps 1 |
| 3/3/1, preference 0, 7 additional pool matches | Optimal; under 1 ms; no overlap | Not run |
| 6 players: 3/3/3/3/2/1, preference 1, pool 10 | Optimal; about 4 ms; zero deviation | Optimal; about 8 ms; zero deviation |
| 8 players: 4/4/4/3/3/2/2/1, preference 1, pool 12 | Cycled; about 106 ms; no solution returned | Optimal; about 1,040 ms; total deviation 3 |
| 10 players: 4/4/4/4/3/3/3/2/2/1, preference 1, pool 15 | Cycled; about 503 ms; no solution returned | 1.5 s time limit; valid exact-count incumbent with total deviation 5; optimality not proven |

These are single synthetic desktop Node trials, not representative performance benchmarks or Android/Edge compatibility claims. HiGHS load was about 17 ms in the initial process. The first HiGHS check used overly strict exact floating-point equality for summed counts; it was corrected to verify each variable's integrality within tolerance, round it, then validate exact integer counts. The subsequent 8/10-player validations passed. This is why server-side independent integer validation remains required.

## R6 — Solver integration and refactor options

**Option A: shared TypeScript optimizer with bounded fallback**

- One target/model/assignment module for local games, web, and a server Edge function; YALPS is the lighter candidate.
- Hosted preview/start/running-edit generation moves out of duplicated SQL search loops. Postgres remains the only committer and validates exact counts and configuration identity under lock.
- For shared previews, server stores or otherwise authenticates the generated proposal against the exact configuration token. Start consumes the reviewed proposal rather than rerandomizing it; stale proposals fail and require refresh.
- No client-provided solver status is trusted. A member/guest cannot inject assignments or declare a proposal optimal.
- Server computation runs outside the database transaction. The commit reacquires room locks and compares roster/pool/targets/token before any write; it never holds a database lock while solving.
- Preserve latest catalog admission/drain/capacity, guest-active-roster, event-history, and idempotency safeguards while replacing only assignment search.
- Native import/bundle and Edge compatibility must be verified before selecting a package. Model-size/solve limits and fallback status are explicit, not silent claims of perfection.

**Option B: stronger hosted HiGHS optimization**

- Same validated database commit boundary, but WASM assets and initialization are added server-side.
- Supabase documents [WASM support](https://supabase.com/docs/guides/functions/wasm); that is not proof this particular wrapper deploys successfully. An actual Edge packaging/CPU/memory probe is required.
- Browser support is documented; React Native Hermes offline support is not. A separate portable fallback or verified native execution path is required for local games.
- Stronger solving does not eliminate timeouts, input-size guards, numeric validation, or proposal consistency work.

**Option C: keep/refactor existing constructive generators**

- Fewest dependencies and least change to the transaction boundary.
- Exact counts and prioritized larger-player sharing are straightforward, but arbitrary optimal overlap is not guaranteed.
- SQL/TypeScript generation still needs aligned rules and common fixture coverage; a library cannot run directly inside PL/pgSQL.

**Decision confirmed**: The user chose Option B. The implementation uses one hosted preview orchestrator, private proposal storage, canonical SQL validation/commit, and a portable constructive fallback. See the final plan and contracts for the selected interfaces; Options A/C remain evaluated alternatives only.

## R7 — 24-hour inventory and minimum change

**Decision**: Reuse `features/football-matches/matchTime.ts` and normalize every recognized clock value to HH:mm. Keep existing timezone conversion and unknown-time indications. Use an explicit h23 hour cycle and stable Latin-digit colon-separated clock output for instants; do not just remove AM/PM text.

- `matchTime.ts:25` currently forces `hour12: true`; ISO instants and ESPN fallback use en-US time formatting. Bare clock strings pass through, including `9:05` and `15:00:00`; normalize those to `09:05` and `15:00` after bounds validation.
- `SelectableMatchList.tsx:99` is its sole production caller. Noncompact rows affect match discovery/selection, setup assignments, lobby pool/allocation, registered/guest picks, and the running editor. Compact grid rows show no kickoff; CommonMatchSelector currently shows no kickoff.
- `useMatchData.ts:54` produces local HH:mm discovery strings already; preserve its timezone semantics.
- `platform/date-input/PlatformTimePicker.tsx:46` already sets `use24HourClock`.
- `__tests__/features/football-matches/matchTime.test.ts` currently requires AM/PM and preserves unnormalized bare clocks; update those expectations and add midnight/noon, bounds, unknown values, and date-rollover cases during implementation.
- `MatchesGrid/LastUpdatedFooter.tsx:120` can show locale-dependent AM/PM for refresh time; `history/historyFormatting.ts:32` can do so for session completion time shown by GameDetailsModal and PlayerDetailsModal. These are not kickoff times. Record them as adjacent inventory, not evidence of another kickoff formatter; changing unrelated timestamps is outside the current specification's assumption.

**Alternatives considered**: Per-screen fixes duplicate behavior and miss shared call paths. Switching to hour12 false alone does not address raw 9:05/seconds inputs or stable punctuation/digits across all locales.

Primary reference: [Intl.DateTimeFormat options](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat).

## R8 — Coverage and governance

Applicable skills consulted: speckit-plan, ponytail, Supabase, Supabase Postgres best practices, UI Taste (operate), and Exa Search; Context7 used for solver status/tolerance documentation. Codegraph already reported no usable index for this worktree; source investigation used rg and direct owning-source reads.

Extend unit suites for local assignment, room adapter, room RPCs, running drafts, history mapping, persistence, and matchTime; database suites 230, 240, 250, 290, 313, and 314; BDD configure-start-game and player-picked-two-devices plus relevant browser helpers. New executable UI tests require ARTEMIS exploration first, not fabricated screen interactions. Planning has not authored UI test code or exercised a device.

Constitution constraints: web/Android parity; canonical shared commits; immutable event history; Supabase-first; unit/database/end-to-end coverage; required skill use. A solver Edge function is orchestration only, not a duplicate CRUD backend. No production changes are authorized by this planning task.

Checked the Supabase changelog index and current function/RLS documentation. Recent TLS cipher removal scheduled for November 10 affects obsolete HTTP clients, not the proposed target schema; no relevant schema/RPC breaking change was identified in the inspected current entries. See [changelog](https://supabase.com/changelog.md), [database functions](https://supabase.com/docs/guides/database/functions), and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## R9 — Final runtime and modeling decisions

**Decision**: Use the published HiGHS JS 1.15.4 server entry with explicit bundled WASM bytes. Run a local Edge compatibility/CPU/memory spike before integrating mutations. Do not ship HiGHS in the Expo bundle. The spike is an implementation acceptance gate, not evidence that compatibility has already passed.

Use the polynomial incidence model described in `contracts/assignment-optimization.md`, not the prototype's exponential enumeration of all player subsets. Keep cheap constructive candidates as a warm start/fallback. Independently validate decoded integer assignments and compare their actual sharing deviation to the fallback before accepting a candidate.

Supabase documents a 2-second CPU allowance and 256 MB memory per request, with no Web Worker API: [Edge limits](https://supabase.com/docs/guides/functions/limits). Initial design budgets are a 1.5-second entire-generation deadline, at most 0.75 seconds inside HiGHS, 20,000 binary variables, 60,000 constraints, and 8 MiB serialized model input; oversized models use the linear-work fallback. Full pair assessment is capped at 50 ms/50,000 membership comparisons, with incomplete summaries labeled. Basic input/output limits (8 MiB/10,000 additional assignments for v2) are distinct from mathematical count feasibility. Cold-start/WASM/model-building overhead must also fit the CPU allowance. These are implementation starting limits to verify/lower, not measured production guarantees. A longer wall-clock allowance is not permission to extend CPU time.

Private, expiring proposals bind exact assignments to actor, room, pre-solve reservation identity, base configuration token, configuration hash, sharing policy and consent requirement. Start/save consumes the reviewed proposal without another draw. Host-authorized prepare reserves private metadata; service-only publication compares current identity/lease, and host-JWT commit validates the result. Keep room locks short and outside optimization. See R10 for the review-driven lifecycle correction.

**Alternatives considered**: The subset model was excellent for small exploratory cases but grows as 2^N. Calling native Java/Python OR-Tools adds another runtime/platform path and does not simplify offline Expo. A queue/service or paid infrastructure is unnecessary for bounded previews; failure of the Edge spike must be reported before changing the selected hosting architecture.

## R10 — Design review corrections

The user requested updates to all five findings from the codebase-design review. These decisions apply together across spec, plan, data model and contracts:

1. **Relaxation consent**: derive an immutable exact/preference/relaxed/common-only preview policy. A relaxed positive-equal preview requires explicit acceptance of that same proposal; consent is part of the commit fingerprint/history and cannot change assignments after review.
2. **Preview ordering**: reserve identity before computing, coalesce identical input, admit one live 10-second lease per actor/room/purpose, and require compare-and-set publication of the current reserved identity. New admissions have a 2-second cooldown; client pending retries are sequential and bounded to two. Expired/older results cannot replace newer reservations. Reuse the proposal table; no new queue infrastructure.
3. **Bounded fallback**: replace per-slot pair-scoring with a cyclic count-only baseline in linear input/output work, plus cheap core/exact constructions. Bound independent full assessment too; report incomplete aggregates and expose actual pair overlaps on demand. Basic output admission remains explicit and distinct from count feasibility.
4. **All-zero exception**: new-policy local/hosted games use Common Match only despite a stored positive preference; no sharing minimum or consent. Keep the preference for later positive targets and preserve legacy-policy behavior.
5. **Deep module and test seam**: RoomAssignments owns preview/commit lifecycle with an injected owned-remote transport adapter; generation owns candidate construction/selection/validation behind one in-process operation. Existing hooks bind context; screens do not coordinate protocol steps. Tests cross these interfaces, replacing obsolete scalar/choreography tests once equivalent coverage exists.

See [module interfaces](contracts/assignment-module.md). Applicable skill: `C:/src/dong/.agents/skills/codebase-design/SKILL.md` and its `DEEPENING.md` guidance on depth, locality, real adapters and replacing redundant shallow tests. These are design updates, not evidence that any runtime check has passed.

## Planning gates

User policy/library choice is resolved. Constitution review passed at research exit and after the data model/contracts were designed. Runtime compatibility, numerical/property tests, UI exploration, and deployment remain implementation validation, explicitly listed in `quickstart.md`; none are claimed complete by this plan.
