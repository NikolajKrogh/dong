# Tasks: Web Flow Browser Coverage

**Input**: Design documents from `/specs/006-playwright-web-flows/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: This feature adds browser-flow coverage and new test-support helpers. Every new helper introduced for the suite MUST have unit-test coverage, and the primary browser journeys MUST be covered end-to-end through Playwright BDD.

**Organization**: Tasks are grouped by user story so the browser-flow suite can be implemented and validated independently of any retained standalone regression spec.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to, e.g. US1, US2, US3
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared browser-flow helpers and test scaffolding used by every story

- [x] T001 [P] Create shared browser-flow helper module in `e2e/steps/browser-flow.helpers.ts` for readiness markers, onboarding dismissal, and setup dataset builders.
- [x] T002 [P] Add unit tests for browser-flow helpers in `__tests__/e2e/browser-flow.helpers.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Centralize the startup/readiness path and keep the canonical browser entrypoint stable

**Checkpoint**: The browser suite has one shared readiness path and one repeatable local/CI command before story-specific coverage is expanded

- [x] T003 [P] Refactor `e2e/steps/app-shell.steps.ts` to consume `e2e/steps/browser-flow.helpers.ts` for launch readiness and onboarding handling.
- [x] T004 [P] Normalize the browser entrypoint in `playwright.config.ts`, `package.json`, and `playwright.home.config.ts` so `bddgen && playwright test` remains the canonical local and CI command while the alternate config stays isolated for the retained standalone regression spec.

---

## Phase 3: User Story 1 - Reliable Home Smoke Coverage (Priority: P1) 🎯 MVP

**Goal**: The browser suite reliably confirms the home screen loads after hydration and onboarding.

**Independent Test**: Run the browser suite against a healthy web app and confirm the smoke path waits for actual home content, not just the initial loading shell.

### Tests for User Story 1 (REQUIRED coverage) ⚠️

- [x] T005 [P] [US1] Rewrite the home smoke scenario in `e2e/features/app-shell.feature` to wait for actual home content after hydration and onboarding.
- [x] T006 [P] [US1] Update `e2e/steps/app-shell.steps.ts` with home-specific readiness markers and visible-home assertions.

### Implementation for User Story 1

- [x] T007 [US1] Remove smoke-only home launch assertions from `e2e/playwright/shell-launch.spec.ts` once the BDD smoke scenario covers the same behavior.

**Checkpoint**: The canonical smoke path should now be independently runnable and stable

---

## Phase 4: User Story 2 - Core Setup Journey Coverage (Priority: P1)

**Goal**: The browser suite completes the setup flow and reaches the next game state using reusable test data.

**Independent Test**: Complete the setup journey in the browser with representative data sets and confirm the suite reaches the expected next state.

### Tests for User Story 2 (REQUIRED coverage) ⚠️

- [x] T008 [P] [US2] Add parameterized setup-to-start-game scenarios to `e2e/features/app-shell.feature` for representative player and match datasets.
- [x] T009 [P] [US2] Extend `e2e/steps/app-shell.steps.ts` with reusable setup journey data and the next-state assertion after Start Game.

### Implementation for User Story 2

- [x] T010 [US2] Add setup journey dataset builders in `e2e/steps/browser-flow.helpers.ts` so the same flow can run with multiple valid inputs.

**Checkpoint**: The primary browser journey should now be independently testable through the BDD suite

---

## Phase 5: User Story 3 - Maintainable Local And CI Runs (Priority: P2)

**Goal**: The browser suite is easy to run locally and in CI, with duplicate smoke checks removed or reduced to unique regressions only.

**Independent Test**: Run the browser suite from a clean workspace and confirm it produces the same result locally and in CI-oriented execution.

### Tests for User Story 3 (REQUIRED coverage) ⚠️

- [x] T011 [US3] Retire or delete `e2e/playwright/shell-theme-switch.spec.ts` if it only duplicates smoke-style browser coverage that belongs in the canonical suite.
- [x] T012 [P] [US3] Keep `e2e/playwright/home-shell-flow.spec.ts` limited to unique layout or geometry assertions and preserve `playwright.home.config.ts` only if that standalone regression remains necessary.

### Implementation for User Story 3

- [x] T013 [P] Update `specs/006-playwright-web-flows/quickstart.md` with the final `npm run bddgen` / `npm run test:e2e` workflow and the optional standalone regression command.
- [x] T014 [P] Run `npm run bddgen`, `npm run test:e2e`, and any retained standalone browser regression command from `specs/006-playwright-web-flows/quickstart.md`.

**Checkpoint**: The browser-flow suite should now be maintainable, repeatable, and documented

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on the Foundational phase being complete
- **Polish (Final Phase)**: Depends on the desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after the Foundational phase is complete
- **User Story 2 (P1)**: Can start after the Foundational phase is complete and may reuse the shared browser helpers from US1
- **User Story 3 (P2)**: Can start after the canonical smoke and setup journeys are in place so duplicate checks can be safely retired or narrowed

### Within Each User Story

- Required tests MUST be written and FAIL before implementation
- Shared helpers before story-specific browser assertions
- Story complete before moving to the next priority
- Keep any retained standalone spec limited to unique regression coverage only

### Parallel Opportunities

- T001 and T002 can run in parallel because they touch different files
- T003 and T004 can run in parallel because one refactors browser steps while the other normalizes the entrypoint
- T005 and T006 can run in parallel because one updates the feature file and the other updates the shared step definitions
- T008 and T009 can run in parallel because they cover separate browser-flow surfaces for the setup journey
- T013 and T014 can run in parallel once implementation is complete

---

## Parallel Example: User Story 1

```bash
# Launch the home smoke work together:
Task: "Rewrite the home smoke scenario in e2e/features/app-shell.feature to wait for actual home content after hydration and onboarding."
Task: "Update e2e/steps/app-shell.steps.ts with home-specific readiness markers and visible-home assertions."
```

---

## Parallel Example: User Story 2

```bash
# Launch the setup journey work together:
Task: "Add parameterized setup-to-start-game scenarios to e2e/features/app-shell.feature for representative player and match datasets."
Task: "Extend e2e/steps/app-shell.steps.ts with reusable setup journey data and the next-state assertion after Start Game."
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate the home smoke path independently before expanding scope

### Incremental Delivery

1. Complete Setup + Foundational to lock the shared browser-flow helpers and command path
2. Deliver User Story 1 and validate the home smoke path on the canonical BDD suite
3. Deliver User Story 2 and validate the setup-to-start-game journey independently
4. Deliver User Story 3 and remove or narrow any duplicate standalone smoke coverage
5. Finish with documentation and the repeatable browser validation pass

### Parallel Team Strategy

1. One developer can own the shared helpers and readiness path while another prepares the home smoke scenario
2. Once the home smoke path is stable, the setup journey can be built in parallel with documentation cleanup
3. The duplicate standalone specs can be trimmed while the canonical BDD suite is being validated

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] labels map the task to a specific user story for traceability
- Each user story remains independently testable and deliverable
- Every new helper introduced by the suite has unit-test coverage
- The canonical browser-flow suite lives in `e2e/features/app-shell.feature` and `e2e/steps/app-shell.steps.ts`
- Retained standalone browser specs should only cover unique layout or geometry regressions
