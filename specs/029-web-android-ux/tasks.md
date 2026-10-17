# Tasks: Predictable navigation and usable mobile web

**Input**: [plan.md](plan.md), [spec.md](spec.md), research.md, data-model.md, contracts/navigation.md and agent-handoff.md.
**State**: Implementation authorized 2026-10-17; coordinator records completed gates and worker integration here.
**Tests**: Required under constitution V. ARTEMIS exploration before Android test authoring. No backend changes, so no new pgTAP work expected.
**Skills**: Read [skills.md](skills.md) before assigned tasks; apply the common/role-specific skills and triggered domain skills. Record actual use and checks in each handoff. No new test dependency is authorized merely by a skill example.
**Installed additions**: `playwright-best-practices` applies to T009/T018/T026/T034/T037/T044 and their fixture/review work; `accessibility` applies to relevant US2/US3 control/focus behavior and US4–US6 implementation/acceptance. Exact owner/task mappings are in skills.md. These are execution requirements within the original 49 tasks (three runtime-led convergence tasks were appended), not extra feature scope.
**Format**: `- [ ] Tnnn [P?] [USn?] Description with path`. `[P]` means independent files within the stated prerequisite/ownership gates, not unrestricted simultaneous edits. Paths that do not yet exist are planned additions.

## Phase 1: Setup and shared baseline

Coordinator. Common starting point recorded before authorized worker dispatch; implementation worktrees and integration are listed in validation.md.

- [x] T001 Record the approved committed web-navigation baseline, included planning/audit paths and preserved dirty-work boundaries in specs/029-web-android-ux/validation.md; commit/create worktrees only when implementation is requested.
- [x] T002 Confirm existing coverage and controlled solo/host/member/guest/Friends/History fixture prerequisites in specs/029-web-android-ux/validation.md; keep secrets in ignored local configuration.
- [x] T003 Freeze public vocabulary, worker ownership and per-role skill requirements in specs/029-web-android-ux/contracts/navigation.md, specs/029-web-android-ux/agent-handoff.md and specs/029-web-android-ux/skills.md; assign precise task IDs and shared-file handoff gates.

## Phase 2: Foundational Android acceptance infrastructure

Coordinator. Required by all six stories for executable Android journey coverage. Explore before authoring test code; preserve one-device-at-a-time access.

- [x] T004 Explore the current Android client with ARTEMIS using approved fixtures and record verified locators, transitions, keyboard/Back behavior and coordinate fallback conditions in specs/029-web-android-ux/validation.md.
- [x] T005 Implement shared explicit state waits, dynamic UIAutomator lookup, verified fallback, foreground/device guards, diagnostics and failure exits in scripts/android/run-ux-journeys.ps1; use the parameter contract in agent-handoff.md without adding a native testing framework.

## Phase 3: US1 — Preserve game context

Owner A. Independent outcome: configuration/status navigation preserves solo/registered/guest identity and permissions. FR-001, FR-002, FR-020; SC-001.

- [x] T006 [US1] Extend __tests__/hooks/useGameProgressController.multiplayer.test.ts and __tests__/hooks/useGameProgressController.test.ts for solo/host/member/guest, hydration/ended/access-lost destinations and absence of navigation-triggered mutations.
- [x] T007 [US1] Correct context-aware configuration/status behavior in hooks/useGameProgressController.ts without clearing a live multiplayer context or changing guest authorization.
- [x] T008 [US1] Wire accurate labels and guest read-only status through app/gameProgress.tsx and components/gameProgress/GameActionsSheet.tsx; extend __tests__/components/gameProgress/GameActionsSheet.platform.test.tsx for permission/status states.
- [x] T009 [US1] Add the primary mode-preservation BDD journey in e2e/features/ux-game-context.feature and e2e/steps/ux-game-context.steps.ts using existing fixture helpers and unique steps.
- [x] T010 [US1] Add verified game-context Android scenarios to scripts/android/run-ux-journeys.ps1 through coordinator-owned integration; record web/native evidence in specs/029-web-android-ux/validation.md.

