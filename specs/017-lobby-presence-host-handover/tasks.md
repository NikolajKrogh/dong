# Tasks: Live Lobby Presence & Host Handover

**Input**: Design documents from `specs/017-lobby-presence-host-handover/`

**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/](contracts/)

**Tests**: Included — the constitution (§V) mandates unit + DB tests for new behavior and e2e for substantial UI, and the spec's "Required coverage" assumption lists them.

**Organization**: Tasks are grouped by user story. Stories are independently testable and build in priority order (US1 → US2 → US3 → US4).

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1–US4 (story phases only)

**Note on migrations**: this refines plan.md's grouping into four sequential migrations — `031` (foundational lifecycle), `032` (US1 membership RPCs), `033` (US2/US3 host-leave), `034` (US4 expiry). The `'closed'` enum value is added in `031` and only referenced from `033`/`034` (separate transactions — research R3). **Every pgTAP test that mutates `game_sessions`/`participants` MUST run `SET CONSTRAINTS ALL IMMEDIATE` so the deferred `assert_session_owner_participant` trigger fires inside the test** (carryover from the 016→030 bug).

---

## Phase 1: Setup

- [X] T001 [P] Create `types/room.ts` with `RoomSnapshot`, `RoomParticipantSummary`, `RoomState` (`'joinable' | 'in_progress' | 'completed' | 'closed'`), and response types (`RegisteredJoinResponse`, `HostLeaveResponse`, `MemberLeaveResponse`, `MyActiveRoom`) per [contracts/RoomRpcClient.ts](contracts/RoomRpcClient.ts).
- [X] T002 [P] Export a shared `LOBBY_POLL_INTERVAL_MS = 4000` constant in `utils/supabaseClient.ts` for all lobby polling (host, member, guest).
- [X] T003 Verify `pg_cron` is enabled on the local stack and the dev project (`select * from pg_extension where extname='pg_cron'`); enable it or record the Edge-Function fallback in research.md (R10).

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Blocks all user stories.

- [X] T004 Write `supabase/migrations/031_room_lifecycle.sql`: `ALTER TYPE session_state ADD VALUE 'closed'` (this migration only — no literal use here); add `game_sessions.last_activity_at timestamptz NOT NULL DEFAULT now()`; add index `idx_game_sessions_active_last_activity (state, last_activity_at)`; add `AFTER INSERT` trigger on `public.gameplay_events` that sets `game_sessions.last_activity_at = now()` for `NEW.session_id`.
- [X] T005 [P] pgTAP `supabase/tests/database/165_room_lifecycle_schema.test.sql`: assert `'closed'` is a valid `session_state`; assert inserting a `gameplay_events` row bumps the session's `last_activity_at`.
- [X] T006 Add the `RoomRpcClient` interface + `createRoomRpcClient(client)` factory + `getRoomRpcClient()` singleton skeleton to `utils/supabaseClient.ts` (methods filled per story), mirroring `GuestRoomRpcClient`.

**Checkpoint**: Schema + client wiring ready.

---

## Phase 3: User Story 1 — Registered users and guests join a lobby and see it update live (Priority: P1) 🎯 MVP

**Goal**: Signed-in users join as registered members and guests as guests; everyone sees the live roster (host-only join code); one active room at a time (server-enforced) with resume; member/guest leave removes them.

**Independent Test**: Host lobby on one device; a signed-in user on a second joins → appears as registered within ~4s; a not-signed-in user on a third joins → appears as guest; one leaves → disappears for all; the join code shows only on the host's screen.

### DB for US1

- [X] T007 [US1] Write `supabase/migrations/032_room_membership_rpcs.sql`: `private.find_active_room_for(account uuid)`; `public.get_my_active_room()`; `public.get_room_snapshot(session_id uuid)` (guard `private.can_access_session`, return `private.build_guest_room_snapshot`); `public.join_room_as_registered(join_code text)` (idempotent; reject non-joinable; reject `already_in_active_room`); **MODIFY** `public.create_room_as_host()` to add the `already_in_active_room` guard; `public.leave_room_as_member(session_id uuid)` (joinable-guarded); `public.leave_room_as_guest(guest_token text)` (anon+authenticated, token-scoped, joinable-guarded). Apply exact grants per [contracts/room-rpcs.md](contracts/room-rpcs.md).

