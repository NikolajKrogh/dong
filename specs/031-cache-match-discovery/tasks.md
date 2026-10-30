# Tasks: Responsive Match Discovery with Reusable Results

**Branch**: `codex/cache-match-discovery` | **Created**: 2026-10-30

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contract](contracts/match-discovery.md), [quickstart.md](quickstart.md).

**Organization**: Setup, shared foundation, then US1/US2 (P1), US3/US4 (P2), and final validation. Implementation and unit-only validation are complete; see [validation/results.md](validation/results.md). Explicitly waived tasks are labeled below.

**Tests**: Constitution V requires new behavior coverage and a primary Playwright BDD journey. Before authoring any executable application tests, perform the ARTEMIS exploration required by `AGENTS.md`. Write story tests before their implementation and establish expected red failures; fixture/setup failures do not demonstrate the intended regression. The unit-only validation exception recorded below supersedes E2E and platform timing-trial tasks; requirements review still needs evidence.

## Readiness and Scope

At generation, `checklists/requirements.md` has 16 completed items and `checklists/discovery.md` has 37 unchecked review items. Task generation does not waive that gate or mark the review complete. Before `/speckit-implement`, review/resolve the checklist or obtain the explicit proceed response required by that skill. Preserve prior design decisions and unrelated dirty work.

This phase adds no dependencies, schema migrations, backfills, backend deployments or provider-policy changes. Reuse the installed Query client, normalized discovery adapter, visibility/connectivity adapters and existing football animation. Exact server live-source expiry is outside scope: fixture reuse is less than 60 seconds from a complete, server-nonstale group's successful source check. Inactive retention is 30 minutes; it is not persistent offline storage.

## Format and Execution Rules

- Every task has a sequential ID, checkbox and concrete project-relative file path; filesystem operations use absolute paths under `C:\src\dong`.
- `[P]` denotes independent files within the stated phase, after its prerequisites. It does not authorize agents or bypass test/device gates.
- Story tasks carry `[US1]` through `[US4]`. Tasks touching the same file remain sequential across stories.
- Policy tests exercise the internal discovery module interface with a real isolated QueryClient and injected one-check adapter. Hook tests cover view-model/activity wiring; avoid repeating the entire policy suite or asserting on private counters/helpers.
- Mark a task complete only after its work and validation are actually done. Record unavailable environments or failed checks as incomplete, with evidence in `validation/results.md`; do not substitute browser evidence for Android or client mocks for hosted provider measurements.

## Phase 1: Setup

**Goal**: Establish a safe implementation baseline and ground test interactions in the actual application.

- [X] T001 Verify the pinned client tooling and relevant ignore coverage in `package.json`, `.gitignore` and `eslint.config.js`; record the branch, existing dirty-file scope and required setup adjustments in `specs/031-cache-match-discovery/quickstart.md` without upgrading dependencies or changing unrelated files.
- [X] T002 **Resolved by explicit user exception:** Android exploration/testing is deferred; no device interaction tests will be authored. Record diagnostics/no-interaction status in `specs/031-cache-match-discovery/validation/results.md`.

**Checkpoint**: Environment and test-authoring prerequisites are documented. Implementation's checklist gate must already be satisfied or explicitly waived; these tasks do not bypass it.

## Phase 2: Shared Foundation

**Goal**: Provide the one-check adapter and controlled test harness needed by every story while preserving default discovery behavior.

- [X] T003 Extend `__tests__/features/football-matches/footballMatchService.test.ts` with a picker-mode case that returns the first validated pending response without waits/follow-ups, plus assertions that omitted configuration preserves existing default bounded follow-ups and error/abort behavior; reuse existing coverage rather than duplicating it.
- [X] T004 Add optional `followUpPending` factory configuration to `features/football-matches/footballMatchService.ts`, defaulting to true; support a false one-check mode while preserving normalization, parsing, limits, error mapping, existing signal handling and all default callers. Run T003's checks before continuing; do not change the hosted contract or `FootballMatchService` operations.
- [X] T005 Prepare the controlled adapter/isolated QueryClient harness in `__tests__/features/football-matches/matchDiscoveryQueries.test.ts` and adapt existing reusable setup in `__tests__/features/football-matches/useMatchData.test.tsx` using `test-utils/render.ts` where appropriate; keep fixtures local/minimal, control Query and domain clocks together, and assert observable interface outcomes rather than private bookkeeping.

