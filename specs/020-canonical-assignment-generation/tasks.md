# Tasks: Canonical Player Assignments on Game Start

**Input**: Design documents from `specs/020-canonical-assignment-generation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Scope**: this task list covers only the **#135 row** of the spec's Delivery
Slices table — User Stories 1, 2, 4, and 8. US3, US5, US6, US7 belong to
#184/#185/#186 and are out of scope here.

**Tests**: included. Constitution §V requires unit tests for every new feature
behaviour and this feature changes a persisted state transition and a shared RPC
boundary, so tests are not optional here. For this feature pgTAP is the
generator's unit-test level (research.md R8) — the plpgsql code has no other
place to be unit-tested.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no unresolved dependency)
- **[Story]**: which user story this task serves (US1, US2, US4, US8)
- File paths are exact and relative to the repo root

---

## Phase 1: Setup

**Purpose**: nothing to scaffold — this feature extends existing subsystems
(`supabase/migrations/`, `command-api/`, the client) rather than creating a new
one. No setup phase is needed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema and the shared feasibility computation every story reads.
**⚠️ CRITICAL**: no user story task can start until this phase is complete.

- [x] T001 Create migration `supabase/migrations/036_canonical_assignment_generation.sql`; add `matches_per_player int NOT NULL DEFAULT 1 CHECK (matches_per_player >= 0)` and `shared_matches_per_pair int NOT NULL DEFAULT 0 CHECK (shared_matches_per_pair >= 0)` to `public.game_sessions` (data-model.md schema changes; research.md R4)
- [x] T002 In the same migration file, add `private.compute_room_assignment_plan(p_session_id uuid) RETURNS jsonb` (`STABLE`, `SECURITY DEFINER`, `SET search_path = ''`) computing `participantCount`, `poolSize`, `matchesPerPlayer`, `sharedMatchesPerPair`, `effectivePerPlayer = GREATEST(matchesPerPlayer, sharedMatchesPerPair * (participantCount - 1))`, `requiredPoolSize`, `relaxedFloor = 1 + effectivePerPlayer`, `feasible`, `startable`, per contracts/room-rpcs.md §2 and the formula in data-model.md
- [x] T003 In the same migration file, `REVOKE ALL … FROM PUBLIC, anon, authenticated` and `GRANT EXECUTE … TO service_role` on `private.compute_room_assignment_plan`, matching the repo's private-function convention (no public wrapper needed — it is called from other RPCs, not directly by clients)
- [x] T004 In the same migration file, modify `private.build_guest_room_snapshot` (originally `supabase/migrations/026_guest_room_join.sql`) to add an `'assignmentPlan', private.compute_room_assignment_plan(game_sessions.id)` key to its returned `jsonb_build_object`, additive only — no existing key removed or reordered (contracts/room-rpcs.md §3)
- [x] T005 [P] Add `AssignmentPlan` type and extend `RoomSnapshot` in `types/room.ts` with `assignmentPlan: AssignmentPlan`, mirroring the new snapshot key from T004

**Checkpoint**: schema exists, every snapshot carries a feasibility read, client types compile. User story work can begin.

---

## Phase 3: User Story 1 — Everyone gets the same assignments when the game starts (Priority: P1) 🎯 MVP

**Goal**: `start_game_session` settles one canonical assignment set server-side, atomically with the state transition, using the roster locked at start.

**Independent Test**: start a room with 2+ participants on separate devices with a sufficient pool; every device's assignment list must be identical and must match the stored set.

### Tests for User Story 1

- [x] T006 [P] [US1] pgTAP: seed a 4-participant room (1 host + 3 members) at defaults (`K=0, N=1`), start it, assert every participant holds the Common Match plus exactly 1 additional match and no two participants share it, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T007 [P] [US1] pgTAP: same room with `shared_matches_per_pair = 1` and a pool of 7 matches (per data-model.md's worked P=4/K=1/N=3 row), start it, assert every pair shares exactly 1 additional match plus the Common Match, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T008 [P] [US1] pgTAP: solo room (1 participant) and two-participant room both start successfully at `K=1`; assert the solo participant gets the Common Match + N with no pairing requirement, and the pair shares exactly K, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T009 [P] [US1] pgTAP: assert generation uses the active roster (`left_at IS NULL`) as counted at the moment `start_game_session` runs — seed a participant who left before the call and assert they receive no assignment, and every currently-active participant does. A genuine concurrent-join race cannot be expressed in this repo's pgTAP harness (single transaction, `SET LOCAL ROLE`, no second connection) — that guarantee is instead covered structurally by T047/T048, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T010 [P] [US1] pgTAP: assert `assignment_replaced` and `session_started` gameplay events are recorded with correct payloads (settled set; `relaxedConstraints: false`) after a successful start, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T011 [P] [US1] pgTAP: assert generation is non-deterministic — run generation twice over the same roster/pool/settings (two separate rooms with identical inputs) and assert the two resulting sets differ at least once across a handful of repetitions (SC-011), in `supabase/tests/database/230_canonical_assignment_generation.test.sql`

### Implementation for User Story 1

- [x] T012 [US1] In `supabase/migrations/036_canonical_assignment_generation.sql`, replace `private.start_game_session` and `public.start_game_session` with their **full three-argument signatures** in one step: `DROP FUNCTION IF EXISTS private.start_game_session(uuid, uuid);` and `DROP FUNCTION IF EXISTS public.start_game_session(uuid, uuid);` first — migration 035's two-arg versions are otherwise left in place as a second overload, since `CREATE OR REPLACE` does not replace a function of a different arity, and an ambiguous or stale-body call would result. Then `CREATE` `private.start_game_session(p_session_id uuid, p_idempotency_key uuid, p_relax_constraints boolean DEFAULT false)`: after the existing guards, remove the `unassigned_participants` check (FR-019), call `private.compute_room_assignment_plan`, and branch into generation per contracts/room-rpcs.md §4 steps 4-10 in full — both the constrained path (deal K shared matches per pair via `ORDER BY random()`, deal `N − K(P−1)` private matches per participant, assign the Common Match to all) **and** the two rejection branches and the relaxed-generation branch (US2's scope, implemented here rather than split across tasks so the function body is written once) — then insert `assignment_replaced`, transition state, insert `session_started`. Re-create `public.start_game_session(session_id uuid, idempotency_key uuid, relax_constraints boolean DEFAULT false)` as a thin wrapper. Apply fresh `REVOKE ALL … FROM PUBLIC, anon, authenticated` and `GRANT EXECUTE …` to both new-signature functions — grants do not carry across a signature change. Depends on T001, T002
- [ ] T013 *(removed — folded into T012 to avoid splitting one `CREATE OR REPLACE` across two tasks/stories; see advisor note in Phase 2 revision history)*
- [x] T014 [US1] Remove `StartGameCommandHandler.validate()` and its `get_room_snapshot` call in `command-api/src/main/java/com/dong/commandapi/command/StartGameCommandHandler.java`; the RPC now performs all five original checks as the sole authority (research.md R1) — depends on T012
- [x] T015 [US1] Update `StartGameCommandHandlerTest` in `command-api/src/test/java/com/dong/commandapi/command/StartGameCommandHandlerTest.java` to remove assertions on the deleted `validate()` path and assert the handler now only dispatches to `start_game_session` and maps its errors — depends on T014
- [x] T016 [US1] Update `hooks/useRoomConfigure.ts`: delete `randomizeAssignments` and its `shuffled` helper (client-side generation is superseded by FR-001/FR-050) — depends on nothing in this phase, can run parallel to T012-T015
- [x] T017 [US1] [P] Update `app/lobby/[sessionId].tsx`: remove the "Randomize Assignments" control (`testID="lobby-randomize-assignments"`) and its handler wiring to the now-deleted `randomizeAssignments`
- [x] T018 [US1] [P] Update `__tests__/hooks/useRoomConfigure.test.ts` to remove tests for the deleted `randomizeAssignments`

**Checkpoint**: a room with a sufficient pool starts with one canonical, server-generated assignment set, visible identically on every device.

---

## Phase 4: User Story 2 — A room short on matches warns rather than blocks (Priority: P1)

**Goal**: an under-filled pool produces a host-facing warning with an explicit override, never a silent start or a bare rejection; a genuinely impossible pool is still rejected outright.

**Independent Test**: configure a room short of matches, attempt to start, confirm the warning names the shortfall and offers the override, confirm the room is untouched if declined, confirm the override produces a complete set.

### Tests for User Story 2

- [x] T019 [P] [US2] pgTAP: a room whose pool is smaller than `requiredPoolSize` but at least `relaxedFloor` — start without `relax_constraints` raises `assignment_constraints_unsatisfiable`, and the room remains `joinable` with zero assignments afterward, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T020 [P] [US2] pgTAP: the same room started with `relax_constraints := true` succeeds, every participant holds the Common Match plus exactly the effective per-player count, overlap between participants is unconstrained, and `session_started`'s payload has `relaxedConstraints: true`, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T021 [P] [US2] pgTAP: a room whose pool is smaller than `relaxedFloor` (`1 + effectivePerPlayer`) is rejected with `insufficient_match_pool` both with and without `relax_constraints := true` — no override possible, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T022 [P] [US2] pgTAP: a room failing any pre-existing guard (no participants, no matches, no Common Match, Common Match not in pool, room not `joinable`) is rejected with its existing error and no `assignment_constraints_unsatisfiable`/`insufficient_match_pool` override is offered, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T023 [P] [US2] MockMvc: `StartGameCommandHandlerTest` — a request with `relaxConstraints: true` forwards `relax_constraints := true` to the RPC call; the new error strings map to `INSUFFICIENT_MATCH_POOL` and `ASSIGNMENT_CONSTRAINTS_UNSATISFIABLE`; `unassigned_participants` mapping is removed, in `command-api/src/test/java/com/dong/commandapi/command/StartGameCommandHandlerTest.java`

### Implementation for User Story 2

- [ ] T024 *(removed — the rejection branches and relaxed-generation branch are implemented as part of T012's single `start_game_session` rewrite, to avoid splitting one `CREATE OR REPLACE` across stories; this phase's tests (T019-T022) validate that code)*
- [ ] T025 *(removed — folded into T012; see T024)*
- [ ] T026 *(removed — folded into T012; see T024)*
- [x] T027 [US2] Add `INSUFFICIENT_MATCH_POOL`, `ASSIGNMENT_CONSTRAINTS_UNSATISFIABLE` to `command-api/src/main/java/com/dong/commandapi/error/ErrorCode.java`; remove `UNASSIGNED_PARTICIPANTS` (retired per FR-019/contracts) — depends on nothing, can run parallel to T012
- [x] T028 [US2] Update `StartGameCommandHandler.mapSupabaseError` to map `insufficient_match_pool` → `INSUFFICIENT_MATCH_POOL`, `assignment_constraints_unsatisfiable` → `ASSIGNMENT_CONSTRAINTS_UNSATISFIABLE`, drop the `unassigned_participants` case, and add a `relaxConstraints` field read from the command payload forwarded as `relax_constraints` on the RPC call — depends on T014, T027
- [x] T029 [US2] **No DTO change needed**: `CommandRequest(Map<String, Object> payload)` / `CommandContext.payload()` already accept an arbitrary JSON body — verified by reading `CommandController.java` and `CommandRequest.java`. `StartGameCommandHandler.readRelaxConstraints(Map)` reads `"relaxConstraints"` from that existing generic map with a null/non-boolean-safe default of `false`, per contracts/start-game-api.md — depends on nothing, parallel to T027
- [x] T030 [US2] [P] In `hooks/useRoomConfigure.ts`, extend `startGame` to accept a `relaxConstraints` argument and pass it through to `getStartGameApiClient().startGame(...)`
- [x] T031 [US2] [P] In `app/lobby/[sessionId].tsx`, add the shortfall warning UI: read `snapshot.assignmentPlan.feasible`/`startable`/`requiredPoolSize` and, when infeasible, present the required count and an explicit "start anyway" choice that calls `startGame(true)` (FR-013, FR-033)
- [x] T032 [US2] [P] Update `__tests__/hooks/useRoomConfigure.test.ts` and the lobby component test to cover the `relaxConstraints` passthrough and the warning display

**Checkpoint**: an under-filled room warns with an actionable number and an override; a truly impossible room is rejected outright; both leave the room untouched until the host acts.

---

## Phase 5: User Story 4 — The host tunes how many matches and how much overlap (Priority: P2)

**Goal**: the host can raise the per-player count and the shared-per-pair count; the stored per-player count can never be set below what the overlap setting requires for the current roster, and a stale value is re-floored at start rather than rejected.

**Independent Test**: change both settings on the host device, confirm a second device sees them, reload, confirm persistence, start and verify the resulting set matches both numbers exactly.

### Tests for User Story 4

- [x] T033 [P] [US4] pgTAP: host sets `matches_per_player` and `shared_matches_per_pair`; assert both persist and are visible via `get_room_snapshot` to a non-host participant, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T034 [P] [US4] pgTAP: non-host caller of `set_room_assignment_settings` is rejected with `not_host`; call against a non-`joinable` room is rejected with `room_not_joinable`, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T035 [P] [US4] pgTAP: setting `matches_per_player` below `shared_matches_per_pair * (P - 1)` for the room's current active roster is rejected with `per_player_count_below_minimum`; negative values rejected with `invalid_assignment_settings`, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T036 [P] [US4] pgTAP: a room whose stored `matches_per_player` was valid when set, then two more participants join raising the minimum above it — start still succeeds using the re-floored `effectivePerPlayer`, not the stale stored value, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T037 [P] [US4] pgTAP: writing the currently-stored values again is a no-op success and does not emit a gameplay event, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`

