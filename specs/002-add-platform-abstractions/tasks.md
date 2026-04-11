# Tasks: Introduce Platform Abstractions for Web Blockers

**Input**: Design documents from `/specs/002-add-platform-abstractions/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/platform-capability-contract.md`, `quickstart.md`

**Tests**: Jest unit and regression test tasks are included for every user story. No new end-to-end task is included because `plan.md` explicitly scopes this feature below the threshold for a new primary-journey or major-navigation E2E requirement.

**Organization**: Tasks are grouped by user story so each implementation slice can be delivered and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared platform module and test scaffolding that the rest of the feature will build on.

- [x] T001 Create the shared platform module scaffolds and barrel exports in platform/index.ts, platform/audio/index.ts, platform/date-input/index.ts, platform/animation/index.ts, platform/visibility/index.ts, and platform/gestures/index.ts
- [x] T002 Configure shared Jest platform test setup in package.json and jest.setup.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the common types, fallback metadata, and test helpers required before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Create shared capability type definitions and fallback metadata in platform/types.ts
- [x] T004 [P] Create visibility and environment helpers in platform/environment.ts, platform/visibility/types.ts, and platform/visibility/normalizeVisibility.ts
- [x] T005 [P] Create date-input and animation fallback helpers in platform/date-input/normalizeValue.ts and platform/animation/fallbacks.ts
- [x] T006 [P] Create gesture and audio fallback helpers in platform/gestures/fallbacks.ts and platform/audio/types.ts
- [x] T007 Create shared platform test helpers and module mocks in **tests**/platform/testUtils.ts

**Checkpoint**: The shared platform layer has a stable base API and test harness, so story work can begin safely.

---

## Phase 3: User Story 1 - Remove Screen-Level Web Blockers (Priority: P1) 🎯 MVP

**Goal**: Introduce the shared platform capability adapters and remove direct platform-sensitive imports from the currently blocked screens.

**Independent Test**: Open the affected screens on native and web and confirm they render without capability-related blocking failures while still using shared platform behavior.

### Tests for User Story 1 (REQUIRED coverage) ⚠️

- [x] T008 [P] [US1] Add unit tests for shared audio and visibility adapter behavior in **tests**/platform/audio.test.ts and **tests**/platform/visibility.test.ts
- [x] T009 [P] [US1] Add unit tests for date-input, animation, and gesture fallback selection in **tests**/platform/dateInput.test.ts, **tests**/platform/animation.test.ts, and **tests**/platform/gestures.test.ts
- [x] T010 [P] [US1] Add regression tests for shared-import adoption in **tests**/app/gameProgress.platform.test.tsx, **tests**/app/index.platform.test.tsx, and **tests**/components/setupGame/MatchFilter.platform.test.tsx

### Implementation for User Story 1

- [x] T011 [P] [US1] Implement shared audio and visibility adapters in platform/audio/createSoundController.ts, platform/audio/useGoalSound.ts, and platform/visibility/useAppVisibility.ts
- [x] T012 [P] [US1] Implement shared date-input and animation adapters in platform/date-input/PlatformDatePicker.tsx, platform/date-input/PlatformTimePicker.tsx, and platform/animation/PlatformAnimation.tsx
- [x] T013 [P] [US1] Implement shared gesture wrappers in platform/gestures/PlatformGestureRoot.tsx, platform/gestures/PlatformGestureView.tsx, and platform/gestures/PlatformSwipeTabs.tsx
- [x] T014 [US1] Replace direct audio and visibility imports in app/gameProgress.tsx with the shared platform adapters
- [x] T015 [US1] Replace direct date and animation imports in components/setupGame/MatchFilter.tsx, app/index.tsx, and components/setupGame/MatchList.tsx with the shared platform adapters
- [x] T016 [US1] Replace direct gesture imports in app/\_layout.tsx, components/OnboardingScreen.tsx, and components/gameProgress/TabNavigation.tsx with the shared platform adapters

**Checkpoint**: User Story 1 is complete when the current blocker screens use only shared capability adapters for the targeted platform-sensitive behavior and load on web without hard failures.

---

## Phase 4: User Story 2 - Preserve Task Completion Across Platforms (Priority: P2)

**Goal**: Make the native and web fallbacks explicit enough that players can still complete the surrounding tasks even when the interaction pattern differs by platform.

**Independent Test**: Run representative native and web flows for splash/loading, onboarding, setup-game filtering, tab switching, and game-progress sound behavior and confirm each task still completes.

### Tests for User Story 2 (REQUIRED coverage) ⚠️

- [x] T017 [P] [US2] Add regression tests for onboarding and tab-navigation fallback controls in **tests**/components/OnboardingScreen.platform.test.tsx and **tests**/components/gameProgress/TabNavigation.platform.test.tsx
- [x] T018 [P] [US2] Add regression tests for splash/loading and date-selection task completion in **tests**/components/setupGame/MatchList.platform.test.tsx, **tests**/app/index.platform.test.tsx, and **tests**/components/setupGame/MatchFilter.platform.test.tsx