## Phase 4: US2 — Back, child return and recovery

B can implement Friends-only work alongside A US1 and C shared US4. A owns adapters/game/lobby. B owns History integration only after adapter API handoff. Coordinator owns exports, runner and final cross-path tests. FR-003–FR-006, FR-009, FR-020; SC-002.

- [x] T011 [P] [US2] Add Friends screen return/direct-entry/auth tests in __tests__/features/friends/navigation.platform.test.tsx; assert Requests restoration, no duplicate parent and safe signed-out return.
- [x] T012 [US2] Fix actual-caller return and sign-in recovery in features/friends/FriendsScreen.tsx, features/friends/FindFriendsScreen.tsx and features/friends/BlockedAccountsScreen.tsx using existing validated auth-return builders.
- [x] T013 [P] [US2] Add scoped Back/close lifecycle and fallback tests in __tests__/platform/navigation/taskNavigation.platform.test.tsx, including nested/repeated dismissal, blur/unmount, external history and keyboard interaction.
- [x] T014 [US2] Implement focused navigation adapters under platform/navigation/taskNavigation.ts, platform/navigation/taskNavigation.web.ts and platform/navigation/taskNavigation.native.ts with shared contract types; coordinator wires exports in platform/index.ts. Preserve specialized useRoomEndedExit.ts.
- [x] T015 [US2] Integrate Game actions/empty-game recovery and safe Home/resume behavior in components/gameProgress/FooterButtons.tsx and app/gameProgress.tsx; extend __tests__/components/gameProgress/FooterButtons.platform.test.tsx and controller coverage.
- [x] T016 [US2] Add explicit non-destructive lobby Home distinct from terminal goHome in app/lobby/[sessionId].tsx; extend __tests__/app/lobby/lobbyInProgress.platform.test.tsx to preserve re-entry, start discrimination and no leave/end commands.
- [x] T017 [US2] Coordinator integrates B-owned History and A-owned default-league overlay close/fallback behavior in components/history/HistoryModalFrame.tsx, app/history.tsx and components/preferences/SelectDefaultLeaguesModal.tsx and app/userPreferences/leagues.tsx; extend __tests__/components/history/HistoryModalWeb.test.tsx and relevant preferences tests, after A adapter handoff.
- [x] T018 [US2] Add primary Back/Requests/direct-entry/Home-cycle web coverage in e2e/features/ux-back-return.feature and e2e/steps/ux-back-return.steps.ts; assert three cycles and browser exit behavior.
- [x] T019 [US2] Add verified back-return Android scenarios through coordinator edits to scripts/android/run-ux-journeys.ps1; record signed-in/out and native/web overlay evidence in specs/029-web-android-ux/validation.md.

## Phase 5: US3 — Route-backed task position

Owner B; coordinator alone updates lobby caller after A releases it. B owns all Wizard behavior/compact semantics plus connector styles until handoff to C. FR-007–FR-009, FR-020; SC-003.

- [x] T020 [P] [US3] Add normalization/transition tests in __tests__/utils/navigation/viewState.test.ts for allowed enums, legacy friendId, duplicate parameters, unavailable targets and history-entry decisions.
- [x] T021 [US3] Implement pure route view-state parsing/building under utils/navigation/viewState.ts matching contracts/navigation.md; keep credentials/private payloads out and normalize with replacement.
- [x] T022 [US3] Add optional controlled key-based step contract, current-step names and compact connector fit in components/setupGame/SetupWizard.tsx and styles/setupGameStyles.ts; extend __tests__/components/setupGame/SetupWizard.platform.test.tsx preserving deferred input/canEnter/polling behavior.
- [x] T023 [US3] Integrate solo step route state in app/setupGame.tsx and __tests__/app/setupGame.platform.test.tsx with hydration-safe prerequisite recovery and at-most-once pending player advancement.
- [x] T024 [US3] Integrate History tab/target/sort/detail route state in app/history.tsx and __tests__/app/history.platform.test.tsx; preserve identity remount/privacy fencing and safe unavailable/local-only detail recovery.
- [x] T025 [US3] After A/B commits integrate, coordinator wires lobby step route state in app/lobby/[sessionId].tsx and __tests__/app/lobby/lobbyWizard.platform.test.tsx; preserve in-progress status and no polling-forced jumps.
- [x] T026 [US3] Add refresh/Back/Forward/malformed-route/account-boundary BDD journeys in e2e/features/ux-route-state.feature and e2e/steps/ux-route-state.steps.ts.
- [x] T027 [US3] Add verified route-state Android scenarios through coordinator edits to scripts/android/run-ux-journeys.ps1; record evidence and release Wizard/History/styles ownership in specs/029-web-android-ux/validation.md.