### Tests for US1

- [X] T008 [P] [US1] pgTAP `supabase/tests/database/170_registered_room_join.test.sql`: registered join success + idempotent; non-joinable rejected; second create/join while already in a room → `already_in_active_room` (`SET CONSTRAINTS ALL IMMEDIATE`).
- [X] T009 [P] [US1] pgTAP `supabase/tests/database/180_room_snapshot_access.test.sql`: owner and member can read snapshot; outsider denied; `find_active_room_for`/`get_my_active_room` return the correct room/role.
- [X] T010 [P] [US1] pgTAP `supabase/tests/database/205_member_and_guest_leave.test.sql`: `leave_room_as_member` and token-scoped `leave_room_as_guest` each remove the row; joinable-guarded; idempotent (`SET CONSTRAINTS ALL IMMEDIATE`).

### Client/hooks for US1

- [X] T011 [US1] Implement `RoomRpcClient` methods `joinRoomAsRegistered`, `getRoomSnapshot`, `getMyActiveRoom`, `leaveRoomAsMember` in `utils/supabaseClient.ts`; add `leaveRoomAsGuest(token)` to `GuestRoomRpcClient`.
- [X] T012 [US1] Create `hooks/useRoomLobby.ts`: poll `getRoomSnapshot` at `LOBBY_POLL_INTERVAL_MS`; expose participants, `myRole`, `state`, host-only `joinCode`; surface `state==='closed'` as room-ended.
- [X] T013 [US1] Create `hooks/useRegisteredRoomJoin.ts`: join by code; on `already_in_active_room` surface the conflicting room so the caller can run the easy-exit.
- [X] T014 [P] [US1] Jest `__tests__/hooks/useRoomLobby.test.ts`: roster updates from polling; join code exposed only to host role; `closed` → room-ended.
- [X] T015 [P] [US1] Jest `__tests__/hooks/useRegisteredRoomJoin.test.ts`: join success; `already_in_active_room` handling.

### UI for US1

- [X] T016 [P] [US1] Create `components/lobby/ParticipantList.tsx` and `components/lobby/RoomEndedNotice.tsx` (Tamagui).
- [X] T017 [US1] Upgrade `app/lobby/[sessionId].tsx`: live roster via `useRoomLobby`, role/membership badges, **host-only** join code, member "Leave", `closed`/expired → home with `RoomEndedNotice`.
- [X] T018 [US1] Update `app/index.tsx`: signed-in "Join Room" (registered) action; "Return to room" card via `getMyActiveRoom`; one-room easy-exit prompt on create/join (member-leave path here; hosted-room path completed in US2/T029).
- [X] T019 [US1] Modify `components/guestJoin/GuestJoinLobby.tsx` (hide join code — Q15) and `hooks/useGuestRoomSession.ts` (poll at `LOBBY_POLL_INTERVAL_MS`; call `leaveRoomAsGuest` on leave; detect `closed`).

### E2E for US1

- [X] T020 [US1] Create `e2e/features/lobby-presence-host-handover.feature` (scenarios: registered join shows as registered; guest shows as guest; a leaver disappears; code host-only) and `e2e/steps/lobby-presence-host-handover.steps.ts`; run `npm run bddgen`.
- [X] T021 [P] [US1] Update the existing guest e2e that asserts the visible `Room ROOM42` code (now hidden for guests) in `e2e/steps/guest-room-join.steps.ts` / its feature.

**Checkpoint**: US1 independently functional — live lobby, registered+guest join, resume, one-room (member case), host-only code.

---

## Phase 4: User Story 2 — Host leaves and another signed-in player inherits the room (Priority: P2)

**Goal**: Host explicitly leaves; auto-transfer to the lone registered member, or chooser when several, or close when none; atomic single-owner.

**Independent Test**: Host + two registered members → host taps Leave → chooser lists only the two members → pick one → that member becomes host, others remain, original host gone (live).

### DB for US2

