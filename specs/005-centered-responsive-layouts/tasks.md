# Tasks: Restore Centered Responsive Layouts

**Input**: Design documents from `/specs/005-centered-responsive-layouts/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: This feature changes a primary UI journey and must keep unit-test coverage for the new responsive behavior plus end-to-end coverage for the browser-visible layout regressions.

**Organization**: Tasks are grouped by user story so Home, Setup, Game Progress, History, and Settings can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks that touch different files and have no dependency on incomplete work
- **[Story]**: Which user story the task belongs to, for example `US1`, `US2`, `US3`
- Include exact file paths in task descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared responsive layout primitives used by every affected screen

- [x] T001 [P] Create a shared wide-layout breakpoint helper in `app/style/responsive.ts`
- [x] T002 [P] Add shell centering coverage in `__tests__/components/ui/ShellScreen.platform.test.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix the shared shell contract before any route-specific layout work starts

**Checkpoint**: The shell owns centering and max-width behavior before the individual screens adopt it

- [x] T003 Refactor `components/ui/ShellScreen.tsx` to center the inner content column on wide layouts using the shared breakpoint helper while keeping the outer frame full width
- [x] T004 [P] Update `components/ui/ShellCard.tsx` and `components/ui/ShellActionButton.tsx` to keep their width-mode options aligned with the new shell contract

---

## Phase 3: User Story 1 - Centered Home Experience (Priority: P1) 🎯 MVP

**Goal**: Home stays centered and balanced on both phone and desktop/web viewports

**Independent Test**: Open Home on phone-sized and wide viewports and confirm the logo, current-game card, history card, and settings action remain centered without horizontal drift

### Tests for User Story 1 (REQUIRED coverage) ⚠️

- [x] T005 [P] [US1] Extend `__tests__/app/index.platform.test.tsx` with phone and wide shell assertions for Home
- [x] T006 [P] [US1] Add headed browser layout checks for Home in `e2e/playwright/home-shell-flow.spec.ts`

### Implementation for User Story 1

- [x] T007 [US1] Update `app/index.tsx` to use the shared breakpoint helper and centered card/button width modes
- [x] T008 [US1] Update `app/style/indexStyles.ts` to replace route-local horizontal offsets with centered content spacing

**Checkpoint**: Home should be independently shippable and visually centered on its own

---

## Phase 4: User Story 2 - Stable Setup Wizard (Priority: P2)

**Goal**: Setup keeps the stepper, content panel, and navigation controls aligned within one stable centered frame

**Independent Test**: Walk through setup on phone and wide screens and confirm each step keeps the wizard frame, stepper, and navigation visually aligned

### Tests for User Story 2 (REQUIRED coverage) ⚠️

- [x] T009 [P] [US2] Expand `__tests__/components/setupGame/SetupWizard.platform.test.tsx` for the centered wide frame and navigation alignment
- [x] T010 [P] [US2] Update `__tests__/app/setupGame.platform.test.tsx` to assert the route shell stays constrained on phone and wide layouts
- [x] T011 [P] [US2] Add setup centering scenarios to `e2e/features/app-shell.feature` and matching assertions in `e2e/steps/app-shell.steps.ts`

### Implementation for User Story 2

- [x] T012 [US2] Update `app/setupGame.tsx` to use the shared breakpoint helper and keep the shell centered on wide layouts
- [x] T013 [US2] Update `components/setupGame/SetupWizard.tsx` and `app/style/setupGameStyles.ts` to constrain the wide wizard frame and remove conflicting width or alignment rules
- [x] T014 [US2] Update `components/setupGame/TabNavigation.tsx`, `PlayerList.tsx`, `MatchList.tsx`, `CommonMatchSelector.tsx`, and `AssignmentSection.tsx` to use the shared breakpoint helper and preserve their responsive layout

**Checkpoint**: The setup flow should remain independently usable across phone and desktop/web sizes

---

## Phase 5: User Story 3 - Consistent Core Screens (Priority: P3)

**Goal**: Game Progress, History, and Settings follow the same centered responsive contract as the other screens

**Independent Test**: Open Game Progress, History, and Settings on phone and wide screens and confirm the main content stays centered and the key controls align to the same visual axis

### Tests for User Story 3 (REQUIRED coverage) ⚠️