### Implementation for User Story 4

- [x] T038 [US4] In `supabase/migrations/036_canonical_assignment_generation.sql`, add `private.set_room_assignment_settings(p_session_id uuid, p_matches_per_player int, p_shared_matches_per_pair int) RETURNS void` with the guards from contracts/room-rpcs.md §1 (not_authenticated, room_not_found, not_host, room_not_joinable, invalid_assignment_settings, per_player_count_below_minimum) — depends on T001
- [x] T039 [US4] In the same migration, add the `public.set_room_assignment_settings(session_id, matches_per_player, shared_matches_per_pair)` wrapper following the repo's `private`/`public` RPC pairing convention (`REVOKE ALL … GRANT EXECUTE TO service_role` on private, `GRANT EXECUTE TO authenticated` on public) — depends on T038
- [x] T040 [US4] [P] Add `setAssignmentSettings(matchesPerPlayer, sharedMatchesPerPair)` to `hooks/useRoomConfigure.ts` calling the new RPC via `getRoomRpcClient()`
- [x] T041 [US4] [P] Add `setRoomAssignmentSettings` to the room RPC client wrapper (wherever `getRoomRpcClient()` is defined, alongside `setRoomAssignments`/`setCommonMatch`) and the corresponding types in `types/room.ts`
- [x] T042 [US4] [P] In `app/lobby/[sessionId].tsx`, add host-only controls for `matchesPerPlayer` and `sharedMatchesPerPair`, and display both to every participant, wired to `setAssignmentSettings`
- [x] T043 [US4] [P] Update `__tests__/hooks/useRoomConfigure.test.ts` and the lobby component test for the new settings controls

