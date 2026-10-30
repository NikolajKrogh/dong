# Tasks: Per-Player Match Counts and 24-Hour Match Times

**Input**: Design documents in `specs/031-per-player-match-counts/`.
**Branch**: `191-per-player-match-counts`
**Created**: 2026-10-30
**Status**: Implementation complete under the user-authorized unit-only validation scope. See [implementation.md](implementation.md) for delivered behavior, rollout, exact verification and remaining runtime limits.

## User-Authorized Validation Override — 2026-10-30

The user requested unit tests instead of E2E and explicitly instructed no Android-device testing for now. This supersedes exploration-first and browser/device validation instructions below. Unit testing may proceed without ARTEMIS. Retain client/domain/component and database unit coverage, static checks and the non-UI HiGHS runtime gate. T001, T016, T017, T033, T034, T044, T054, T055, T060 and T064 are deferred by user request, not completed. In mixed tasks T018/T037/T045/T056/T059/T061, perform only unit/static/non-UI checks and defer Android/ARTEMIS/BDD portions. In T006/T036 do not create new E2E fixtures just for this feature; preserve existing fixtures unless a shared contract change breaks existing tests. T001 no longer blocks test authoring, T034 no longer blocks T055 (both deferred), and no device/E2E task blocks current implementation. Keep deferred entries unchecked with this explicit disposition; do not report them as passes.

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [module interface](contracts/assignment-module.md), [optimization](contracts/assignment-optimization.md), [room commands](contracts/room-commands.md), [UI/time](contracts/ui-and-time.md), [quickstart.md](quickstart.md).

**Tests**: Constitution V requires unit tests for new behavior, pgTAP for database changes and primary Playwright BDD journeys for substantial UI changes. Explore with ARTEMIS before authoring any test code. Write pure/contract tests before corresponding logic; refresh ARTEMIS exploration after new controls exist before authoring their UI journeys. The explicit validation override above applies to this run.

**Organization**: Five story phases, runtime setup, minimal count-story foundations and final integration gates. US5 is independent of solver/count work after baseline exploration. These tasks do not authorize deployment, commits or discarding unrelated edits.

## Format and Execution Rules

- Tasks use `- [ ] Tnnn [P?] [USn?] Action with file paths`.
- `[P]` means file-independent work within its stated ready wave, not permission to ignore dependencies or use one device concurrently.
- Task paths are repository-relative; use absolute paths for filesystem operations.
- Preserve unrelated edits. Read applicable skills before implementation, including Supabase for shared persistence, React Native Testing for component tests and React Doctor after React changes.
- Tests cross the documented module interfaces; do not expose internal helpers merely for tests or layer redundant tests over obsolete scalar logic.
- Serialize edits to shared SQL/client/fixture files. Use the newest protected function bodies identified in research, not old copies.
- Mark tasks complete only after callers, fixtures, required checks and evidence are complete.

### Migration Path Binding

T005 creates the migration through the existing CLI script and records its exact returned filename here before subsequent migration work.

**Deployed foundation**: `supabase/migrations/20261030144426_per_player_match_counts.sql` was created during T005 and deployed on2026-10-30. It is immutable. Completed T005/T011 refer to that file. For every remaining SQL task, `$MIGRATION` means `supabase/migrations/20261030155644_per_player_assignment_workflows.sql`, created through the CLI in T068. See [deployment.md](deployment.md). Final audit/guard/index hardening is in CLI-created, deployed `supabase/migrations/20261030163739_per_player_assignment_hardening.sql`; all deployed files are immutable.

## Phase 1: Setup and Runtime Gate

**Goal**: Establish verified test interactions and prove the selected hosted runtime before integrating HiGHS with canonical mutations.

- [ ] T001 Diagnose devices with `adb devices -l`, ask for a serial if ambiguous, and explore existing setup, host/member/guest picks, running editor and match-time displays using ARTEMIS; record verified states/locators and isolated-data prerequisites in `test-results/per-player-match-counts/exploration.md` before authoring test code; follow ARTEMIS diagnosis/self-heal rules on errors.
- [X] T002 After T001, add the minimal pinned server-only HiGHS 1.15.4 loader/assets and an assert-based import/solve probe in `supabase/functions/_shared/assignments/highsOptimizer.ts`, `supabase/functions/_shared/assignments/runtimeProbe.ts` and `supabase/functions/room-assignment-preview/deno.json`; configure packaged WASM/its MIT notice in `supabase/config.toml`, discover current CLI commands, and keep HiGHS outside Expo dependencies.
- [X] T003 Run the probe in the actual local Edge runtime and record cold/warm load, solve/asset, CPU and memory evidence in `test-results/per-player-match-counts/runtime.md` and `specs/031-per-player-match-counts/research.md`; if hosting cannot fit its limits, stop solver mutation integration and report evidence without silently changing architecture. T035 later validates the entire operation.

