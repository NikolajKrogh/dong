# RPC Contracts: Live Lobby Presence & Host Handover

All RPCs are PL/pgSQL/SQL `SECURITY DEFINER`, `SET search_path = ''`, fully schema-qualified, with a thin `public` wrapper delegating to a `private` function. Grants are exact (no `anon`/`PUBLIC` unless stated). Response payloads are `jsonb`.

---

## `public.join_room_as_registered(join_code text) → jsonb`

- **Caller**: `authenticated` only (`GRANT EXECUTE TO authenticated`; `REVOKE` from `anon`, `PUBLIC`).
- **Preconditions**: `auth.uid()` is not null; an account row exists for the user; room with `join_code` exists and `state='joinable'`.
- **Behavior**: Inserts a participant (`account_id=auth.uid()`, `membership_type='registered'`, `session_role='member'`, `display_name=accounts.preferred_display_name`); idempotent — if the caller is already a participant of that room, returns the existing participant. Writes a `participant_joined` event on first join.
- **Response**:
  ```json
  {
    "participantId": "uuid",
    "sessionId": "uuid",
    "joinCode": "512971",
    "displayName": "Krogh",
    "membershipType": "registered",
    "sessionRole": "member",
    "snapshot": { "...": "RoomSnapshot (same shape as guest snapshot, includes state)" }
  }
  ```
- **Errors** (`RAISE EXCEPTION`): `not_authenticated`, `room_not_found`, `room_not_joinable`, `already_in_active_room` (caller is already in a different active room — client runs the easy-exit flow then retries).

## `public.create_room_as_host()` → jsonb — MODIFY existing (029)

- **Caller**: `authenticated` only (unchanged).
- **Change**: in addition to its existing behavior, reject when the caller is already in a *different* active room (one-active-room rule), via `private.find_active_room_for`.
- **Errors**: existing `not_authenticated`, `create_room_code_exhausted`, plus **`already_in_active_room`**.

## `private.find_active_room_for(account uuid) → uuid` / `public.get_my_active_room() → jsonb`

- `find_active_room_for` (internal): returns the account's single active room id — owner OR registered member, `state NOT IN ('completed','closed')` — or null. Shared by the create/join guard and resume.
- `get_my_active_room` (`authenticated`): returns `{ "sessionId": "uuid", "role": "owner"|"member", "joinCode": "512971"|null }` (joinCode only when caller is host) or `null`. Powers the "Return to room" home card.

## `public.leave_room_as_guest(guest_token text) → jsonb`

- **Caller**: `anon` + `authenticated` (token-scoped, matching the existing guest RPCs).
- **Behavior**: removes the guest participant whose token-hash matches, from a `joinable` room; writes `participant_left`; no-op if not found. Can only ever remove the row matching the supplied token.
- **Response**: `{ "status": "left" }`.

## `public.get_room_snapshot(session_id uuid) → jsonb`

- **Caller**: `authenticated` only.
- **Preconditions**: `private.can_access_session(session_id)` true (caller is owner or a participant).
- **Behavior**: Returns `private.build_guest_room_snapshot(session_id)` (participants with `displayName`, `membershipType`, `sessionRole`, `currentDrinkTotal`; plus `state`, `joinCode`, `commonMatchId`).
- **Errors**: `not_authenticated`, `forbidden`.

## `public.leave_room_as_member(session_id uuid) → jsonb`

- **Caller**: `authenticated` only.
- **Behavior**: Removes the caller's registered-member participant row from the session; idempotent (no-op if not a member). Writes a `participant_left` event. MUST NOT be usable to remove the owner (the host uses `leave_room_as_host`).
- **Response**: `{ "sessionId": "uuid", "status": "left" }`.
- **Errors**: `not_authenticated`. (If caller is the host → `use_leave_room_as_host`.)

## `public.leave_room_as_host(session_id uuid, successor_participant_id uuid DEFAULT NULL) → jsonb`

- **Caller**: `authenticated` only.
- **Preconditions**: caller is the room owner.
- **Behavior**: See data-model.md algorithm. Decides transfer (auto when exactly 1 eligible registered member, or to the given `successor_participant_id`), `successor_required` (when >1 eligible and none given), or close (0 eligible). Atomic; exactly one owner before and after. Re-validates the successor at call time. Writes `host_transferred` + `participant_left`, or `room_closed`.
- **Response (transferred)**:
  ```json
  { "status": "transferred", "sessionId": "uuid", "newHostParticipantId": "uuid", "newHostDisplayName": "Sam", "snapshot": { "...": "RoomSnapshot" } }
  ```
- **Response (closed)**:
  ```json
  { "status": "closed", "sessionId": "uuid" }
  ```
- **Errors**: `not_authenticated`, `not_host`, `successor_required` (client must prompt and re-call with an id), `successor_not_eligible` (chosen id is not a current registered member).

## `private.expire_stale_rooms() → integer`

- **Caller**: `service_role` / scheduled (`pg_cron`); not granted to `anon`/`authenticated`.
- **Behavior**: Sets `state='closed'` for rooms with `state IN ('joinable','in_progress')` and `last_activity_at < now() - interval '24 hours'`; writes a `room_closed` event per affected room. Returns count closed.
- **Schedule**: `pg_cron` every ~15 minutes (fallback: scheduled Edge Function invoking it).

---

## Client protocol notes

- **Host leave**: call `leave_room_as_host(sessionId)` with no successor. On `successor_required`, show the chooser (registered members from the live snapshot), then re-call with `successor_participant_id`. On `successor_not_eligible` or an empty list, re-call **with no successor** and let the RPC re-decide (0 → close, 1 → auto, >1 → re-prompt); when the list collapses to 0, confirm "everyone left — close the room?" before closing.
- **One active room**: on `already_in_active_room` from create/join, run the easy-exit flow on the current room (member-leave, or host-leave handover/close via the shared `useRoomExit`), then retry the original create/join.
- **Closed/expired detection**: any poll returning `state='closed'` (host/member via `get_room_snapshot`, guest via the guest snapshot) → show "room ended" and return the user home / clear local session.
- **Becoming host**: after handover, the successor's next poll (~4 s) shows them with `sessionRole='owner'` → lobby switches to host controls. (No push channel under polling.)
- **Join code visibility**: the numeric join code is rendered to the host only; members/guests get the roster without it (the snapshot still contains `joinCode`, but non-host UIs MUST NOT display it).
- **Polling cadence**: one shared `LOBBY_POLL_INTERVAL_MS = 4000` for host, member, and guest lobbies.
