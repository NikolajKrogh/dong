# Tasks: Migrate Application Shell

**Input**: Design documents from `/specs/003-migrate-app-shell/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/application-shell-contract.md`, `quickstart.md`

**Tests**: Jest regression coverage is required for each story. Because this feature materially changes the launch shell and a primary navigation flow, Playwright web smoke coverage authored through `.feature` scenarios and shared step definitions is also required for the affected journeys.

**Organization**: Tasks are grouped by user story so each slice can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Complete the missing Tamagui scaffolding and shared test/export setup the migration depends on.

- [X] T001 [P] Configure the Tamagui compiler baseline in tamagui.config.ts and babel.config.js
- [X] T002 [P] Create the shared shell export, Playwright BDD scaffolds, and render-helper scaffolds in components/ui/index.ts, playwright.config.ts, e2e/steps/fixtures.ts, and test-utils/tamagui.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the token bridge, provider wrapper, shell primitive scaffolds, and test harness required before any story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Create the DONG-to-Tamagui token mapping and hybrid theme bridge in app/style/palette.ts, app/style/theme.ts, and tamagui.config.ts
- [X] T004 [P] Implement the shared root provider wrapper in components/ui/TamaguiAppProvider.tsx
- [X] T005 [P] Define reusable shell primitive scaffolds in components/ui/ShellScreen.tsx, components/ui/ShellSection.tsx, components/ui/ShellCard.tsx, and components/ui/ShellActionButton.tsx
- [X] T006 [P] Align the shared shell test harness scaffolds in test-utils/tamagui.tsx and __tests__/app/_layout.platform.test.tsx

**Checkpoint**: The shell foundation is ready for story work, and all later stories can build on the same tokens, provider contract, and test utilities.

---

## Phase 3: User Story 1 - Consistent Shell Foundation (Priority: P1) 🎯 MVP

**Goal**: Activate a Tamagui-backed root shell that honors the persisted theme preference and keeps global shell behavior intact on native and web.

**Independent Test**: Launch the app on native and web, confirm the root shell is themed immediately, and verify gesture handling, routing, toast presentation, and persisted theme selection still work.

### Tests for User Story 1 (REQUIRED coverage) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [X] T007 [P] [US1] Add root shell provider regression coverage in __tests__/app/_layout.platform.test.tsx
- [X] T008 [P] [US1] Add provider theme-bridge regression coverage in __tests__/components/ui/TamaguiAppProvider.platform.test.tsx
- [X] T009 [P] [US1] Add shell launch BDD coverage in e2e/features/app-shell.feature and e2e/steps/app-shell.steps.ts

### Implementation for User Story 1

- [X] T010 [P] [US1] Implement TamaguiAppProvider composition and exports in components/ui/TamaguiAppProvider.tsx and components/ui/index.ts
- [X] T011 [P] [US1] Implement persisted shell theme selection in tamagui.config.ts, app/style/theme.ts, and app/style/palette.ts
- [X] T012 [US1] Integrate the themed root shell, gesture root, router stack, and toast host in app/_layout.tsx and test-utils/tamagui.tsx

**Checkpoint**: User Story 1 is complete when the app launches inside the themed root shell with the correct persisted theme and no shell-level regressions.

---

## Phase 4: User Story 2 - Home Screen Preserves Current Experience (Priority: P2)

**Goal**: Move the home screen onto the shell foundation without changing the current entry states, action hierarchy, or navigation behavior.

**Independent Test**: Open the app, dismiss splash or onboarding if needed, and verify the home screen still shows its existing states, cards, and navigation entry points in both themes.

### Tests for User Story 2 (REQUIRED coverage) ⚠️

- [X] T013 [P] [US2] Add home shell state regression coverage in __tests__/app/index.platform.test.tsx and __tests__/components/ui/ShellCard.platform.test.tsx
- [X] T014 [P] [US2] Extend the app shell BDD coverage for home-screen scenarios in e2e/features/app-shell.feature and e2e/steps/app-shell.steps.ts

### Implementation for User Story 2

- [X] T015 [P] [US2] Implement home-ready shell surface variants in components/ui/ShellScreen.tsx, components/ui/ShellSection.tsx, components/ui/ShellCard.tsx, and components/ui/ShellActionButton.tsx
- [X] T016 [US2] Migrate the home screen layout, current-game/history cards, and primary calls to action in app/index.tsx and app/style/indexStyles.ts
- [X] T017 [US2] Preserve splash or onboarding entry behavior and existing navigation anchors in app/index.tsx, components/OnboardingScreen.tsx, and components/ui/index.ts

**Checkpoint**: User Story 2 is complete when the home screen renders through the shell primitives while preserving its current states, actions, and navigation.

---

## Phase 5: User Story 3 - Preferences Screen Keeps Control Flows (Priority: P3)

**Goal**: Move the preferences screen onto the shell foundation while preserving appearance switching, onboarding access, and league-management flows.

**Independent Test**: Open preferences from home, change appearance, open each modal-based flow, and return to home with the updated shell still active.

### Tests for User Story 3 (REQUIRED coverage) ⚠️

- [X] T018 [P] [US3] Add preferences shell regression coverage in __tests__/app/userPreferences.platform.test.tsx and __tests__/components/preferences/LeagueSettings.platform.test.tsx
- [X] T019 [P] [US3] Add appearance and theme-switch regression coverage in __tests__/components/preferences/AppearanceSettings.platform.test.tsx, e2e/features/app-shell.feature, and e2e/steps/app-shell.steps.ts