**Checkpoint**: the host can tune both settings within the FR-009 floor; a stale setting never blocks a start.

---

## Phase 6: User Story 8 — A retried start does not reshuffle the game (Priority: P3)

**Goal**: a retried start (same idempotency key) never regenerates a different assignment set or records a second start.

**Independent Test**: submit two start requests with the same retry identity; the room's assignment set and start count must be identical before and after the second.

### Tests for User Story 8

- [x] T044 [P] [US8] pgTAP: two calls to `start_game_session` with the same `idempotency_key` against an already-started room — this exercises the RPC's own behaviour under a direct repeat call (belt-and-braces beneath the Java-layer idempotency store), asserting the assignment set is unchanged and the room does not re-enter generation, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`
- [x] T045 [P] [US8] **Already covered, unchanged by this feature**: `PersistentIdempotencyServiceTest` (11 tests) and `StartGameCommandControllerTest.doubleSubmitReturnsIdenticalResponseWithoutASecondStart` / `reusingKeyAgainstADifferentRoomIsRejectedWithConflict` already exercise exactly this — replay-without-re-invoking and release-then-reusable. Neither file needed changes since this feature didn't touch `PersistentIdempotencyService` or `CommandDispatcher`; re-ran both after the `start_game_session` signature change to confirm — still green, in `command-api/src/test/java/com/dong/commandapi/command/`

