# Tasks: Protected Multiplayer Data Access

**Input**: Design documents from `/specs/008-add-data-rls/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`

**Tests**: This feature requires pgTAP coverage for database access boundaries. Every new behavior introduced by the schema or policies must have corresponding database tests. No end-to-end UI coverage is required because the feature stays in the database layer.

**Organization**: Tasks are grouped by user story so each slice can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to, for example `US1`, `US2`, or `US3`
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the file scaffolds for the new database security slice.

- [x] T001 [P] Create the migration scaffolds in `supabase/migrations/011_create_social_tables.sql`, `supabase/migrations/012_social_constraints_and_indexes.sql`, `supabase/migrations/013_enable_rls_and_grants.sql`, `supabase/migrations/014_profiles_rls.sql`, `supabase/migrations/015_settings_rls.sql`, `supabase/migrations/016_friendships_rls.sql`, and `supabase/migrations/017_room_read_rls.sql`
- [x] T002 [P] Create the pgTAP test scaffolds in `supabase/tests/database/030_profiles_settings_rls.test.sql`, `supabase/tests/database/040_friendships_rls.test.sql`, `supabase/tests/database/050_room_rls.test.sql`, and `supabase/tests/database/060_privileged_write_paths.test.sql`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the new account-linked tables, enforce core constraints, and establish the exposed-table RLS/grant posture required by every user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Add the `friendship_status` enum plus the `profiles`, `settings`, and `friendships` base tables in `supabase/migrations/011_create_social_tables.sql`
- [x] T004 Add ownership, uniqueness, and supporting indexes and constraints for `profiles`, `settings`, and `friendships` in `supabase/migrations/012_social_constraints_and_indexes.sql`
- [x] T005 Add explicit grants and enable RLS on `profiles`, `settings`, `friendships`, and the existing room tables in `supabase/migrations/013_enable_rls_and_grants.sql`, keeping room tables read-only for authenticated clients while service_role retains the approved write path

**Checkpoint**: The social tables exist, the base constraints are in place, and the exposed tables are ready for policy-specific user story work.

---

## Phase 3: User Story 1 - Personal Records Respect Friendship Boundaries (Priority: P1)

**Goal**: Signed-in users can manage their own profile and settings records, and accepted friends can read the profile row but not the settings row.

**Independent Test**: Authenticate as two users, verify each user can read and update their own profile and settings rows, confirm an accepted friend can read the profile but not the settings, and confirm unrelated users cannot access either record.

### Tests for User Story 1 (REQUIRED coverage) ⚠️

- [x] T006 [P] [US1] Extend `supabase/tests/database/010_schema.test.sql` and `supabase/tests/database/020_constraints.test.sql` with `profiles` and `settings` table-shape, ownership, and one-row-per-account assertions
- [x] T007 [P] [US1] Build `supabase/tests/database/030_profiles_settings_rls.test.sql` to verify owner read/write access, accepted-friend profile visibility, and denied settings access

### Implementation for User Story 1

- [x] T008 [P] [US1] Add owner and accepted-friend RLS policies for `profiles` in `supabase/migrations/014_profiles_rls.sql`
- [x] T009 [P] [US1] Add owner-only RLS policies for `settings` in `supabase/migrations/015_settings_rls.sql`

**Checkpoint**: User Story 1 is independently testable — profile visibility and settings privacy behave correctly for owners and accepted friends.

---

## Phase 4: User Story 2 - Social And Room Data Is Shared Only With Authorized Members (Priority: P1)

**Goal**: Friendship rows are visible only to the two involved accounts, and room data is visible only to the host and current participants of the session.

**Independent Test**: Create multiple users, at least one friendship, and at least two rooms with different memberships. Confirm only the involved friendship accounts can read the friendship row, and only room hosts or participants can read the matching room snapshot.

### Tests for User Story 2 (REQUIRED coverage) ⚠️

- [x] T010 [P] [US2] Extend `supabase/tests/database/020_constraints.test.sql` with friendship lifecycle, unordered-pair uniqueness, and requester/addressee ownership assertions
- [x] T011 [P] [US2] Create `supabase/tests/database/040_friendships_rls.test.sql` to verify requester/addressee reads and denied third-party access to friendship rows
- [x] T012 [P] [US2] Create `supabase/tests/database/050_room_rls.test.sql` to verify host/participant reads and unrelated-user denial across `game_sessions`, `participants`, `matches`, `assignments`, and `gameplay_events`

### Implementation for User Story 2

