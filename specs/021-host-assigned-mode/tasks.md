# Tasks: Assignment Mode Setting + Host-Assigned Allocation

**Input**: Design documents from `specs/021-host-assigned-mode/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Scope**: this task list covers the **#184 row** of
`specs/020-canonical-assignment-generation/spec.md`'s Delivery Slices table —
User Story 3's mode setting and User Story 5. US6 (#185, player-picked) and
US7 (#186, mid-game reassignment) are out of scope. `specs/020/tasks.md`
(#135) is complete and untouched.

**Tests**: included. Constitution §V requires unit tests for every new
feature behaviour, and this feature changes a shared RPC boundary and a
persisted state transition. pgTAP remains the generator's unit-test level
(carried over from `specs/020` research.md R8) — the plpgsql code has no
other place to be unit-tested.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no unresolved dependency)
- **[Story]**: which user story this task serves (US3, US5)
- File paths are exact and relative to the repo root

---

## Phase 1: Setup

**Purpose**: nothing to scaffold — this feature extends existing subsystems
(`supabase/migrations/`, the client) rather than creating a new one. No setup
phase is needed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the mode column and the two functions everything else in this
feature reads (`compute_room_assignment_plan`, `set_room_assignment_settings`)
must exist and be mode-aware before either user story's own RPC work.

**⚠️ CRITICAL**: no user story task can start until this phase is complete.

- [X] T001 Create migration `supabase/migrations/037_host_assigned_mode.sql`; add `CREATE TYPE public.assignment_mode AS ENUM ('automatic', 'host_assigned', 'player_picked')` (guarded with the repo's existing `IF NOT EXISTS`-via-`pg_type` pattern, matching `001_create_types.sql`/`025_session_ownership_roles.sql`) and `ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS assignment_mode public.assignment_mode NOT NULL DEFAULT 'automatic'` (data-model.md; FR-026, FR-027)
- [X] T002 In the same migration file, `CREATE OR REPLACE FUNCTION private.compute_room_assignment_plan` so `effectivePerPlayer` (and the `requiredPoolSize`/`relaxedFloor` derived from it) only applies the `shared_matches_per_pair × (participantCount − 1)` floor when `v_room.assignment_mode = 'automatic'`; otherwise `effectivePerPlayer := v_room.matches_per_player` unraised (contracts/room-rpcs.md §3, research.md R3, FR-011). Signature is unchanged, so existing `REVOKE`/`GRANT` on this function carry over automatically — do not re-issue them.
- [X] T003 In the same migration file, `CREATE OR REPLACE FUNCTION private.set_room_assignment_settings` so the `per_player_count_below_minimum` guard (the `v_minimum` check) is skipped entirely unless `v_room.assignment_mode = 'automatic'` (contracts/room-rpcs.md §2, research.md R3, FR-011). Signature unchanged; grants carry over.
- [X] T004 In the same migration file, `CREATE OR REPLACE FUNCTION private.build_guest_room_snapshot` to add an `'assignmentMode', game_sessions.assignment_mode::text` key to its returned `jsonb_build_object`, additive only — no existing key removed or reordered (data-model.md client types)
- [X] T005 [P] Add `AssignmentMode` type (`"automatic" | "host_assigned" | "player_picked"`) and extend `RoomSnapshot` in `types/room.ts` with `assignmentMode: AssignmentMode`, mirroring the new snapshot key from T004; add `invalidAssignmentMode: "invalid_assignment_mode"` to `ROOM_ERROR`

**Checkpoint**: schema and mode-aware feasibility/settings functions exist, every snapshot carries the room's mode, client types compile. User story work can begin.

---

## Phase 3: User Story 3 — The host chooses how matches get decided (Priority: P2)

**Goal**: the room carries a persisted, host-controlled assignment mode, visible to every participant, defaulting to automatic, changeable only while joinable, and gated by a discard-draft confirmation when a draft already exists.

**Independent Test**: change the mode on the host device, confirm a second participant's device reflects the new mode within one snapshot poll, reload both, confirm it persisted.

### Tests for User Story 3

- [X] T006 [P] [US3] pgTAP: a freshly created room reads `assignmentMode: "automatic"` from `build_guest_room_snapshot` with no explicit set (FR-027), in `supabase/tests/database/240_host_assigned_mode.test.sql`
- [X] T007 [P] [US3] pgTAP: `set_room_assignment_mode` guard table — `not_authenticated`, `room_not_found`, `not_host` (non-owner caller), `room_not_joinable` (room in `in_progress`), `invalid_assignment_mode` (bogus string) — each raises its documented error and leaves `assignment_mode` unchanged, in `supabase/tests/database/240_host_assigned_mode.test.sql`
- [X] T008 [P] [US3] pgTAP: a successful `set_room_assignment_mode` call persists the new value and is idempotent (calling it again with the same value is a no-op success), in `supabase/tests/database/240_host_assigned_mode.test.sql`
- [X] T009 [P] [US3] pgTAP: with identical roster/settings, `compute_room_assignment_plan`'s `effectivePerPlayer` is raised to the FR-009 minimum in `automatic` mode but reads the stored `matches_per_player` unraised in `host_assigned` mode (research.md R3), in `supabase/tests/database/240_host_assigned_mode.test.sql`
- [X] T010 [P] [US3] pgTAP: `set_room_assignment_settings` accepts a `matches_per_player` below the FR-009 minimum in `host_assigned` mode but still rejects it with `per_player_count_below_minimum` in `automatic` mode for the same roster/`shared_matches_per_pair` (FR-011), in `supabase/tests/database/240_host_assigned_mode.test.sql`

### Implementation for User Story 3

- [X] T011 [US3] In `supabase/migrations/037_host_assigned_mode.sql`, add `private.set_room_assignment_mode(p_session_id uuid, p_mode text)` (host-only, `joinable`-only, validates `p_mode` against the three enum values, idempotent no-op on unchanged value, no gameplay event per research.md R7) and its thin `public.set_room_assignment_mode(session_id uuid, mode text)` wrapper with `REVOKE`/`GRANT` matching the repo's private/public convention (contracts/room-rpcs.md §1) — depends on T001
- [X] T012 [P] [US3] Add `setRoomAssignmentMode(sessionId, mode)` to the `RoomRpcClient` interface and its implementation in `utils/supabaseClient.ts`, calling the new RPC — depends on T011
- [X] T013 [P] [US3] Add `setAssignmentMode: (mode: AssignmentMode) => Promise<void>` to `UseRoomConfigureResult` and its implementation in `hooks/useRoomConfigure.ts`, following the existing `setCommonMatch`/`setAssignmentSettings` pattern (`run(...)` wrapper) — depends on T012
- [X] T014 [US3] In `app/lobby/[sessionId].tsx`, add a host-only assignment-mode selector (segmented control, `testID="lobby-assignment-mode-{automatic|host-assigned}"`) reading `lobby.snapshot.assignmentMode` and calling `configure.setAssignmentMode` — depends on T013. `player_picked` is not offered as a selectable option yet (#185)
- [X] T015 [US3] In the same file, add a confirm-discard dialog (`testID="lobby-assignment-mode-confirm"`, `lobby-assignment-mode-confirm-button"`) that intercepts the mode selector's `onChange` whenever `lobby.snapshot.assignments.length > 0`, following the existing `lobby-close-confirm`/`lobby-close-confirm-button` pattern in the same file; declining leaves the selector at its current value and calls nothing, confirming proceeds to T014's call (FR-030a) — depends on T014
- [X] T015a [US3] In the same file, when the target mode of a switch is `automatic`, compute the FR-009 minimum from the snapshot (`sharedMatchesPerPair * (participants.length - 1)`) and compare it to the stored `assignmentPlan.matchesPerPlayer`; if the stored count is below that minimum, surface it in the same confirmation surface as T015 (e.g. "switching to automatic raises the per-player count to N") rather than letting FR-032 silently raise it at start with no warning — spec.md's "count valid in one mode but not another" edge case, `testID="lobby-assignment-mode-confirm-minimum-notice"` — depends on T015
- [X] T016 [P] [US3] Add `setAssignmentMode` coverage to `__tests__/hooks/useRoomConfigure.test.ts`: success, RPC error mapped through `friendlyMessage`, and that `onMutated` fires on success — depends on T013
- [X] T017 [US3] Extend `e2e/features/configure-start-game.feature` and `e2e/steps/configure-start-game.steps.ts` with a scenario: host switches the mode, a second joined participant's polled snapshot reflects it, and switching again after an allocation exists shows the confirm dialog — depends on T014, T015