- [X] T022 [US2] Write `supabase/migrations/033_host_leave.sql`: `public.leave_room_as_host(session_id uuid, successor_participant_id uuid DEFAULT NULL)` — `not_authenticated`/`not_host` checks; eligibility = registered members (role=member, account_id not null); branches auto(1)/`successor_required`(>1)/close(0) and explicit successor with `successor_not_eligible` re-validation; transfer = `UPDATE game_sessions.owner_account_id` (025 trigger demotes→promotes) then `DELETE` old host; write `host_transferred`/`participant_left`/`room_closed` events; joinable-guarded; grants.

### Tests for US2

- [X] T023 [P] [US2] pgTAP `supabase/tests/database/190_host_leave_handover.test.sql`: auto-transfer with 1; `successor_required` with >1; `successor_not_eligible` for stale/guest pick; exactly one owner after transfer; old host removed (`SET CONSTRAINTS ALL IMMEDIATE`).

### Client/hooks for US2

- [X] T024 [US2] Add `leaveRoomAsHost(sessionId, successorParticipantId?)` to `RoomRpcClient` in `utils/supabaseClient.ts` (surface `successor_required`/`successor_not_eligible`).
- [X] T025 [US2] Create `hooks/useRoomExit.ts`: `exitRoom(sessionId)` → member vs host branch; host → `leaveRoomAsHost`; on `successor_required` expose `pendingSuccessorChoice` + `eligibleSuccessors` + `confirmSuccessor(id)`/`cancel`; on `successor_not_eligible`/empty re-call with no successor (server re-decides); collapse-to-0 → confirm-close.
- [X] T026 [P] [US2] Jest `__tests__/hooks/useRoomExit.test.ts`: member exit; host auto-transfer; `successor_required` flow; re-resolution on stale pick; collapse → confirm-close.

### UI for US2

- [X] T027 [P] [US2] Create `components/lobby/SuccessorChooserModal.tsx` (lists registered members only).
- [X] T028 [US2] Wire host "Leave Room" in `app/lobby/[sessionId].tsx` to `useRoomExit` + `SuccessorChooserModal`; reflect becoming-host (role flips on next poll).
- [X] T029 [US2] Complete the one-room easy-exit in `app/index.tsx` for the hosted-current-room case via `useRoomExit` (handover/close before create/join).

### E2E for US2

- [X] T030 [US2] Add handover scenarios (choose among ≥2; auto with exactly 1) to `e2e/features/lobby-presence-host-handover.feature` + steps; rerun `npm run bddgen`.

**Checkpoint**: US1 + US2 functional — handover works and completes the one-room easy-exit.

---

## Phase 5: User Story 3 — Host leaves a guest-only room (Priority: P3)

**Goal**: Host leaves a room with only guests → room `closed`; guests informed and returned home; not recorded as a completed game. (The close branch is built in T022; this story covers the guest-side outcome + coverage.)

**Independent Test**: Host + only guests → host leaves → room unjoinable; each guest sees "room ended" and returns home; no history entry appears.

- [X] T031 [US3] Verify/extend guest-side closure handling in `hooks/useGuestRoomSession.ts` + `components/guestJoin/GuestJoinLobby.tsx`: on `state==='closed'` show `RoomEndedNotice`, clear the grant, return home.
- [X] T032 [P] [US3] pgTAP `supabase/tests/database/200_host_leave_close.test.sql`: host leaves with only guests → `state='closed'`; no `completed` history row created; snapshot reflects `closed` (`SET CONSTRAINTS ALL IMMEDIATE`).
- [X] T033 [US3] Add a guest-only-close scenario (host leaves → guest sees room ended → home) to `e2e/features/lobby-presence-host-handover.feature` + steps; rerun `npm run bddgen`.

**Checkpoint**: US1–US3 functional — full host departure lifecycle.

---

## Phase 6: User Story 4 — Unused rooms expire automatically (Priority: P4)

**Goal**: A `joinable` room idle ≥24h is auto-closed; `in_progress` untouched; recent activity prevents expiry.

**Independent Test**: Set a joinable room's `last_activity_at` >24h ago, run `expire_stale_rooms()` → `closed` + code no longer joins; a room with recent activity stays joinable.

