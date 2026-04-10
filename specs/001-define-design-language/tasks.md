# Tasks: Define the Design Language

**Input**: Design documents from `/specs/001-define-design-language/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/design-md-contract.md`, `quickstart.md`

**Tests**: No automated test tasks are included. This feature is documentation-only, so verification is handled by the review tasks in each user story and the final contract/spec validation tasks.

**Organization**: Tasks are grouped by user story so each documentation increment can be implemented and reviewed independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the final deliverable scaffold in the correct repository location.

- [x] T001 Create the repository-root DESIGN.md scaffold with the contract-defined top-level sections in DESIGN.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Complete the shared audit work that all user stories depend on.

**⚠️ CRITICAL**: No user story drafting should begin until this audit phase is complete.

- [x] T002 [P] Audit semantic color roles and light/dark token baselines in app/style/palette.ts and app/style/theme.ts for DESIGN.md
- [x] T003 [P] Audit recurring primitives, spacing, radius, and elevation patterns in app/style/indexStyles.ts, app/style/setupGameStyles.ts, app/style/gameProgressStyles.ts, app/style/historyStyles.ts, and app/style/userPreferencesStyles.ts for DESIGN.md
- [x] T004 [P] Audit representative screen context and theme entry points in app/index.tsx, app/setupGame.tsx, app/gameProgress.tsx, app/history.tsx, app/userPreferences.tsx, and store/store.ts for contributor-facing terminology to preserve in DESIGN.md
- [x] T005 Consolidate the audit into a section-by-section outline in DESIGN.md using specs/001-define-design-language/research.md and specs/001-define-design-language/contracts/design-md-contract.md

**Checkpoint**: The DESIGN.md scaffold and audit outline are ready, so story-specific drafting can proceed.

---

## Phase 3: User Story 1 - Publish the Visual Contract (Priority: P1) 🎯 MVP

**Goal**: Deliver the core DESIGN.md sections that define the existing token system and reusable visual primitives.

**Independent Test**: Open DESIGN.md and verify that a contributor can identify the current color, typography, spacing, radius, elevation, and primitive guidance needed to style a representative screen.

### Implementation for User Story 1

- [x] T006 [US1] Write the Overview and Color Palette & Roles sections in DESIGN.md using app/style/palette.ts and app/style/theme.ts
- [x] T007 [US1] Write the Typography Rules, Spacing System, Border Radius, and Depth & Elevation sections in DESIGN.md using app/style/indexStyles.ts and app/style/userPreferencesStyles.ts
- [x] T008 [US1] Write the Component Primitives section for buttons, cards, modals, badges, inputs, tabs, rows, and counters in DESIGN.md using app/style/setupGameStyles.ts, app/style/gameProgressStyles.ts, and app/style/historyStyles.ts
- [x] T009 [US1] Review and tighten DESIGN.md against specs/001-define-design-language/spec.md so a contributor can style a representative screen from the document alone

**Checkpoint**: User Story 1 is complete when DESIGN.md functions as the MVP visual contract without requiring undocumented visual assumptions.

---

## Phase 4: User Story 2 - Preserve Theme Consistency (Priority: P2)

**Goal**: Document light-theme baseline behavior and dark-theme overrides so contributors can preserve the existing visual language across themes.

**Independent Test**: Use DESIGN.md alone to determine how a primary action, standard card, modal, text treatment, and semantic status treatment should appear in light and dark presentation.

### Implementation for User Story 2

- [x] T010 [US2] Add the Theme Rules section in DESIGN.md using app/style/theme.ts and store/store.ts
- [x] T011 [US2] Update the Component Primitives and Color Palette & Roles guidance in DESIGN.md with theme-specific behavior for buttons, cards, modals, text, and semantic states using app/style/gameProgressStyles.ts and app/style/historyStyles.ts
- [x] T012 [US2] Review DESIGN.md against specs/001-define-design-language/spec.md to confirm light and dark guidance is explicit for primary actions, cards, modals, text, and status treatments

**Checkpoint**: User Story 2 is complete when theme behavior is explicit enough that contributors do not have to infer dark-mode intent from light-mode guidance.

---

## Phase 5: User Story 3 - Guide Responsive Layout Decisions (Priority: P3)

**Goal**: Document the current mobile-first and wider-layout behavior so web and tablet adaptations stay aligned with the product language.

**Independent Test**: Use DESIGN.md to map one narrow/mobile screen and one wider/web layout variation without introducing undocumented spacing, sizing, or container behavior.

### Implementation for User Story 3