**Checkpoint**: The existing default discovery path is unchanged and the test harness is ready. No fixture-reuse policy or pending loop is duplicated in a caller.

## Phase 3: US1 — Find Selected Fixtures Without Unrelated Waiting (P1)

**Goal**: Only selected eligible leagues initiate discovery, all configured options remain choosable, and usable fixtures do not wait for unrelated work.

**Independent acceptance**: With seven configured leagues and selected A/B, requests contain only A/B. A's available fixtures are actionable while B remains pending for at least 15 seconds; all seven options remain choosable. Empty selection requests nothing, and time-window edits remain local.

### Tests first

- [X] T006 [P] [US1] Add module-interface cases in `__tests__/features/football-matches/matchDiscoveryQueries.test.ts` for explicit date/selected codes, empty demand, canonical code ordering, same-date batching up to 16, independent split-batch completion and immediate A-available/B-pending results; use the existing normalized result shape and no per-helper test exports.
- [X] T007 [P] [US1] Add requirements-focused view-model/UI cases in `__tests__/features/game-setup/MatchList.platform.test.tsx` for all configured chooser options, zero selection, actionable available fixtures despite pending/manual-team work, and existing football/reduced-motion/accessibility feedback without the visible caption.
- [X] T008 [P] [US1] Create `e2e/features/match-discovery-cache.feature` and `e2e/steps/match-discovery-cache.steps.ts` with a feature title containing `match discovery cache`; reuse `e2e/steps/browser-flow.helpers.ts` and verified interactions to cover selected-only demand and usable A while B remains pending. Stub the maintained discovery operation with valid fixtures and explicit semantic waits, not a compatibility Java route or fixed sleeps. **Resolved by user exception: E2E task waived; no feature/step files will be authored.**

### Implementation

- [X] T009 [US1] Create `features/football-matches/matchDiscoveryQueries.ts` with an internal factory accepting `{ queryClient, discoverOnce }`, canonical league/date identity and transient same-date batched work; preserve normalized fixture/group facts, return each completed batch promptly, and expose only the internal operations needed by the hook. Keep batch queues/options private and avoid a second retained store.
- [X] T010 [US1] Change `features/football-matches/useMatchData.ts` to the single documented `useMatchData({ date, leagueCodes, active })` interface; bind the existing normalized adapter to the one-check factory, obtain the implementation per supplied QueryClient, and return existing fixture/team projection formats plus explicit `leagueStates`, `isInitialLoading`, `isUpdating` and guarded `retry`. Metadata-only or unfinished responses cannot become checked-empty results.
- [X] T011 [US1] Wire selected eligible codes and route activity in `features/game-setup/MatchList.tsx`; source chooser options from existing configuration, remove response-derived selection synchronization, keep the selected game pool independent, and separate manual-team feedback from fixture availability. Retain the existing `PlatformAnimation` football path and accessible reduced-motion fallback.
- [X] T012 [US1] Update `features/game-setup/MatchFilter.tsx` and `features/game-setup/LeagueFilter.tsx` to consume the revised picker facts without hiding configured choices or disabling ready fixture actions/date-time controls because another league or manual suggestions are unfinished; preserve the current layout and local time filtering.
- [X] T013 [US1] Run the selected-demand module/UI cases and primary BDD increment from `specs/031-cache-match-discovery/quickstart.md`; record results and request-scope evidence in `specs/031-cache-match-discovery/validation/results.md`, including separate web/Android observations and any unmet gate.

**Checkpoint**: US1 is demonstrable without waiting for later stories. It is not the full cache feature or a release approval.

## Phase 4: US2 — Reuse Fixtures When Returning or Adjusting Selections (P1)