## Phase 6: US4 — Accessible controls and forms

Owner C. Shared controls/forms can start with A/B. Screen-level Wizard/History semantics wait for B handoff or are requested from B. FR-010–FR-014, FR-020; SC-004.

- [x] T028 [P] [US4] Extend __tests__/components/ui/ShellActionButton.test.tsx and __tests__/components/ui/ShellScreen.platform.test.tsx for semantic action/destination roles, disabled activation, focus and landmark compatibility.
- [x] T029 [US4] Implement shared accessible controls/main structure in components/ui/ShellActionButton.tsx and components/ui/ShellScreen.tsx; keep native props and existing caller compatibility; no nested interactive elements.
- [x] T030 [P] [US4] Add account-label/autofill/password/error tests in __tests__/components/auth/AuthForm.platform.test.tsx and guest feedback coverage in __tests__/components/guestJoin/GuestJoinForm.platform.test.tsx.
- [x] T031 [US4] Correct field labels/purposes/error announcements in components/auth/AuthForm.tsx and components/guestJoin/GuestJoinForm.tsx without changing auth flow, keyboard submit or deferred terms scope.
- [x] T032 [US4] Name Back/remove controls in components/preferences/Header.tsx and components/setupGame/PlayerList.tsx with targeted tests; preserve caller contracts and coordinate overlapping solo changes.
- [x] T033 [US4] After B handoff, integrate affected screen headings/titles and hidden-goal accessibility handling in app/_layout.tsx, app/history.tsx and components/gameProgress/GoalToast.tsx; retain Wizard semantics from B and avoid nested main landmarks.
- [x] T034 [US4] Add actual rendered DOM keyboard/link/focus/label/error/heading coverage in e2e/features/ux-accessibility.feature and e2e/steps/ux-accessibility.steps.ts; browser semantics cannot be established by component mocks alone.
- [x] T035 [US4] Add verified accessibility Android smoke to scripts/android/run-ux-journeys.ps1 through coordinator; record TalkBack/autofill/IME manual acceptance separately in specs/029-web-android-ux/validation.md.

## Phase 7: US5 — Compact layout and evidence-led scrolling

Owner C after B releases Wizard/History/styles. Each discovery case records pass unchanged or a reproducible defect; do not assume every ScrollView is wrong. FR-015–FR-018, FR-020; SC-005.

- [x] T036 [US5] Record populated scroll owners, boundary handoff, browser bars/IME, long names, 1/20/100 rows and reduced-motion behavior in specs/029-web-android-ux/validation.md using controlled fixtures; distinguish actual clipping from reachable content.
- [x] T037 [US5] Add geometry/reachability/scroll assertions for confirmed defects in e2e/features/ux-mobile-layout.feature and e2e/steps/ux-mobile-layout.steps.ts at 320/360/390, 640x360 and enlarged text; use actual bounds and final-action reachability.
- [x] T038 [US5] Fix schedule title/badge/team-label layout in components/setupGame/MatchFilter.tsx, components/setupGame/TeamSelectionRow.tsx and styles/setupGameStyles.ts; retain B's step API/connector fit and add relevant component regression coverage.
- [x] T039 [US5] Correct only reproduced web competing-scroll or IME reachability defects in components/setupGame/SetupWizard.tsx, components/history/HistoryModalFrame.tsx and affected screen styles identified in validation.md; preserve native virtualization and documented intentional modal scrollers.
- [x] T040 [US5] Implement affected reduced-motion handling through existing platform/animation adapters and components/setupGame/MatchFilter.tsx; add policy/interaction coverage under __tests__/platform/ and __tests__/components/setupGame/.
- [ ] T041 [US5] Add verified layout-scroll Android scenarios through coordinator edits to scripts/android/run-ux-journeys.ps1; complete physical font/IME/scroll and web bar/landscape evidence in specs/029-web-android-ux/validation.md.