**Checkpoint**: the room's assignment mode is persisted, host-controlled, visible to every participant, and switching it safely warns before discarding a draft.

---

## Phase 4: User Story 5 — The host allocates matches by hand (Priority: P2)

**Goal**: in host-assigned mode the host allocates matches to participants from the room's pool; the lobby shows who is still short; starting keeps every host allocation and server-fills any shortfall, reporting who was filled in.

**Independent Test**: set the mode to host-assigned, allocate matches to some but not all players, confirm the lobby shows the outstanding ones, then start and confirm the stored set matches what was allocated plus the server-filled shortfall.

### Tests for User Story 5

- [X] T018 [P] [US5] pgTAP: in `host_assigned` mode, seed full allocations for every active participant via `set_room_assignments`, start the game, assert the stored `public.assignments` set is exactly what was allocated plus the Common Match for everyone, and `filledInParticipantIds` is empty (issue acceptance scenario 1), in `supabase/tests/database/240_host_assigned_mode.test.sql`
- [X] T019 [P] [US5] pgTAP: in `host_assigned` mode, seed partial allocations (some participants short of `matches_per_player`), start the game, assert every host-allocated match is kept, every shortfall is filled from the pool up to the count, and `filledInParticipantIds` names exactly the participants that needed a fill (issue acceptance scenario 2; FR-036, FR-037), in `supabase/tests/database/240_host_assigned_mode.test.sql`
- [X] T020 [P] [US5] pgTAP: in `host_assigned` mode, the host explicitly allocates the Common Match to a participant via `set_room_assignments` before start; starting succeeds with no unique-constraint error and that participant holds the Common Match exactly once (research.md R4 step 4, the `ON CONFLICT DO NOTHING` path; User Story 5 edge case), in `supabase/tests/database/240_host_assigned_mode.test.sql`
- [X] T021 [P] [US5] pgTAP: in `host_assigned` mode, the host allocates the same non-Common match to two different participants; starting succeeds and both participants hold it (clarification: shared allocation is permitted, no exclusivity rule), in `supabase/tests/database/240_host_assigned_mode.test.sql`
- [X] T022 [P] [US5] pgTAP: in `host_assigned` mode, the host allocates more matches to a participant than the room's configured `matches_per_player`; starting keeps the full over-allocation uncapped, and that participant is never listed in `filledInParticipantIds` (clarification: allocation is uncapped), in `supabase/tests/database/240_host_assigned_mode.test.sql`
- [X] T023 [P] [US5] pgTAP: `set_room_assignments` (unchanged RPC) still rejects a non-host caller with `not_host` and a non-`joinable` room with `room_not_joinable` when `assignment_mode = 'host_assigned'` — regression guard confirming the reused RPC's existing guards are untouched (FR-035), in `supabase/tests/database/240_host_assigned_mode.test.sql`
- [X] T024 [P] [US5] pgTAP: a participant who has left the room (`left_at IS NOT NULL`) before start is not read as "held" even if a stray allocation row exists for them, and receives no assignment — mirrors the roster-lock behaviour `specs/020` T009 established for automatic mode, in `supabase/tests/database/240_host_assigned_mode.test.sql`

