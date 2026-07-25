# Quickstart: Validating Canonical Assignment Generation

**Feature**: `specs/020-canonical-assignment-generation` | **Issue**: #135

Runnable checks proving the #135 slice works end to end. Details of the RPC shapes
live in [`contracts/room-rpcs.md`](contracts/room-rpcs.md); the formulas live in
[`data-model.md`](data-model.md).

---

## Prerequisites

```bash
npm install
```

Docker must be running for the Supabase stack. Java service env vars:

```powershell
$env:SUPABASE_JWT_SECRET = "test-secret-which-is-at-least-thirty-two-bytes-long"
$env:SUPABASE_URL        = "http://localhost:9"
```

---

## 1. Database layer

```bash
npm run db:reset
```

```bash
npm run db:test
```

**Expect**: all pgTAP suites pass, including the new
`230_canonical_assignment_generation.test.sql`. Existing suites — especially
`180_room_snapshot_access.test.sql` and `220_configure_start_game_rpcs.test.sql` —
must still pass; the snapshot change is additive and the `unassigned_participants`
assertions in 220 are expected to be replaced, not merely deleted.

Key assertions the new suite must make:

- Every participant holds the Common Match plus exactly the effective per-player count
- Every pair shares exactly `shared_matches_per_pair` additional matches
- At `K = 0`, no two participants share any additional match
- Solo room (P=1) and two-participant room both start successfully
- A pool exactly the required size succeeds; one short is rejected
- Rejection leaves zero assignments and the room still `joinable`
- `relax_constraints := true` starts a short-pooled room with a complete set
- A pool below `1 + N` is rejected even with `relax_constraints := true`
- Repeated generation over the same roster yields at least two distinct arrangements
- Settings writes are rejected for non-hosts and for non-`joinable` rooms
- A registered join attempted against a starting room is serialised, not interleaved

---

## 2. Java command service

```powershell
cd command-api; .\mvnw.cmd clean verify
```

**Expect**: green. `StartGameCommandHandlerTest` should now cover the
`relaxConstraints` passthrough and the new error mappings, and should no longer
assert the five-rule optimistic validation — that logic moved into the RPC.

---

## 3. Client

```bash
npm test
```

```bash
npm run lint
```

**Expect**: green, with `randomizeAssignments` gone from
`hooks/useRoomConfigure.ts` and its test, and new coverage for the settings
controls and the pool-requirement display.

---

## 4. End-to-end journey

Start the web dev server, then:

```bash
npm run test:e2e
```

**Expect**: the extended room-configuration feature passes, covering — host
configures a room, starts it, and a second participant's device shows the same
assignments.

---

## 5. Manual verification

With the stack running and two browser profiles signed in as host and member:

1. **Default is linear.** Create a room, add 3 participants, add 4 matches, set a
   Common Match. The lobby should say the room needs **4** matches
   (`1 + P×N` at the defaults `K=0, N=1`) — not 4 from the quadratic formula by
   coincidence, so also check an 8-participant room reads **9**, not 29.
2. **Start is canonical.** Press Start Game. Both devices should navigate to the
   game dashboard showing identical assignments.
3. **Shortfall warns rather than blocks.** Back in a fresh room, set
   `shared_matches_per_pair = 1` with 5 participants and only 6 matches. The lobby
   should show the requirement (11) and the Start control should present the
   choice to start anyway.
4. **Override completes.** Accept it. The game starts, every participant holds the
   configured count, and overlap is unconstrained.
5. **Hard floor still rejects.** Set the per-player count to 5 with only 3 matches
   in the pool. The override must not be offered and the start must be refused.
6. **Retry is safe.** With the network throttled, press Start Game and let the
   request retry. The room must start once, and the assignment set after the retry
   must equal the set before it.

---

## Rollback notes

*(constitution: releases modifying persisted data or multiplayer flows must
include rollback notes)*

The migration is additive — two `NOT NULL DEFAULT` columns on `game_sessions`,
plus function replacements. To roll back:

- `DROP` the two columns; no other table references them.
- Restore the prior `start_game_session`, `build_guest_room_snapshot`, and
  `join_room_as_registered` bodies from migration 035 / 032 / 026.
- Rooms started under this feature keep their assignments; they are ordinary rows
  in `public.assignments` and remain valid under the previous behaviour, which
  read the same table.
- The client must be rolled back in step with the RPC, since it reads
  `assignmentPlan` from the snapshot. Rolling back the database alone leaves the
  lobby without a pool requirement to display.
