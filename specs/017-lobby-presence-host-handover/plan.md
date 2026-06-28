# Implementation Plan: Live Lobby Presence & Host Handover

**Branch**: `136-us52-allow-registered-users-and-guests-to-join-a-lobby-and-see-presence` | **Date**: 2026-06-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/017-lobby-presence-host-handover/spec.md`

## Summary

Make the room lobby a live, shared waiting room and give rooms a complete ownership lifecycle:

1. **Registered + guest join with live presence (US1)** — signed-in users can join a room as registered members (new capability; only guest-join existed before); the host and every member see the roster update within a few seconds. The host lobby reuses the existing guest-lobby **snapshot polling** pattern (no new realtime subscription layer).
2. **Host departure with ownership handover (US2)** — the host can explicitly leave; if exactly one registered member remains the room is auto-transferred to them, if several the host chooses, and the room stays alive. The server decides auto-vs-choose (raises `successor_required`) so it never trusts a stale client snapshot.
3. **Room closure fallback (US3)** — if no registered member remains, the room is closed (new terminal `closed` state) and remaining guests are returned home with a "room ended" message.
4. **Inactivity expiry (US4)** — a scheduled job closes any **joinable** room with no activity for 24h, bounding the stale rooms that the deliberate "never auto-transfer" policy allows. (In-progress rooms are out of scope for expiry.)
5. **One active room + resume (US1)** — a signed-in user is in at most one active room at a time, enforced server-side on create AND join (`already_in_active_room`); the client offers an easy exit (reusing host/member leave) instead of a dead-end error. A shared `find_active_room_for` lookup also powers a "Return to room" home card. The join code is shown to the host only.

Technical spine: a small set of `SECURITY DEFINER` Postgres RPCs (reusing `private.build_guest_room_snapshot` and the `025` `sync_session_owner_participant` trigger), one new `closed` state, a `last_activity_at` column bumped by a `gameplay_events` trigger, and `pg_cron` for expiry. Ownership transfer leans entirely on the existing owner-sync trigger (demote old → promote new) plus the `030`-fixed deferred assert trigger.

### Key design decisions (from design review / grilling)

- **Polling, no presence dots**: one shared lobby poll interval of **~4 s** for host, member, AND guest lobbies (replaces the guest 1 s cadence). No online/away indicator (FR-021). Tail caveat: worst-case "time to notice" ≈ 4 s + round-trip, which can brush SC-001's 5 s at the 95th percentile; revisit interval or relax SC-001 to ~6 s if observed.
- **Handover de-risked**: confirmed from source that the `025` `sync_session_owner_participant` trigger **demotes the old owner before promoting** the new one, so `UPDATE owner_account_id → DELETE old host` never violates the single-owner unique index.
- **One active room is server-enforced** on create and join via a shared `private.find_active_room_for(account)` helper (also backs the "Return to room" home card). This **modifies the existing `029` `create_room_as_host`** to reject when already in another active room.
- **Lobby-phase only**: leave/handover/closure are guarded to `state='joinable'`; in-game leave + end-game history are out of scope (GitHub #165 / #138); Start Game stays in #134.
- **Join code is host-only**: this **changes the existing guest lobby** (`components/guestJoin/GuestJoinLobby.tsx` currently renders `Room {code}`) and its e2e assertion — non-hosts see the roster without the code.

## Technical Context

**Language/Version**: TypeScript (strict) on Expo SDK 52 / React Native 0.76 / React 18; PL/pgSQL on Postgres 15 (Supabase).

**Primary Dependencies**: Expo Router v4, Tamagui, Zustand, `@supabase/supabase-js` v2; Supabase Postgres + RLS + RPC + `pg_cron`; Playwright + playwright-bdd; Jest + react-test-renderer; pgTAP.

**Storage**: Supabase Postgres (`game_sessions`, `participants`, `gameplay_events`, `accounts`). No new tables; one new column (`game_sessions.last_activity_at`), one new enum value (`session_state.'closed'`).

**Testing**: pgTAP for DB logic (with `SET CONSTRAINTS ALL IMMEDIATE` to exercise deferred triggers — see Constitution Check); Jest for hooks/decision logic; Playwright BDD for the primary journeys on web.

**Target Platform**: Expo native (iOS/Android) + web; all four stories must behave on both.

**Project Type**: Mobile + web client over Supabase backend (no Java involvement — match discovery proxy is unrelated).

**Performance Goals**: Roster changes visible to other participants within ~5 s (SC-001). Unify all lobby polling on a single shared **~4 s** interval (replacing the guest 1 s cadence) to cut free-tier load while staying within SC-001; expiry job runs every ~15 min.

**Constraints**: Single registered owner per room enforced by `ux_participants_session_owner_role` + `chk_participants_owner_role_consistency` + the deferred `assert_session_owner_participant` trigger; ownership changes must stay atomic (never 0 or 2 owners). Guests remain anon, token-scoped, single-device.

**Scale/Scope**: Small rooms (handful to dozens of participants); free-tier Supabase.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Cross-Platform First** | Presence, join, leave/handover, and "room ended" are defined for native + web; all UI uses existing Tamagui shell components and platform adapters. No platform exclusions. **PASS** |
| **II. Server-Authoritative Shared State** | Every shared-state change (join, leave, handover, close, expiry) goes through a `SECURITY DEFINER` RPC or scheduled DB function — no client-side authority. Idempotency: join returns the existing participant on replay; leave is a no-op if already gone. Conflict handling: handover re-validates the successor and raises `successor_required` rather than trusting the client; owner change is atomic in one transaction. **PASS** |
| **III. Event-Backed Game History** | Joins, leaves, handovers, and closures are written as `gameplay_events` (auditable). `closed` is distinct from `completed`, and all history read models filter `state = 'completed'`, so closed/expired rooms never appear as played games (satisfies FR-018/FR-025 with no extra work — **do not** add closed rooms to history). Schema change ships with migration + index + RLS review. **PASS** |
| **IV. Supabase-First, Custom Backend by Exception** | Entirely Supabase: Postgres, RPC, RLS, and `pg_cron`. No Java, no duplicate CRUD. Live updates use existing RPC **polling** rather than Realtime — a deliberate consistency/risk decision documented in research.md (polling already powers the guest lobby; Realtime is noted as a future optimization). **PASS** |
| **V. Story-First Delivery With Required Coverage** | Four independently-testable stories with Gherkin acceptance + edge cases. Coverage: pgTAP for every RPC and the expiry job (forcing deferred constraints), Jest for hooks/decision logic, and Playwright e2e for live-presence and host-handover journeys on web. **PASS** |
| **VI. Skill-First AI Execution** | Planning ran under the Spec Kit skills and the advisor review; no other domain skill applies. **PASS** |
| **Product constraints** | Room creation still requires an authenticated host (unchanged). Guests stay session-scoped, single-device. The new registered-join path is authenticated-only and reuses the existing `can_access_session` RLS (a registered member has `account_id = auth.uid()`, so existing SELECT policies already cover them). Schema change ships with migration, index, and RLS review. **PASS** |

**Result**: PASS (no violations). Complexity Tracking not required.

**Highest gate-risk item** (called out for review): the new **registered-join** auth/multiplayer path. Mitigation: it is an authenticated `SECURITY DEFINER` RPC; reads remain governed by the existing `can_access_session` policy; no new table or broad grant is introduced.

## Project Structure

### Documentation (this feature)

```text
specs/017-lobby-presence-host-handover/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (polling vs realtime, enum-add ordering, handover mechanics, expiry scheduler)
├── data-model.md        # Phase 1 — schema delta, RPC signatures, entities, state machine
├── quickstart.md        # Phase 1 — runnable validation guide
├── contracts/           # Phase 1 — RPC + TS client contracts
└── tasks.md             # Phase 2 — created by /speckit-tasks (NOT here)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   ├── 031_room_lifecycle.sql          # ADD enum value 'closed' (own migration); add game_sessions.last_activity_at + (state,last_activity_at) index; bump-on-event trigger on gameplay_events
│   ├── 032_room_membership_rpcs.sql     # find_active_room_for + get_my_active_room; join_room_as_registered & MODIFY create_room_as_host (already_in_active_room guard); get_room_snapshot; leave_room_as_member; leave_room_as_guest (token); leave_room_as_host (handover/close); all guarded to state='joinable'
│   └── 033_room_expiry.sql              # expire_stale_rooms() (joinable-only) + pg_cron schedule
└── tests/database/
    ├── 170_registered_room_join.test.sql      # join success/idempotent/not-joinable; already_in_active_room on second room
    ├── 180_room_snapshot_access.test.sql       # owner/member yes, outsider no; find_active_room_for/get_my_active_room
    ├── 190_host_leave_handover.test.sql        # auto-1, successor_required>1, guest-ineligible, atomic single-owner, host removed (SET CONSTRAINTS ALL IMMEDIATE)
    ├── 200_host_leave_close.test.sql           # 0 registered → closed; not recorded as completed
    ├── 205_member_and_guest_leave.test.sql     # member/guest leave removes the row (joinable-guarded)
    └── 210_room_expiry.test.sql                # joinable stale → closed; in_progress untouched; fresh not; activity bump

