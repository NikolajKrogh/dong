# Tasks: Cloud Gameplay Core Data Model

**Input**: Design documents from `specs/007-core-supabase-schema/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/shared-session-write-contract.md ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Supabase Workspace Scaffolding)

**Purpose**: Initialize the first Supabase CLI workspace in the repo so migration and test tooling is available for all user story phases.

- [x] T001 Run `npx supabase init --yes` at repo root to create `supabase/config.toml` and the local CLI workspace
- [x] T002 [P] Add `.supabase/`, `supabase/.env.local`, and `*.env.local` patterns to `.gitignore`
- [x] T003 [P] Add `db:start`, `db:stop`, `db:reset`, `db:test`, `db:new-migration`, and `db:status` scripts that delegate to `npx supabase` in `package.json`
- [x] T004 [P] Update `README.md` with prerequisites (Docker, Supabase CLI), `npm run db:start`, `npm run db:reset`, and `npm run db:test` quickstart steps referencing `specs/007-core-supabase-schema/quickstart.md`
- [x] T005 Confirm the target Supabase project is reachable through the hosted MCP server or, for local development, verify `npm run db:start` and `npm run db:status` return valid local service details

**Checkpoint**: Supabase CLI workspace exists, local stack starts cleanly, and the dev team can reach the local DB before any migration work begins.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish migration conventions, shared enum types, the `accounts` table, and the pgTAP test harness before any user story migration can land.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Create the first migration files under `supabase/migrations/` and define the foundational enum types `session_state` (`joinable`, `in_progress`, `completed`) and `participant_membership_type` (`registered`, `guest`)
- [x] T007 Add `public.accounts` table (`id uuid PRIMARY KEY REFERENCES auth.users(id)`, `preferred_display_name text`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`) in `supabase/migrations/`
- [x] T008 Create `supabase/tests/database/000_extensions.test.sql` that installs `pgtap`, wraps in `BEGIN/ROLLBACK`, and defines the harness smoke check for the current local database test environment
- [x] T009 [P] Create `supabase/tests/database/010_schema.test.sql` as a `BEGIN/ROLLBACK` pgTAP file with foundational schema assertions that can accumulate more table-shape checks across later phases
- [x] T010 [P] Create `supabase/tests/database/020_constraints.test.sql` as a `BEGIN/ROLLBACK` pgTAP file with foundational constraint assertions that can accumulate more checks across later phases
- [x] T011 Reset and verify the foundation: `npm run db:reset` applies migrations cleanly and `npm run db:test` passes the foundational pgTAP harness

**Checkpoint**: Foundation is ready — `accounts` table exists, pgTAP harness runs, and user story migrations can proceed.

---

## Phase 3: User Story 1 — Host Starts A Shared Session (P1) 🎯 MVP

**Goal**: An authenticated host can create a cloud-backed session with a unique active join code, durable host ownership, lifecycle state, and common-match metadata that survives a reload.

**Independent Test**: Create a host-owned session in the DB under an impersonated Auth user, reload it, and confirm host identity, join code, state, and lifecycle constraints are all intact.

### Implementation for User Story 1

- [x] T012 [US1] Add `game_sessions` table (`id uuid PK`, `host_account_id uuid FK→accounts.id NOT NULL`, `join_code text NOT NULL`, `state session_state NOT NULL DEFAULT 'joinable'`, `common_match_id uuid NULL`, `last_event_sequence bigint NOT NULL DEFAULT 0`, `created_at`, `started_at`, `completed_at`) to `supabase/migrations/`
- [x] T013 [P] [US1] Add partial unique index `UNIQUE (join_code) WHERE state != 'completed'` and check constraint `CHECK (completed_at IS NULL OR state = 'completed')` on `game_sessions` in `supabase/migrations/`
- [x] T014 [P] [US1] Add performance indexes `idx_game_sessions_host_account_id` and `idx_game_sessions_state`, with the active join-code partial unique index serving the join-code lookup path on `game_sessions`

### Tests for User Story 1

- [x] T015 [US1] Extend `supabase/tests/database/010_schema.test.sql` to assert `game_sessions` table exists with all required columns, correct types, and not-null constraints
- [x] T016 [US1] Extend `supabase/tests/database/020_constraints.test.sql` to assert active join code partial uniqueness and the `completed_at` lifecycle check constraint
- [x] T017 [US1] Write `supabase/tests/database/030_authenticated_host.test.sql` to seed an authenticated host context through `auth.users` and `public.accounts`, then verify host session creation, host identity preserved on reload, join code uniqueness rejects a second active session with the same code, and the session state begins as `joinable`

**Checkpoint**: User Story 1 is independently testable — host sessions are created and verified in the DB without any UI.

---

## Phase 4: User Story 2 — Session Setup Persists Across Devices (P1)