## Phase 8: US6 — Home shortcuts

Owner C after shared semantic action API is stable. FR-019, FR-006, FR-020; SC-006.

- [x] T042 [P] [US6] Add signed-in/out and populated Home shortcut tests in __tests__/app/index.platform.test.tsx with one activation to Friends/History and preserved room entry.
- [x] T043 [US6] Expose labeled Friends/History destinations in app/index.tsx using existing layout; reconcile Game Stats entry and existing components/home/ display, with signed-out Friends recovery and local History.
- [x] T044 [US6] Add Home shortcut primary journey in e2e/features/ux-home-shortcuts.feature and e2e/steps/ux-home-shortcuts.steps.ts; cover keyboard activation and account recovery return.
- [x] T045 [US6] Add verified home-shortcuts Android scenarios through coordinator edits to scripts/android/run-ux-journeys.ps1 and record compact populated Home evidence in specs/029-web-android-ux/validation.md.

## Phase 9: Integration and acceptance

Coordinator. SC-007 and all FRs. No worker independently merges into web-navigation.

- [x] T046 Integrate worker commits serially into web-navigation, recording commit IDs/conflict decisions in specs/029-web-android-ux/validation.md; rerun affected suites after each dependency handoff.
- [x] T047 Run complete Jest platform-inclusive, typecheck, lint, unused-code, BDD and relevant React Doctor gates; record exact commands/results in specs/029-web-android-ux/validation.md without converting baseline/tool failures into product failures.
- [ ] T048 Run all planned Android runner scenarios and serial physical web/native checks from specs/029-web-android-ux/quickstart.md; include owner/member/guest and separate packaged release acceptance; keep any unavailable gate not-run.
- [x] T049 Reconcile every FR/SC and audit finding disposition, rollback notes and test/runtime evidence in specs/029-web-android-ux/validation.md; mark accepted stories only when their required gates pass.

## Dependencies and parallel execution

- T001–T003 establish the shared baseline/contract. T004 precedes T005 and all native test-authoring tasks. Web/component implementation may proceed after T003 while coordinator verifies native fixtures.
- US1 precedes A's game/lobby part of US2. B's Friends-only US2 work and C's shared US4 tests/forms are independent of US1.
- A's navigation adapter API precedes B's History overlay integration. The coordinator wires shared exports. B's pure route parser tests can run while A finishes the adapter.
- US3 lobby caller integration requires both A's safe-lobby changes and B's controlled Wizard. US5 waits for B's Wizard/History/style handoff; C must preserve those APIs. US6 waits for C's shared action semantics.
- Android scenario contributions are serialized by coordinator in scripts/android/run-ux-journeys.ps1, even when their web tests are parallel.
- Shared root config/fixtures/exports and tasks.md progress are coordinator-only. Do not mark overlapping tasks [P] merely because separate worktrees exist.

## Parallel examples

Batch 1 after contract freeze: A US1 controller/context tests; B Friends screen navigation tests/fix; C shared UI and AuthForm tests/fix. Each uses its own worktree/temporary branch from the same recorded committed web-navigation baseline.

Batch 2 after integration: A game/lobby Back adapters; B pure route parser/test preparation; C Home shortcuts once action semantics are stable. Then B owns Wizard/History until explicit handoff. Coordinator integrates lobby steps and runs cross-story regressions before C edits compact/scroll layouts.

## Requirement coverage