**Goal**: Reuse fresh per-league/date results across consumers/navigation and request only newly needed keys.

**Independent acceptance**: A/B return instantly on a retained-fresh reopen with no new request; adding C requests only C. Reordering/time edits request nothing; overlapping A/B and B/C consumers share B. An unobserved entry may be collected after the 30-minute retention period.

### Tests first

- [X] T014 [P] [US2] Extend `__tests__/features/football-matches/matchDiscoveryQueries.test.ts` through the module interface for fresh reopen, add/remove/re-add league reuse, overlapping in-flight selections, same canonical key despite order/duplicates, and 30-minute unobserved collection while active/in-flight entries remain protected.
- [X] T015 [P] [US2] Adapt `__tests__/features/football-matches/useMatchData.test.tsx` for the explicit selection and shared QueryClient; cover retained-data projection, adding only a missing league and time-independent projection without duplicating T014's complete policy coverage or retaining the old all-configured-leagues expectations.
- [X] T016 [P] [US2] Extend `e2e/features/match-discovery-cache.feature` and `e2e/steps/match-discovery-cache.steps.ts` with the retained-fresh reopen/add-C journey, asserting request contents and actionable prior fixtures through the existing setup entry point. **Resolved by user exception: E2E task waived; no feature/step files will be authored.**

### Implementation

- [X] T017 [US2] Implement the fixed source-check +60-second client reuse deadline, server-stale/completeness veto, Query timestamp-safe freshness and 30-minute unobserved retention in `features/football-matches/matchDiscoveryQueries.ts`; share Query-owned retained data and equivalent in-flight work. Do not infer private live deadlines, compare match/group timestamps or create persistent downloads.
- [X] T018 [US2] Complete shared per-client observation in `features/football-matches/useMatchData.ts`, reusing fresh selected keys and projecting only current date/code results; preserve the existing normalization adapter and public namespace, avoid hidden global configuration reads, and keep time-window values outside demand identity.
- [X] T019 [US2] Run T014–T016 cases and record reuse, overlap and retention evidence in `specs/031-cache-match-discovery/validation/results.md`; keep source age distinct from response receipt and do not claim restart persistence.

**Checkpoint**: US1 and US2 demonstrate the useful caching increment. Complete the following correctness/lifecycle stories before feature release.

## Phase 5: US3 — Continue Selecting During Refresh or Failure (P2)

**Goal**: Retain usable fixtures, report truthful per-league status and own one bounded pending cycle with guarded Retry.

**Independent acceptance**: After expiry, retained A remains actionable during refresh/failure. A checked-empty B differs from pending/error. A continuously pending key makes at most initial +2 follow-ups, none before cooldown; another consumer cannot reset the budget. Explicit Retry joins/waits or starts one permitted new cycle without changing selected matches.

### Tests first

- [X] T020 [P] [US3] Extend `__tests__/features/football-matches/matchDiscoveryQueries.test.ts` for the exact 60-second boundary, old saved responses, invalid/missing/future group timing, server-stale/incomplete groups, summary timestamps not affecting reuse, complete-empty eligibility, partial-row retention and shared bounded follow-ups. Include early/concurrent Retry, exhaustion, delays above 60 seconds and failure stopping automatic continuation; assert states and adapter calls rather than counters.
- [X] T021 [P] [US3] Extend `__tests__/features/game-setup/MatchList.platform.test.tsx` with retained-content updating/error/offline states, per-league pending/exhausted messages, cooldown-aware Retry presentation and unchanged selected/fixed match pools; distinguish schedule emptiness, time-filter emptiness and empty game selection.
- [X] T022 [P] [US3] Reuse/extend `__tests__/features/football-matches/footballMatchService.test.ts` and `__tests__/features/football-matches/matchDiscoveryCatalog.test.ts` to establish whole-body structural rejection and preserved normalized group metadata; keep structurally malformed response tests distinct from schema-valid missing/duplicate/wrong-date group cases at the discovery interface.
- [X] T023 [P] [US3] Extend `e2e/features/match-discovery-cache.feature` and `e2e/steps/match-discovery-cache.steps.ts` with retained refresh failure and pending/Retry states using controlled responses and clocks where supported; author from the explored path and keep the existing BDD timeout compatible with deterministic retry timing. **Resolved by user exception: E2E task waived; no feature/step files will be authored.**