**Goal**: The host can persist participants (registered and guest), matches, a common match designation, and per-participant assignments for a session. Registered participants resolve by account identity; guests reclaim the same row via their rejoin token.

**Independent Test**: Save a session with one registered participant, one guest participant, two matches, a common match, and assignments. Reload and confirm all relationships are intact. Reconnect the guest with the same rejoin token hash and verify no duplicate participant row is created.

### Implementation for User Story 2

- [x] T018 [US2] Add `participants` table (`id uuid PK`, `session_id uuid FK→game_sessions.id NOT NULL`, `account_id uuid NULL FK→accounts.id`, `display_name text NOT NULL`, `membership_type participant_membership_type NOT NULL`, `current_drink_total numeric(6,1) NOT NULL DEFAULT 0 CHECK (>=0)`, `guest_rejoin_token_hash text NULL`, `created_at`) to `supabase/migrations/`
- [x] T019 [P] [US2] Add partial unique index `UNIQUE (session_id, account_id) WHERE account_id IS NOT NULL`, unique index `UNIQUE (session_id, guest_rejoin_token_hash) WHERE guest_rejoin_token_hash IS NOT NULL`, and check constraints enforcing registered/guest invariants (`registered` requires `account_id IS NOT NULL AND guest_rejoin_token_hash IS NULL`; `guest` requires `account_id IS NULL AND guest_rejoin_token_hash IS NOT NULL`) on `participants` in `supabase/migrations/`
- [x] T020 [US2] Add `matches` table (`id uuid PK`, `session_id uuid FK→game_sessions.id NOT NULL`, `source_provider text NOT NULL`, `source_match_id text NULL`, `home_team_name text NOT NULL`, `away_team_name text NOT NULL`, `kickoff_at timestamptz NULL`, `home_score int NOT NULL DEFAULT 0 CHECK (>=0)`, `away_score int NOT NULL DEFAULT 0 CHECK (>=0)`, `created_at`) to `supabase/migrations/`
- [x] T021 [P] [US2] Add conditional unique index `UNIQUE (session_id, source_provider, source_match_id) WHERE source_match_id IS NOT NULL` on `matches` in `supabase/migrations/`
- [x] T022 [US2] Add the same-session `common_match_id uuid NULL` FK from `game_sessions` to `matches` via a composite foreign key after `matches` is defined in `supabase/migrations/`
- [x] T023 [US2] Add `assignments` table with composite PK `(session_id, participant_id, match_id)`, composite FK `(session_id, participant_id)` referencing `participants(session_id, id)`, and composite FK `(session_id, match_id)` referencing `matches(session_id, id)`, plus `created_at` in `supabase/migrations/`
- [x] T024 [P] [US2] Add performance indexes `idx_participants_session_id`, `idx_participants_account_id`, `idx_matches_session_id`, `idx_assignments_session_id`, `idx_assignments_participant_id`, and `idx_assignments_match_id`, with the unique guest-token index serving session reclaim lookups

### Tests for User Story 2

- [x] T025 [US2] Extend `supabase/tests/database/010_schema.test.sql` to assert `participants`, `matches`, and `assignments` table shapes with all required columns, types, and not-null constraints
- [x] T026 [US2] Extend `supabase/tests/database/020_constraints.test.sql` to assert: registered-participant uniqueness rejects duplicate `(session_id, account_id)`, guest-token uniqueness rejects duplicate hash in same session, membership type check constraints reject invalid combinations, score check constraints reject negative values, and cross-session assignment is rejected by the composite FK
- [x] T027 [US2] Write `supabase/tests/database/040_guest_reclaim.test.sql` to verify: guest participant created with token hash, second guest join with same token hash is rejected by unique constraint, reclaim lookup by `(session_id, guest_rejoin_token_hash)` resolves to the original participant row, and no duplicate row exists after reclaim

**Checkpoint**: User Story 2 is independently testable — participants, matches, assignments, and guest reclaim all work correctly at the DB layer.

---

## Phase 5: User Story 3 — Gameplay History Remains Auditable (P2)

**Goal**: History-affecting commands produce immutable events ordered per session. Each command carries an idempotency key that deduplicates retries. Completed sessions reject any new history-affecting writes.

**Independent Test**: Append events with sequence numbers, verify replay order is stable. Retry the same idempotency key and confirm no second event row. Mark a session completed and confirm further event inserts are rejected.

### Implementation for User Story 3

