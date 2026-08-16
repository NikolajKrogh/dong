# Tasks: Host Reassignment During an Active Game

**Input**: Design documents from `specs/023-mid-game-reassignment/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/reassignment-rpc.md`, `quickstart.md`

**Tests**: Required by constitution §V and the feature specification. Write the
listed tests first and confirm the new assertions fail before implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel because it touches a different file and does not
  depend on incomplete work
- **[US7]**: Host changes one participant's settled assignments safely
- **[US7A]**: Completed history remains immutable and reconstructible

---

## Phase 1: Setup and Current-State Verification

**Purpose**: Re-verify the time-sensitive assumptions and freeze the exact
migration baseline before writing tests.

- [X] T001 Re-verify that no current scoring path derives or rewrites totals through `public.assignments`, and record any delta in `specs/023-mid-game-reassignment/research.md`
- [X] T002 Verify migration 040 remains the latest `private.end_game_session` definition and migration 031 remains the latest `chk_gameplay_events_event_type` definition, updating source references in `specs/023-mid-game-reassignment/plan.md` if needed
- [X] T003 [P] Verify #190 still owns active-game room identity, server-authoritative scoring, End Game wiring, and the reassignment client surfaces; record scope drift in `specs/023-mid-game-reassignment/spec.md`

**Checkpoint**: The implementation baseline and external integration ownership
are current.

---

## Phase 2: Foundational Contract and Test Scaffolding

**Purpose**: Establish shared types and failing database test fixtures used by
both stories.

- [X] T004 Add `ReassignParticipantMatchesInput`, `ReassignParticipantMatchesResponse`, and the complete documented reassignment error union to `types/room.ts`
- [X] T005 [P] Create pgTAP room, host, participant, match-pool, assignment, scoring, and event helpers in `supabase/tests/database/240_mid_game_reassignment.test.sql`
- [X] T006 [P] Create the failing RPC-wrapper success/error mapping suite in `__tests__/utils/supabaseClient.reassign.test.ts`

**Checkpoint**: Shared fixtures and contracts exist; new behavioral assertions
still fail because migration 041 and the wrapper are not implemented.

---

## Phase 3: User Story 7 — Host safely reassigns during play (Priority: P2) 🎯 Server MVP

**Goal**: Provide one host-only, idempotent, auditable RPC that replaces a
participant's non-Common matches without changing past scoring or settled slot
count.

**Independent Test**: In pgTAP, start an in-progress room, record goals and
drinks, call the RPC, and prove the canonical assignments and one audit delta
change while all prior scoring and events remain byte-identical.

### Tests for User Story 7

- [X] T007 [US7] Add failing happy-path, no-op, Common Match preservation, pool confinement, and scoring immutability assertions to `supabase/tests/database/240_mid_game_reassignment.test.sql`
- [X] T008 [US7] Add failing auth, host, room-state, active-target, and active-owner-actor guard assertions to `supabase/tests/database/240_mid_game_reassignment.test.sql`
- [X] T009 [US7] Add failing null array, null element, duplicate ID, changed-cardinality, and stable-error assertions to `supabase/tests/database/240_mid_game_reassignment.test.sql`
- [X] T010 [US7] Add failing equal-request replay, different-input key reuse, post-completion replay, non-host replay denial, and concurrent unique-index race assertions to `supabase/tests/database/240_mid_game_reassignment.test.sql`
- [X] T011 [US7] Add failing last-write-wins and ordered `assignment_reassigned` delta assertions, including move-away-and-back, to `supabase/tests/database/240_mid_game_reassignment.test.sql`

### Implementation for User Story 7

- [X] T012 [US7] In `supabase/migrations/041_mid_game_reassignment.sql`, redefine `chk_gameplay_events_event_type` from migration 031 with `assignment_reassigned` and create the private/public RPC shells with least-privilege grants
- [X] T013 [US7] In `supabase/migrations/041_mid_game_reassignment.sql`, implement authorization-first guard order, unique active owner-participant resolution, structural array validation, pool/Common Match checks, and settled non-Common cardinality preservation
- [X] T014 [US7] In `supabase/migrations/041_mid_game_reassignment.sql`, implement canonical request fingerprinting, equal-input replay, different-input `idempotency_key_reused`, and concurrent `23505` re-read handling
- [X] T015 [US7] In `supabase/migrations/041_mid_game_reassignment.sql`, implement the transactional assignment delta and one actor-attributed `assignment_reassigned` event whose payload matches the rows written
- [X] T016 [US7] Implement `reassignParticipantMatches` and all documented Postgres error mappings in `utils/supabaseClient.ts`
- [X] T017 [US7] Run `npm run db:reset`, `npm run db:test`, and the focused Jest wrapper suite; resolve failures in `supabase/migrations/041_mid_game_reassignment.sql`, `supabase/tests/database/240_mid_game_reassignment.test.sql`, or `__tests__/utils/supabaseClient.reassign.test.ts`

**Checkpoint**: The server mutation is complete and independently demonstrable,
but #186 remains product-incomplete until #190 supplies the active-game client.

---

## Phase 4: User Story 7a — Completed history tells the truth (Priority: P2)

**Goal**: Capture one complete immutable end-state assignment checkpoint, expose
whether assignments changed, and prove persisted events reconstruct every state.

**Independent Test**: Reassign, complete the room through
`private.end_game_session`, mutate the live table afterwards, and prove history
uses the complete snapshot while replay from kickoff plus ordered deltas equals
that snapshot and reconstructs an earlier moment.