### Implementation for User Story 8

- [x] T046 [US8] Verify (and adjust if needed) that `private.start_game_session`'s early guards — particularly `invalid_room_state` once the room is already `in_progress` — correctly short-circuit a duplicate direct RPC call so generation code is never reached twice for the same room; no new mechanism should be needed since `command_idempotency` (migration 035) already prevents the dispatcher from calling through twice for the same key — depends on T012 (which now includes US2's rejection/relaxed branches)

**Checkpoint**: retries are safe at both the dispatch layer (existing) and the RPC layer (verified here).

---

## Phase 7: Correctness Fix — Registered join must lock the room row

**Not tied to a single user story** — this closes the race identified in research.md R6, which US1's roster-lock guarantee (FR-005) depends on.

- [x] T047 [P] In `supabase/migrations/036_canonical_assignment_generation.sql`, replace `private.join_room_as_registered`'s plain `SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.join_code = v_join_code;` with `... FOR UPDATE`, matching the guest path in `026_guest_room_join.sql` (contracts/room-rpcs.md §5)
- [x] T048 [P] pgTAP: this repo's suites run as one transaction on one connection (`BEGIN; … SET LOCAL ROLE …`), so a genuine two-session lock race cannot be executed here — instead assert the lock is present in the function definition: `SELECT ok(pg_get_functiondef('private.join_room_as_registered'::regproc) LIKE '%FOR UPDATE%', 'registered join locks the room row before reading it');`. Pair with a plain functional test that `join_room_as_registered` still succeeds and returns its existing snapshot shape unchanged, confirming the added lock clause didn't alter behavior for the non-racing case, in `supabase/tests/database/230_canonical_assignment_generation.test.sql`. If genuine concurrency coverage is wanted, it needs a script outside pgTAP (two `psql` processes) and is out of scope for this task list.

