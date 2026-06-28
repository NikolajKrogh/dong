# Data Model: Live Lobby Presence & Host Handover

**Feature**: 017-lobby-presence-host-handover · **Date**: 2026-06-21

No new tables. One enum value, one column, one index, one trigger, and a set of RPCs.

---

## Schema changes

### `session_state` enum

Add a terminal value distinct from `completed`:

| Value | Meaning |
|-------|---------|
| `joinable` | (existing) accepting joins |
| `in_progress` | (existing) game running |
| `completed` | (existing) game finished — appears in history |
| **`closed`** | **(new)** room ended without completing a game (host left with no successor, or expired). Never appears in history. |

- Added in migration `031` **only** (no literal use in `031`). Referenced (`'closed'::session_state`) starting in `032`. (See research R3.)
- `chk_game_sessions_completed_state` (`completed_at IS NULL OR state='completed'`) still holds: closed rooms keep `completed_at = NULL`.

### `public.game_sessions` — new column

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `last_activity_at` | `timestamptz` | `now()` (NOT NULL) | Updated on every room activity; drives 24h expiry. |

- Index: `idx_game_sessions_active_last_activity ON game_sessions (state, last_activity_at)` to support the expiry sweep.

### Activity-bump trigger

`AFTER INSERT ON public.gameplay_events` → set `game_sessions.last_activity_at = now()` for `NEW.session_id`. Every join/leave/handover/gameplay action writes a `gameplay_events` row, so this single trigger captures all activity (FR-023).

---

## Entities (logical)

### Room (`game_sessions`)
- One **owner** (`owner_account_id`, NOT NULL, registered account).
- Lifecycle: `joinable → in_progress → completed`, plus terminal `closed` reachable from `joinable`/`in_progress`.
- `last_activity_at` for inactivity expiry.

### Participant (`participants`)
- Belongs to a session. `membership_type ∈ {registered, guest}`, `session_role ∈ {owner, member}`.
- **Registered member**: `account_id = <account>`, `membership_type='registered'`, `session_role='member'`. Inheritance-eligible.
- **Guest**: `account_id NULL`, `membership_type='guest'`, token-hash identity. Never inheritance-eligible (`chk_participants_owner_role_consistency`).
- **Owner**: exactly one per session (`ux_participants_session_owner_role`), must be registered.

### Membership / ownership event (`gameplay_events`)
- Auditable records: `participant_joined`, `participant_left`, `host_transferred`, `room_closed` (event types/payloads finalized in implementation), via existing `allocate_event_sequence`.

---

## Room lifecycle state machine (this feature)

```
                 join (registered/guest)
                 ┌───────────────┐
                 ▼               │
[created] ──> joinable ──────────┘
                 │  │
                 │  ├── host leaves, ≥1 registered member ──> joinable (new owner)   (US2)
                 │  ├── host leaves, 0 registered members  ──> closed                (US3)
                 │  └── no activity 24h                     ──> closed                (US4)
                 │
                 └── (future: host starts game) ──> in_progress ──> completed
                                                        └── no activity 24h ──> closed (US4)
```

`closed` is terminal: not joinable, never written to history (history filters `state='completed'`).

---

## RPCs (contracts in `contracts/`)

All `SECURITY DEFINER`, `SET search_path = ''`, fully schema-qualified. Public wrappers grant `EXECUTE` to the noted roles only.

