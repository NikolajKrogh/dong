# Tasks: Host Profile and Synced Settings

**Input**: Design docs from `/specs/013-host-profile-settings/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`

**Tests**: This feature requires unit coverage for profile validation and save/restore, supported-settings sync, safe sign-out/session expiration, pgTAP coverage for account/settings constraints and RLS, and Playwright BDD coverage for the primary profile/settings journeys.

**Organization**: Tasks are grouped by user story so each slice can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to, for example `US1`, `US2`, or `US3`
- Include exact file paths in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared BDD scaffold for the new preferences/profile journey.

- [x] T001 [P] Create the shared host-profile-settings BDD scaffold in `e2e/features/host-profile-settings.feature` and `e2e/steps/host-profile-settings.steps.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the schema, database validation, and shared account/settings helpers that every story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Add the account profile and synced-settings migration in `supabase/migrations/027_host_profile_and_settings.sql`
- [x] T003 [P] Add pgTAP regression coverage for the new account username rules, bootstrap behavior, and synced-settings RLS in `supabase/tests/database/032_host_profile_and_settings.test.sql`
- [x] T004 [P] Extend `hooks/useAccountAuth.ts` with account profile bootstrap, display-name and username normalization, and cloud-backed settings load/save helpers
- [x] T005 [P] Add synced preference hydration and serialization helpers to `store/store.ts` for theme, sound, common match notifications, configured leagues, and default selected leagues

**Checkpoint**: The account/profile schema exists, the database posture is covered, and the shared helpers for profile and settings sync are ready.

---

## Phase 3: User Story 1 - Edit Host Profile Details (Priority: P1) 🎯 MVP

**Goal**: A signed-in host can edit their visible profile details from preferences and see the saved values restore on later visits.

**Independent Test**: Sign in, change the profile fields from the preferences screen, save them, and confirm the updated values appear again after leaving and returning to the app.

### Tests for User Story 1 (REQUIRED coverage) ⚠️

- [x] T006 [P] [US1] Add profile validation, save, restore, and validation-error copy coverage in `__tests__/hooks/useAccountAuth.test.ts`
- [x] T007 [P] [US1] Add the profile section, preferences-screen, and invalid-profile-message coverage in `__tests__/components/preferences/ProfileSection.platform.test.tsx` and `__tests__/app/userPreferences.platform.test.tsx`

### Implementation for User Story 1

- [x] T008 [US1] Create `components/preferences/ProfileSection.tsx` and render it from `app/userPreferences.tsx`
- [x] T009 [US1] Extend `hooks/useAccountAuth.ts` with profile update methods for display name and username plus validation errors
- [x] T010 [US1] Add the profile-edit, restore, and invalid-profile-message scenarios to `e2e/features/host-profile-settings.feature` and `e2e/steps/host-profile-settings.steps.ts`

**Checkpoint**: User Story 1 is independently testable and delivers the MVP slice for editing the host profile.

---

## Phase 4: User Story 2 - Sync Supported Preferences Across Devices (Priority: P1)

**Goal**: The supported preferences follow the signed-in host across sessions and devices.

**Independent Test**: Change the supported preference controls on one signed-in device, then sign in on another device or restart the app and confirm the same values are restored.

### Tests for User Story 2 (REQUIRED coverage) ⚠️

- [x] T011 [P] [US2] Add cloud-backed settings sync coverage, including first-sync seeding from current local values, in `__tests__/hooks/useAccountAuth.test.ts`
- [x] T012 [P] [US2] Add preference-surface coverage in `__tests__/components/preferences/AppearanceSettings.platform.test.tsx`, `__tests__/components/preferences/SoundNotificationSettings.platform.test.tsx`, and `__tests__/components/preferences/LeagueSettings.platform.test.tsx`

### Implementation for User Story 2

- [x] T013 [US2] Wire cloud-backed settings bootstrap, first-sync seeding from current local values, and persistence through `hooks/useAccountAuth.ts` and `store/store.ts`
- [x] T014 [US2] Update `components/preferences/AppearanceSettings.tsx`, `components/preferences/SoundNotificationSettings.tsx`, `components/preferences/LeagueSettings.tsx`, and `app/userPreferences.tsx` to read and write the synced preference state
- [x] T015 [US2] Add the synced-preferences restore and first-sync seeding scenario to `e2e/features/host-profile-settings.feature` and `e2e/steps/host-profile-settings.steps.ts`

**Checkpoint**: User Story 2 is independently testable and keeps the supported preference set consistent across devices.

---

## Phase 5: User Story 3 - Handle Sign-Out and Session Expiration Safely (Priority: P2)

**Goal**: Signing out or losing a session returns the preferences experience to a safe state without corrupting saved profile or settings data.

**Independent Test**: Sign out from preferences or simulate an expired session while viewing the profile area, then confirm the app exits the signed-in state cleanly and keeps saved account data intact.

### Tests for User Story 3 (REQUIRED coverage) ⚠️

- [x] T016 [P] [US3] Add safe sign-out, expired-session, and failure-copy coverage in `__tests__/hooks/useAccountAuth.test.ts`
- [x] T017 [P] [US3] Add signed-out recovery and session-failure message coverage in `__tests__/components/preferences/AccountSection.platform.test.tsx`

### Implementation for User Story 3

- [x] T018 [US3] Extend `hooks/useAccountAuth.ts` to clear account, profile, and settings state safely on sign-out and expired-session events
- [x] T019 [US3] Update `components/preferences/AccountSection.tsx` and `app/userPreferences.tsx` so the preferences surface recovers cleanly when the session is lost
- [x] T020 [US3] Add the sign-out, expired-session, and explanatory-message scenarios to `e2e/features/host-profile-settings.feature` and `e2e/steps/host-profile-settings.steps.ts`

**Checkpoint**: User Story 3 is independently testable and prevents stale signed-in state from leaking through sign-out or expiry.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish documentation and run the full validation pass for the feature.

- [x] T021 [P] Update `README.md` and `DESIGN.md` with the host profile and synced-settings flow, validation rules, and validation commands
- [x] T022 [P] Run `npm run db:test`, `npm test`, `npm run lint`, and `npm run test:e2e`, then fix regressions in the touched files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Stories (Phase 3+)**: Depend on the Foundational phase being complete
- **Polish (Final Phase)**: Depends on the desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after the Foundational phase and is the MVP slice
- **User Story 2 (P1)**: Can start after the Foundational phase; it reuses the shared settings helpers but remains independently testable
- **User Story 3 (P2)**: Can start after the Foundational phase; it reuses the shared auth/session helpers but remains independently testable

### Within Each User Story

- Required tests should be added before or alongside the implementation they validate
- Shared hook/state work should land before screen-specific wiring when a story depends on it
- Route and screen files should be updated before the shared BDD step definitions are finalized
- Each story should be validated independently before moving to the next priority slice

### Parallel Opportunities

- **Phase 2**: `T002` + `T003` + `T004` + `T005` can proceed in parallel because they touch separate layers and files
- **Phase 3**: `T006` + `T007` can proceed in parallel once the profile contract is fixed
- **Phase 4**: `T011` + `T012` can proceed in parallel once the synced-settings contract is fixed
- **Phase 5**: `T016` + `T017` can proceed in parallel once the safe-session contract is fixed
- **Phase 6**: `T021` + `T022` can proceed in parallel because one is documentation and the other is validation

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate the profile-edit flow independently before expanding scope

### Incremental Delivery

1. Finish Setup + Foundational so the schema, shared helpers, and validation path exist
2. Deliver User Story 1 to prove profile editing and restore behavior
3. Deliver User Story 2 to sync the supported preference set across devices
4. Deliver User Story 3 to keep sign-out and session expiry safe
5. Finish with documentation and a full validation pass

### Parallel Team Strategy

1. One contributor can own the schema/database work while another prepares the hook and store helpers
2. After the foundation is complete, one contributor can work on the profile UI while another implements the synced preference path
3. The BDD scenarios can be expanded alongside the screen work once the route names and helper APIs are stable

---

## Summary

| Phase | Story | Tasks | Parallel Opportunities |
| --- | --- | --- | --- |
| 1 - Setup | - | T001 (1) | T001 |
| 2 - Foundational | - | T002-T005 (4) | T002+T003+T004+T005 |
| 3 - US1 Edit Host Profile | P1 | T006-T010 (5) | T006+T007 |
| 4 - US2 Sync Supported Preferences | P1 | T011-T015 (5) | T011+T012 |
| 5 - US3 Safe Sign-Out/Expiry | P2 | T016-T020 (5) | T016+T017 |
| 6 - Polish | - | T021-T022 (2) | T021+T022 |
| **Total** |  | **22** |  |

---

## Notes

- `[P]` tasks can be executed in parallel when they touch different files and do not depend on incomplete work
- Each user story remains independently testable once its tasks are complete
- Features affecting auth or persisted data must include migration, policy, or RLS validation tasks
- Features affecting substantial UI flows must include end-to-end coverage for the primary journey
- Keep local game setup, history, and preferences public; only the synced account-backed profile and supported preference state should change in this slice
- Use the existing Expo, Tamagui, Zustand, and Supabase architecture rather than introducing a separate backend layer