**Checkpoint**: T001 gates test authoring. T003 gates hosted optimizer integration, not the independent time story. Desktop Node trials are not proof of Edge compatibility.

## Phase 2: Foundations for Count Stories

**Goal**: Establish shared contracts, a concrete migration path and synthetic fixtures. This phase serves US1–US4 and does not block US5.

- [X] T004 Define generation/quality, sharing policies, opaque preview/consent/domain issues and additive snapshot/request types in `shared/assignments/types.ts`, `types/room.ts` and `types/guestRoom.ts`, following `specs/031-per-player-match-counts/contracts/assignment-module.md`; keep protocol identity out of screen-facing handles.
- [X] T005 Create the migration with `npm run db:new-migration -- per_player_match_counts` and replace the MIGRATION binding in `specs/031-per-player-match-counts/tasks.md` with the exact CLI-generated path; do not edit old migrations or backfill assignments.
- [X] T068 Before remaining SQL work, create a follow-up with `npm run db:new-migration -- per_player_assignment_workflows` and bind its exact filename above. Keep the deployed foundation unchanged. Enable capabilities and authenticated v2 adoption only after the corresponding start/save/pick paths are complete and validated.

- [X] T006 Establish reusable synthetic legacy/v2, member/guest, 3/3/1, zero-count and Common Match representation fixtures in owning unit-test fixture builders, and minimally adapt `e2e/steps/browser-flow.helpers.ts` for target-bearing snapshots; exclude credentials/production data and avoid duplicating the optimizer in fakes.

**Checkpoint**: Shared count contracts/fixtures are ready. Capability advertisement waits for each corresponding server path to be implemented and validated.

## Phase 3: US1 — Give a Player Fewer Matches (P1, First Demonstrable Increment)

**Goal**: Configure, persist and display targets; demonstrate 3/3/1 through local manual assignment and a fully allocated host-assigned room.

**Independent validation**: Default3, one override1, manual allocations3/3/1, start and reopen/reconnect with exact counts plus Common Match. Default changes preserve overrides; clearing restores inheritance. Automatic optimization and unfinished participant-picked filling arrive in US2/US3 rather than being claimed by this checkpoint.

### Tests First

- [X] T007 [US1] Add default/null-versus-zero, bounds, stable identity, Common Match exclusion, persistence/reset/removal and legacy-hydration assertions through existing store/snapshot interfaces in `__tests__/store/perPlayerMatchCounts.test.ts` and `__tests__/features/rooms/roomSnapshotAdapter.test.ts`; include all-zero v2 with stored sharing1 and unchanged legacy assignments, then establish expected failures without exporting private helpers.
- [X] T008 [P] [US1] Add host authority, invalid participant keys/values, default-induced reductions, atomic rejection below existing selections, stale writes/replays, v1 compatibility and common-only cases in `supabase/tests/database/per_player_targets.test.sql` before target mutation implementation.

### Implementation and Journey Coverage

