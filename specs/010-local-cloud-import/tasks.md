---
description: "Task list template for feature implementation"
---

# Tasks: One-Time Local-to-Cloud Import

**Input**: Design documents from `/specs/010-local-cloud-import/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: This feature changes shared state, persistence, and a substantial Settings flow, so it includes unit coverage, pgTAP database coverage, and a Playwright BDD journey.

**Organization**: Tasks are grouped by user story so each slice can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install the shared client dependency and define import-domain types used by the hook, utilities, and tests.

- [x] T001 [P] Add `@supabase/supabase-js` to `package.json` and `package-lock.json`
- [x] T002 [P] Define shared import-domain types and RPC payload/response shapes in `types/legacyHistoryImport.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database and helper infrastructure that every story depends on.

**⚠️ CRITICAL**: No story work should begin until the private ledger, RPC wrapper, and shared client helpers are in place.

- [x] T003 Create `supabase/migrations/023_legacy_history_import_schema.sql` with private import-state tables, enums, indexes, and grants for account completion and per-session fingerprints
- [x] T004 [P] Create `utils/supabaseClient.ts` with a typed Supabase client factory that reads the Expo public Supabase env values and exposes the RPC client used by the importer
- [x] T005 [P] Create `utils/legacyHistoryImport.ts` with shared normalization helpers for local history snapshots, claimant derivation, guest preservation, and source-fingerprint inputs

**Checkpoint**: The database contract and shared helper layer exist, so the Settings flow and tests can be implemented safely.

---

## Phase 3: User Story 1 - Start Import From Settings (Priority: P1) 🎯 MVP

**Goal**: A signed-in user can open Settings, choose the local participant that represents their account, and start the first cloud import run.

**Independent Test**: Sign in, seed legacy local history, open Settings, start import, choose a claimant, and confirm the app reports progress/completion while creating cloud-backed sessions.

### Tests for User Story 1 (REQUIRED coverage) ⚠️

- [x] T006 [P] [US1] Add pgTAP schema coverage in `supabase/tests/database/120_legacy_history_import_schema.test.sql` to verify the private ledger tables, indexes, and public RPC grants exist with the expected shape
- [x] T007 [P] [US1] Add unit coverage in `__tests__/utils/legacyHistoryImport.test.ts` for claimant normalization, snapshot flattening, and source-fingerprint inputs
- [x] T008 [P] [US1] Add component-level coverage in `__tests__/components/preferences/LegacyHistoryImport.platform.test.tsx` for claimant selection, empty history, and in-progress rendering
- [x] T009 [P] [US1] Add screen-level regression coverage in `__tests__/app/userPreferences.platform.test.tsx` to verify the Settings screen renders the new import entry point without breaking the existing shell
- [x] T010 [P] [US1] Add Playwright BDD coverage in `e2e/features/legacy-history-import.feature`, `e2e/steps/legacy-history-import.steps.ts`, and `e2e/steps/browser-flow.helpers.ts` for starting import from Settings, selecting a claimant, and completing the first successful run

### Implementation for User Story 1

- [x] T011 [P] [US1] Implement `hooks/useLegacyHistoryImport.ts` to read the persisted local history, prepare claimant options, call the import RPC, and expose import progress state
- [x] T012 [P] [US1] Implement `components/preferences/LegacyHistoryImportClaimantModal.tsx` for explicit claimant selection and ambiguous-name guardrails
- [x] T013 [US1] Implement `components/preferences/LegacyHistoryImportSection.tsx` and wire it into `app/userPreferences.tsx` and `app/style/userPreferencesStyles.ts` so Settings shows the import entry point and current status

**Checkpoint**: The first successful import flow is available in Settings and can be tested on its own.

---

## Phase 4: User Story 2 - Avoid Duplicate Imports (Priority: P1)

**Goal**: Retrying the import is safe, and an already-completed account import does not create duplicate cloud sessions.

**Independent Test**: Run the same import twice against the same local history and confirm the second run reports already-imported or skipped statuses without increasing cloud session counts.

### Tests for User Story 2 (REQUIRED coverage) ⚠️

- [x] T014 [P] [US2] Add pgTAP coverage in `supabase/tests/database/130_legacy_history_import_dedupe.test.sql` and `supabase/tests/database/150_legacy_history_import_retry.test.sql` for duplicate fingerprints, partial retries, and completed-account no-op behavior
- [x] T015 [P] [US2] Extend `__tests__/components/preferences/LegacyHistoryImport.platform.test.tsx` with already-imported, retry, and failure-state regressions
- [x] T016 [P] [US2] Extend `e2e/features/legacy-history-import.feature`, `e2e/steps/legacy-history-import.steps.ts`, and `e2e/steps/browser-flow.helpers.ts` with a repeated-run/no-op scenario

### Implementation for User Story 2