### Implementation

- [X] T024 [US3] Implement group correspondence checks, partial fixture retention, explicit domain status projection and shared three-check cycle/cooldown guards in `features/football-matches/matchDiscoveryQueries.ts`; reject every key in a structurally failed submitted batch while preserving retained data, isolate only validated per-key failures, and allow separate batches to settle independently. Pending-only intervals stop on completion/failure/exhaustion/long deferral; guarded Retry joins work without cancel-and-restart or resetting receipt-based freshness.
- [X] T025 [US3] Present the module's league states and one guarded Retry action in `features/game-setup/MatchList.tsx` and `features/game-setup/MatchFilter.tsx`; keep available fixtures and selected matches usable during failure/refresh, show explicit no-content error/offline status, and do not expose raw query/cycle fields or caller-owned retry loops.
- [X] T026 [US3] Run T020–T023 cases and record retry-delay/request-count and failure-granularity evidence in `specs/031-cache-match-discovery/validation/results.md`; document initial/retained error differences and confirm no rejected body becomes a successful-empty schedule.

**Checkpoint**: Shared pending budget and partial/error behavior are established without changing provider scheduling or default legacy discovery.

## Phase 6: US4 — Safely Change Screens and Filters on Web and Android (P2)

**Goal**: Keep current-selection accuracy, shared consumer independence, privacy and activity-driven refresh across navigation and backgrounding.

**Independent acceptance**: A delayed A response never replaces B. Detaching one consumer preserves another's result; no relevant active consumer means no future checks. Completed idle results make zero requests across 120 seconds; allowed activity rechecks stale keys while fresh keys reuse. Selections and permissions remain unchanged on both platforms.

### Tests first

- [X] T027 [P] [US4] Extend `__tests__/features/football-matches/matchDiscoveryQueries.test.ts` for delayed prior-date completions, one-of-two consumers departing, zero-demand/inactive/background follow-up suppression, remaining-budget resumption, no reset on new observer and no completed-result periodic/reconnect refresh across 120 seconds. Include public-key/data isolation and sign-in/out without private facts entering discovery.
- [X] T028 [P] [US4] Extend `__tests__/features/football-matches/useMatchData.test.tsx` with actual route-activity/application-visibility wiring, foreground return, paused initial work and current-key view-model projection, using existing lifecycle adapters rather than reimplementing them or mirroring all module policy cases.
- [X] T029 [P] [US4] Extend `__tests__/features/game-setup/MatchList.platform.test.tsx` and `__tests__/features/game-setup/useMatchListFilters.test.ts` for configured choices changing during a delayed result, preserved fixed/selected fixtures, existing selection-disabled permissions, and unchanged source-date/local-time behavior including midnight/DST-related inputs.
- [X] T030 [P] [US4] Extend `e2e/features/match-discovery-cache.feature` and `e2e/steps/match-discovery-cache.steps.ts` with picker close/reopen, rapid date changes, permitted activity refresh and completed idle behavior; reuse grounded interactions and controlled role fixtures without production room mutations. **Resolved by user exception: E2E task waived; no feature/step files will be authored.**

### Implementation

