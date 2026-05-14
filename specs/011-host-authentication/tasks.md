# Tasks: Account Authentication

**Input**: Design docs from `/specs/011-host-authentication/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `quickstart.md`, `contracts/host-auth-flow.md`

**Tests**: This feature requires unit coverage for the account auth hook and UI surfaces, pgTAP coverage for `public.accounts` grants/RLS/account bootstrap, and Playwright BDD coverage for sign-up, restore/sign-out, gating, and password reset.

**Organization**: Tasks are grouped by user story so each slice can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to, for example `US1`, `US2`, or `US3`
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the initial auth route, component, and test scaffolding used by the account-auth slice.

- [x] T001 Create the account auth route scaffolds in app/auth/index.tsx, app/auth/onboarding.tsx, and app/auth/reset-password.tsx plus shared component and test scaffolds in components/auth/, **tests**/hooks/, **tests**/components/auth/, e2e/features/host-auth.feature, and e2e/steps/host-auth.steps.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared auth state machine, account row posture, and database access rules that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Add shared account auth state, session bootstrap, and app-shell provider wiring in hooks/useAccountAuth.ts and app/_layout.tsx
- [x] T003 [P] Add the public.accounts RLS, grants, and display-name constraint migration in supabase/migrations/024_host_auth_accounts.sql
- [x] T004 [P] Add database regression coverage for public.accounts ownership, blank-name rejection, and authenticated access in supabase/tests/database/031_host_auth_accounts.test.sql

**Checkpoint**: The account auth shell exists, the account table is protected, and the database validation path is ready for feature work.

---

## Phase 3: User Story 1 - New Host Creates an Account and Profile (Priority: P1) 🎯 MVP

**Goal**: A new host can sign up, choose a display name, and reach the authenticated host-ready state.

**Independent Test**: Create a new account with email and password, finish display-name onboarding, and confirm the account row persists while the app reaches the authenticated host state.

### Tests for User Story 1 (REQUIRED coverage) ⚠️

- [x] T005 [P] [US1] Add sign-up and username onboarding tests in **tests**/hooks/useAccountAuth.test.ts and **tests**/components/auth/UsernameOnboardingForm.platform.test.tsx

### Implementation for User Story 1

- [x] T006 [US1] Implement the sign-up form and username onboarding flow in app/auth/index.tsx, app/auth/onboarding.tsx, components/auth/AuthForm.tsx, and components/auth/UsernameOnboardingForm.tsx
- [x] T007 [P] [US1] Wire the post-sign-up account bootstrap and display-name save path in hooks/useAccountAuth.ts
- [ ] T008 [P] [US1] Add the new-host web journey to e2e/features/host-auth.feature and e2e/steps/host-auth.steps.ts

**Checkpoint**: User Story 1 is independently testable — a new host can create an account, store a display name, and reach the host-ready state.

---

## Phase 4: User Story 2 - Returning Host Signs In, Stays Signed In, and Signs Out (Priority: P1)

**Goal**: A returning host can sign in, relaunch with the same session, and sign out cleanly.

**Independent Test**: Sign out, reload or relaunch the app, sign back in, and confirm the same account is restored and later cleared by sign-out.

### Tests for User Story 2 (REQUIRED coverage) ⚠️

- [ ] T009 [P] [US2] Add session-restore and sign-out tests in **tests**/hooks/useAccountAuth.test.ts and **tests**/components/preferences/AccountSection.platform.test.tsx

### Implementation for User Story 2

- [x] T010 [US2] Implement returning-account sign-in, restore, and sign-out behavior in hooks/useAccountAuth.ts and app/auth/index.tsx
- [x] T011 [P] [US2] Surface the authenticated account state and sign-out action in components/preferences/AccountSection.tsx and app/userPreferences.tsx
- [ ] T012 [P] [US2] Add returning-host sign-in, session-restore, and sign-out coverage to e2e/features/host-auth.feature and e2e/steps/host-auth.steps.ts

**Checkpoint**: User Story 2 is independently testable — a host can return later, regain the same account, and sign out without disturbing local game state.

---

## Phase 5: User Story 3 - Unauthenticated Users Are Blocked From Host Actions (Priority: P1)

**Goal**: Signed-out users are forced through authentication before they can continue into host-only multiplayer actions.

**Independent Test**: Start from a signed-out state, attempt the host entry action, and confirm the app interrupts the flow and routes the user into authentication first.

### Tests for User Story 3 (REQUIRED coverage) ⚠️

- [x] T013 [P] [US3] Add owner-action gating tests in **tests**/app/userPreferences.platform.test.tsx and **tests**/components/preferences/AccountSection.platform.test.tsx

### Implementation for User Story 3

- [x] T014 [US3] Implement the owner-action gate and return-to-flow behavior in components/preferences/AccountSection.tsx, app/userPreferences.tsx, and hooks/useAccountAuth.ts
- [x] T015 [P] [US3] Add blocked-owner-action coverage to e2e/features/host-auth.feature and e2e/steps/host-auth.steps.ts

**Checkpoint**: User Story 3 is independently testable — signed-out users cannot reach host-only actions without authenticating first.

---

## Phase 6: User Story 4 - Users Can Recover Access With Password Reset (Priority: P2)

**Goal**: A user who forgot their password can request a reset and return to the same account.

**Independent Test**: Request a password reset for a valid account, complete the recovery path, and confirm the user can sign in again with the updated password.

### Tests for User Story 4 (REQUIRED coverage) ⚠️

- [x] T016 [P] [US4] Add password-reset tests in **tests**/components/auth/PasswordResetForm.platform.test.tsx and **tests**/hooks/useAccountAuth.test.ts

### Implementation for User Story 4

- [x] T017 [US4] Implement password recovery and callback handling in app/auth/reset-password.tsx, components/auth/PasswordResetForm.tsx, and app/auth/index.tsx
- [x] T018 [P] [US4] Add the password-reset journey to e2e/features/host-auth.feature and e2e/steps/host-auth.steps.ts

**Checkpoint**: User Story 4 is independently testable — password recovery returns the host to the same account without creating a new identity.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finish with documentation and the final validation pass for the host-auth slice.

- [x] T019 [P] Update README.md and DESIGN.md with the host-auth flow, redirect requirements, and local validation commands
- [ ] T020 [P] Run npm run db:test, npm run lint, the focused Jest auth suites, and the new e2e/host-auth flow, then fix regressions in the touched files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Stories (Phase 3+)**: Each depends on the Foundational phase being complete
- **Polish (Final Phase)**: Depends on the desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - the MVP slice for account creation and display-name onboarding
- **User Story 2 (P1)**: Can start after Foundational - independent of US1, but it reuses the shared auth hook and host-account UI surface
- **User Story 3 (P1)**: Can start after US2 has the host-account surface in place, or after the shared gate behavior is ready if the UI is already defined
- **User Story 4 (P2)**: Can start after the shared auth route and hook exist; it is otherwise independent of the host gating work

### Within Each User Story

- Tests MUST be added before or alongside the implementation they validate
- Shared hook/state work before screen-specific wiring
- Route and screen files before the BDD step definitions that drive them
- Each story should be validated independently before moving to the next priority slice

### Parallel Opportunities

- **Phase 1**: T001 can be prepared while the feature folder is still being scaffolded
- **Phase 2**: T002, T003, and T004 can run in parallel because they touch different files
- **Phase 3**: T005 can run alongside T006; T007 and T008 can proceed in parallel once the sign-up contract is locked
- **Phase 4**: T009 can run alongside T010; T011 and T012 can proceed in parallel once the host-account surface shape is fixed
- **Phase 5**: T013 can run alongside T014; T015 can proceed in parallel once the gate scenario is defined
- **Phase 6**: T016 can run alongside T017; T018 can proceed in parallel once the recovery route is settled
- **Phase 7**: T019 and T020 can run in parallel because one is documentation and the other is validation

---

## Parallel Examples

### User Story 1

```text
Task: "Add sign-up and username onboarding tests in __tests__/hooks/useAccountAuth.test.ts and __tests__/components/auth/UsernameOnboardingForm.platform.test.tsx."
Task: "Implement the sign-up form and username onboarding flow in app/auth/index.tsx, app/auth/onboarding.tsx, components/auth/AuthForm.tsx, and components/auth/UsernameOnboardingForm.tsx."
```

### User Story 2

```text
Task: "Add session-restore and sign-out tests in __tests__/hooks/useAccountAuth.test.ts and __tests__/components/preferences/AccountSection.platform.test.tsx."
Task: "Surface the authenticated account state and sign-out action in components/preferences/AccountSection.tsx and app/userPreferences.tsx."
```

### User Story 3

```text
Task: "Add owner-action gating tests in __tests__/app/userPreferences.platform.test.tsx and __tests__/components/preferences/AccountSection.platform.test.tsx."
Task: "Implement the owner-action gate and return-to-flow behavior in components/preferences/AccountSection.tsx, app/userPreferences.tsx, and hooks/useAccountAuth.ts."
```

### User Story 4

```text
Task: "Add password-reset tests in __tests__/components/auth/PasswordResetForm.platform.test.tsx and __tests__/hooks/useAccountAuth.test.ts."
Task: "Implement password recovery and callback handling in app/auth/reset-password.tsx, components/auth/PasswordResetForm.tsx, and app/auth/index.tsx."
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate the sign-up and onboarding path independently before expanding scope