- [x] T017 [US2] Update `hooks/useLegacyHistoryImport.ts` to map RPC responses into imported, skipped, failed, and completed states and to block duplicate reruns after completion
- [x] T018 [US2] Update `components/preferences/LegacyHistoryImportSection.tsx` to show progress, retry, and already-imported messaging from the hook state

**Checkpoint**: The importer is idempotent and safe to retry without duplicating cloud sessions.

---

## Phase 5: User Story 3 - Preserve Legacy Guest Participants (Priority: P2)

**Goal**: Imported sessions keep non-account players as session-scoped guest snapshots instead of promoting them into permanent identities.

**Independent Test**: Import a mixed registered/guest legacy session and confirm the guest rows remain session-scoped in the cloud schema.

### Tests for User Story 3 (REQUIRED coverage) ⚠️

- [x] T019 [P] [US3] Add pgTAP coverage in `supabase/tests/database/140_legacy_history_import_claim.test.sql` for claimed-participant mapping, guest-scoped participants, and cross-account isolation
- [x] T020 [P] [US3] Extend `__tests__/utils/legacyHistoryImport.test.ts` with mixed-player normalization and guest-preservation regressions
- [x] T021 [P] [US3] Extend `e2e/features/legacy-history-import.feature`, `e2e/steps/legacy-history-import.steps.ts`, and `e2e/steps/browser-flow.helpers.ts` with a mixed registered/guest session scenario

### Implementation for User Story 3

- [x] T022 [US3] Update `utils/legacyHistoryImport.ts` to preserve guest participants as session-scoped snapshots when building the normalized payload
- [x] T023 [US3] Update `hooks/useLegacyHistoryImport.ts` to carry guest-preservation metadata through the RPC request and surface validation or conflict errors clearly

**Checkpoint**: The importer preserves guest identity boundaries while still linking the signed-in account to the chosen claimant.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation sync, and repo-level checks.

- [x] T024 [P] Sync `specs/010-local-cloud-import/quickstart.md`, `specs/010-local-cloud-import/contracts/legacy-history-import-contract.md`, and `specs/010-local-cloud-import/data-model.md` with any implementation details that changed during coding
- [x] T025 [P] Run `npm run db:reset`, `npm run db:test`, `npx jest --runInBand __tests__/app/userPreferences.platform.test.tsx __tests__/components/preferences/LegacyHistoryImport.platform.test.tsx`, `npm run test:e2e`, and `npm run lint` from `specs/010-local-cloud-import/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all story work
- **User Stories (Phase 3+)**: Depend on the shared foundation; US1 is the MVP and should land first
- **Polish (Final Phase)**: Depends on the desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: The first import flow, claimant picker, and shared hook are the base slice
- **User Story 2 (P1)**: Reuses the shared import flow from US1 to add retry and no-op behavior
- **User Story 3 (P2)**: Reuses the same normalization path to preserve guest-scoped participants

### Within Each User Story

- Required tests are written before the story is marked done
- Shared helper utilities come before feature-specific UI wiring
- Database contracts are implemented before client calls that depend on them
- Story complete before moving to the next priority slice

### Parallel Opportunities

- Setup tasks T001 and T002 can run in parallel
- Foundational tasks T004 and T005 can run in parallel after the schema migration is decided
- User Story 1 test tasks T006 through T010 can be developed in parallel once the RPC contract is fixed
- User Story 1 implementation tasks T011 and T012 can be built in parallel, then T013 can wire the completed pieces together
- User Story 2 test tasks T014 through T016 can run in parallel
- User Story 3 test tasks T019 through T021 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch the Settings regression and importer unit coverage together:
Task: "Add pgTAP schema coverage in supabase/tests/database/120_legacy_history_import_schema.test.sql"
Task: "Add unit coverage in __tests__/utils/legacyHistoryImport.test.ts"
Task: "Add component-level coverage in __tests__/components/preferences/LegacyHistoryImport.platform.test.tsx"
Task: "Add screen-level regression coverage in __tests__/app/userPreferences.platform.test.tsx"

# Build the import building blocks together once the contract is fixed:
Task: "Implement hooks/useLegacyHistoryImport.ts"
Task: "Implement components/preferences/LegacyHistoryImportClaimantModal.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate the first import flow before adding retry or guest-preservation work

### Incremental Delivery

1. Foundation ready
2. Add User Story 1 and confirm the first successful import
3. Add User Story 2 and confirm duplicate runs no-op or retry safely
4. Add User Story 3 and confirm guest participants stay session-scoped
5. Finish with docs and repo-level validation

### Parallel Team Strategy

With multiple developers:

1. One developer can own the database migrations and pgTAP coverage
2. One developer can own the Settings UI and claimant modal
3. One developer can own the Playwright BDD flow and browser-flow helpers
4. Story 2 and Story 3 can then split across retry/idempotency and guest-preservation work once the shared flow is in place
