# Tasks: Configure Room and Start Game

**Input**: Design documents from `specs/018-configure-start-game/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Required per the DONG Constitution Principle V (every feature must have unit tests, plus e2e tests for substantial UI changes spanning lobby to progress redirects).

**Organization**: Tasks are grouped by setup, foundation, and then strictly by user story to enable independent implementation and testing.

**Out of scope** (see spec.md "Out of Scope" and research.md R8): defining an idle/abandonment policy for `in_progress` rooms is explicitly deferred to #138/#165. No task below implements it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (editing different files, no dependencies on other incomplete tasks in the same phase)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Identifies exact file paths in and across descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration and test folder scaffolding

- [X] T001 Create database schema migration script in `supabase/migrations/035_configure_start_game_rpcs.sql` (will hold both the domain RPCs and the `public.command_idempotency` table/RPCs)
- [X] T002 Create pgTAP database verification script in `supabase/tests/database/220_configure_start_game_rpcs.test.sql`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database RPC methods, the persistent idempotency store (Constitution II — see research.md R7), and backend Java security adjustments

**⚠️ CRITICAL**: Must be completed before any User Story implementation can begin

- [X] T003 [P] Implement `public.add_room_match` and `public.remove_room_match` security definer SQL functions in `supabase/migrations/035_configure_start_game_rpcs.sql`. `add_room_match` gets a unique constraint on `(session_id, source_provider, source_match_id)`; on `unique_violation`, return the existing match id as a no-op success instead of raising (FR-014).
- [X] T004 [P] Implement `public.set_common_match` security definer SQL function in `supabase/migrations/035_configure_start_game_rpcs.sql`. Re-designating the already-current common match is a no-op success.
- [X] T005 [P] Implement `public.set_room_assignments` security definer SQL function in `supabase/migrations/035_configure_start_game_rpcs.sql`
- [X] T006 [P] Implement `public.start_game_session(p_session_id uuid, p_idempotency_key uuid) RETURNS jsonb` in `supabase/migrations/035_configure_start_game_rpcs.sql`: `SELECT ... FOR UPDATE` lock on the session row, reject with `invalid_room_state` if not `joinable`, otherwise transition to `in_progress` and emit `'session_started'` using `p_idempotency_key` in the event's `idempotency_key` value (data-model.md, research.md R7)
- [X] T007 [P] Create `public.command_idempotency` table plus `public.reserve_command_idempotency` / `public.complete_command_idempotency` / `public.release_command_idempotency` `authenticated`-only, `auth.uid()`-scoped SQL functions in `supabase/migrations/035_configure_start_game_rpcs.sql` (data-model.md, contracts/room-rpcs.md) — the dispatch-layer idempotency store backing FR-013/SC-005. Do **not** use `service_role` here; follow the `find_active_room_for` pattern (R6).
- [X] T008 [P] Create pgTAP tests covering insertion, deletion, assignment sync, transition logic, `add_room_match` dedupe-on-repeat, and `start_game_session`'s row-lock/state-guard behavior in `supabase/tests/database/220_configure_start_game_rpcs.test.sql`
- [X] T009 [P] Create pgTAP tests for `reserve_command_idempotency`/`complete_command_idempotency`/`release_command_idempotency` covering all four `reserve` outcomes (`reserved`, `replay`, `in_flight`, `conflict`) plus: after `release_command_idempotency`, a subsequent `reserve` for the same key returns `reserved` again (failed attempts are never replayed), in `supabase/tests/database/220_configure_start_game_rpcs.test.sql`
- [X] T010 [P] Add a pgTAP regression test asserting `private.find_active_room_for` still resolves a session once `state = 'in_progress'` (research.md R9) in `supabase/tests/database/220_configure_start_game_rpcs.test.sql`
- [X] T011 [P] Add the room-configuration/commencement error enum values to `command-api/src/main/java/com/dong/commandapi/error/ErrorCode.java`: `ROOM_NOT_FOUND`, `INVALID_ROOM_STATE`, `EMPTY_PARTICIPANTS`, `EMPTY_MATCHES`, `MISSING_COMMON_MATCH`, `INVALID_COMMON_MATCH`, `UNASSIGNED_PARTICIPANTS` (all 422, per contracts/start-game-api.md), plus `IDEMPOTENCY_KEY_REUSE` (409)
- [X] T012 [P] Update authentication payload record in `command-api/src/main/java/com/dong/commandapi/security/AuthenticatedHost.java` to hold onto the raw JWT token
- [X] T013 [P] Update JWT parser filter in `command-api/src/main/java/com/dong/commandapi/security/SupabaseJwtFilter.java` to set the raw JWT string into the authenticated host details
- [X] T014 Extend the `IdempotencyService` interface (`command-api/src/main/java/com/dong/commandapi/command/idempotency/IdempotencyService.java`) beyond its current single `validate(String) → UUID` method to expose reserve/replay/in-flight/conflict semantics (e.g. `reserve(UUID, String commandType, String roomId)`, `complete(UUID, CommandResult)`, `release(UUID)`) — the existing single-method contract cannot carry the outcomes T015 needs. Then implement `PersistentIdempotencyService` in `command-api/src/main/java/com/dong/commandapi/command/idempotency/PersistentIdempotencyService.java`, replacing `NoOpIdempotencyService` (research.md R7, ADR-7/#133): calls `reserve_command_idempotency`/`complete_command_idempotency`/`release_command_idempotency` under the host's forwarded JWT (T012), same as `StartGameCommandHandler` — no service-role credential. On `in_flight`, polls `reserve_command_idempotency` with a short bounded backoff until it resolves to `replay` (a completed **success**) or the reservation disappears (the original failed and was released, so this caller proceeds itself); on exhausted backoff, throws `ApiException(SERVICE_UNAVAILABLE)`. On `conflict`, throws `ApiException(IDEMPOTENCY_KEY_REUSE)`.
- [X] T015 Update `CommandDispatcher` in `command-api/src/main/java/com/dong/commandapi/command/CommandDispatcher.java` to reserve the idempotency key before invoking the resolved handler and to short-circuit with the previously stored `CommandResult` on replay (including a resolved in-flight wait) instead of re-invoking the handler. Only a **successful** handler completion is persisted via `complete_command_idempotency` (`CommandResult` has no failure variant — validation failures throw `ApiException` instead). On a handler exception, call `release_command_idempotency` to delete the reservation and rethrow, so a failed attempt is never replayed and a subsequent same-key retry re-runs validation from scratch
- [X] T016 Update `IdempotencyStubGuardTest` in `command-api/src/test/java/com/dong/commandapi/command/idempotency/IdempotencyStubGuardTest.java` to assert `PersistentIdempotencyService` (not `NoOpIdempotencyService`) is wired once a state-mutating handler exists, and add dispatcher-level coverage for replay short-circuiting, in-flight-resolves-to-success, failed-attempt-releases-and-is-retryable, and cross-command key-reuse conflict

**Checkpoint**: Foundation ready - local database reset verifies migrations, pgTAP tests pass cleanly, `IdempotencyStubGuardTest` passes against the persistent store

---

## Phase 3: User Story 1 - Host selects remote matches in the lobby (Priority: P1) 🎯 MVP

**Goal**: Allow the room host to fetch soccer catalog fixtures and add/remove matches in the room configuration lobby

**Independent Test**: Host opens match selection modal, adds matches, and they instantly show on the participants' rosters (via regular snapshot polls)

### Implementation for User Story 1

- [X] T017 [P] [US1] Define client schemas and type definitions for configuring room matches in `types/room.ts`
- [X] T018 [P] [US1] Add `addRoomMatch` and `removeRoomMatch` transport network handlers to `utils/supabaseClient.ts`
- [X] T019 [US1] Implement custom configuration hook `hooks/useRoomConfigure.ts` to manage match list selections and removals
- [X] T020 [US1] Create match picker browser UI component `components/lobby/ConfigureMatchesModal.tsx` with filtering by leagues and dates
- [X] T021 [US1] Integrate `ConfigureMatchesModal` trigger and selected matches list layout under `app/lobby/[sessionId].tsx` for host role
- [X] T022 [P] [US1] Create Jest unit tests modeling hook selections in `__tests__/hooks/useRoomConfigure.test.ts`
- [X] T023 [P] [US1] Create platform component Jest tests in `__tests__/components/lobby/ConfigureMatchesModal.platform.test.tsx`

**Checkpoint**: User Story 1 functional — host can select / remove matches and they are persistent in Postgres

---

## Phase 4: User Story 2 - Host selects a Common Match (Priority: P1)

**Goal**: Enable host to highlight exactly one match as the central Common Match

**Independent Test**: Host nominates a match, and everyone in the room lobby sees the Common Match crown highlight on their screens

### Implementation for User Story 2

- [X] T024 [P] [US2] Add `setCommonMatch` transport network handler to `utils/supabaseClient.ts`
- [X] T025 [US2] Add set-common-match command integration within `hooks/useRoomConfigure.ts`
- [X] T026 [US2] Create Common Match nomination toggle and indicator display elements inside `components/lobby/ConfigureMatchesModal.tsx`
- [X] T027 [P] [US2] Write Jest unit tests verifying common match selection logic in `__tests__/hooks/useRoomConfigure.test.ts`

**Checkpoint**: User Story 2 functional — a single selected match can be designated as the Common Match and synchronized globally

---

## Phase 5: User Story 3 - Host assigns additional matches and starts the game with validation (Priority: P1)

**Goal**: Host assigns matches to players, executes start command, gets validated by Java proxy, and transitions room

**Independent Test**: Clicking "Start Game" with incomplete assignments throws precise messages. Correct setups trigger in-progress status transitions. Submitting the same start request twice (same `Idempotency-Key`) transitions the room exactly once and returns an equivalent response both times.

### Implementation for User Story 3

- [X] T028 [P] [US3] Add `setRoomAssignments` transport network handler to `utils/supabaseClient.ts`
- [X] T029 [P] [US3] Create `SupabaseRestClient.java` inside package `com.dong.commandapi.supabase` to invoke Supabase REST and RPC functions with host authorization (built during Phase 2, since `PersistentIdempotencyService`/T014 needed the same authenticated-RPC capability ahead of schedule)
- [X] T030 [P] [US3] Create `StartGameCommandHandler.java` in package `com.dong.commandapi.command` registering command type `"start-game"`
- [X] T031 [US3] Implement cross-aggregate validation check algorithm in `StartGameCommandHandler.java` verifying state, matches, common match, and participant assignments
- [X] T032 [US3] Wire transactional Supabase starting RPC trigger inside `StartGameCommandHandler.java` on successful configuration verification, passing the request's validated `Idempotency-Key` UUID through to `public.start_game_session(p_session_id, p_idempotency_key)`
- [X] T033 [P] [US3] Add start-game API mock transport client command dispatch trigger to `utils/commandApiClient.ts`, generating a fresh UUID v4 `Idempotency-Key` per logical start attempt (reused only when the client itself retries the same attempt, e.g. after a timeout)
- [X] T034 [US3] Add automated random assignments generator and starting triggers to `hooks/useRoomConfigure.ts`
- [X] T035 [US3] Integrate "Start Game" button, assignment editor layout, and error toasts inside `app/lobby/[sessionId].tsx`
- [X] T036 [P] [US3] Write Java unit tests for validations inside `command-api/src/test/java/com/dong/commandapi/command/StartGameCommandHandlerTest.java`
- [X] T037 [P] [US3] Write Java MockMvc controller endpoint integration tests in `command-api/src/test/java/com/dong/commandapi/command/StartGameCommandControllerTest.java`, including: double-submitting the same `Idempotency-Key` returns an identical response without a second state transition, and reusing a key against a different `roomId` returns `409 IDEMPOTENCY_KEY_REUSE`
- [X] T038 [P] [US3] Update Jest unit tests to cover assignments synchronization and start dispatch in `__tests__/hooks/useRoomConfigure.test.ts`

**Checkpoint**: User Story 3 functional — Java correctly intercepts starting and blocks on validation failures; correct rooms transition to `in_progress` in the database exactly once per logical start attempt

---

## Phase 6: User Story 4 - Connected devices receive the starting game state automatically (Priority: P1)

**Goal**: Participant devices automatically sync, hydrate match progress values, and redirect onto the active gameplay dashboard

**Independent Test**: Host starts the game; registered members and anonymous guests instantly navigate to the active `/gameProgress` dash without manual action

### Implementation for User Story 4

- [X] T039 [US4] Update lobby poll hook `hooks/useRoomLobby.ts` to detect snapshot state transition to `'in_progress'`
- [X] T040 [US4] Add automatic router redirect in `app/lobby/[sessionId].tsx` taking users forward on state transition
- [X] T041 [US4] Hydrate active players, selected matches, designated common match, and player assignments into the global Zustand store in `app/lobby/[sessionId].tsx` before navigation
- [X] T042 [P] [US4] Verify transition and automatic navigation inside `__tests__/hooks/useRoomLobby.test.ts`

**Checkpoint**: User Story 4 functional — clients automatically sync and redirect to active gameplay dashboard on game start

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Code cleanup, schema validation, and complete E2E BDD verification.

- [X] T043 [P] Refactor and clean up unused properties inside `hooks/useRoomConfigure.ts` and `app/lobby/[sessionId].tsx`
- [ ] T044 Execute local database audit via `npm run db:reset` to verify migrations integrity (**not run** — no Docker/local Supabase stack available in this environment; migration reviewed manually, run before merging)
- [ ] T045 Run the complete pgTAP suite via `npm run db:test` to verify database integrations (**not run** — same Docker constraint as T044; run before merging)
- [X] T046 [P] Run JUnit backend verification via `mvnw clean verify` in `command-api`
- [X] T047 Run frontend tests via `npm test` and verify code structure via `npm run lint`
- [X] T048 Create a Playwright BDD integration test file `e2e/features/configure-start-game.feature` covering the full setup to progress transition
- [X] T049 Implement Playwright step definitions in `e2e/steps/configure-start-game.steps.ts` and verify E2E suite passes with `npm run test:e2e`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories. Includes the persistent idempotency store (T007, T014-T016), which must land before `StartGameCommandHandler` (US3) is wired, per `IdempotencyStubGuardTest`'s guard.
- **User Stories (Phases 3-6)**: All depend on Foundational phase completion. User stories can proceed sequentially (US1 → US2 → US3 → US4).
- **Polish (Final Phase)**: Depends on all desired user stories being complete.

### Within Each User Story

- Supabase migrations and SQL functions before frontend hooks or transport layer additions.
- Hooks and transport triggers before UI modules, selectors, or layouts.
- Core UI layouts before validation toasts or final visual touchups.
- Story complete and covered by Jest unit tests before proceeding to the next priority.

---

## Parallel Execution Examples

### User Story 1 - Match Selection
- **Role A**: Implement `addRoomMatch` / `removeRoomMatch` transport network handlers in `utils/supabaseClient.ts` (T017, T018).
- **Role B**: Scaffolding UI designs and filters inside `components/lobby/ConfigureMatchesModal.tsx` (T020).

### User Story 3 - Room Commencement
- **Role A**: Develop Java snapshot client and command handlers / validators in `command-api` (T029, T030, T031, T032, T036, T037).
- **Role B**: Author randomizer algorithms, assignments hooks, and trigger selectors in client-side code (T028, T033, T034, T035, T038).
