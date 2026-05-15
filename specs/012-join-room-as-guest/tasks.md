# Tasks: Join Room as Guest

**Input**: Design documents from `/specs/012-join-room-as-guest/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Every new feature MUST include unit-test coverage for the new behavior it introduces. Substantial UI changes, including the guest-room join flow and lobby handoff, MUST include end-to-end coverage for the primary cross-device journey. Because this feature changes shared multiplayer state, it also needs the highest-leverage database and contract coverage around the RPC boundary.

**Organization**: Tasks are grouped by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (for example `US1`, `US2`, or `US3`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 [P] Create guest join feature scaffolding in `app/joinRoom.tsx`, `components/guestJoin/GuestJoinForm.tsx`, `components/guestJoin/GuestJoinLobby.tsx`, `components/guestJoin/GuestJoinBanner.tsx`, `hooks/useGuestRoomJoin.ts`, `hooks/useGuestRoomSession.ts`, and `types/guestRoom.ts`
- [x] T002 [P] Add guest-room helper scaffolding in `utils/guestRoom.ts` and extend `utils/supabaseClient.ts` with a typed guest-room RPC client interface and AsyncStorage-backed grant helpers

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Add the guest-room RPC migration in `supabase/migrations/026_guest_room_join.sql` for `join_room_as_guest`, `get_guest_room_snapshot`, replay-safe guest-token handling, and the expired-grant error path
- [x] T004 [P] Add shared guest-room DTOs, normalization helpers, and persisted session-grant helpers in `types/guestRoom.ts` and `utils/guestRoom.ts`
- [x] T005 [P] Add shared BDD fixture helpers for host-room and guest-device setup in `e2e/fixtures.ts` and `e2e/steps/browser-flow.helpers.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Join Room as a Guest (Priority: P1) 🎯 MVP

**Goal**: A guest can enter a room code and guest name from their own device, join the room without creating an account, and reach the lobby or restored session snapshot.

**Independent Test**: From a second device or browser session, enter a valid room code and guest name for a joinable room, then confirm the guest is accepted, the lobby loads from the join response, and the room snapshot shows the current session state.

### Tests for User Story 1 (REQUIRED coverage) ⚠️

- [x] T006 [P] [US1] Add database success coverage in `supabase/tests/database/041_guest_room_join_success.test.sql` for a successful guest join, duplicate guest-name acceptance, replaying the same guest token without creating a second participant, and guest snapshot retrieval
- [x] T007 [P] [US1] Add unit tests in `__tests__/hooks/useGuestRoomJoin.test.ts` and `__tests__/hooks/useGuestRoomSession.test.ts` for successful join, first lobby render from the join response snapshot, replaying the same guest token after a lost response, restoring a persisted grant, and snapshot refresh
- [x] T008 [P] [US1] Add component tests in `__tests__/components/guestJoin/GuestJoinForm.platform.test.tsx` and `__tests__/components/guestJoin/GuestJoinLobby.platform.test.tsx` for rendering, submit behavior, and lobby snapshot display
- [x] T009 [P] [US1] Add Playwright BDD coverage in `e2e/features/guest-room-join.feature` and `e2e/steps/guest-room-join.steps.ts` for joining an open room from a second device, reaching the lobby, and observing the same gameplay-state transition after the host starts play

### Implementation for User Story 1

- [x] T010 [P] [US1] Implement the guest-room join and session hooks with token generation, retry replay, and restore logic in `hooks/useGuestRoomJoin.ts` and `hooks/useGuestRoomSession.ts`
- [x] T011 [P] [US1] Implement the guest join form and route in `components/guestJoin/GuestJoinForm.tsx` and `app/joinRoom.tsx`
- [x] T012 [US1] Add the home-screen guest join entry point in `app/index.tsx`
- [x] T013 [US1] Render the joined lobby and participant summary in `components/guestJoin/GuestJoinLobby.tsx`

**Checkpoint**: User Story 1 should now be fully functional and testable independently

---

## Phase 4: User Story 2 - Reject Invalid Join Data (Priority: P1)

**Goal**: Invalid room codes, closed rooms, blank guest names, and expired stored grants are rejected with a clear explanation, while valid duplicate guest names still remain allowed.

**Independent Test**: Attempt to join with a bad room code, a closed room, or a blank guest name, then invalidate a stored grant, and confirm each path fails cleanly without creating a durable account.

### Tests for User Story 2 (REQUIRED coverage) ⚠️

- [x] T014 [P] [US2] Add database rejection coverage in `supabase/tests/database/042_guest_room_join_rejections.test.sql` for invalid room codes, non-joinable rooms, blank-name rejection, and expired or unknown guest-token errors
- [x] T015 [P] [US2] Add unit tests in `__tests__/hooks/useGuestRoomJoin.test.ts` and `__tests__/hooks/useGuestRoomSession.test.ts` for invalid code, closed room, blank-name validation, expired-grant clearing, and `leaveRoom()` removing the persisted grant

### Implementation for User Story 2

- [x] T016 [US2] Add join-time normalization, joinability checks, blank-name validation, and expired-grant clearing in `utils/guestRoom.ts`, `hooks/useGuestRoomJoin.ts`, and `hooks/useGuestRoomSession.ts`
- [x] T017 [US2] Surface failure copy and retry affordances in `components/guestJoin/GuestJoinForm.tsx` and `app/joinRoom.tsx`