- [X] T009 [US1] Implement target/policy rules needed by the generation module inside `shared/assignments/generateAssignments.ts`: null inheritance, exact quotas, bounds, positive-equal minimum validation, all-zero exception and distinct capacity/count errors; keep internal helpers private and preserve v1 behavior.
- [X] T010 [US1] Extend active/local-history state, safe legacy hydration, v2 reset/adoption and override pruning in `store/gameStore.ts`; preserve saved assignments, historical totals and unrelated preferences rather than clearing persisted storage.
- [X] T011 [US1] Add policy/version and nullable participant target columns, constraints and authorized target resolution in `$MIGRATION`; retain participant ownership/indexes and leave existing rows v1/null without historical event/assignment rewrites.
- [X] T012 [US1] Implement atomic host configuration, complete override-map replacement, default/reduction validation and the fully allocated host-assigned branch of v2 start in `$MIGRATION`; preserve locks, authoritative roster, catalog safeguards and replay/events without invoking HiGHS or advertising unfinished automatic support.
- [X] T013 [US1] Add target/capability/fence projections and v1 fallbacks in `$MIGRATION`, `features/rooms/roomSnapshotAdapter.ts`, `features/rooms/hostRoomRpcClient.ts`, `features/rooms/roomRpcClient.ts`, `types/hostRoom.ts`, `types/room.ts` and `types/guestRoom.ts`; explicitly create/adopt v2, regenerate `types/database.types.ts` and prevent room hydration from corrupting separate solo state.
- [X] T014 [US1] Reuse counters/cards for a labeled default, per-player resolved count/override and Use default in `features/game-setup/AssignmentSection.tsx`, `features/game-setup/AssignmentControls.tsx`, `features/rooms/AssignmentSettingsPanel.tsx` and `features/rooms/RoomAssignmentPlayers.tsx`; preserve host authority, player-specific accessible labels, busy/error state and capability gating.
- [X] T015 [US1] Wire persisted targets and exact manual-start validation through `features/game-setup/SetupGameScreen.tsx`, `features/rooms/useRoomConfigure.ts` and `features/rooms/RoomLobbyWizard.tsx`; keep Common Match separate, retain drafts on errors and never route unfinished v2 automatic behavior through scalar legacy writers.
- [ ] T016 [US1] Refresh ARTEMIS exploration of implemented local controls, then add the verified override/default/reopen journey in `e2e/features/per-player-targets-local.feature` and `e2e/steps/per-player-targets-local.steps.ts` with dynamic locators/explicit waits; record `test-results/per-player-match-counts/us1-local.md`.
- [ ] T017 [US1] Refresh ARTEMIS exploration of host/member/guest target displays, then add fully allocated host-assigned/reconnect coverage in `e2e/features/per-player-targets-room.feature` and `e2e/steps/per-player-targets-room.steps.ts`; distinguish mocked client evidence from database authority and record `test-results/per-player-match-counts/us1-room.md`.
- [X] T018 [US1] Run focused unit/pgTAP/BDD suites and verified Android local/host-assigned journeys; record evidence and outstanding gates in `specs/031-per-player-match-counts/implementation.md`, keeping unsupported capabilities unavailable rather than declaring the entire feature release-ready.

**Checkpoint**: Manual unequal participation is demonstrable without a solver. Full release still requires mode parity and final gates.

## Phase 4: US2 — Automatically Assign Unequal Counts (P1)

**Goal**: Hosted optimization and portable fallback preserve quotas, with trusted immutable previews and one owning client module.

**Independent validation**: 3/3/1 K2 and four additional matches gives the larger pair overlap2. Cover K0, 2/2/1 K1, all-zero with K1, strict-equal shortfall/consent, runtime/model failures, supersession and frozen accepted retry identity.

### Tests First

- [X] T019 [US2] Add generation-interface assertions in `__tests__/shared/assignments/generateAssignments.test.ts` for quotas, common-only, core/disjoint constructions, pool membership, duplicates, invalid/fractional optimizer vectors, capacity versus infeasibility, deadlines and partial assessment; use tiny independent oracles/randomized invariants without exposing LP helpers.
- [X] T020 [P] [US2] Add lifecycle contract tests and an in-memory transport adapter in `__tests__/features/rooms/roomAssignments.test.ts` for consent, immutable previews, current draft, coalescing, two bounded retries, late responses, expiry and frozen replay after a lost response.
- [X] T021 [P] [US2] Add proposal pgTAP in `supabase/tests/database/per_player_assignment_proposals.test.sql` for current-row uniqueness, 10-second leases, 2-second admission cooldown, pending/busy reuse, late A after B, trusted publication, forged identity/quality, host authority, expiry/cleanup, consent and replay ordering.

### Generation, Persistence and Orchestration