### Implementation for User Story 5

- [X] T025 [US5] In `supabase/migrations/037_host_assigned_mode.sql`, `CREATE OR REPLACE FUNCTION private.start_game_session` (same three-argument signature — no `DROP FUNCTION` needed since arity is unchanged) adding the `host_assigned` generation branch per contracts/room-rpcs.md §4 and research.md R4: skip the up-front `DELETE FROM public.assignments` for this mode; for each active participant, count existing non-Common-Match assignment rows, fill any shortfall against `effectivePerPlayer` (from T002, already unraised in this mode) by drawing random unheld pool matches excluding the Common Match, recording filled participant IDs; then insert the Common Match for every active participant via `INSERT ... ON CONFLICT (session_id, participant_id, match_id) DO NOTHING`; add `filledInParticipantIds` to the returned `jsonb` (empty array outside `host_assigned` mode or when nothing needed filling). The existing `automatic`/relaxed branches and all five pre-existing guards are otherwise byte-for-byte unchanged — depends on T001, T002, T011
- [X] T026 ~~Add `filledInParticipantIds` to the start-game response type~~ — **superseded**: the Java command-api's `CommandResponse` deliberately does not forward RPC/handler internals to the client (`command-api/.../CommandResult.java`, the same boundary `relaxedConstraints` already lives behind — confirmed by reading the controller/DTO, not assumed). There is no client type to add. FR-037 is instead satisfied pre-start by T028's data (see revised T029). research.md R5 documents the correction.
- [X] T027 [US5] In `app/lobby/[sessionId].tsx`, add a host-only per-participant allocation control, visible only when `lobby.snapshot.assignmentMode === "host_assigned"`: for each participant, a picker over `lobby.snapshot.matches` (excluding the Common Match) that adds/removes entries via `configure.setAssignments`, seeded from `lobby.snapshot.assignments` filtered to that participant (`testID="lobby-allocate-{participantId}-{matchId}"`) — depends on T013 (reuses the existing `setAssignments`, unchanged), T005
- [X] T028 [US5] In the same file, compute and render a per-participant "still short" indicator client-side: `count(assignments where participantId = X, matchId != commonMatchId) < assignmentPlan.matchesPerPlayer` (research.md R9 — no new server field), `testID="lobby-allocation-status-{participantId}"` — depends on T027
- [X] T029 [US5] In the same file, **pre-start** (not post-start — research.md R5), when `assignmentMode === "host_assigned"` and at least one participant is short (T028's set is non-empty), render a line near the Start button naming those participants and stating the server will fill them in if the host proceeds (FR-037's echo, satisfied before the action rather than after it) — `testID="lobby-start-game-will-fill-in"` — depends on T028
- [X] T030 [P] [US5] Add allocation-flow coverage to `__tests__/hooks/useRoomConfigure.test.ts`: `setAssignments` round-trips through `setRoomAssignments` correctly when used repeatedly for the same participant (add then remove), confirming no regression from reusing the existing hook method — depends on T013
- [X] T031 [US5] Extend `e2e/features/configure-start-game.feature` and `e2e/steps/configure-start-game.steps.ts` with the full host-assigned journey: switch to host-assigned mode, allocate matches to some but not all participants, confirm the shortfall indicator, start the game, confirm the stored assignments match what was allocated plus server-filled matches, and confirm the filled-in message appears — depends on T014, T027, T028, T029

