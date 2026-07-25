# Quickstart: Validating Player-Picked Mode

**Feature**: `specs/022-player-picked-mode` | **Issue**: #185

Runnable checks proving this slice works end to end. RPC shapes live in
[`contracts/room-rpcs.md`](contracts/room-rpcs.md); schema, RLS, and lifecycle
detail live in [`data-model.md`](data-model.md).

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
```

```bash
npm run db:test
```

Confirms `038_player_picked_mode.sql` applies cleanly on top of `037_...` and
that `supabase/tests/database/250_player_picked_mode.test.sql` passes. The
assertions that matter most, in rough order of importance:

**The authorisation boundary (the security-sensitive part — FR-038a, FR-039)**
- A registered non-host member can write their **own** picks via
  `set_my_room_picks`, and the row lands against their participant id.
- A **guest**, authenticated only by room-scoped token, can do the same via
  `set_my_room_picks_as_guest`.
- Neither RPC exposes any way to name another participant — asserted by
  signature (no `participant_id` argument) plus a test that member A's call
  leaves member B's picks untouched.
- A stale/blank guest token raises `guest_token_expired`; a signed-in user who
  is not a participant of the room raises `not_a_participant`.
- RLS: `authenticated` can `SELECT` picks only for a room they can access
  (`private.can_access_session`), and has **no** INSERT/UPDATE/DELETE grant —
  direct table writes are refused even for one's own row.

**Cap and release (FR-040)**
- Submitting exactly `matches_per_player` ids succeeds.
- Submitting one more raises `pick_limit_exceeded` and changes nothing.
- Resubmitting a smaller set releases the difference (this is how "release"
  works — there is no separate RPC).
- Resubmitting an **empty** set (or `NULL`) releases everything and **succeeds** —
  it must not raise `pick_limit_exceeded`. This is the `array_length` /
  `COALESCE` trap: `array_length('{}'::uuid[], 1)` is NULL, not 0
  (contracts §1 precondition 7).
- Resubmitting the identical set is an idempotent no-op.

**Pool confinement and the Common Match (FR-039, FR-040a)**
- A match id from another room, or one not in this room's pool, raises
  `match_not_found`.
- The Common Match in the input is **silently stripped**, not rejected, and does
  not count toward the cap.

**Mode and state guards (FR-038)**
- Picking in `automatic` or `host_assigned` mode raises `room_not_player_picked`.
- Picking in an `in_progress` room raises `room_not_joinable`.

**Settlement (FR-041, FR-041a)**
- Every picked match survives into `public.assignments`, and each participant
  reaches `effectivePerPlayer`, with `filledInParticipantIds` naming exactly
  those who needed filling.
- Nobody picking anything → every set is server-filled; indistinguishable from
  an automatic start.
- A participant who **left** after picking: their picks are excluded (leaves are
  soft, so the rows still exist — this is the roster filter, not a cascade) and
  no other participant's set changes.
- A picked match later **promoted** to Common Match: the participant drops one
  short and is filled, ending with the Common Match plus the full count.
- The cap **lowered after picking** (cap 3 → participant picks 3 → host sets cap
  to 2): that participant holds exactly 2 additional matches, same as everyone
  else. Without settlement's per-participant seed bound they would hold 3, since
  the inherited fill loop trims nothing (research.md R16). This is the one
  settlement case with no analogue in #184's suite.

**Cascade (data-model lifecycle)**
- `remove_room_match` on a picked match succeeds — no FK violation — and the
  dependent pick rows are gone.

**Schema guard**
- `010_schema.test.sql` still passes. It asserts hardcoded column lists, and
  #184's CI caught exactly this class of break when `assignment_mode` was added
  (fix commit `be9c830`) — check it in the same task that adds the table.

## 2. Manual validation — registered participants

```bash
npx expo start --web
```

1. Sign in as host, create a room, add ≥ 4 matches, designate a Common Match,
   set **matches per player = 2**.
2. Switch the assignment mode to **Player-picked** (this option is newly
   offered — #184 shipped the selector with it withheld).
3. In a second browser tab, join the room by code as a registered member.
4. On the member's device: pick 2 matches. Confirm the Common Match is **not**
   offered as pickable, and that attempting a 3rd pick is refused until one is
   released.
5. On the **host's** device: pick 1 match for yourself. The host is a
   participant too and picks from the same control.
6. Confirm each device shows both participants' progress (host 1/2, member 2/2)
   within one poll — ~4s for the lobby, ~1s for a guest.
7. Start the game. Confirm the member holds exactly their 2 picked matches plus
   the Common Match, and the host holds their 1 picked match plus 1 server-filled
   match plus the Common Match.

## 3. Manual validation — a guest picking on their own device

This is the surface this issue newly builds: before #185 a guest's room view was
a read-only summary card (research.md R10).

1. With a room in **Player-picked** mode, join from a third tab via
   **Join Room as Guest**.
2. Confirm the guest's view now shows the room's match pool and a pick control,
   plus every participant's progress.
3. Pick up to the cap; confirm the one past it is refused and that releasing one
   frees a slot.
4. Confirm the host's lobby reflects the guest's progress within a poll.
5. Have the guest leave, then start the game. Confirm the guest's picks do not
   affect anyone else's set (FR-041a).

## 4. Automated coverage

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run bdd:gen && npm run test:e2e
```

The Playwright BDD run extends two features, following the suite's existing
single-context mock pattern — there are no multi-context helpers despite the
issue's note, so other actors are simulated via shared mock state
(research.md R12):

- `e2e/features/configure-start-game.feature` — host switches to player-picked,
  picks their own matches, sees a second participant's progress, starts, and the
  settled set reflects the picks.
- `e2e/features/guest-room-join.feature` — a guest sees the pool, picks to the
  cap, is refused the one past it, and releases one.

## 5. Java service regression check

```bash
cd command-api && ./mvnw.cmd clean verify
```

Expected: no source change needed (research.md R13). This confirms
`start_game_session`'s unchanged signature and error vocabulary leave
`StartGameCommandHandler` unaffected.
