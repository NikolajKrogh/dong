# Data Model: Player-Picked Assignment Mode

**Scope**: the #185 slice. One new table, one additive snapshot key, two new
RPC pairs, one changed generation branch. No existing column, constraint, or
RPC signature changes.

---

## `public.assignment_picks` (new table)

A participant's own pre-start intention in `player_picked` mode. Distinct from
`public.assignments`, which holds the **settled** set (research.md R1).

| Column | Type | Notes |
|---|---|---|
| `session_id` | `uuid NOT NULL` | Part of PK and both composite FKs |
| `participant_id` | `uuid NOT NULL` | Whose pick this is — derived server-side from the caller's credential, never from a client parameter (FR-038a) |
| `match_id` | `uuid NOT NULL` | Must be in the room's pool; never the Common Match (FR-040a) |
| `created_at` | `timestamptz DEFAULT now()` | Matches `public.assignments` |

- **PK**: `(session_id, participant_id, match_id)` — makes a duplicate pick
  impossible by construction.
- **FK** `(session_id, participant_id) → public.participants(session_id, id)
  ON DELETE CASCADE`
- **FK** `(session_id, match_id) → public.matches(session_id, id)
  ON DELETE CASCADE` — **load-bearing**: `private.remove_room_match` hard-deletes
  the match row (research.md R5).
- **Indexes**: `session_id`, `participant_id`, `match_id` — mirroring
  `007_create_assignments.sql`.

**Shape rationale**: deliberately identical to `public.assignments` so the
settlement seed is a plain `INSERT ... SELECT` with no shape translation.

### Grants and RLS (research.md R4)

```
REVOKE ALL      ON TABLE public.assignment_picks FROM anon, authenticated;
GRANT  SELECT   ON TABLE public.assignment_picks TO authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON TABLE public.assignment_picks TO service_role;
ALTER  TABLE public.assignment_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY assignment_picks_room_members_select ON public.assignment_picks
  FOR SELECT TO authenticated
  USING (private.can_access_session(public.assignment_picks.session_id));
```

No INSERT/UPDATE/DELETE policy for `authenticated`: **all** writes go through
the `SECURITY DEFINER` RPCs below. Guests (`anon`) get no table grant at all —
they read picks only through `build_guest_room_snapshot`, which is
`SECURITY DEFINER` and bypasses RLS, exactly as they already read participants
and matches.

### Lifecycle

| Event | Effect on picks |
|---|---|
| Participant submits their set (`set_my_room_picks[_as_guest]`) | That participant's rows for the room are replaced |
| Host removes a match from the pool (`remove_room_match`) | Rows referencing it cascade away |
| Participant leaves (any leave RPC) | **Rows persist** — leaves are soft (`left_at`). Settlement's roster filter makes them inert (FR-041a, research.md R5) |
| Host switches assignment mode | Rows persist server-side; the client's confirm-discard gate (FR-030a, #184) is what tells the host they won't carry over. Settlement only reads picks in `player_picked` mode |
| Game starts | Picks are read, filtered, and copied into `public.assignments`. Pick rows are **not** deleted — `public.assignments` becomes canonical, and the picks become historical residue of a `joinable` room |

---

## `public.assignments` (unchanged shape, one new seed source)

No DDL change. In `player_picked` mode it is fully cleared at start and reseeded
from `assignment_picks` (see the settlement contract). After start it is the
canonical set, as since #135.

---

## `public.game_sessions` (unchanged)

