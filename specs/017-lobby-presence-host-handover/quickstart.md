# Quickstart: Live Lobby Presence & Host Handover

**Feature**: 017-lobby-presence-host-handover · **Date**: 2026-06-21

How to validate the feature end-to-end once implemented. Contracts: [contracts/room-rpcs.md](contracts/room-rpcs.md) · [contracts/RoomRpcClient.ts](contracts/RoomRpcClient.ts). Schema: [data-model.md](data-model.md).

---

## Prerequisites

1. Docker running; local Supabase stack: `npm run db:start`
2. Migrations applied: `npm run db:reset` (includes `031`–`033`)
3. `pg_cron` available locally (verify: `select * from pg_extension where extname='pg_cron'`; enable if needed). Expiry can also be invoked directly in tests.
4. At least two registered accounts (sign up via the auth flow) plus a non-signed-in browser for the guest.
5. Expo web: `npx expo start --web`

---

## Database layer (pgTAP)

```bash
npm run db:test
```

Expected — all new files pass, **each forcing deferred constraints** (`SET CONSTRAINTS ALL IMMEDIATE`) so the committed path is exercised:

- `170_registered_room_join` — signed-in join creates a registered member; joining a non-joinable room is rejected; re-join is idempotent; joining/creating a second room while in one raises `already_in_active_room`.
- `180_room_snapshot_access` — owner and members can read the snapshot; a non-member cannot; `find_active_room_for` / `get_my_active_room` return the right room.
- `190_host_leave_handover` — exactly one eligible member → auto-transfer; >1 with no successor → `successor_required`; a guest is never eligible; after transfer there is exactly one owner and the old host is gone.
- `200_host_leave_close` — host leaves with only guests → room `closed`; no `completed` history row is created.
- `205_member_and_guest_leave` — registered member leave and token-scoped guest leave each remove the participant row (joinable-guarded).
- `210_room_expiry` — a **joinable** room idle ≥24h becomes `closed`; an `in_progress` room is untouched; a room with recent activity stays `joinable`; inserting a gameplay event bumps `last_activity_at`.

## Hook / logic layer (Jest)

```bash
npm test -- --testPathPattern="useRoomLobby|useRegisteredRoomJoin"
```

Expected: lobby poll updates the roster; `successor_required` surfaces `needsSuccessorChoice` + `eligibleSuccessors`; becoming owner after handover flips the view to host controls; `closed` state surfaces "room ended".

## Full flow (Playwright BDD)

```bash
npm run test:e2e -- --grep "lobby presence|host handover"
```

Expected scenarios in `lobby-presence-host-handover.feature`:
1. Host sees a signed-in user appear as a **registered** member and a guest appear as a **guest**, live.
2. A participant leaving disappears from the host roster.
3. Host with two registered members taps Leave → chooser lists only the two registered members → pick one → that member becomes host; others remain.
4. Host with only guests leaves → guests see "room ended" and return home.

---

## Manual smoke test (web)

1. **Sign in** as Host A → **Create Room** → note the join code on the lobby.
2. On a second browser **signed in** as User B → **Join Room** → enter the code. Within ~5s, B appears in A's lobby as **registered**; A appears in B's lobby; B's lobby shows the live roster.
3. On a third browser **not signed in** → **Join Room as Guest** → code. Guest appears in both lobbies labelled **guest**.
4. **Presence**: have the guest leave → they disappear from A's and B's rosters within ~5s.
5. **Handover (choose)**: sign in a User C and have them Join as registered (now A + B + C registered, maybe a guest). Host A taps **Leave Room** → a chooser lists **B and C only** (no guests) → pick B. B's lobby now shows **owner**; C and any guests remain; A is gone — all reflected live.
6. **Handover (auto)**: in a room with the host + exactly one registered member, host taps Leave → no chooser; the lone registered member becomes host automatically.
7. **Close (guests only)**: in a room with host + only guests, host taps Leave → each guest sees a "room ended" message and returns home; the code no longer joins.
8. **Disconnect resilience**: as host, briefly drop connectivity (offline toggle) and return → you remain host and the lobby restores; ownership did not move.
9. **Expiry**: (test/dev) set a joinable room's `last_activity_at` to >24h ago and run `expire_stale_rooms()` → the room becomes `closed` and its code no longer joins.
10. **One active room**: while in a room, try Create or Join another → you're prompted to leave the current one (host → handover/close; member → leave), then proceed. You're never in two at once.
11. **Resume**: with an active room, reopen the app → a "Return to room" card appears on home and takes you back to the lobby.
12. **Host-only code**: confirm the numeric join code shows on the host's lobby but NOT on a registered member's or guest's lobby.

---

## Validation checklist (maps to Success Criteria)

- [ ] Join/leave reflected on other devices within ~5s without refresh (SC-001)
- [ ] Signed-in joiner shown as registered, never guest/host (SC-010)
- [ ] Auto-transfer with 1 member; never 0/2 owners (SC-002, SC-007)
- [ ] Chosen successor always gets it with >1 (SC-003)
- [ ] Guest-only room closes; guests returned home (SC-004)
- [ ] Closed/expired rooms create no history entry (SC-005)
- [ ] Guest never host/selectable (SC-006)
- [ ] Disconnected host resumes role (SC-008)
- [ ] 24h-idle **joinable** rooms expire; active rooms don't; `in_progress` untouched (SC-009)
- [ ] Signed-in user never in two active rooms; create/join blocked server-side + easy-exit (SC-011)
- [ ] Join code visible to host only (SC-012)
- [ ] Member/guest leave removes the participant from everyone's roster (FR-003)
- [ ] "Return to room" home card appears for an active room and is gone after close/expire (FR-0A6)