- [x] T013 [P] [US2] Add requester/addressee `SELECT` and lifecycle-transition RLS policies for `friendships` in `supabase/migrations/016_friendships_rls.sql`
- [x] T014 [P] [US2] Add host/participant `SELECT` RLS policies for `game_sessions`, `participants`, `matches`, `assignments`, and `gameplay_events` in `supabase/migrations/017_room_read_rls.sql`

**Checkpoint**: User Story 2 is independently testable — friendship access stays bilateral and room reads stay scoped to the correct session members.

---

## Phase 5: User Story 3 - Protected Gameplay Writes Stay Behind Approved Actions (Priority: P2)

**Goal**: Unsafe direct room writes are blocked, while the approved privileged write path remains available for room mutations.

**Independent Test**: Attempt direct client-style inserts, updates, and deletes against protected room tables and confirm they fail, then confirm the approved service-role or validated RPC path still works for the same room mutations.

### Tests for User Story 3 (REQUIRED coverage) ⚠️

- [x] T015 [P] [US3] Add direct-write rejection assertions to `supabase/tests/database/060_privileged_write_paths.test.sql` for authenticated inserts, updates, and deletes against protected room tables
- [x] T016 [P] [US3] Add approved-path smoke checks to `supabase/tests/database/060_privileged_write_paths.test.sql` to confirm the service-role or validated RPC path still performs the intended room mutations

**Checkpoint**: User Story 3 is independently testable — direct client room writes fail, and the approved mutation path still works.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, smoke-check verification, and cleanup.

- [x] T017 [P] Run `npx supabase db reset` and `npx supabase test db` against `supabase/migrations/` and `supabase/tests/database/` to validate the full RLS and grant chain
- [x] T018 [P] Walk the schema smoke checklist in `specs/008-add-data-rls/quickstart.md` and confirm the profile, friendship, settings, and room access boundaries match the spec

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Stories (Phase 3+)**: Each depends on Foundational completion; US1 and US2 can run in parallel, and US3 can run once the room grants and base RLS posture are in place
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - no dependency on US2 or US3
- **User Story 2 (P1)**: Can start after Foundational - independent of US1, though it shares the friendship table created in Phase 2
- **User Story 3 (P2)**: Can start after Foundational - independent of US1 and US2 once the room-table grant posture is in place

### Within Each User Story

- Tests MUST be added before or alongside the implementation they validate
- Table and enum definitions come before policy files that depend on them
- Different policy files can be worked on in parallel when they do not share the same migration file
- Each story should be validated independently before moving to the next priority slice

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel
- **Phase 3**: T006 and T007 can run in parallel; T008 and T009 can run in parallel
- **Phase 4**: T010, T011, and T012 can run in parallel; T013 and T014 can run in parallel
- **Phase 5**: T015 and T016 can run in parallel
- **Phase 6**: T017 and T018 can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate profile and settings access independently before moving on

### Incremental Delivery

1. Finish Setup + Foundational so the schema and RLS posture exist
2. Deliver User Story 1 to secure profile and settings access
3. Deliver User Story 2 to secure friendship and room reads
4. Deliver User Story 3 to prove direct room writes are blocked and the approved mutation path still works
5. Run the quickstart smoke checklist and the full pgTAP suite before merge

### Parallel Team Strategy

With multiple contributors:

1. Split Setup and Foundational file creation early
2. After Phase 2, assign one contributor to US1 policies/tests, one to US2 policies/tests, and one to US3 validation
3. Validate each user story independently as soon as its tests and policies are complete

---

## Summary

| Phase                             | Story | Tasks         | Parallel Opportunities          |
| --------------------------------- | ----- | ------------- | ------------------------------- |
| 1 - Setup                         | -     | T001-T002 (2) | T001 + T002                     |
| 2 - Foundational                  | -     | T003-T005 (3) | T004                            |
| 3 - US1 Profile and Settings      | P1    | T006-T009 (4) | T006 + T007, T008 + T009        |
| 4 - US2 Friendship and Room Reads | P1    | T010-T014 (5) | T010 + T011 + T012, T013 + T014 |
| 5 - US3 Protected Writes          | P2    | T015-T016 (2) | T015 + T016                     |
| 6 - Polish                        | -     | T017-T018 (2) | T017 + T018                     |
| **Total**                         |       | **18**        |                                 |

---

## Notes

- [P] tasks can be executed in parallel when they touch different files and do not depend on incomplete work
- Each story is independently testable once its tasks are complete
- Features affecting auth or persisted data must include migration, policy, and database validation tasks
- Keep the approved room mutation path intact; this feature only hardens access boundaries around it