- [X] T022 [US2] Complete `shared/assignments/generateAssignments.ts` with an O(N + M + A) cyclic baseline, cheap core/exact constructions, injected randomness and discrete validation; retain the 3/3/1 K2 candidate and common-only handling, with no greedy per-slot pair-scoring loop.
- [X] T023 [US2] Add whole-generation deadline accounting, model/output admission, bounded independent incumbent comparison and 50 ms/50,000-comparison quality assessment inside `shared/assignments/generateAssignments.ts`; expose incomplete summaries/on-demand pair overlap, never false infeasibility or unjustified optimality.
- [X] T024 [P] [US2] Extend `supabase/functions/_shared/assignments/highsOptimizer.ts` with the guarded incidence model, hard quotas, AND overlap/deviation constraints, finite near-integer decoding and remaining-time budget; extend `supabase/functions/_shared/assignments/runtimeProbe.ts` with tiny model-oracle/timeout checks through the optimizer interface, keeping WASM server-only.
- [X] T025 [P] [US2] Add private proposal storage/state constraints, current-row partial uniqueness, expiry indexes and bounded cleanup in `$MIGRATION`; reserve before solving, retain cooldown metadata and keep assignment results absent until publication. Run after earlier migration work and serially with T026–T028.
- [X] T026 [US2] Implement host-scoped prepare/admission in `$MIGRATION`: normalize authoritative drafts, derive sharing/consent policy, reserve current identity under a short lock, reuse identical input and return bounded pending/busy delays; never hold a lock during computation.
- [X] T027 [US2] Implement service-only compare-and-set publication in `$MIGRATION`, validating actor/token/configuration/policy/quota/pool and current unexpired reservation; late work cannot invalidate a newer result, and direct table/wrapper grants remain restricted.
- [X] T028 [US2] Complete automatic v2 start in `$MIGRATION`: consume the exact ready proposal, replay before stale/expiry validation, require/record proposal-specific relaxed consent and preserve catalog cutoff/capacity/pending behavior; guard unsafe legacy writes and regenerate `types/database.types.ts`.
- [X] T029 [US2] Implement `supabase/functions/room-assignment-preview/index.ts` and `supabase/functions/room-assignment-preview/handler.ts` using authenticated preparation, the generation module with HiGHS, and trusted publication; validate JWT/host before expensive work, bound input and never expose arbitrary solver inputs or credentials.
- [X] T030 [US2] Implement `features/rooms/roomAssignments.ts` with latest-context reader and owned-remote transport seam, wiring `features/rooms/roomRpcClient.ts`, `features/rooms/startGameClient.ts` and `types/room.ts`; centralize version routing, opaque handles, busy delays, consent/expiry and unknown-outcome replay behind preview/commit.
- [X] T031 [US2] Bind the module inside `features/rooms/useRoomConfigure.ts` and `features/rooms/useLobbyAssignmentController.ts`, and add explicit preview, pair inspection, incomplete-quality labels and per-preview consent in `features/rooms/RoomLobbyWizard.tsx`; screens do not coordinate protocol phases or solve on polling/every counter change.
- [X] T032 [US2] Connect local automatic setup to generation in `features/game-setup/createRandomAssignments.ts` and `features/game-setup/SetupGameScreen.tsx`, preserving v1 behavior, implicit sharing1, Common Match representations and offline use; add the Edge entry to `package.json` typecheck coverage and exclude HiGHS/WASM from Expo imports.
- [ ] T033 [US2] After fresh ARTEMIS exploration, add automatic mocked multi-context coverage in `e2e/features/per-player-automatic.feature` and `e2e/steps/per-player-automatic.steps.ts` for 3/3/1 K2, K0, all-zero, fallback, stale/superseded previews and declined/replaced consent; match IDs remain identical across preview/start/retry.
- [ ] T034 [US2] Add an isolated real local-backend proposal/start/reconnect journey in `e2e/features/per-player-assignments-backend.feature`, `e2e/steps/per-player-assignments-backend.steps.ts` and `playwright.assignments.config.ts`, reusing browser helpers/synthetic accounts; assert actual accepted assignments rather than mocked authority.
- [X] T035 [US2] Run integrated cold/warm Edge and oversized-model/no-solver checks, including fallback, validation and assessment overhead; record measured budgets, quality and import evidence in `test-results/per-player-match-counts/runtime.md`, lowering unproven limits rather than passing the gate on solver timing alone.
- [X] T036 [US2] Update preview/commit fakes and replace scalar feasibility expectations in `e2e/steps/browser-flow.helpers.ts`, `__tests__/features/game-setup/createRandomAssignments.test.ts` and `__tests__/features/rooms/roomRpcClient.processing.test.ts`; remove obsolete choreography assertions only after equivalent module-interface coverage passes.
- [X] T037 [US2] Run focused module/unit, proposal pgTAP, mocked/real-backend BDD, Edge type/runtime and Android offline checks; record quota/ordering/consent evidence in `specs/031-per-player-match-counts/implementation.md` before enabling automatic-preview capability.

