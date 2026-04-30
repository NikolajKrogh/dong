# Tasks: Responsive Core Screens

**Input**: Design documents from `/specs/004-responsive-core-screens/`  
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: This feature changes three substantial UI flows. Every screen migration needs targeted Jest regression coverage, and the web journeys need Playwright BDD coverage at a phone-sized viewport and a desktop-wide viewport.

**Organization**: Tasks are grouped by shared foundation first, then by user story so each screen can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which workstream the task belongs to (`Shared`, `US1`, `US2`, `US3`)
- Include exact file paths in descriptions

---

## Phase 1: Shared Responsive Foundation

**Purpose**: Establish the reusable responsive shell and spacing rules that all three screens will share.

- [x] T001 [P] [Shared] Inventory the layout-critical surfaces for setup, gameplay, and history in [app/setupGame.tsx](../../app/setupGame.tsx), [app/gameProgress.tsx](../../app/gameProgress.tsx), [app/history.tsx](../../app/history.tsx), and their local component trees.
- [x] T002 [P] [Shared] Add shared responsive container behavior in [components/ui/ShellScreen.tsx](../../components/ui/ShellScreen.tsx) and [components/ui/ShellSection.tsx](../../components/ui/ShellSection.tsx) for centered desktop layouts and consistent section spacing.
- [x] T003 [P] [Shared] Expand shared card and action-button primitives in [components/ui/ShellCard.tsx](../../components/ui/ShellCard.tsx) and [components/ui/ShellActionButton.tsx](../../components/ui/ShellActionButton.tsx) to support desktop-friendly widths and spacing.
- [x] T004 [Shared] Reconcile the responsive width and spacing rules in [app/style/setupGameStyles.ts](../../app/style/setupGameStyles.ts), [app/style/gameProgressStyles.ts](../../app/style/gameProgressStyles.ts), and [app/style/historyStyles.ts](../../app/style/historyStyles.ts) with the shared shell primitives.

---

## Phase 2: User Story 1 - Responsive Setup Flow (Priority: P1) 🎯 MVP

**Goal**: Keep the setup wizard usable on phone-sized and desktop-wide viewports without changing the underlying setup flow.

**Independent Test**: Open setup on a phone-sized viewport and a desktop-wide viewport, complete the wizard, and confirm that the step order, inputs, and primary actions remain visible and usable.

### Tests for User Story 1 (REQUIRED coverage) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [x] T005 [P] [US1] Add route-level responsive regression coverage in [**tests**/app/setupGame.platform.test.tsx](../../__tests__/app/setupGame.platform.test.tsx) for phone-sized and desktop-wide layouts.
- [x] T006 [P] [US1] Add setup component regression coverage in [**tests**/components/setupGame/SetupWizard.platform.test.tsx](../../__tests__/components/setupGame/SetupWizard.platform.test.tsx) and [**tests**/components/setupGame/MatchList.platform.test.tsx](../../__tests__/components/setupGame/MatchList.platform.test.tsx).
- [x] T007 [P] [US1] Extend [e2e/features/app-shell.feature](../../e2e/features/app-shell.feature) and [e2e/steps/app-shell.steps.ts](../../e2e/steps/app-shell.steps.ts) with setup scenarios for phone-sized and desktop-wide viewports.

### Implementation for User Story 1

- [x] T008 [US1] Migrate [app/setupGame.tsx](../../app/setupGame.tsx) to the responsive Tamagui shell layout and keep the setup flow order intact.
- [x] T009 [P] [US1] Update [components/setupGame/SetupWizard.tsx](../../components/setupGame/SetupWizard.tsx) and [components/setupGame/TabNavigation.tsx](../../components/setupGame/TabNavigation.tsx) so the wizard, step controls, and content regions adapt cleanly at wide widths.
- [x] T010 [P] [US1] Update [components/setupGame/PlayerList.tsx](../../components/setupGame/PlayerList.tsx), [components/setupGame/MatchList.tsx](../../components/setupGame/MatchList.tsx), [components/setupGame/CommonMatchSelector.tsx](../../components/setupGame/CommonMatchSelector.tsx), [components/setupGame/AssignmentSection.tsx](../../components/setupGame/AssignmentSection.tsx), and [components/setupGame/MatchItem.tsx](../../components/setupGame/MatchItem.tsx) for responsive spacing, wrapping, and readable desktop layouts.
- [x] T011 [US1] Preserve the existing setup logic in [app/setupGame.tsx](../../app/setupGame.tsx) and [utils/setupGameAssignments.ts](../../utils/setupGameAssignments.ts) while fixing any web-specific regressions uncovered by migration.