### Implementation for User Story 2

- [x] T019 [P] [US2] Preserve goal-sound gating and visibility-based stop behavior in app/gameProgress.tsx, platform/audio/useGoalSound.ts, and platform/visibility/useAppVisibility.ts
- [x] T020 [P] [US2] Preserve date and time selection outcomes across native and web in components/setupGame/MatchFilter.tsx, platform/date-input/PlatformDatePicker.tsx, and platform/date-input/PlatformTimePicker.tsx
- [x] T021 [P] [US2] Preserve splash and loading comprehension with explicit animation fallbacks in app/index.tsx, components/setupGame/MatchList.tsx, and platform/animation/PlatformAnimation.tsx
- [x] T022 [US2] Preserve onboarding and tab-task completion with gesture-safe fallbacks in components/OnboardingScreen.tsx, components/gameProgress/TabNavigation.tsx, and platform/gestures/PlatformGestureView.tsx

**Checkpoint**: User Story 2 is complete when the same surrounding user tasks can be completed on native and web without relying on undocumented or unsupported platform behavior.

---

## Phase 5: User Story 3 - Centralize Future Compatibility Improvements (Priority: P3)

**Goal**: Consolidate the shared platform layer into a reusable public API so future compatibility work happens centrally instead of screen by screen.

**Independent Test**: Update one shared capability behavior and verify that multiple consuming screens inherit the change without additional platform-specific edits in those screens.

### Tests for User Story 3 (REQUIRED coverage) ⚠️

- [x] T023 [P] [US3] Add unit tests for shared platform public exports and fallback metadata in **tests**/platform/index.test.ts and **tests**/platform/fallbackMetadata.test.ts
- [x] T024 [P] [US3] Add integration tests for multi-consumer adapter reuse in **tests**/app/gameProgress.platform.test.tsx and **tests**/components/setupGame/MatchList.platform.test.tsx

### Implementation for User Story 3

- [x] T025 [P] [US3] Consolidate the public platform API in platform/index.ts, platform/audio/index.ts, platform/date-input/index.ts, platform/animation/index.ts, platform/visibility/index.ts, and platform/gestures/index.ts
- [x] T026 [P] [US3] Centralize reusable fallback metadata and capability descriptors in platform/types.ts, platform/animation/fallbacks.ts, and platform/gestures/fallbacks.ts
- [x] T027 [US3] Refactor shared adapters to depend on the consolidated public API in platform/audio/useGoalSound.ts, platform/date-input/PlatformDatePicker.tsx, platform/animation/PlatformAnimation.tsx, platform/visibility/useAppVisibility.ts, and platform/gestures/PlatformSwipeTabs.tsx
- [x] T028 [US3] Update future-screen adoption guidance in specs/002-add-platform-abstractions/quickstart.md and .github/copilot-instructions.md

**Checkpoint**: User Story 3 is complete when the shared platform surface is discoverable, reusable, and capable of serving future screen migrations without repeated compatibility work.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish final validation, cleanup, and repository-wide verification across all stories.

- [x] T029 Validate the implementation against specs/002-add-platform-abstractions/contracts/platform-capability-contract.md and remove any leftover direct imports in app/\_layout.tsx, app/gameProgress.tsx, app/index.tsx, components/setupGame/MatchFilter.tsx, components/setupGame/MatchList.tsx, components/OnboardingScreen.tsx, and components/gameProgress/TabNavigation.tsx
- [x] T030 Run npm test and npm run lint, then reconcile any platform-adapter verification notes in specs/002-add-platform-abstractions/quickstart.md and package.json

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts immediately.
- **Foundational (Phase 2)**: Depends on T001-T002 and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on T003-T007.
- **User Story 2 (Phase 4)**: Depends on completion of US1 because it hardens the same adapters and consuming screens.
- **User Story 3 (Phase 5)**: Depends on completion of US1 and benefits from US2 being complete because it consolidates the finalized adapter surface.
- **Polish (Phase 6)**: Depends on all selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: MVP slice; no dependency on later stories.
- **US2 (P2)**: Extends US1 by validating and preserving task-completion behavior across native and web.
- **US3 (P3)**: Extends the implemented adapters so future compatibility changes remain centralized.

### Within Each User Story

- Write the story’s tests first and confirm they fail before implementation.
- Implement adapter files before migrating consuming screens.
- Finish screen migration before the story checkpoint.
- Complete the checkpoint before moving to the next story.

### Parallel Opportunities