**Checkpoint**: Hosted/offline automatic assignment preserves quotas even without proven optimal sharing; consent and replay refer to one immutable result.

## Phase 5: US3 — Honor Counts in Host Allocations and Player Picks (P2)

**Goal**: Individual caps and target-aware filling apply to host, registered-member and guest selections without an optimizer requirement.

**Independent validation**: With targets3/1, retain each player's selections, reject picks beyond their own cap and fill only their deficit. Reductions below selections fail until explicit release; mode changes retain overrides.

### Tests First

- [X] T038 [US3] Add individual-cap, zero-target, progress and release assertions in `__tests__/features/rooms/PlayerPickPanel.platform.test.tsx` and `__tests__/features/rooms/useLobbyAssignmentController.test.ts`, using already explored interactions and accurate target-bearing fixtures.
- [X] T039 [P] [US3] Extend `supabase/tests/database/240_host_assigned_mode.test.sql` and `supabase/tests/database/250_player_picked_mode.test.sql` for unequal caps, registered/guest own-row authority, partial fill, inactive players, zero targets, Common Match exclusion and default reductions.

### Implementation and Journey Coverage

- [X] T040 [US3] Replace scalar registered/guest pick caps with authoritative individual targets in `$MIGRATION`, preserving token/revocation, own-row authorization, pool confinement and explicit releases; a supplied participant ID never grants authority over another row.
- [X] T041 [US3] Complete host/player-picked shortfall settlement in `$MIGRATION` and v2 start, retaining valid choices and filling only each deficit; manual/picked starts remain proposal-free and impossible quotas fail without partial writes.
- [X] T042 [US3] Use individual caps/progress in `features/rooms/GuestRoomContent.tsx`, `features/rooms/PlayerPickPanel.tsx`, `features/rooms/RoomAssignmentPlayers.tsx`, `features/rooms/useLobbyAssignmentController.ts` and `features/rooms/RoomLobbyWizard.tsx`; retain pending-fill labels and host-only count editing.
- [X] T043 [US3] Update mode/roster changes in `$MIGRATION` and `features/rooms/useRoomConfigure.ts` to retain overrides, exclude departed/ineligible players, invalidate affected previews and surface positive equal-target minimum changes without raising counts or silently deleting selections.
- [ ] T044 [US3] Refresh ARTEMIS exploration, then extend `e2e/features/player-picked-two-devices.feature` and `e2e/steps/player-picked-two-devices.steps.ts` with host/member/guest 3/1 caps, release-before-reduction, partial-fill and mode-change journeys using verified locators/waits.
- [X] T045 [US3] Run focused unit/component, selection pgTAP and multi-context BDD plus Android guest-picking checks; record cap/identity/fill evidence in `specs/031-per-player-match-counts/implementation.md`, distinguishing mocked results from actual authorization proof.

**Checkpoint**: All lobby modes honor individual targets without new readiness gates, catalogue access or mid-game participant picking.

## Phase 6: US4 — Change Future Participation During Play (P2)

**Goal**: Extend the existing multiplayer editor with target-aware atomic save and reviewed proposals while preserving gameplay/history.

**Independent validation**: Record a score/drink, reduce a target and add a draft match, review/save, reconnect and retain previous gameplay. A stale or invalid save preserves both canonical state and the editable draft.

### Tests First

- [X] T046 [US4] Extend `__tests__/features/rooms/useRunningGameDraft.test.ts` and `__tests__/features/rooms/roomAssignments.test.ts` for target-bearing running drafts, immutable new-match references, manual quotas, automatic consent, stale revisions and frozen replay after a lost response.
- [X] T047 [P] [US4] Extend `supabase/tests/database/290_running_game_editor.test.sql` for v2 proposal purpose/hash/consent, atomic new-match mapping, bounds, host/configuration conflicts, replay after expiry/cleanup and catalog drain/capacity, retaining all v1 cases.
- [X] T048 [P] [US4] Add actual-count/target and legacy-history regressions in `__tests__/features/history/historyRepository.test.ts` and `supabase/tests/database/per_player_modes.test.sql`, retaining `313_canonical_completed_history.test.sql` and `314_in_game_departure_history.test.sql`; past scores, drinks and frozen provider metadata must remain unchanged.

### Implementation and Journey Coverage