- [x] T013 [P] [US3] Audit width, wrapping, and dense-filter patterns in app/style/setupGameStyles.ts and app/style/userPreferencesStyles.ts for responsive guidance in DESIGN.md
- [x] T014 [P] [US3] Audit width, wrapping, tab, and modal constraints in app/style/historyStyles.ts and app/style/gameProgressStyles.ts for responsive guidance in DESIGN.md
- [x] T015 [US3] Add the Responsive Rules section in DESIGN.md covering stacking, wrapping, width constraints, and wider-layout adaptations from the audited style modules
- [x] T016 [US3] Add the Exceptions & Legacy Notes section in DESIGN.md for screen-specific or one-off layout patterns using app/style/indexStyles.ts and app/style/setupGameStyles.ts
- [x] T017 [US3] Review DESIGN.md against specs/001-define-design-language/spec.md to confirm narrow and wide layout guidance is explicit without inventing new breakpoint rules

**Checkpoint**: User Story 3 is complete when responsive behavior is documented clearly enough for contributors to preserve current web and tablet adaptations.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete final validation and cleanup across all stories.

- [x] T018 Validate DESIGN.md against specs/001-define-design-language/contracts/design-md-contract.md and resolve any missing required sections or primitive coverage in DESIGN.md
- [x] T019 Validate DESIGN.md against specs/001-define-design-language/quickstart.md and specs/001-define-design-language/spec.md, then perform final editorial cleanup in DESIGN.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts immediately.
- **Foundational (Phase 2)**: Depends on T001 and blocks all story drafting.
- **User Story 1 (Phase 3)**: Depends on T002-T005.
- **User Story 2 (Phase 4)**: Depends on T002-T005 and should be applied after US1 to avoid conflicting edits in DESIGN.md.
- **User Story 3 (Phase 5)**: Depends on T002-T005 and should be applied after US1 for the same single-file editing reason.
- **Polish (Phase 6)**: Depends on completion of all desired user stories.

### User Story Dependencies

- **US1 (P1)**: The MVP and first delivery slice; no dependency on later stories.
- **US2 (P2)**: Independently reviewable once added, but operationally sequenced after US1 because it extends the same DESIGN.md artifact.
- **US3 (P3)**: Independently reviewable once added, but operationally sequenced after US1 because it extends the same DESIGN.md artifact.

### Within Each User Story

- Audit tasks before drafting tasks.
- Draft core sections before review tasks.
- Complete the story review task before moving to the next story.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel during the foundational audit phase.
- T013 and T014 can run in parallel during the responsive audit phase.
- Story review tasks are not parallelizable because they depend on completed DESIGN.md edits.
- Cross-story implementation drafting is not marked parallel because the feature converges on one file: DESIGN.md.

---

## Parallel Example: Foundational Phase

```text
T002 Audit semantic color roles and light/dark token baselines in app/style/palette.ts and app/style/theme.ts for DESIGN.md
T003 Audit recurring primitives, spacing, radius, and elevation patterns in app/style/indexStyles.ts, app/style/setupGameStyles.ts, app/style/gameProgressStyles.ts, app/style/historyStyles.ts, and app/style/userPreferencesStyles.ts for DESIGN.md
T004 Audit representative screen context and theme entry points in app/index.tsx, app/setupGame.tsx, app/gameProgress.tsx, app/history.tsx, app/userPreferences.tsx, and store/store.ts for contributor-facing terminology to preserve in DESIGN.md
```

---

## Parallel Example: User Story 1

```text
No safe parallel drafting tasks are recommended for US1 because T006-T009 all modify DESIGN.md.
```

---

## Parallel Example: User Story 2

```text
No safe parallel drafting tasks are recommended for US2 because T010-T012 all modify DESIGN.md.
```

---

## Parallel Example: User Story 3

```text
T013 Audit width, wrapping, and dense-filter patterns in app/style/setupGameStyles.ts and app/style/userPreferencesStyles.ts for responsive guidance in DESIGN.md
T014 Audit width, wrapping, tab, and modal constraints in app/style/historyStyles.ts and app/style/gameProgressStyles.ts for responsive guidance in DESIGN.md
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001-T005.
2. Complete T006-T009.
3. Stop and validate that DESIGN.md already works as the visual contract for core tokens and primitives.

### Incremental Delivery

1. Finish Setup + Foundational.
2. Deliver US1 and validate the MVP document.
3. Deliver US2 and validate theme behavior coverage.
4. Deliver US3 and validate responsive behavior coverage.
5. Finish T018-T019 for final contract and spec compliance.

### Parallel Team Strategy

1. Split the foundational audit across T002, T003, and T004.
2. Merge findings through T005 before any story drafting begins.
3. For US3, split T013 and T014 across contributors, then merge into T015-T017.
4. Serialize all direct DESIGN.md drafting tasks to avoid same-file conflicts.

---

## Notes

- [P] tasks are limited to audit work that can be done safely in parallel.
- No automated tests are required unless implementation scope expands beyond documentation.
- Every task includes exact repository file paths.
- The suggested MVP scope is Phase 3 only: User Story 1.