| Requirement | Story/tasks |
| --- | --- |
| FR-001–FR-002 | T006–T010, T050 |
| FR-003 | T013–T019 |
| FR-004 | T011–T012, T018–T019 |
| FR-005 | T015–T016, T018–T019, T050 |
| FR-006 | T011–T012, T015, T017–T019, T042–T045 |
| FR-007 | T020–T023, T025–T027 |
| FR-008 | T020–T021, T024, T026–T027 |
| FR-009 | T011, T017–T027 |
| FR-010 | T028–T029, T034–T035, T042–T045 |
| FR-011 | T022, T032, T034–T035 |
| FR-012 | T030–T031, T034–T035 |
| FR-013 | T030–T031, T033–T035 |
| FR-014 | T029, T033–T035 |
| FR-015 | T022, T036–T039, T041 |
| FR-016–FR-017 | T036–T039, T041, T051–T052 |
| FR-018 | T036–T037, T040–T041 |
| FR-019 | T042–T045 |
| FR-020 | T006, T011, T016, T024, T046–T050 plus all story regressions |
| SC-001–SC-006 | Respective US1–US6 acceptance scenarios; SC-001 adds T050, SC-005 adds T051–T052 |
| SC-007 | Setup/Android infrastructure plus final acceptance phase |

## Implementation strategy

MVP: US1 as the smallest high-risk correction, with its tests and runtime evidence. Follow with US2, then US3. US4 shared semantics can develop concurrently, followed by US6 and US5 after shared-file handoffs. Preserve five delivery slices if useful for review; do not compress verification into a single final merge.

Each story can be demonstrated independently using its stated prerequisites. A worker returns task IDs, commit IDs, changed files, tests, runtime limitations and interface handoffs. Coordinator reviews/integrates one at a time and updates checkboxes. No push/PR/worktree creation is performed during planning.


## Phase 10: Convergence

Runtime-led assessment on 2026-10-17 checked 20 FRs, 7 SCs, six user stories, the plan's eight technical constraints/design boundaries and six constitution principles. Two actionable partial gaps remain in the integrated code; no missing backend, dependency or new framework is required. This append-only pass records buildable work, while existing T010/T019/T027/T035/T041/T045/T048 retain their separate runtime acceptance obligations.

- [x] T050 [US1] Fix the reproduced private-room Realtime subscription collision during retained gameplay/re-entry in hooks/useActiveGameRoomSync.ts using the existing Supabase client/private topic and identity boundaries; add realistic SDK lifecycle tests for concurrent owners, last cleanup, async remount, identity change and failed cleanup, then rerun native owner/member/guest navigation and server invariants. Source: FR-001, FR-005, FR-020 (partial, HIGH). Owner A; coordinator integrates and owns phone verification.
- [x] T051 [US5] Preserve the actual focused setup input/ancestor identity when the web viewport crosses the short-height threshold during IME appearance in components/setupGame/SetupWizard.tsx; reproduce with touch/focused-input resize coverage, retain intentional portrait/landscape scroll ownership and final-action bounds, and verify trusted touch plus real keyboard on Android Chrome. Source: FR-016, US5/AC2, US5/AC4 (partial, HIGH). Owner C; coordinator integrates and owns phone verification.

## Phase 11: Convergence

Physical trusted-touch follow-up found one additional HIGH partial gap in FR-016/FR-017 after the input ancestry fix: the web PlayerList disabled FlatList computes touch-action:none and blocks ancestor drag, while the setup page still sizes its scroll port from the larger layout viewport during a real IME visual-viewport shrink. Empty/populated gesture checks must establish reachability; programmatic scroll-to assertions are insufficient. Existing requirement, plan and constitution inventories remain unchanged; no backend work is needed.

- [x] T052 [US5] Remove the reproduced web-only touch blockade in components/setupGame/PlayerList.tsx while preserving native behavior, and size the web setup scroll port for the actual visible keyboard viewport in components/setupGame/SetupWizard.tsx. Add trusted drag regressions over empty and populated player lists, preserve focused input identity and 200%-text/landscape final-control bounds, then verify real Android Chrome swipes reach Next with the IME open. Source: FR-016, FR-017, US5/AC2–AC4 (partial, HIGH). Owner C; coordinator integrates and owns physical verification.