`assignment_mode` already exists with `player_picked` as a valid enum value
(#184, migration 037). **No migration needed** to make the mode selectable —
only the client's mode selector needs the third option, which #184
deliberately withheld.

`matches_per_player` is the cap for picks. `shared_matches_per_pair` is stored
but not enforced in this mode, and `compute_room_assignment_plan` already
returns `effectivePerPlayer = matches_per_player` unraised outside `automatic`
mode (#184, FR-011) — so **no change** to that function either.

---

## `public.gameplay_events` (unchanged)

No new `event_type`; `chk_gameplay_events_event_type` (now living in
`031_room_lifecycle.sql`, not 010) is not touched. Rationale and the
constitution-III argument: research.md R9.

---

## RPC surface

Full contracts in [`contracts/room-rpcs.md`](contracts/room-rpcs.md).

| RPC | Status | Caller |
|---|---|---|
| `public.set_my_room_picks(session_id uuid, match_ids uuid[])` | **NEW** | Registered member **or host** (`authenticated`) |
| `public.set_my_room_picks_as_guest(guest_token text, match_ids uuid[])` | **NEW** | Session-scoped guest (`anon`, `authenticated`) |
| `private.build_guest_room_snapshot(uuid)` | **CHANGED** — `+ 'picks'` key, additive | Internal; serves both snapshot RPCs |
| `private.start_game_session(uuid, uuid, boolean)` | **CHANGED** — `+ player_picked` branch | Unchanged signature/guards |
| `private.compute_room_assignment_plan(uuid)` | **UNCHANGED** | Already mode-aware (#184) |
| `public.set_room_assignments(uuid, jsonb)` | **UNCHANGED** | Host allocation only; never touches picks |
| `public.set_room_assignment_mode(uuid, text)` | **UNCHANGED** | Already accepts `player_picked` |
| `private.remove_room_match`, `private.set_common_match` | **UNCHANGED** | Cascade / settlement filter handle the interactions (research.md R5, R8) |

---

## Client types

### `types/room.ts`

```ts
/** One participant's pre-start pick in player-picked mode (FR-038, FR-042). */
export interface RoomPickSummary {
  participantId: string;
  matchId: string;
}

// RoomSnapshot gains:
picks: RoomPickSummary[];

// ROOM_ERROR gains:
pickLimitExceeded: "pick_limit_exceeded",
roomNotPlayerPicked: "room_not_player_picked",
notAParticipant: "not_a_participant",
```

### `types/guestRoom.ts` — three keys, two of them overdue

`GuestRoomSnapshot` is currently **behind the wire** (research.md R11): the
shared builder has returned `assignmentPlan` since #135 and `assignmentMode`
since #184, but the guest type declares neither. All three are added now
because the guest pick UI needs the cap and the mode:

```ts
assignmentMode: AssignmentMode;        // pre-existing on the wire, newly typed
assignmentPlan: AssignmentPlan;        // pre-existing on the wire, newly typed
picks: GuestRoomPickSummary[];         // new
```

No server change is required for the first two.

---

## Derived client state (no server field)

Per research.md R7, per-participant progress is computed client-side from data
every snapshot already carries — the same approach #184 uses for its "still
short" indicator:

| Display | Derivation |
|---|---|
| A participant's progress | `count(picks where participantId = X) / assignmentPlan.matchesPerPlayer` |
| My remaining slots | `matchesPerPlayer − count(my picks)` |
| Pick control disabled | `count(my picks) >= matchesPerPlayer` and the match isn't already picked |
| Pool offered for picking | `matches` minus `commonMatchId` (FR-040a) |

---

## Validation rules

Enforced by the pick RPCs (contracts §1–2):

| Rule | Requirement | Failure |
|---|---|---|
| Caller is an active participant of the room | FR-038a | `not_a_participant` |
| Room is `joinable` | FR-038 | `room_not_joinable` |
| Room mode is `player_picked` | FR-038 | `room_not_player_picked` |
| Every `match_id` is in the room's pool | FR-039 | `match_not_found` |
| Submitted count ≤ `matches_per_player` | FR-040 | `pick_limit_exceeded` |
| Common Match in the input | FR-040a | silently stripped — **not** an error |
| Writing another participant's picks | FR-039 | structurally impossible: no participant parameter exists |

Enforced at settlement (contracts §4):

| Rule | Requirement |
|---|---|
| Only picks of roster-locked (`left_at IS NULL`) participants are seeded | FR-041a |
| Only picks whose match is still in the pool are seeded | FR-039 |
| The Common Match is never seeded as an additional match | FR-040a |
| At most `effectivePerPlayer` picks are seeded per participant | FR-003 (research.md R16 — reachable when the host lowers the cap after picks exist; the inherited fill loop trims nothing) |
| Every participant reaches `effectivePerPlayer`, picks kept, remainder filled | FR-041 |

---

## State transitions

Picks exist only while the room is `joinable`; every other room state makes
them read-only residue.

```
joinable ──set_my_room_picks[_as_guest]──▶ joinable        (picks replaced)
joinable ──remove_room_match───────────────▶ joinable       (picks cascade away)
joinable ──leave_room_as_*─────────────────▶ joinable       (picks persist, inert)
joinable ──start_game_session──────────────▶ in_progress    (picks → assignments, then frozen)
in_progress / completed / closed ──any pick attempt──▶ rejected (room_not_joinable)
```