- [X] T049 [US4] Implement atomic `save_running_game_configuration_v2` in `$MIGRATION` using the newest protected save body: validate actor/token/purpose/draft, consume the reviewed automatic proposal or validate manual quotas, resolve new-match IDs and revalidate distinct counts while preserving provider pending/drain/capacity behavior.
- [X] T050 [US4] Extend token, fingerprint/replay and existing assignment-replacement events in `$MIGRATION` with old/new targets/policy/assignments and accepted consent; preserve current-host authority and replay-before-stale/expiry ordering without adding another event system or rewriting history.
- [X] T051 [US4] Refactor `features/rooms/useRunningGameDraft.ts` and `features/rooms/EditGameScreen.tsx` to bind RoomAssignments, expose target-aware draft/preview/consent, retain conflicts for review and remove obsolete scalar minimum/pool-formula ownership from the editor.
- [X] T052 [US4] Extend the running transport in `features/rooms/roomRpcClient.ts`, `types/room.ts` and `types/guestRoom.ts` for frozen proposal/draft/confirmation data behind the module handle; regenerate `types/database.types.ts` and align settings/new-match/mode limits between prepare and commit.
- [X] T053 [US4] Extend current completed/departure projections in `$MIGRATION` and mapping/display in `features/history/historyRepository.ts`, `features/history/historyTypes.ts`, `features/history/GameDetailsModal.tsx` and `features/history/PlayerDetailsModal.tsx`; use actual individual additional counts, preserve frozen metadata and keep legacy history readable.
- [ ] T054 [US4] Refresh ARTEMIS exploration, then add score/drink-preserving edit, cancellation, conflict and reconnect coverage in `e2e/features/per-player-running-edit.feature` and `e2e/steps/per-player-running-edit.steps.ts`, preserving supported modes and verified waits.
- [ ] T055 [US4] Extend `e2e/features/per-player-assignments-backend.feature` and `e2e/steps/per-player-assignments-backend.steps.ts` with real-backend new-match mapping, failed-save atomicity, accepted retry and history/departure assertions using T034's local configuration.
- [X] T056 [US4] Run focused draft/module/history tests, running/history pgTAP, mocked/real-backend journeys and Android editor observations; record event preservation and conflict evidence in `specs/031-per-player-match-counts/implementation.md`.

**Checkpoint**: Future assignment changes are atomic/auditable; past gameplay remains intact. No new solo running editor or retired importer is introduced.

## Phase 7: US5 — Read Match Times Consistently (P2, Independent)

**Goal**: Enforce HH:mm through the shared kickoff formatter without changing instants, timezone policy or unrelated timestamps.

**Independent validation**: Under en-US/12-hour preferences on Android and phone/desktop web, match rows show 00:00/09:05/12:00/23:59; raw/ISO/recognized legacy clocks agree, and unknown times/date rollover remain correct.

### Tests First

- [X] T057 [US5] Replace AM/PM expectations and add fixed-zone boundary, padding, seconds, raw/ISO/recognized legacy clock, invalid-range, unknown and safe-error cases in `__tests__/features/football-matches/matchTime.test.ts`; avoid runner-timezone assumptions and author only after T001 exploration.

### Implementation and Journey Coverage

- [X] T058 [US5] Update `features/football-matches/matchTime.ts` with explicit h23 Latin-digit HH:mm for instants, narrow validated raw/legacy-clock normalization and preserved timezone/unknown/error handling; remove forced hour12 without screen-specific formatter copies or fabricated midnight.
- [X] T059 [US5] Refresh ARTEMIS observations after T058, extend `__tests__/features/game-setup/SelectableMatchList.platform.test.tsx` with actual 24-hour output assertions, retain `platform/date-input/PlatformTimePicker.tsx`'s existing 24-hour setting and document no-kickoff surfaces in `test-results/per-player-match-counts/us5-surfaces.md`.
- [ ] T060 [US5] Add the verified en-US/12-hour and timezone-rollover journey in `e2e/features/match-time-format.feature` and `e2e/steps/match-time-format.steps.ts` for phone/desktop web; record Android discovery/setup/lobby/pick/editor observations in `test-results/per-player-match-counts/us5-validation.md`, excluding refresh/completion timestamps as agreed.
- [X] T061 [US5] Run formatter/list suites, time-format BDD, affected lint/types and Android observations; record outputs, unknown handling and remaining limits in `test-results/per-player-match-counts/us5-validation.md` without claiming solver/count validation.