**Checkpoint**: Setup should be fully functional and responsive at the two acceptance viewport classes before moving on.

---

## Phase 3: User Story 2 - Responsive Gameplay Screen (Priority: P2)

**Goal**: Keep the gameplay screen, quick actions, and end-game flows usable on phone-sized and desktop-wide viewports.

**Independent Test**: Open an active game on a phone-sized viewport and a desktop-wide viewport, switch views, and open quick actions/end-game controls to confirm the screen remains usable.

### Tests for User Story 2 (REQUIRED coverage) ⚠️

- [x] T012 [P] [US2] Add route-level responsive regression coverage in [**tests**/app/gameProgress.platform.test.tsx](../../__tests__/app/gameProgress.platform.test.tsx) for phone-sized and desktop-wide layouts.
- [x] T013 [P] [US2] Add gameplay component regression coverage in [**tests**/components/gameProgress/TabNavigation.platform.test.tsx](../../__tests__/components/gameProgress/TabNavigation.platform.test.tsx) and [**tests**/components/gameProgress/MatchesGridContainer.platform.test.tsx](../../__tests__/components/gameProgress/MatchesGridContainer.platform.test.tsx).
- [x] T014 [P] [US2] Extend [e2e/features/app-shell.feature](../../e2e/features/app-shell.feature) and [e2e/steps/app-shell.steps.ts](../../e2e/steps/app-shell.steps.ts) with gameplay scenarios for phone-sized and desktop-wide viewports.

### Implementation for User Story 2

- [x] T015 [US2] Migrate [app/gameProgress.tsx](../../app/gameProgress.tsx) to the responsive Tamagui shell layout without changing gameplay state ownership.
- [x] T016 [P] [US2] Update [components/gameProgress/TabNavigation.tsx](../../components/gameProgress/TabNavigation.tsx), [components/gameProgress/MatchesGrid/MatchesGridContainer.tsx](../../components/gameProgress/MatchesGrid/MatchesGridContainer.tsx), and [components/gameProgress/PlayersList.tsx](../../components/gameProgress/PlayersList.tsx) for the selected wide-screen behavior.
- [x] T017 [P] [US2] Update [components/gameProgress/MatchQuickActionsModal.tsx](../../components/gameProgress/MatchQuickActionsModal.tsx), [components/gameProgress/EndGameModal.tsx](../../components/gameProgress/EndGameModal.tsx), and [components/gameProgress/MatchesGrid/MatchesHeader.tsx](../../components/gameProgress/MatchesGrid/MatchesHeader.tsx) for viewport-safe overlays and controls.
- [x] T018 [US2] Reconcile responsive style rules in [app/style/gameProgressStyles.ts](../../app/style/gameProgressStyles.ts) and any screen-local helpers needed for the new layout.

**Checkpoint**: Gameplay should preserve the current interaction model while staying readable and reachable at both viewport classes.

---

## Phase 4: User Story 3 - Responsive History Screen (Priority: P3)

**Goal**: Keep history browsing, sorting, tabs, and detail views usable on phone-sized and desktop-wide viewports.

**Independent Test**: Open history on a phone-sized viewport and a desktop-wide viewport, change tabs, sort sessions, and open a detail view to confirm the screen remains usable.

### Tests for User Story 3 (REQUIRED coverage) ⚠️

- [x] T019 [P] [US3] Add route-level responsive regression coverage in [**tests**/app/history.platform.test.tsx](../../__tests__/app/history.platform.test.tsx) for phone-sized and desktop-wide layouts.
- [x] T020 [P] [US3] Add history component regression coverage in [**tests**/components/history/HistoryHeader.platform.test.tsx](../../__tests__/components/history/HistoryHeader.platform.test.tsx), [**tests**/components/history/SortHistoryModal.platform.test.tsx](../../__tests__/components/history/SortHistoryModal.platform.test.tsx), and [**tests**/components/history/GameDetailsModal.platform.test.tsx](../../__tests__/components/history/GameDetailsModal.platform.test.tsx).
- [x] T021 [P] [US3] Extend [e2e/features/app-shell.feature](../../e2e/features/app-shell.feature) and [e2e/steps/app-shell.steps.ts](../../e2e/steps/app-shell.steps.ts) with history scenarios for phone-sized and desktop-wide viewports.

### Implementation for User Story 3