- [X] T031 [US4] Finish route-focus/application-interactivity and active-demand enforcement in `features/football-matches/useMatchData.ts` and `features/football-matches/matchDiscoveryQueries.ts`, reusing `lib/QueryLifecycle.tsx` and existing platform adapters; keep submitted shared batches alive for remaining consumers, stop future unneeded follow-ups and fence results by exact key/cycle. Preserve completed-result reconnect behavior and the allowed paused-initial-work exception.
- [X] T032 [US4] Complete configured-option reconciliation in `features/game-setup/useMatchListFilters.ts` and `features/game-setup/MatchList.tsx`; delayed results cannot restore removed options, empty eligible selection does not silently become all leagues, and existing game selections/fixed match IDs stay independent. Preserve parent-screen permissions; edit parent activity wiring only if needed by the established contract.
- [X] T033 [US4] Run the lifecycle cases and existing relevant room/score regressions; exercise controlled solo, host-configuration and running-edit entry points in `app/setupGame.tsx`, `app/lobby/[sessionId].tsx` and `app/editGame.tsx`. Record web/Android, permission/history preservation and unchanged live-score acquisition evidence separately in `specs/031-cache-match-discovery/validation/results.md`; do not treat client mocks as hosted provider-count proof.

**Checkpoint**: All stories have functional and regression evidence. Missing required device or provider evidence remains explicitly incomplete.

## Phase 7: Polish and Cross-Cutting Validation

- [X] T034 Remove obsolete all-configured discovery effects, response-derived option synchronization, duplicate projections/policy tests and unused exports introduced or displaced by this feature in `features/football-matches/useMatchData.ts`, `features/football-matches/matchDiscoveryQueries.ts`, `features/game-setup/MatchList.tsx` and their changed test files; retain default compatibility paths and avoid broad unrelated cleanup.
- [X] T035 Perform the controlled measurements specified in `specs/031-cache-match-discovery/quickstart.md`: 20 reopen and 20 mixed-speed trials per platform with instrumented ready/actionable checkpoints; record raw durations, request scope, sample counts and pass rates in `specs/031-cache-match-discovery/validation/performance.md`. Require at least 19/20 within 200 ms for reuse and 19/20 within 250 ms for partial availability; model latency/phone-sized browser results are not native measurements. **Resolved by user exception: platform timing-trial gate waived; no platform latency pass is claimed.**
- [X] T036 Run final typecheck, full client Jest gate, lint, targeted phone/desktop BDD, React Doctor and web export against the final changed sources using `package.json` and `specs/031-cache-match-discovery/quickstart.md`; report exact outcomes in `specs/031-cache-match-discovery/validation/results.md`. Separate runner/tool failures from product failures and do not mark failed/unexecuted required checks green.
- [X] T037 Reconcile FR-001–FR-015 and SC-001–SC-008 with recorded evidence, update `specs/031-cache-match-discovery/quickstart.md`, preserve review findings in `specs/031-cache-match-discovery/checklists/discovery.md`, and mark only completed work in `specs/031-cache-match-discovery/tasks.md`; document client-only rollback and any remaining blocker without committing, deploying or marking requirements passed solely because code exists.

## Dependencies and Execution Order

```text
Checklist gate satisfied or explicitly waived
  -> Setup T001–T002
  -> Foundation T003–T005 (T004 after T003)
  -> US1 T006–T013
  -> US2 T014–T019
  -> US3 T020–T026
  -> US4 T027–T033
  -> Cleanup T034 -> Measurements T035 -> Final checks T036 -> Reconciliation T037
```

Each story phase starts after its predecessor's checkpoint. US2 reuses US1's module/interface; US3 adds bounded continuation and recovery to retained data; US4 completes lifecycle/authority integration. These are real incremental dependencies in the same implementation files, not independent story-sized coding branches. Every story has acceptance criteria that do not depend on completing a later story.

Within each story, finish its test-authoring group before implementation tasks, then execute implementation tasks in ID order and run the story checkpoint. Changes to `features/football-matches/matchDiscoveryQueries.ts`, `features/football-matches/useMatchData.ts`, the shared picker or a reused test file must be serialized. Tests for later behavior may be written in the same suite as earlier tests, without duplicating covered cases.

## Parallel Execution Examples

All examples assume Setup/Foundation and earlier story checkpoints are complete. `[P]` groups are authoring opportunities across distinct files; they are not instructions to spawn agents automatically.