- [X] T034 [US4] Write `supabase/migrations/034_room_expiry.sql`: `private.expire_stale_rooms()` — `UPDATE game_sessions SET state='closed' WHERE state='joinable' AND last_activity_at < now() - interval '24 hours'` + `room_closed` events; schedule via `pg_cron` (~15 min); grant to `service_role`, revoke from anon/authenticated.
- [X] T035 [P] [US4] pgTAP `supabase/tests/database/210_room_expiry.test.sql`: joinable stale → `closed`; `in_progress` untouched; fresh stays joinable; a `gameplay_events` insert resets the window (`SET CONSTRAINTS ALL IMMEDIATE`).

**Checkpoint**: All four stories functional.

---

## Phase 7: Polish & Cross-Cutting

- [X] T036 [P] Run `npm run db:reset && npm run db:test` — all pgTAP green (031–034 schema + 165/170/180/190/200/205/210).
- [X] T037 Run `npm test && npm run lint` — no regressions; new hook/component tests pass.
- [X] T038 [P] Run `npm run test:e2e -- --grep "lobby presence|host handover"` — presence + handover + guest-only-close scenarios pass; existing guest e2e still passes with the code hidden.
- [X] T039 Apply migrations `031–034` to the hosted dev project `qccvlhblytuedgmlqfef` (Supabase MCP `apply_migration`); verify the committed path with `SET CONSTRAINTS ALL IMMEDIATE` in a rolled-back transaction (carryover from 016/030).
- [X] T040 Complete the [quickstart.md](quickstart.md) manual web smoke test: join/presence, one-room + easy-exit, resume card, handover (choose + auto), guest-only close, host-only code, expiry.
- [X] T041 [P] Confirm the `pg_cron` schedule is active on the dev project (or wire the Edge-Function fallback per research R10).

---

## Dependencies & Execution Order

### Phase dependencies
- **Setup (P1)**: immediate.
- **Foundational (P2)**: after Setup — blocks all stories (migration `031` + client skeleton).
- **US1 (P3)**: after Foundational. MVP.
- **US2 (P4)**: after US1 (shares the lobby screen + `useRoomExit` completes the easy-exit started in US1).
- **US3 (P5)**: after US2 (close branch lives in `leave_room_as_host` from T022).
- **US4 (P6)**: after Foundational (independent of US1–US3; needs `031`'s `last_activity_at` + `closed`).
- **Polish (P7)**: after the desired stories.

### Within-story
- DB migration → DB tests + client methods → hooks → UI → e2e.
- `useRoomExit` (T025) depends on `leaveRoomAsHost` (T024) which depends on migration `033` (T022).

---

## Parallel Opportunities

- **Setup**: T001, T002 in parallel (T003 is a check).
- **US1 tests**: T008, T009, T010 in parallel; Jest T014, T015 in parallel; components T016 in parallel with the DB tests.
- **US2**: T023 (pgTAP) ∥ T026 (Jest) ∥ T027 (modal component) once T022/T024/T025 exist.
- **Cross-story (with capacity)**: US4 (T034/T035) can proceed in parallel with US1–US3 since it only needs Foundational.
- **Polish**: T036 ∥ T038 ∥ T041.

### Example — US1 parallel batch
```
T008 pgTAP registered join   |  T009 pgTAP snapshot access  |  T010 pgTAP member/guest leave
T014 Jest useRoomLobby       |  T015 Jest useRegisteredRoomJoin  |  T016 lobby components
```

---

## Implementation Strategy

- **MVP = Setup + Foundational + US1**: a live lobby with registered+guest join, presence, resume, one-room, host-only code. Stop and validate (T036–T038 scoped to US1) before US2.
- **Incremental**: add US2 (handover) → US3 (guest-only close) → US4 (expiry), validating each independently.
- **Backend-first within a story**: land the migration + pgTAP (forcing deferred constraints) before the client, so the contract is proven before UI is built.

## Notes
- All shared-state mutations go through `SECURITY DEFINER` RPCs; the handover/close decision stays in `leave_room_as_host` (no client re-derivation).
- `closed` ≠ `completed`, so history (filters `state='completed'`) ignores closed/expired rooms for free — do not add them to history.
- In-game leave + end-game history are out of scope (GitHub #165 / #138); Start Game is #134. Keep the leave RPCs `joinable`-guarded.
