# Data Model: Assignment Mode Setting + Host-Assigned Allocation

Builds directly on the schema `specs/020-canonical-assignment-generation`
(migration 036) already shipped. Only the deltas for this slice are described
here.

## `public.assignment_mode` (new enum type)

```sql
CREATE TYPE public.assignment_mode AS ENUM (
  'automatic',
  'host_assigned',
  'player_picked'
);
```

Three values now (FR-026), even though `player_picked` isn't implemented
until #185 — the type is shared across the whole `specs/020` delivery, and a
room must be able to be *set* to a mode this slice doesn't otherwise act on
without needing a later `ALTER TYPE ... ADD VALUE`.

## `public.game_sessions` (altered)

| Column | Type | Constraint | Notes |
|---|---|---|---|
| `assignment_mode` | `public.assignment_mode` | `NOT NULL DEFAULT 'automatic'` | FR-026, FR-027. No backfill needed — every existing row reads as `automatic`, today's only behavior. |

No other column changes. `matches_per_player` and `shared_matches_per_pair`
already exist from migration 036 and are unchanged in shape; only their
*interpretation* changes (research.md R3).

## `public.assignments` (unchanged shape, new lifecycle meaning)

No DDL change. Existing composite PK `(session_id, participant_id,
match_id)` with same-session FKs to `participants` and `matches` (migration
007) is exactly what host allocation needs — a participant can hold several
matches already, and the FK guarantees an allocation can never reference a
participant or match outside the room.

**Lifecycle, by mode, at `start_game_session`**:

- `automatic`: unchanged — table is cleared, then fully regenerated.
- `host_assigned`: table is **read first**, not cleared. Existing rows for
  active participants are kept as-is (their allocation), then shortfalls are
  filled per participant, then the Common Match is added for everyone via
  `ON CONFLICT (session_id, participant_id, match_id) DO NOTHING` (research.md
  R4). Rows belonging to a participant no longer in the active roster are
  implicitly superseded (never read, never carried forward).
- `player_picked` (#185, not implemented here): same table, different write
  path (each participant writes their own rows) — out of scope, noted only so
  the table isn't redesigned out from under it.

**Pre-start semantics**: while `state = 'joinable'`, every row in
`public.assignments` for a room is a **draft**, regardless of mode — it has no
canonical meaning until `start_game_session` decides what to do with it. This
was already true before this slice (FR-050); host-assigned mode is the first
mode that makes the server actually *keep* some of that draft rather than
discarding all of it.

## RPC surface (new/changed — see `contracts/room-rpcs.md` for full contracts)

| RPC | Change |
|---|---|
| `set_room_assignment_mode(session_id, mode)` | **New.** Host-only, `joinable`-only. Sets `game_sessions.assignment_mode`. |
| `set_room_assignment_settings(session_id, matches_per_player, shared_matches_per_pair)` | **Changed.** The FR-009 minimum check becomes conditional on `assignment_mode = 'automatic'`. |
| `compute_room_assignment_plan(session_id)` | **Changed.** `effective_per_player` computation branches on `assignment_mode` — automatic applies the FR-009 floor, host-assigned does not (FR-011). |
| `start_game_session(session_id, idempotency_key, relax_constraints)` | **Changed.** Gains a third generation branch for `host_assigned` mode (research.md R4). Return `jsonb` gains `filledInParticipantIds: string[]`. |
| `set_room_assignments(session_id, assignments)` | **Unchanged.** Already the correct seam for host allocation (research.md R2) — no signature or body change. |

## Client types (`types/room.ts`)

| Type | Change |
|---|---|
| `RoomSnapshot` | gains `assignmentMode: "automatic" \| "host_assigned" \| "player_picked"` |
| `AssignmentPlan` | unchanged shape; `effectivePerPlayer`'s *meaning* now depends on the snapshot's `assignmentMode` (mode-aware value from the server, no client-side branching needed to read it correctly) |
| `ROOM_ERROR` | gains `invalidAssignmentMode: "invalid_assignment_mode"` |

**Not modeled client-side**: the RPC's `filledInParticipantIds` field. The
Java command-api's response envelope doesn't forward RPC internals (the same
boundary `relaxedConstraints` already lives behind), so this is not a client
type — see research.md R5. FR-037's host-facing requirement is met by a
pre-start lobby computation instead, reusing `assignments` + `assignmentPlan`
(research.md R9), not a new field.

## Validation rules carried over unchanged

- Host-only: `owner_account_id = auth.uid()` (every mutating RPC in this
  table).
- `joinable`-only: `state = 'joinable'::public.session_state` (every mutating
  RPC in this table).
- Composite same-session FK on `assignments` rejects a participant/match from
  a different room as `foreign_key_violation`, mapped to `invalid_assignment`
  (unchanged, `set_room_assignments`).

## State transitions

No new room states. `assignment_mode` itself has no transition rules beyond
"host may change it while `joinable`" (FR-029/FR-030) — switching between any
of the three values at any time pre-start is valid; there is no ordering
constraint between modes.