| RPC | Roles | Purpose | Key errors |
|-----|-------|---------|-----------|
| `private.find_active_room_for(account uuid) → uuid` | (internal) | Returns the caller's single active room id (owner or member; `state NOT IN ('completed','closed')`) or null. Backs the one-room guard + resume. | — |
| `public.get_my_active_room() → jsonb` | `authenticated` | Returns the caller's active room summary (id, joinCode if host, role) or null — powers the "Return to room" home card. | `not_authenticated` |
| `public.join_room_as_registered(join_code text)` | `authenticated` | Signed-in user joins joinable room as registered member; idempotent; returns snapshot. Rejects if already in another active room. | `not_authenticated`, `room_not_found`, `room_not_joinable`, `already_in_active_room` |
| `public.create_room_as_host()` **(MODIFY 029)** | `authenticated` | Existing create, **plus** reject when caller is already in another active room (so create honors the one-room rule). | `not_authenticated`, `create_room_code_exhausted`, `already_in_active_room` |
| `public.get_room_snapshot(session_id uuid)` | `authenticated` | Owner/member reads room snapshot (reuses `build_guest_room_snapshot`; guarded by `can_access_session`). | `not_authenticated`, `forbidden` |
| `public.leave_room_as_member(session_id uuid)` | `authenticated` | Registered member leaves a **joinable** room; removes their participant row; idempotent. | `not_authenticated`, `use_leave_room_as_host` |
| `public.leave_room_as_guest(guest_token text)` | `anon`, `authenticated` | Token-scoped guest leave: removes the guest's own participant row from a **joinable** room. | — (no-op if not found) |
| `public.leave_room_as_host(session_id uuid, successor_participant_id uuid DEFAULT NULL)` | `authenticated` | Host leaves a **joinable** room: auto-transfer (1), choose (`successor_required` when >1 and none given), or close (0). Atomic. | `not_authenticated`, `not_host`, `successor_required`, `successor_not_eligible` |
| `private.expire_stale_rooms() → integer` | `service_role` / cron | Close **joinable** rooms idle ≥24h. | — |

All leave/handover RPCs are guarded to `state = 'joinable'` (lobby phase). In-progress leave is out of scope (GitHub #165).

### `leave_room_as_host` algorithm
1. `auth.uid()` not null → else `not_authenticated`.
2. Caller owns `session_id` (`owner_account_id = auth.uid()`) → else `not_host`.
3. `eligible := registered members in session, role=member, account_id not null` (exclude host).
4. If `successor_participant_id` given: must be in `eligible` (re-validate now) → else `successor_not_eligible`; **transfer**.
5. Else by `count(eligible)`: `0` → **close**; `1` → **transfer** to that member; `>1` → `RAISE 'successor_required'`.
6. **transfer**: `UPDATE game_sessions SET owner_account_id = <successor account>` (025 trigger demotes old owner→member, promotes successor→owner) → `DELETE` old host participant → write `host_transferred` + `participant_left` events.
7. **close**: `UPDATE game_sessions SET state='closed'` → write `room_closed` event. (Remaining guests detect `closed` on next poll.)

### `expire_stale_rooms` algorithm
`UPDATE game_sessions SET state='closed' WHERE state = 'joinable' AND last_activity_at < now() - interval '24 hours'` → write `room_closed` events for affected rooms. Scheduled via `pg_cron` (~15 min). **Joinable-only** — `in_progress` games are intentionally excluded (auto-closing a live game would destroy it; their idle policy belongs to the gameplay story, GitHub #134/#165).

### One-active-room guard
`join_room_as_registered` and the modified `create_room_as_host` both call `private.find_active_room_for(auth.uid())`; if it returns a room id other than the one being acted on, they `RAISE 'already_in_active_room'`. The client catches this and runs the easy-exit flow (member/host leave on the current room) before retrying.

---

## Access control (RLS)

- Existing `017`/`025` policies use `private.can_access_session` (owner OR participant with `account_id = auth.uid()`). A registered member satisfies this automatically → **no new SELECT policy needed**.
- All writes flow through `SECURITY DEFINER` RPCs (bypass RLS as owner); no new INSERT/UPDATE/DELETE policies for clients.
- Grant boundary mirrors prior features: public wrappers `GRANT EXECUTE` to `authenticated` (member/host RPCs) or `service_role` (expiry); `REVOKE` from `anon`/`PUBLIC`. The one exception is `leave_room_as_guest`, which is `anon`+`authenticated` and token-scoped — matching the existing guest RPCs (`join_room_as_guest`, `get_guest_room_snapshot`); it can only ever remove the row matching the supplied token, so there is no cross-participant vector.

---

## Client types (`types/room.ts`)

- `RoomSnapshot` — reuse the guest snapshot shape (`sessionId`, `joinCode`, `state`, `commonMatchId`, `participants[]`, ...). `participants[]` items expose `id`, `displayName`, `membershipType`, `sessionRole`, `currentDrinkTotal`.
- `RoomParticipant`, `RoomState` (`'joinable' | 'in_progress' | 'completed' | 'closed'`).
- Response types for join/leave/handover (snapshot + status discriminant, e.g. `'transferred' | 'closed' | 'successor_required'`).