- T004, T005, and T006 can run in parallel during the foundational phase.
- T008, T009, and T010 can run in parallel for US1 because they touch separate test files.
- T011, T012, and T013 can run in parallel for US1 because they build separate capability adapters.
- T017 and T018 can run in parallel for US2.
- T019, T020, and T021 can run in parallel for US2 because they touch separate capability files and screen groups.
- T023 and T024 can run in parallel for US3.
- T025 and T026 can run in parallel for US3 because they touch different consolidation files.

---

## Parallel Example: Foundational Phase

```text
T004 Create visibility and environment helpers in platform/environment.ts, platform/visibility/types.ts, and platform/visibility/normalizeVisibility.ts
T005 Create date-input and animation fallback helpers in platform/date-input/normalizeValue.ts and platform/animation/fallbacks.ts
T006 Create gesture and audio fallback helpers in platform/gestures/fallbacks.ts and platform/audio/types.ts
```

---

## Parallel Example: User Story 1

```text
T008 Add unit tests for shared audio and visibility adapter behavior in __tests__/platform/audio.test.ts and __tests__/platform/visibility.test.ts
T009 Add unit tests for date-input, animation, and gesture fallback selection in __tests__/platform/dateInput.test.ts, __tests__/platform/animation.test.ts, and __tests__/platform/gestures.test.ts
T010 Add regression tests for shared-import adoption in __tests__/app/gameProgress.platform.test.tsx, __tests__/app/index.platform.test.tsx, and __tests__/components/setupGame/MatchFilter.platform.test.tsx

T011 Implement shared audio and visibility adapters in platform/audio/createSoundController.ts, platform/audio/useGoalSound.ts, and platform/visibility/useAppVisibility.ts
T012 Implement shared date-input and animation adapters in platform/date-input/PlatformDatePicker.tsx, platform/date-input/PlatformTimePicker.tsx, and platform/animation/PlatformAnimation.tsx
T013 Implement shared gesture wrappers in platform/gestures/PlatformGestureRoot.tsx, platform/gestures/PlatformGestureView.tsx, and platform/gestures/PlatformSwipeTabs.tsx
```

---

## Parallel Example: User Story 2

```text
T017 Add regression tests for onboarding and tab-navigation fallback controls in __tests__/components/OnboardingScreen.platform.test.tsx and __tests__/components/gameProgress/TabNavigation.platform.test.tsx
T018 Add regression tests for splash/loading and date-selection task completion in __tests__/components/setupGame/MatchList.platform.test.tsx, __tests__/app/index.platform.test.tsx, and __tests__/components/setupGame/MatchFilter.platform.test.tsx

T019 Preserve goal-sound gating and visibility-based stop behavior in app/gameProgress.tsx, platform/audio/useGoalSound.ts, and platform/visibility/useAppVisibility.ts
T020 Preserve date and time selection outcomes across native and web in components/setupGame/MatchFilter.tsx, platform/date-input/PlatformDatePicker.tsx, and platform/date-input/PlatformTimePicker.tsx
T021 Preserve splash and loading comprehension with explicit animation fallbacks in app/index.tsx, components/setupGame/MatchList.tsx, and platform/animation/PlatformAnimation.tsx
```

---

## Parallel Example: User Story 3

```text
T023 Add unit tests for shared platform public exports and fallback metadata in __tests__/platform/index.test.ts and __tests__/platform/fallbackMetadata.test.ts
T024 Add integration tests for multi-consumer adapter reuse in __tests__/app/gameProgress.platform.test.tsx and __tests__/components/setupGame/MatchList.platform.test.tsx

T025 Consolidate the public platform API in platform/index.ts, platform/audio/index.ts, platform/date-input/index.ts, platform/animation/index.ts, platform/visibility/index.ts, and platform/gestures/index.ts
T026 Centralize reusable fallback metadata and capability descriptors in platform/types.ts, platform/animation/fallbacks.ts, and platform/gestures/fallbacks.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001-T007.
2. Complete T008-T016.
3. Stop and validate that the blocked screens render on web using only the shared platform adapters.

### Incremental Delivery

1. Finish Setup + Foundational.
2. Deliver US1 and validate blocker removal.
3. Deliver US2 and validate preserved task completion on native and web.
4. Deliver US3 and validate centralized adapter reuse.
5. Finish T029-T030 for final contract and repository verification.

### Parallel Team Strategy

1. Split the foundational helper work across T004-T006.
2. Split adapter implementation across audio/visibility, date/animation, and gesture owners for US1.
3. Split the US2 fallbacks across game progress, setup-game, and onboarding/tab surfaces.
4. Serialize the final cleanup and contract-validation tasks to avoid overlapping edits in the same screens.

---

## Notes

- [P] tasks are limited to work that touches separate files with no incomplete-task dependency.
- Every user story includes automated Jest coverage because this feature changes platform behavior.
- No end-to-end task is included because the planned scope does not introduce a new primary user journey or major navigation redesign.
- The suggested MVP scope is Phase 3 only: User Story 1.