types/
└── room.ts                              # RoomSnapshot, RoomParticipant, RegisteredJoin/Leave/Handover response types (shared by host + member views)

utils/
└── supabaseClient.ts                    # + RoomRpcClient: joinRoomAsRegistered, getRoomSnapshot, getMyActiveRoom, leaveRoomAsMember, leaveRoomAsHost(successorId?); shared LOBBY_POLL_INTERVAL_MS = 4000; extend guest client with leaveRoomAsGuest(token)

hooks/
├── useRoomLobby.ts                      # authenticated host/member: poll get_room_snapshot (~4s), expose participants/role/state, host-only join code
├── useRoomExit.ts                       # SINGLE exit unit: exitRoom(sessionId) → member-leave or host-leave; on successor_required exposes pendingSuccessorChoice + eligibleSuccessors + confirmSuccessor/cancel; collapse-to-0 → confirm-close. Used by lobby AND join/create guard
├── useRegisteredRoomJoin.ts            # signed-in join via code; on already_in_active_room drives useRoomExit then retries
└── useGuestRoomSession.ts              # (extend) poll at shared 4s; detect state='closed' → "room ended" + clear grant; call leaveRoomAsGuest on leave; hide join code (host-only)

app/
├── index.tsx                           # signed-in: "Join Room" (registered) + "Return to room" card (via getMyActiveRoom); one-room easy-exit on create/join; not signed-in: unchanged guest join
└── lobby/[sessionId].tsx               # upgrade: live roster, role badges, host-only join code, host "Leave Room" (+ SuccessorChooserModal), member "Leave", closed/expired → home with message, reflect becoming-host after handover

components/
├── lobby/                              # ParticipantList, SuccessorChooserModal, RoomEndedNotice (Tamagui)
└── guestJoin/GuestJoinLobby.tsx        # (modify) remove the visible join code for guests (Q15 host-only) — also update its e2e assertion

e2e/
├── features/lobby-presence-host-handover.feature
└── steps/lobby-presence-host-handover.steps.ts
```

**Structure Decision**: Existing Expo-client-over-Supabase monorepo layout (no new top-level areas). Backend logic lives in numbered SQL migrations + pgTAP; client logic in `hooks/` + `app/lobby/` + `components/lobby/`, mirroring the established guest-room and host-room features.

## Complexity Tracking

No constitution violations — section intentionally empty.