**Checkpoint**: host-assigned mode is fully usable end to end — allocate, see shortfalls, start, and the server settles exactly what was promised.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: repo-wide gates and final validation, per constitution §V ("Run `npm test && npm run lint` before opening a pull request").

- [ ] T032 [P] Run `npm run db:reset && npm run db:test`, confirming migration `037_host_assigned_mode.sql` applies cleanly on top of `036_...` and `supabase/tests/database/240_host_assigned_mode.test.sql` passes in full — **blocked in this environment**: no local Docker daemon available to run the Supabase stack. `037_host_assigned_mode.sql` and `240_host_assigned_mode.test.sql` are written and internally consistent with the shipped `036_canonical_assignment_generation.sql`, but neither has been executed. Run this before merging.
- [X] T033 [P] Run `npm test && npm run lint` across the client changes (T005, T012–T017, T026–T031) — lint: 0 errors (365 pre-existing warnings, none in touched files). Full `npm test` run confirmed separately.
- [X] T034 [P] Run `.\mvnw.cmd clean verify` in `command-api/` to confirm the Java service is unaffected (research.md R8 — no source change expected, this is a regression check) — **BUILD SUCCESS**, 76/76 tests passing, confirming no Java changes were needed.
- [ ] T035 Run `npm run bdd:gen && npm run test:e2e` against the extended Playwright journey (T017, T031) — **blocked in this environment**: `test:e2e` requires Expo web running plus a browser; not exercised here. The new scenarios/steps are written; run before merging.
- [ ] T036 Walk through `quickstart.md` manually end to end (mode switch on two tabs, allocation, shortfall fill, Common-Match no-op, shared-allocation case) and confirm every step matches its documented outcome — **blocked in this environment**: same Docker/dev-server dependency as T032/T035.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — skipped
- **Foundational (Phase 2)**: no dependencies — BLOCKS both user stories
- **User Story 3 (Phase 3)**: depends on Phase 2 (needs the `assignment_mode` column and mode-aware `compute_room_assignment_plan`/`set_room_assignment_settings`)
- **User Story 5 (Phase 4)**: depends on Phase 2 (same reason) **and** on T011 (needs `set_room_assignment_mode` to exist so pgTAP fixtures can put a room into `host_assigned` mode) — otherwise independent of Phase 3's client-side work
- **Polish (Phase 5)**: depends on both user stories being complete