### Implementation for User Story 3

- [X] T020 [P] [US3] Migrate the preferences shell container and header to shared shell primitives in app/userPreferences.tsx and components/preferences/Header.tsx
- [X] T021 [P] [US3] Migrate appearance, notification, and onboarding surfaces in components/preferences/AppearanceSettings.tsx, components/preferences/SoundNotificationSettings.tsx, and components/preferences/OnboardingButton.tsx
- [X] T022 [US3] Migrate league settings and modal shells in components/preferences/LeagueSettings.tsx, components/preferences/AddLeagueModal.tsx, components/preferences/ManageLeaguesModal.tsx, and components/preferences/SelectDefaultLeaguesModal.tsx
- [X] T023 [US3] Reconcile hybrid preferences styling and shell token usage in app/style/userPreferencesStyles.ts and app/userPreferences.tsx

**Checkpoint**: User Story 3 is complete when preferences renders through the shell foundation and all current settings flows still work in both themes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish documentation, run full validation, and resolve any remaining integration gaps across all stories.

- [X] T024 [P] Update shell adoption guidance in DESIGN.md and specs/003-migrate-app-shell/quickstart.md
- [X] T025 Run the quickstart validation commands from specs/003-migrate-app-shell/quickstart.md and reconcile any remaining shell integration issues in playwright.config.ts, tamagui.config.ts, app/_layout.tsx, app/index.tsx, and app/userPreferences.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies and can start immediately.
- **Foundational (Phase 2)**: Depends on T001-T002 and blocks all story work.
- **User Story 1 (Phase 3)**: Depends on T003-T006.
- **User Story 2 (Phase 4)**: Depends on T003-T006; final validation also requires the US1 root shell integration to be in place.
- **User Story 3 (Phase 5)**: Depends on T003-T006; final validation also requires the US1 root shell integration to be in place.
- **Polish (Phase 6)**: Depends on all selected stories being complete.

### User Story Dependencies

- **US1 (P1)**: Can start as soon as the foundational phase is complete and is the MVP slice.
- **US2 (P2)**: Can begin after the foundational phase, but its end-to-end validation depends on the US1 shell foundation being active.
- **US3 (P3)**: Can begin after the foundational phase, but its end-to-end validation depends on the US1 shell foundation being active.

### Within Each User Story

- Story tests must be written first and confirmed failing before implementation starts.
- Shared primitives or provider changes should land before the consuming screen changes.
- Screen migration should complete before Playwright BDD smoke validation is considered done.
- Each story should reach its checkpoint before polish work begins.

### Parallel Opportunities

- T001 and T002 can run in parallel.
- T004, T005, and T006 can run in parallel after T001-T002 complete.
- T007, T008, and T009 can run in parallel for US1.
- T010 and T011 can run in parallel for US1 before T012.
- T013 and T014 can run in parallel for US2.
- T018 and T019 can run in parallel for US3.
- T020 and T021 can run in parallel for US3 before T022-T023.

---

## Parallel Example: User Story 1

```text
T007 Add root shell provider regression coverage in __tests__/app/_layout.platform.test.tsx
T008 Add provider theme-bridge regression coverage in __tests__/components/ui/TamaguiAppProvider.platform.test.tsx
T009 Add shell launch BDD coverage in e2e/features/app-shell.feature and e2e/steps/app-shell.steps.ts

T010 Implement TamaguiAppProvider composition and exports in components/ui/TamaguiAppProvider.tsx and components/ui/index.ts
T011 Implement persisted shell theme selection in tamagui.config.ts, app/style/theme.ts, and app/style/palette.ts
```

---

## Parallel Example: User Story 3

```text
T018 Add preferences shell regression coverage in __tests__/app/userPreferences.platform.test.tsx and __tests__/components/preferences/LeagueSettings.platform.test.tsx
T019 Add appearance and theme-switch regression coverage in __tests__/components/preferences/AppearanceSettings.platform.test.tsx, e2e/features/app-shell.feature, and e2e/steps/app-shell.steps.ts

T020 Migrate the preferences shell container and header to shared shell primitives in app/userPreferences.tsx and components/preferences/Header.tsx
T021 Migrate appearance, notification, and onboarding surfaces in components/preferences/AppearanceSettings.tsx, components/preferences/SoundNotificationSettings.tsx, and components/preferences/OnboardingButton.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Confirm the root shell launches themed on native and web.

### Incremental Delivery

1. Finish Setup + Foundational.
2. Deliver US1 and validate shell activation.
3. Deliver US2 and validate the migrated home screen.
4. Deliver US3 and validate the migrated preferences flow.
5. Finish Polish validation and documentation updates.

### Parallel Team Strategy

1. One owner completes T001-T003 to stabilize the Tamagui foundation.
2. A second owner can take T004-T006 and keep the shared shell scaffolds moving.
3. After Phase 2, separate owners can work on US1 tests, home migration, and preferences migration in parallel with coordination around shared primitives.
4. Keep T025 serialized so final validation happens against the fully integrated shell.

---

## Notes

- [P] tasks are limited to work that touches separate files with no incomplete dependency.
- Every story includes required automated test tasks.
- The suggested MVP scope is Phase 3 only: User Story 1.
- Format validation target: every task uses the required checkbox, task ID, optional `[P]`, required story label for story phases, and exact file paths.