- [x] T022 [US3] Migrate [app/history.tsx](../../app/history.tsx) to the responsive Tamagui shell layout and keep history state and navigation intact.
- [x] T023 [P] [US3] Update [app/history.tsx](../../app/history.tsx) and [components/history/HistoryHeader.tsx](../../components/history/HistoryHeader.tsx) for wide-screen behavior.
- [x] T024 [P] [US3] Update [components/history/GameHistoryItem.tsx](../../components/history/GameHistoryItem.tsx), [components/history/PlayerStatsList.tsx](../../components/history/PlayerStatsList.tsx), [components/history/OverallStats.tsx](../../components/history/OverallStats.tsx), [components/history/MatchCard.tsx](../../components/history/MatchCard.tsx), [components/history/GameDetailsModal.tsx](../../components/history/GameDetailsModal.tsx), [components/history/PlayerDetailsModal.tsx](../../components/history/PlayerDetailsModal.tsx), [components/history/PlayerComparisonModal.tsx](../../components/history/PlayerComparisonModal.tsx), [components/history/TooltipModal.tsx](../../components/history/TooltipModal.tsx), and [components/history/SortHistoryModal.tsx](../../components/history/SortHistoryModal.tsx) as needed for responsive width and spacing.
- [x] T025 [US3] Reconcile responsive style rules in [app/style/historyStyles.ts](../../app/style/historyStyles.ts) and any history-specific layout helpers.

**Checkpoint**: History should remain readable and fully interactive at both acceptance viewport classes.

---

## Phase 5: Polish & Cross-Cutting Validation

**Purpose**: Close out browser regressions, verify both target viewport classes, and make any last adjustments that affect multiple screens.

- [x] T026 [P] [Shared] Add explicit phone-sized and desktop-wide viewport helpers in [e2e/steps/fixtures.ts](../../e2e/steps/fixtures.ts) and [playwright.config.ts](../../playwright.config.ts) so the browser journeys run both viewport classes deterministically.
- [x] T027 [Shared] Run lint, targeted Jest, and Playwright validation using [package.json](../../package.json) and [playwright.config.ts](../../playwright.config.ts) once the migrated screens are in place.
- [x] T028 [Shared] Fix any clipping, overlap, or modal regressions found during validation in [app/setupGame.tsx](../../app/setupGame.tsx), [app/gameProgress.tsx](../../app/gameProgress.tsx), [app/history.tsx](../../app/history.tsx), and the affected components.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Shared Responsive Foundation)**: No dependencies and can start immediately.
- **Phase 2 (US1)**: Depends on Phase 1.
- **Phase 3 (US2)**: Depends on Phase 1.
- **Phase 4 (US3)**: Depends on Phase 1.
- **Phase 5 (Polish & Cross-Cutting Validation)**: Depends on all desired user story phases being complete.

### User Story Dependencies

- **US1 (P1)**: Can start after the shared responsive foundation is complete.
- **US2 (P2)**: Can start after the shared responsive foundation is complete and should remain independently testable from US1.
- **US3 (P3)**: Can start after the shared responsive foundation is complete and should remain independently testable from US1 and US2.

### Within Each User Story

- Required tests MUST be written and shown failing before implementation starts.
- Shared responsive wrappers should land before the screen-specific layout changes that depend on them.
- Screen migration should complete before Playwright BDD smoke validation is considered done.
- Each story should reach its checkpoint before the next story begins if work is being done sequentially.

### Parallel Opportunities

- T001-T003 can run in parallel.
- T005-T007 can run in parallel for US1.
- T009-T010 can run in parallel once the setup route migration is underway.
- T012-T014 can run in parallel for US2.
- T016-T017 can run in parallel once the gameplay route migration is underway.
- T019-T021 can run in parallel for US3.
- T023-T024 can run in parallel once the history route migration is underway.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Shared Responsive Foundation.
2. Complete Phase 2: User Story 1.
3. **STOP and VALIDATE**: Confirm the setup flow works on phone-sized and desktop-wide viewports before moving on.

### Incremental Delivery

1. Finish the shared responsive foundation.
2. Deliver setup and validate the setup journey.
3. Deliver gameplay and validate the in-game journey.
4. Deliver history and validate the history journey.
5. Run the final browser and Jest sweep, then fix any discovered regressions.

### Parallel Team Strategy

1. One owner can stabilize the shared responsive foundation.
2. After the foundation lands, separate owners can work on US1, US2, and US3 in parallel if needed.
3. Keep the browser validation and regression-fix pass serialized at the end so the final responsive behavior is checked against the full integrated app.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] labels map tasks to the shared foundation or a specific user story for traceability
- Each user story should remain independently completable and testable
- Every story that adds new feature behavior includes unit-test tasks
- Stories with substantial UI changes include Playwright BDD tasks
- Features affecting web UI should include phone-sized and desktop-wide verification tasks
- Before implementation, follow the applicable repository and domain skills already identified in the plan