### Tests for User Story 7a

- [X] T018 [US7A] Add failing atomic snapshot, expected-row-count, immutability, retry, Common Match, and post-completion live-table mutation assertions to `supabase/tests/database/240_mid_game_reassignment.test.sql`
- [X] T019 [US7A] Add failing incomplete-snapshot-insert rejection and snapshot-less legacy fallback assertions to `supabase/tests/database/240_mid_game_reassignment.test.sql`
- [X] T020 [US7A] Add failing `assignments_changed_during_play` true/false and unchanged-game history regression assertions to `supabase/tests/database/240_mid_game_reassignment.test.sql`
- [X] T021 [US7A] Add the failing `snapshot == replay(kickoff, ordered deltas)` invariant for one change, repeated changes, move-away-and-back, and no changes to `supabase/tests/database/240_mid_game_reassignment.test.sql`
- [X] T022 [US7A] Add a failing per-moment reconstruction assertion and retention/independent-delete protection assertion to `supabase/tests/database/240_mid_game_reassignment.test.sql`

### Implementation for User Story 7a

- [X] T023 [US7A] In `supabase/migrations/041_mid_game_reassignment.sql`, create `public.assignment_snapshots` with composite foreign keys, repeated expected count, restrictive privileges, and immutable update/delete trigger
- [X] T024 [US7A] In `supabase/migrations/041_mid_game_reassignment.sql`, redefine `private.end_game_session` to insert and verify the complete snapshot atomically before the completion event/state transition
- [X] T025 [US7A] In `supabase/migrations/041_mid_game_reassignment.sql`, enforce complete snapshots at the insert boundary, repoint `private._history_completed_assignments` to snapshots, and preserve the no-snapshot legacy fallback
- [X] T026 [US7A] In `supabase/migrations/041_mid_game_reassignment.sql`, recreate `public.completed_session_summaries` with `assignments_changed_during_play` and reapply the grants from migration 025
- [X] T027 [US7A] Run `npm run db:reset` and `npm run db:test`; resolve all history, snapshot, replay, fallback, grant, and existing-history regression failures in migration 041 and `supabase/tests/database/240_mid_game_reassignment.test.sql`

**Checkpoint**: Both server stories are complete and independently protected.

---

## Phase 5: Cross-Cutting Validation and Handoff

- [X] T028 Run the full `npm test` suite and fix feature-caused regressions in the files changed by this task list
- [X] T029 Run `npm run lint` and fix feature-caused lint failures in the files changed by this task list
- [X] T030 Execute every validation and Definition of Done item in `specs/023-mid-game-reassignment/quickstart.md`, recording any correction in that file
- [X] T031 Re-run the Spec Kit prerequisite checker and `/speckit-analyze` against `specs/023-mid-game-reassignment/spec.md`, `plan.md`, and `tasks.md`, resolving all CRITICAL or HIGH findings before implementation handoff

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 has no dependencies.
- Phase 2 depends on Phase 1 and blocks both stories.
- US7 depends on Phase 2.
- US7A depends on US7 because both extend migration 041 and history replay consumes
  the event written by US7.
- Cross-cutting validation depends on both stories.

### Within Each Story

- Write and observe failing tests before implementation.
- Implement schema/contract foundations before RPC or read-model behavior.
- Complete focused validation before advancing to the next story.

### Parallel Opportunities

- T003 can run alongside T001–T002.
- T005 and T006 can run alongside T004 and each other.
- Database tasks sharing migration 041 or test 240 are intentionally sequential to
  avoid conflicting edits.

---

## Parallel Example: Foundational Work

```text
Task: "Create pgTAP fixtures in supabase/tests/database/240_mid_game_reassignment.test.sql"
Task: "Create RPC-wrapper tests in __tests__/utils/supabaseClient.reassign.test.ts"
Task: "Add reassignment types to types/room.ts"
```

---

## Implementation Strategy

### Server MVP First

1. Complete current-state verification and test scaffolding.
2. Complete US7 and demonstrate the mutation independently.
3. Do not close #186: the feature remains intentionally unreachable from UI.
4. Complete US7A before merging because history safety is inseparable from the
   live mutation.
5. Finish full validation and hand the explicit client criteria to #190.

### Delivery Boundary

The server PR may merge ahead of #190, but product completion requires #190 to
implement and verify the host-only control, server-authoritative scoring
attribution, history indication, refusal presentation, active-game convergence,
and reassignment Playwright journey.

## Notes

- Every task follows the required checkbox, sequential ID, optional `[P]`, story
  label, and concrete file-path format.
- The migration and its pgTAP file are deliberately single-file work streams;
  do not parallelize tasks that edit the same file.
- Do not add UI or Playwright implementation in this slice; `issue-sync.md`
  records the exact external ownership needed to keep that work from being lost.

### Validation record

- `npm run db:reset` passed against the local Docker PostgreSQL 17.6 image.
- `npm run db:test` passed: 38 files and 526 assertions.
- Focused reassignment wrapper Jest passed: 13 tests.
- `npm run lint` exited 0; the repository still reports its existing warning set
  (386 warnings, no errors).
- The full `npm test -- --runInBand --watchAll=false` command was executed. It
  remains red in the pre-existing ShellCard platform tests because the current
  Node 26/Jest environment does not provide `window.dispatchEvent`; no failure
  implicated the files changed by this feature.
- The prerequisite checker passed and the final read-only cross-artifact review
  found no CRITICAL or HIGH Spec Kit findings.