**Checkpoint**: US5 can proceed after T001 without count migrations, the HiGHS gate or new previews. Final regression also covers upgraded flows.

## Phase 8: Integration, Recovery and Release Readiness

**Goal**: Close cross-story gates. These tasks do not deploy, merge or commit automatically.

- [X] T062 Run fresh local reset and populated legacy-upgrade validation, all pgTAP, generated-type checks and target/proposal grant/security review; record migration/recovery evidence in `specs/031-per-player-match-counts/implementation.md` and retain `types/database.types.ts` generated from the final schema.
- [X] T063 Run full client CI tests, TypeScript, lint, React Doctor and expanded Edge type/runtime checks from `specs/031-per-player-match-counts/quickstart.md`; record exact outcomes in `specs/031-per-player-match-counts/implementation.md`, distinguishing blocked/skipped checks from passes.
- [ ] T064 Run all affected mocked/real-backend BDD and verified Android journeys, including 24-hour times after count/editor changes; record guest/reconnect, zero targets, consent, overlapping previews, accepted retries and past-gameplay preservation in `specs/031-per-player-match-counts/implementation.md`.
- [X] T065 Reconcile delivered interfaces, measured budgets, capability activation and non-destructive recovery guidance in `specs/031-per-player-match-counts/quickstart.md`, `specs/031-per-player-match-counts/contracts/assignment-module.md`, `specs/031-per-player-match-counts/contracts/room-commands.md` and `docs/development-workflow.md`; preserve adopted games/history and imply no production rollout.
- [X] T066 [P] Evaluate requirement/task/acceptance traceability and `specs/031-per-player-match-counts/checklists/feature-quality.md`, recording evidence/new gaps in `specs/031-per-player-match-counts/checklists/requirements.md`; document checks alone do not certify runtime readiness.
- [X] T067 Review the final diff and `specs/031-per-player-match-counts/tasks.md`, keep only necessary code/assets/tests, run `git diff --check` and report verified outcomes/remaining risks in `specs/031-per-player-match-counts/implementation.md`; preserve unrelated edits and leave deployment/commit for separately authorized work.

## Dependencies and Execution Order

### Gates and Story Graph

```text
T001 baseline ARTEMIS exploration
  +-- US5: T057 -> T058 -> T059 -> T060 -> T061
  +-- T002 -> T003 hosted HiGHS runtime gate
  +-- T004 -> T005 -> T006 count-story foundations
        -> US1: T007-T018
             +-- US2: T019-T037 (hosted integration also requires T003)
             +-- US3: T038-T045 (core caps/fill can start from US1)
                  US2 + US3 -> US4: T046-T056
All requested stories and runtime gate -> T062-T067
```

US3 core database/cap work does not logically require HiGHS; its combined UI journeys use US2's completed module integration. US4 requires targets, the preview lifecycle and selection semantics. These are deliberate shared-state dependencies, not five independently deployable products. Each story has an independent validation criterion within its stated prerequisites.

### Within-Story Ordering

- Pure/contract tests precede logic. New UI journey tests follow implemented controls plus fresh ARTEMIS exploration, taking precedence over a generic tests-first template.
- US1: T007/T008 can run together after foundations; then T009–T015 precede T016–T018.
- US2: T019/T020/T021 are independent test lanes after US1/foundations and exploration. T022 -> T023. T024 and T025 are independent implementation lanes after shared types/tests, with T024 requiring T003. T025 -> T026 -> T027 -> T028 serialize SQL. T029 requires T023/T024/T027; T030 requires T028/T029; T031/T032 follow lifecycle/generation implementation. T033/T034 need the wired app and refreshed exploration. T035–T037 close evidence.
- US3: T038/T039 are independent test files after US1. Default order is T040 -> T041 -> T042 -> T043 -> T044 -> T045; wait for US2 when touching shared migration/controllers or exercising its module.
- US4: T046/T047/T048 are independent test lanes after US2/US3; T049–T053 proceed in order, then exploration/journeys/validation.
- US5: T057–T061 are sequential in an independent lane. Reserve device use separately; do not run simultaneous ARTEMIS tasks on one device.
- Final T062–T065 require completed story code. T066 may overlap validation/runbook work only where file edits do not collide. T067 is last.

### Shared-File Serialization