| Story | Independent work that may proceed together | Must remain sequential afterward |
|---|---|---|
| US1 | T006 module-interface cases; T007 picker cases; T008 BDD feature/steps | T009 -> T010 -> T011 -> T012 -> T013 |
| US2 | T014 reuse/overlap cases; T015 hook wiring cases; T016 BDD increment | T017 -> T018 -> T019 |
| US3 | T020 cycle/age cases; T021 UI states; T022 parser/compatibility cases; T023 BDD increment | T024 -> T025 -> T026 |
| US4 | T027 lifecycle/privacy cases; T028 hook activity cases; T029 filters/permissions cases; T030 BDD increment | T031 -> T032 -> T033 |

No same-file story implementations should be parallelized. Device tasks also obey ARTEMIS per-device exclusivity and user device-selection requirements.

## Requirement Mapping

| Requirements | Primary tasks |
|---|---|
| FR-001, FR-002, FR-005, FR-010, FR-015; SC-002, SC-003 | T006–T013; timing evidence T035 |
| FR-003, FR-004, FR-012; SC-001, SC-004 | T014–T019; source-age validation T020/T024; timing evidence T035 |
| FR-006, FR-007, FR-008; SC-005, SC-006 | T020–T026; lifecycle continuation T027/T031 |
| FR-009, FR-011, FR-013, FR-014; SC-007, SC-008 | T027–T033; compatibility T003/T004/T022; final evidence T036/T037 |

There are no schema tasks or pgTAP additions because this feature changes no database schema or authoritative backend behavior. Existing backend/provider evidence may still be needed to substantiate claims beyond the client seam; record it separately rather than inventing coverage.

## Implementation Strategy

1. Complete readiness, exploration and the small shared foundation. Add no new infrastructure or cache dependency.
2. Demonstrate US1 as the first vertical increment: selected-only discovery and usable partial results.
3. Complete US2 for the useful caching MVP: retained-fresh reuse and missing-league batching. This is a development checkpoint; the full feature still requires US3/US4 correctness and lifecycle gates.
4. Complete US3 and US4 incrementally, preserving earlier acceptance and default live-score/permission behavior.
5. Freeze the code after cleanup, collect platform measurements, run the final gates and reconcile the evidence. Mark tasks complete only when their stated outputs and checks exist. Deployment and commits are not included in this task-generation request.

## Generation Summary

- Total: 37 tasks; Setup 2, Foundation 3, US1 8, US2 6, US3 7, US4 7, Polish 4.
- Four parallel authoring groups containing 14 `[P]` tasks; shared implementation work stays sequential.
- All tasks have checkboxes, sequential IDs and concrete file paths; story-phase tasks have their corresponding story labels.
- All implementation/review tasks have recorded outcomes. E2E, Android and platform timing tasks are explicitly resolved by user exceptions, not reported as passed. Original checkout lint was limited by unrelated generated Java reports; full repository lint passes in the PR checkout on current multiplayer.

## Validation exception — 2026-10-30

The user explicitly requested implementation with unit tests only: "I do not think e2e test is necessary here and unit tests should be enough." No new Playwright/BDD tests, end-to-end runs or per-platform timing-trial gate are required for this delivery. Use module, hook, component and existing compatibility unit tests plus typecheck/lint/build checks. UI latency targets remain unmeasured product targets, not reported passes. Existing device-exploration instructions apply to any preparatory observation; no device acceptance suite is introduced.

Android exception — 2026-10-30: The user explicitly said "Do not test on an android device for now." No Android interaction/exploration or acceptance is required in this run. ARTEMIS diagnostics found no connected device and its emulator boot failed; no app interactions ran. Unit tests and local static/build checks are the delivery validation.

## Completion evidence

All task outcomes are recorded in [validation/results.md](validation/results.md). T012 required only corrected parent inputs; no redundant child component edits were needed. T033 uses unit regressions for the existing entry points under the user exception, with no device/hosted-provider claim. T036 checks ran and their exact outcomes are recorded; the original checkout lint limitation is distinguished from the passing full lint gate on the rebased PR checkout. T035 and E2E/Android tasks remain explicit waivers.
