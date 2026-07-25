# Quickstart: Validating Assignment Mode + Host-Assigned Allocation

**Feature**: `specs/021-host-assigned-mode` | **Issue**: #184

Runnable checks proving this slice works end to end. RPC shapes live in
[`contracts/room-rpcs.md`](contracts/room-rpcs.md); schema/lifecycle detail
lives in [`data-model.md`](data-model.md).

---

## Prerequisites

```bash
npm install
```

Docker must be running for the Supabase stack.

---

## 1. Database layer

```bash
npm run db:reset
npm run db:test
```

Confirms the new migration applies cleanly on top of `036_...` and that
`supabase/tests/database/240_host_assigned_mode.test.sql` passes, including:

- `assignment_mode` defaults to `automatic` on a freshly created room.
- `set_room_assignment_mode` is host-only and `joinable`-only.
- `set_room_assignment_settings`'s minimum-floor guard is skipped in
  `host_assigned` mode (a count below the FR-009 minimum is accepted).
- `start_game_session` in `host_assigned` mode: keeps host allocations, fills
  shortfalls, reports `filledInParticipantIds`, and the Common Match ends up
  held by everyone exactly once even if the host allocated it explicitly.
- `set_room_assignments` (unchanged RPC) still round-trips a host allocation
  correctly when the room is in `host_assigned` mode.

## 2. Manual validation — mode setting

```bash
npx expo start --web
```

1. Sign in as host, create a room, open the lobby.
2. Change the assignment mode to **Host-assigned**. Confirm a second browser
   tab (joined via the room code as a guest) reflects the new mode within one
   snapshot poll (~4s).
3. Allocate a match to a participant, then switch the mode back to
   **Automatic**. Confirm a confirmation prompt appears warning the draft will
   not carry over, and that declining leaves both the mode and the allocation
   untouched.

## 3. Manual validation — host allocation and start

1. With the room in **Host-assigned** mode and the per-player count set to 2,
   allocate 2 matches to participant A and 1 to participant B (leave any
   others unallocated).
2. Confirm the lobby shows B (and any others) as still short.
3. Start the game. Confirm:
   - A's stored set is exactly the 2 matches allocated, plus the Common Match.
   - B's stored set is their 1 allocated match, plus 1 server-filled match,
     plus the Common Match.
   - The host is shown which participants were filled in.
4. Repeat, this time explicitly allocating the Common Match to a participant
   before starting. Confirm no error and the participant ends up holding it
   exactly once.

## 4. Automated coverage

```bash
npm test
npm run lint
npm run bdd:gen
npm run test:e2e
```

The Playwright BDD run extends `e2e/steps/configure-start-game.steps.ts` with
the host-assigned journey (mode switch, allocation, shortfall fill, start).