### User Story Dependencies

- **User Story 3 (P2)**: can start after Phase 2 — no dependency on US5
- **User Story 5 (P2)**: can start after Phase 2 and T011 (the mode RPC) — its allocation mechanism (`set_room_assignments`) is otherwise already-shipped and independent of US3's client UI

### Within Each User Story

- pgTAP tests are written first per task order but, per this feature's test level (research.md, carried from `specs/020`), are not required to fail-first in isolation the way a unit test would — they exercise a single migration file's functions and are naturally written alongside T011/T025
- RPC/migration work before client hook work before lobby UI work before e2e
- Story complete before moving to the next priority, though US3 and US5 may be worked in parallel by different developers once T011 lands (see below)

### Parallel Opportunities

- All Phase 2 tasks marked [P] (T005) can run alongside T001–T004 once T001 lands
- All US3 pgTAP tasks (T006–T010) can run in parallel with each other (same file, independent test bodies) once T001–T004 land
- All US5 pgTAP tasks (T018–T024) can run in parallel with each other once T011 and T025 land
- T012/T013 (US3 client plumbing) can run parallel to T018–T024 (US5 pgTAP) once T011 lands
- T026 (US5 type) can run parallel to T027–T029 (US5 UI) since it's a separate file

---

## Parallel Example: Phase 2 → User Story 3

```bash
# After T001-T004 land:
Task: "Add AssignmentMode type and extend RoomSnapshot in types/room.ts"          # T005

# After T011 lands:
Task: "pgTAP: default mode reads automatic on a fresh room"                       # T006
Task: "pgTAP: set_room_assignment_mode guard table"                               # T007
Task: "pgTAP: set_room_assignment_mode persists and is idempotent"                # T008
Task: "pgTAP: effectivePerPlayer mode branch in compute_room_assignment_plan"     # T009
Task: "pgTAP: set_room_assignment_settings minimum guard is mode-conditional"     # T010
```

---

## Implementation Strategy

### MVP First (User Story 3 Only)

1. Complete Phase 2: Foundational
2. Complete Phase 3: User Story 3 — the room now has a real, host-controlled,
   visible assignment mode, even though `host_assigned` mode has no allocation
   UI yet (the mode simply behaves like automatic once selected, since
   `start_game_session`'s host-assigned branch doesn't exist until Phase 4)
3. **STOP and VALIDATE**: confirm the mode persists and is visible across
   devices
4. Deploy/demo if ready — this alone closes User Story 3's independent test

### Incremental Delivery

1. Phase 2 → Foundation ready
2. Phase 3 (US3) → mode setting works end to end → demo
3. Phase 4 (US5) → host allocation works end to end → demo (closes issue #184)
4. Phase 5 → polish and final gate

### Note on Phase 3 without Phase 4

Selecting `host_assigned` mode before Phase 4 lands is safe but incomplete:
`set_room_assignment_settings`'s minimum-floor exemption (T003) and
`compute_room_assignment_plan`'s unraised `effectivePerPlayer` (T002) already
apply, but `start_game_session` has no host-assigned branch yet — starting a
`host_assigned` room before T025 lands falls through to the existing
`automatic`-shaped logic unless T025 is guarded to be part of the same
migration file as T011. **Recommendation**: land T001–T025 together as one
migration file (`037_host_assigned_mode.sql`), even if Phase 3's UI (T014
onward) ships first — the schema/RPC layer for both stories is one file by
construction (Phase 2 + T011 + T025 are all edits to
`037_host_assigned_mode.sql`), so this risk is naturally avoided as long as
the migration isn't split across two files.

---

## Notes

- [P] tasks = different files (or independent bodies in the same pgTAP file),
  no dependencies
- [Story] label maps task to specific user story for traceability
- Commit after each task or logical group
- Stop at either checkpoint to validate a story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break
  independence beyond the shared migration file noted above