- [x] T015 [P] [US3] Extend `__tests__/app/gameProgress.platform.test.tsx` and `__tests__/app/history.platform.test.tsx` with phone and wide shell assertions
- [x] T016 [P] [US3] Extend `__tests__/app/userPreferences.platform.test.tsx` with phone and wide shell assertions
- [x] T017 [P] [US3] Add centered-layout coverage for Game Progress, History, and Settings to `e2e/features/app-shell.feature` and `e2e/steps/app-shell.steps.ts`

### Implementation for User Story 3

- [x] T018 [US3] Update `app/gameProgress.tsx`, `app/history.tsx`, and `app/userPreferences.tsx` to use the shared breakpoint helper and keep their shells centered on wide layouts
- [x] T019 [US3] Update `app/style/gameProgressStyles.ts`, `app/style/historyStyles.ts`, and `app/style/userPreferencesStyles.ts` to remove any route-local spacing that still fights the centered shell contract

**Checkpoint**: The remaining core routes should conform to the same responsive layout rules

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish verification, remove leftovers, and confirm the final browser behavior

- [x] T020 [P] Re-run the targeted route and component responsive tests after the shell and setup changes land
- [x] T021 [P] Run headed Playwright on `chromium-phone` and `chromium-desktop` for the app-shell and home-shell flows
- [x] T022 Update `specs/005-centered-responsive-layouts/quickstart.md` with any final verification notes from the browser pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Stories (Phase 3+)**: Depend on the Foundational phase being complete
- **Polish (Final Phase)**: Depends on the targeted user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after the shared shell contract is fixed
- **User Story 2 (P2)**: Can start after the shared shell contract is fixed and may reuse the Home layout work patterns
- **User Story 3 (P3)**: Can start after the shared shell contract is fixed and should be validated after Home and Setup

### Within Each User Story

- Write or update the required tests before the implementation changes for that story
- Adopt the shared breakpoint helper before removing any local layout constants
- Keep shared-primitives changes before route-specific width or spacing cleanup
- Validate each story independently before moving to the next priority

### Parallel Opportunities

- T001 and T002 can run in parallel because they touch different files
- T005 and T006 can run in parallel because one is a unit test and the other is a browser check
- T009, T010, and T011 can run in parallel because they cover separate test surfaces for Setup
- T015, T016, and T017 can run in parallel because they cover separate test surfaces for the remaining core screens
- T020 and T021 can run in parallel once implementation is complete

---

## Parallel Example: User Story 1

```bash
# Launch the Home tests together:
Task: "Extend __tests__/app/index.platform.test.tsx with phone and wide shell assertions for Home"
Task: "Add headed browser layout checks for Home in e2e/playwright/home-shell-flow.spec.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch the Setup tests together:
Task: "Expand __tests__/components/setupGame/SetupWizard.platform.test.tsx for the centered wide frame and navigation alignment"
Task: "Update __tests__/app/setupGame.platform.test.tsx to assert the route shell stays constrained on phone and wide layouts"
Task: "Add setup centering scenarios to e2e/features/app-shell.feature and matching assertions in e2e/steps/app-shell.steps.ts"
```

---

## Parallel Example: User Story 3

```bash
# Launch the remaining core-screen tests together:
Task: "Extend __tests__/app/gameProgress.platform.test.tsx and __tests__/app/history.platform.test.tsx with phone and wide shell assertions"
Task: "Extend __tests__/app/userPreferences.platform.test.tsx with phone and wide shell assertions"
Task: "Add centered-layout coverage for Game Progress, History, and Settings to e2e/features/app-shell.feature and e2e/steps/app-shell.steps.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate the Home route independently before expanding scope

### Incremental Delivery

1. Complete Setup + Foundational to lock the shared shell contract
2. Deliver User Story 1 and validate Home on phone and desktop/web
3. Deliver User Story 2 and validate the setup flow independently
4. Deliver User Story 3 and validate the remaining core screens
5. Finish with the polish phase and the headed browser pass

### Parallel Team Strategy

1. One developer can take the shell contract work while another prepares the test coverage
2. Once the shell is stable, Home and Setup can be worked in parallel if needed
3. The remaining core-screen checks can be finished while browser verification is being prepared

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] labels map the work to a specific user story for traceability
- Each story remains independently testable and deliverable
- Every story that adds new feature behavior includes unit-test coverage
- The UI change includes end-to-end coverage for the primary browser journeys