**Checkpoint**: User Stories 1 and 2 should both work independently

---

## Phase 5: User Story 3 - Show Guest Limitations Clearly (Priority: P2)

**Goal**: The guest join modal and lobby clearly explain that the guest is temporary and room-scoped, so the player understands what this access does and does not create.

**Independent Test**: Open the guest join modal and lobby after a successful join, then confirm the temporary-guest explanation and guest labels are visible on both phone-sized and desktop-sized layouts.

### Tests for User Story 3 (REQUIRED coverage) ⚠️

- [x] T018 [P] [US3] Add unit tests in `__tests__/components/guestJoin/GuestJoinLobby.platform.test.tsx` for guest badges and temporary-access messaging
- [x] T019 [P] [US3] Extend `e2e/steps/guest-room-join.steps.ts` to verify guest labels and temporary-room messaging in the guest join modal and lobby across phone and desktop web viewports

### Implementation for User Story 3

- [x] T020 [US3] Add guest limitation messaging in `components/guestJoin/GuestJoinBanner.tsx` and `components/guestJoin/GuestJoinLobby.tsx`
- [x] T021 [US3] Update `app/index.tsx` and `components/guestJoin/GuestJoinModal.tsx` to show the temporary guest state after successful join and on restored session

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T022 [P] Run focused validation with `npm run db:test`, `npx jest --runInBand __tests__/hooks/useGuestRoomJoin.test.ts __tests__/hooks/useGuestRoomSession.test.ts __tests__/components/guestJoin/GuestJoinForm.platform.test.tsx __tests__/components/guestJoin/GuestJoinLobby.platform.test.tsx __tests__/app/index.platform.test.tsx __tests__/app/joinRoom.platform.test.tsx`, `npm run test:e2e`, the native smoke checks from `quickstart.md` for join, reload, expired-grant clearing, and host-to-gameplay transition, then `npm run lint`
- [x] T023 [P] Update `specs/012-join-room-as-guest/quickstart.md` and `specs/012-join-room-as-guest/contracts/guest-room-join.md` if implementation details change

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in priority order or in parallel if staffed
- **Polish (Final Phase)**: Depends on the desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - reuses the same join surface but stays independently testable
- **User Story 3 (P2)**: Can start after User Story 1 exposes the join screen and lobby, but its messaging work remains independently testable

### Within Each User Story

- Required tests MUST be written and fail before implementation
- Shared RPC and client helpers before screen-specific UI work
- Join flow before lobby polish
- Core implementation before end-to-end regression validation
- Story complete before moving to the next priority slice

### Parallel Opportunities

- Setup tasks T001 and T002 can run in parallel
- Foundational tasks T003, T004, and T005 can run in parallel once the feature structure exists
- In User Story 1, T006, T007, T008, and T009 can start in parallel after the shared foundation is in place
- In User Story 2, T014 and T015 can run in parallel, then T016 and T017 follow
- In User Story 3, T018 and T019 can run in parallel, then T020 and T021 follow

---

## Parallel Example: User Story 1

```bash
# Launch the user story 1 tests together:
Task: "Add database success coverage in supabase/tests/database/041_guest_room_join_success.test.sql"
Task: "Add unit tests in __tests__/hooks/useGuestRoomJoin.test.ts and __tests__/hooks/useGuestRoomSession.test.ts"
Task: "Add component tests in __tests__/components/guestJoin/GuestJoinForm.platform.test.tsx and __tests__/components/guestJoin/GuestJoinLobby.platform.test.tsx"
Task: "Add Playwright BDD coverage in e2e/features/guest-room-join.feature and e2e/steps/guest-room-join.steps.ts"

# Launch the user story 1 implementation tasks together:
Task: "Implement the guest-room join and session hooks in hooks/useGuestRoomJoin.ts and hooks/useGuestRoomSession.ts"
Task: "Implement the guest join form and route in components/guestJoin/GuestJoinForm.tsx and app/joinRoom.tsx"
Task: "Render the joined lobby and participant summary in components/guestJoin/GuestJoinLobby.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test the guest join journey independently
5. Demo or merge the MVP slice if it is stable

### Incremental Delivery

1. Complete Setup + Foundational -> the command boundary and shared helpers are ready
2. Add User Story 1 -> the guest can join a room from a second device and restore the room from a persisted grant
3. Add User Story 2 -> invalid inputs and expired grants fail cleanly
4. Add User Story 3 -> the guest experience is clearly framed as temporary
5. Validate each story before moving to the next slice

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once the foundation is ready:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Integrate each story independently and keep the guest join flow working throughout

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to a specific user story for traceability
- Each user story should be independently completable and testable
- Every story that adds new feature behavior MUST include unit-test tasks
- Stories with substantial UI changes MUST include end-to-end test tasks
- Features affecting web UI must include native and web verification tasks
- Features affecting shared state must include command-path, idempotency, and event-persistence tasks
- Features affecting auth or persisted data must include migration, policy, or RLS validation tasks
- Before research or implementation, identify applicable repository, platform, or domain skills and follow them, or explicitly note that none apply
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid vague tasks, same file conflicts, and cross-story dependencies that break independence