- [x] T028 [US3] Add `gameplay_events` table (`id uuid PK`, `session_id uuid FK→game_sessions.id NOT NULL`, `sequence_number bigint NOT NULL`, `actor_participant_id uuid NOT NULL`, `event_type text NOT NULL` with known-value check, `idempotency_key text NOT NULL`, `payload jsonb NOT NULL`, `created_at timestamptz DEFAULT now()`) to the migration chain
- [x] T029 [P] [US3] Add unique constraints `UNIQUE (session_id, sequence_number)` and `UNIQUE (session_id, idempotency_key)` on `gameplay_events` in `supabase/migrations/`
- [x] T030 [P] [US3] Add composite FK `(session_id, actor_participant_id)` referencing `participants(session_id, id)` and performance indexes `idx_gameplay_events_session_sequence` on `(session_id, sequence_number)` and `idx_gameplay_events_actor` on `actor_participant_id` in `supabase/migrations/`
- [x] T031 [US3] Create `allocate_event_sequence(p_session_id uuid)` SQL function that atomically increments `game_sessions.last_event_sequence` and returns the new value in `supabase/migrations/`
- [x] T032 [US3] Create a `before insert` trigger on `gameplay_events` (or equivalent check in the write path helper) that raises an exception when `game_sessions.state = 'completed'` for the target session in `supabase/migrations/`

### Tests for User Story 3

- [x] T033 [US3] Extend `supabase/tests/database/010_schema.test.sql` to assert `gameplay_events` table shape with all required columns, types, and not-null constraints
- [x] T034 [US3] Extend `supabase/tests/database/020_constraints.test.sql` to assert `(session_id, sequence_number)` uniqueness and `(session_id, idempotency_key)` uniqueness both reject duplicate inserts
- [x] T035 [US3] Write `supabase/tests/database/050_idempotency_and_completion.test.sql` to verify: `allocate_event_sequence` increments monotonically per session, same `(session_id, idempotency_key)` pair rejects a second insert, event rows ordered by `sequence_number` reproduce the original event sequence, and inserting a new event against a `completed` session raises an exception

**Checkpoint**: User Story 3 is independently testable — events append immutably, sequence order is stable, idempotency prevents duplicates, and completion blocks further writes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Repo hygiene, full-suite verification, and smoke checklist sign-off.

- [x] T036 [P] Run `npm run db:reset && npm run db:test` and confirm all pgTAP test assertions pass with zero failures
- [x] T037 [P] Run `npm run lint` to verify no TypeScript, JSON, or markdown config changes introduced lint failures
- [x] T038 [P] Walk through the smoke checklist in `specs/007-core-supabase-schema/quickstart.md` and confirm each item is satisfied by the implemented schema and tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — no dependency on US2 or US3
- **US2 (Phase 4)**: Depends on Phase 2; T022 depends on US1's `game_sessions` table — best started after Phase 3
- **US3 (Phase 5)**: Depends on Phase 2 and US2 (`participants` table required for actor FK) — start after Phase 4
- **Polish (Phase 6)**: Depends on all implementation phases being complete

### User Story Dependencies

- **US1 (P1)**: Can start immediately after Foundational
- **US2 (P1)**: Requires `game_sessions` to exist (US1 T012) for `participants` and `matches` FKs and the deferred `common_match_id` FK in T022
- **US3 (P2)**: Requires `participants` to exist (US2 T018) for the `gameplay_events` actor composite FK

### Within Each User Story

- Table migration → indexes + constraints (T012 → T013, T014)
- Table exists → schema test extension can run in parallel with constraint test extension
- All migrations applied and tests extended → write the story-specific DB test file last

### Parallel Opportunities

**Phase 1** — after T001, run T002 + T003 + T004 in parallel, then T005

**Phase 2** — after T006 + T007 migrations, run T008 + T009 + T010 in parallel, then T011

**Phase 3** — after T012: run T013 + T014 in parallel; run T015 + T016 in parallel; then T017

**Phase 4** — after T018: run T019, T020, T021 in parallel; T022 depends on T020 (matches); T023 depends on T018 + T020; after T022 + T023: run T024 + T025 + T026 in parallel; then T027

**Phase 5** — after T028: run T029 + T030 in parallel; T031 + T032 in parallel; after T028–T032: run T033 + T034 in parallel; then T035

### Suggested MVP Scope

Phase 1 + Phase 2 + Phase 3 (US1) delivers a verifiable authenticated host session foundation that unblocks all follow-up stories.

---

## Summary

| Phase                 | Story | Tasks          | Parallel Opportunities           |
| --------------------- | ----- | -------------- | -------------------------------- |
| 1 — Setup             | —     | T001–T005 (5)  | T002, T003, T004                 |
| 2 — Foundational      | —     | T006–T011 (6)  | T008, T009, T010                 |
| 3 — US1 Host Session  | P1    | T012–T017 (6)  | T013+T014, T015+T016             |
| 4 — US2 Session Setup | P1    | T018–T027 (10) | T019, T020, T021; T024+T025+T026 |
| 5 — US3 Audit History | P2    | T028–T035 (8)  | T029+T030, T031+T032; T033+T034  |
| 6 — Polish            | —     | T036–T038 (3)  | T036, T037, T038                 |
| **Total**             |       | **38**         |                                  |