### Incremental Delivery

1. Finish Setup + Foundational so the auth shell, account table posture, and baseline tests exist
2. Deliver User Story 1 to prove new-host sign-up and display-name onboarding
3. Deliver User Story 2 to restore sessions and support sign-out cleanly
4. Deliver User Story 3 to block host-only actions until authentication completes
5. Deliver User Story 4 to complete password recovery and retest the full auth journey
6. Finish with documentation and the repeatable validation pass

### Parallel Team Strategy

1. One contributor can own the auth hook and app-shell wiring while another prepares the migration and pgTAP coverage
2. Once the foundation is in place, one contributor can work on the sign-up/onboarding screens while another builds the returning-host surface
3. The BDD scenarios can be expanded alongside the screen work once the route names and return-flow behavior are stable

---

## Summary

| Phase                    | Story | Tasks         | Parallel Opportunities   |
| ------------------------ | ----- | ------------- | ------------------------ |
| 1 - Setup                | -     | T001 (1)      | T001                     |
| 2 - Foundational         | -     | T002-T004 (3) | T002 + T003 + T004       |
| 3 - US1 New Host Signup  | P1    | T005-T008 (4) | T005 + T006, T007 + T008 |
| 4 - US2 Returning Host   | P1    | T009-T012 (4) | T009 + T010, T011 + T012 |
| 5 - US3 Host Action Gate | P1    | T013-T015 (3) | T013 + T014, T015        |
| 6 - US4 Password Reset   | P2    | T016-T018 (3) | T016 + T017, T018        |
| 7 - Polish               | -     | T019-T020 (2) | T019 + T020              |
| **Total**                |       | **20**        |                          |

---

## Notes

- [P] tasks can be executed in parallel when they touch different files and do not depend on incomplete work
- Each user story remains independently testable once its tasks are complete
- Features affecting auth or persisted data must include migration, policy, and database validation tasks
- Keep local game setup, history, and preferences public; only multiplayer host and room-management actions are gated by this slice