**Checkpoint**: FR-005's roster lock is real, not just asserted by the RPC's own `FOR UPDATE`.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: end-to-end confirmation and validation-guide execution, spanning all of US1/US2/US4/US8.

- [x] T049 [P] Extend `e2e/features/*.feature` and `e2e/steps/configure-start-game.steps.ts` with a journey: host configures a room (matches, Common Match, settings), starts it, and a second participant's device shows the same assignments (primary journey per constitution §V, required because the start flow changes materially)
- [x] T050 [P] **Scope substituted — see note.** Added a second scenario ("The room shows an unrelaxable shortfall...") covering the *hard-floor* case instead of the overridable-shortfall/override case literally described here. Reason: `requiredPoolSize` and `relaxedFloor` are mathematically identical whenever P=1 (no pairs exist to create the gap between them — see data-model.md), and this e2e journey only has the solo host, no second participant browser context. The overridable-shortfall path genuinely needs 2+ participants to be reachable; that needs the multi-context join helpers noted in issue #185's implementation notes and is a real gap, not covered here. The hard-floor case (host raises the per-player count above what the pool supports) *is* reachable solo and is what got tested.
- [x] T051 **Partially verified — DB suite not run.** `npm test` (407/407 passing, 80 suites), `npm run lint` (0 errors, 0 new warnings — diffed against a pre-change baseline), `npx tsc --noEmit` (0 new errors vs. baseline), and the Java suite via the Maven wrapper offline (`.\mvnw.cmd -o test`, 76/76 passing, including `StartGameCommandHandlerTest`/`StartGameCommandControllerTest`) all ran clean. **`npm run db:test` could not be run**: this environment has no Docker (confirmed via `docker info`) and appears to block local TCP/loopback connections entirely — even a bare local Postgres instance (installed PostgreSQL 18 binaries, no Docker involved) hung on every connection attempt. Migration 036 and the new pgTAP suite are unverified by execution; only by careful manual trace (see spec/tasks notes on the two bugs that trace already caught: the function-overload drop, and `now()` being frozen for the whole test transaction). **Run `npm run db:reset && npm run db:test` before merging.**
- [ ] T052 **Not run — requires a live local stack.** Execute quickstart.md manual verification steps 1-6 once `npm run db:start` (Docker) is available; confirm the linear-default pool requirement (step 1) and the quadratic-at-K=1 requirement both display correctly in the lobby UI, which has not been visually verified in a browser.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: no dependencies within this feature — BLOCKS every user story phase (T001/T002 are read by every subsequent RPC change)
- **US1 (Phase 3)**: depends on Phase 2. T012 implements the full `start_game_session` body — generation, rejection branches, and relaxed-generation branch together (see the Phase 3/4 implementation notes on why this is one task) — so US1 cannot be merged as generation-only and tested in isolation from US2's rejection paths at the code level; it *is* independently testable at the behavioral level (T006-T011 exercise only the sufficient-pool paths).
- **US2 (Phase 4)**: depends on Phase 2 and on T012 (US1's phase) being complete, since T012 already contains US2's implementation. Phase 4's own tasks (T019-T023, T027-T032) are the tests and surrounding Java/client wiring for behavior T012 already implements.
- **US4 (Phase 5)**: depends on Phase 2 only. Can be implemented in parallel with US1/US2 — it is a separate RPC (`set_room_assignment_settings`) that US1/US2 read from (via `compute_room_assignment_plan`) but do not write to.
- **US8 (Phase 6)**: depends on T012 (which by this point contains both US1's and US2's behavior), since it verifies the completed `start_game_session`.
- **Phase 7 (join lock fix)**: independent of every user story; can be done first, in parallel, or last. Recommended early since it is a correctness fix to already-shipped code (research.md R6).
- **Polish (Phase 8)**: depends on all of the above.

### Within Each User Story

- Tests before implementation (write pgTAP assertions first; they should fail against the pre-migration schema)
- Migration/RPC changes before Java handler changes before client changes, per story
- A story's checkpoint is not reached until its own tests pass against its own implementation

### Parallel Opportunities

- T005 (client type) can proceed alongside T001-T004 once the `AssignmentPlan` shape in contracts/room-rpcs.md §2 is fixed
- All pgTAP test-writing tasks within a phase (marked [P]) share one test file (`230_canonical_assignment_generation.test.sql`) — write them as sequential `SELECT` blocks within that file rather than separate files, but they do not depend on each other's assertions passing first
- T016/T017/T018 (client randomiser removal) can proceed in parallel with T012-T015 (server generation) — they are independent deletions
- Phase 5 (US4) can be staffed in parallel with Phases 3-4 (US1/US2) by a second implementer, since `set_room_assignment_settings` is additive to the migration file but touches none of the same functions
- Phase 7 (join lock fix) can be staffed in parallel with anything

---

## Parallel Example: Phase 2 + User Story 1 kickoff

```bash
# Foundational, in parallel:
Task: "Add matches_per_player/shared_matches_per_pair columns to game_sessions (T001)"
Task: "Add AssignmentPlan type to types/room.ts (T005)"

# Once T001/T002 land, US1 tests in parallel (same file, independent SELECT blocks):
Task: "pgTAP: default K=0 generation invariants (T006)"
Task: "pgTAP: K=1 pairing invariants (T007)"
Task: "pgTAP: solo and two-participant boundaries (T008)"

# US1 client-side deletions, parallel to server implementation:
Task: "Delete randomizeAssignments from useRoomConfigure.ts (T016)"
Task: "Remove randomise control from lobby screen (T017)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: a room with a sufficient pool starts with one canonical set, visible identically on two devices
4. This is a genuine MVP: a host who never under-fills their pool never sees the shortfall path

### Incremental Delivery

1. Foundational → Phase 3 (US1) → validate → this alone is releasable if pool-sizing UX is deferred
2. Add Phase 4 (US2) → validate the shortfall warning and override → now releasable with full FR-013 coverage
3. Add Phase 5 (US4) → validate settings tuning → host gains control over pool cost (can be done in parallel with the above)
4. Add Phase 6 (US8) → validate retry safety → closes the last correctness gap
5. Phase 7 (join lock fix) should land no later than Phase 3, since Phase 3's own tests (T009) assume it

### Recommended Order Given the Dependency Graph

Because US2 extends US1's function body and US8 verifies both, the practical
sequence is: **Phase 2 → Phase 7 → Phase 3 → Phase 4 → Phase 6**, with **Phase 5**
run in parallel from right after Phase 2. This differs from strict priority order
(P1, P1, P2, P3) because US4's independence makes it free parallel capacity, and
the join-lock fix is cheap to do first rather than risk US1's T009 exposing it
mid-story.

---

## Notes

- **`230_canonical_assignment_generation.test.sql` needs one exact `SELECT plan(N)`** at
  the top, per this repo's pgTAP convention (see `220_configure_start_game_rpcs.test.sql`'s
  `plan(26)`). Every test task in this list (T006-T011, T019-T022, T033-T037,
  T044, T048) appends assertions to that same file. Whoever lands the first block
  sets the initial `plan(N)` to their own assertion count; every task after that
  updates `N` to the running total before merging — do not leave a stale count.
- [P] tasks touch different files, or the same file in a way that doesn't create
  a merge conflict (independent `SELECT` blocks appended to one pgTAP file) —
  confirm no two [P] tasks in flight edit the same function body concurrently.
- **Format exceptions**: T046 has no single file path (it's a verification pass
  over T012/T024's already-written guards, not a new deliverable) and T051/T052
  are cross-cutting command-run tasks rather than file edits. Every other task
  carries an exact path per the checklist format.
- All new SQL objects follow the repo's `private.*` (`SECURITY DEFINER`,
  `SET search_path = ''`, granted to `service_role`) + thin `public.*` wrapper
  (granted to `authenticated`) convention — do not deviate.
- `UNASSIGNED_PARTICIPANTS` removal (T027) is a breaking change to
  `ErrorCode` — grep the codebase for other references before deleting the
  constant (T051 covers this via the full test/lint pass).
- Every task that edits `supabase/migrations/036_canonical_assignment_generation.sql`
  edits the same file; sequence them within a story even where marked
  independent of *other* stories, to avoid migration-file merge conflicts.
- Commit after each task or logical group. Stop at any checkpoint to validate a
  story independently before continuing.