T011/T012/T013, T025–T028, T040/T041/T043 and T049/T050/T053 edit the same bound migration and must serialize. Refresh generated types after the needed commands exist. `RoomLobbyWizard.tsx`, `useRoomConfigure.ts`, `useLobbyAssignmentController.ts`, `roomRpcClient.ts` and browser fakes also have cross-story ownership; separate story labels do not make parallel edits safe.

## Parallel Examples by User Story

These identify opportunities, not instructions to spawn agents automatically.

| Story | Ready wave and independent work | Constraint |
| --- | --- | --- |
| US1 | T007 local/domain tests alongside T008 target pgTAP | Both require T001/fixtures; establish intended failures before logic |
| US2 | T019 generation, T020 lifecycle and T021 proposal tests; later T024 optimizer alongside T025 storage | T024 requires T003; SQL stays serial |
| US3 | T038 UI/controller cap tests alongside T039 identity/cap pgTAP | Shared controller/migration edits wait for other owners |
| US4 | T046 editor/module tests, T047 save pgTAP and T048 history regressions | Module test file changes start after US2 completes |
| US5 | T057–T061 as an independent lane during count/solver work | Separate source/test files; shared device use remains serial |

## Requirement and Contract Traceability

| Area | Owning tasks |
| --- | --- |
| FR-001–FR-004 defaults, overrides, controls/totals | T007–T018, T038–T045, T048/T053 |
| FR-005–FR-008 quotas, sharing, fallback/common-only | T009/T019, T022–T024, T028/T029/T032/T035/T037 |
| FR-009–FR-010 allocations, picks, reductions/modes | T008/T012, T038–T045 |
| FR-011 running edits and prior gameplay | T046–T056 |
| FR-012–FR-013 authority, atomicity, ordering/consent/replay | T008/T012/T020/T021, T025–T031, T039–T043, T047/T049/T050 |
| FR-014–FR-015 persistence/history/compatibility | T007/T010/T013/T018, T030/T034/T036, T048/T050/T053/T055/T062 |
| FR-016 participation wording | T014/T031/T042/T051/T053/T066 |
| FR-017 24-hour match times | T057–T061, T064 |
| Generation interface and HiGHS adapter | T002/T003/T019, T022–T024/T035 |
| RoomAssignments and transport adapters | T004/T020/T030/T031, T046/T051/T052 |
| Reservation/publication/commit contracts | T021/T025–T029, T047/T049/T050 |
| All five design-review corrections | T007–T015, T020–T031/T035, T046/T050/T051/T066 |
| SC-001–SC-008 | T018/T037/T045/T056/T061 and integrated T062–T064 |

## Implementation Strategy

1. T001 establishes observed interactions. T002/T003 prove hosted compatibility before solver mutation integration, without production changes.
2. **MVP demonstration**: US1 proves manual 3/3/1 participation locally and in a fully allocated host-assigned room. It is not permission to release partially supported v2 modes.
3. Add US2 automatic optimization with exact counts, fallback and explicit result quality; no promise of global optimality after timeout.
4. Complete US3 mode parity and registered/guest shortfall filling.
5. Complete US4 editor/history behavior without a new solo editor or retired importer.
6. US5 is independently reviewable after exploration, then rechecked in upgraded flows.
7. Complete final integration/recovery gates. Actual schema/Edge/client deployment requires separately authorized rollout work; auto-commit is disabled.

## Counts and Completion Notes

- Total: 68 tasks. Setup/foundations: 7. US1: 12. US2: 19. US3: 8. US4: 11. US5: 5. Integration/release readiness: 6.
- Tasks begin unchecked. Completion requires the full change, caller/fixture updates and recorded validation.
- Task generation performed no application implementation, executable UI test authoring, migration, dependency installation or deployment.

## Final disposition

58 tasks completed within the current validation scope;10 E2E/device-only tasks remain deliberately unchecked under the user exception. Mixed validation tasks cover their unit/static/non-UI portions only. Current paths, test placement, compatibility ownership and deployment authorization are reconciled in [implementation.md](implementation.md). The user separately authorized applying all required Supabase migrations and updating the existing PR; the task-generation default against deployment does not override that authorization.

Validation records are consolidated in implementation.md, with raw ignored logs under test-results/per-player-match-counts/. Additive v1 fakes and unchanged catalog/history units remain regression coverage; v2 cases were added at the owning lifecycle/transport/domain seams rather than rewriting compatible legacy fixtures.
