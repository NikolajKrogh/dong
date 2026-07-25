# Phase 1 Data Model: Canonical Player Assignments on Game Start

**Feature**: `specs/020-canonical-assignment-generation` | **Issue**: #135 | **Date**: 2026-07-25

Covers the **#135 slice** only. Draft-pick storage (#185), the assignment-mode
column (#184), and the completion snapshot (#186) are deliberately absent.

---

## Schema changes

### `public.game_sessions` — two new columns

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| `matches_per_player` | `int` | NOT NULL | `1` | Matches each participant receives beyond the Common Match (the host's stored setting, FR-028) |
| `shared_matches_per_pair` | `int` | NOT NULL | `0` | Matches any two participants hold in common, beyond the Common Match (FR-007) |

**Constraints**:

```sql
CHECK (matches_per_player >= 0)
CHECK (shared_matches_per_pair >= 0)
```

**Why these defaults**: `shared_matches_per_pair = 0` keeps an unconfigured room's
pool requirement linear (`1 + P`). A default of `1` would demand `1 + P(P−1)/2` —
29 fixtures for eight players — from hosts who never asked for shared stakes. See
research.md R4.

**Backfill**: none. Both columns are `NOT NULL DEFAULT`, so existing rows adopt
`K=0, N=1` in place. Rooms already `in_progress` or `completed` are unaffected
because the settings are read only during the start transition.

**No index needed**: both columns are read only via a single-row lookup already
served by `game_sessions_pkey`.

### `public.assignments` — unchanged

PK `(session_id, participant_id, match_id)` with composite same-session FKs to
`participants` and `matches`. A participant already may hold many matches. This
table becomes the **settled** set: written only by the start transition in this
slice.

### `public.gameplay_events` — unchanged

No new `event_type` values, so `010_constrain_gameplay_events.sql`'s CHECK
constraint is untouched. See research.md R5.

---

## Derived quantities

Let **P** = active participants (`left_at IS NULL`) on the locked roster,
**N** = effective per-player count, **K** = `shared_matches_per_pair`,
**M** = matches in the room's pool.

| Quantity | Definition | Requirement |
|---|---|---|
| Pairing minimum | `K × (P − 1)` | FR-009 |
| Effective per-player count | `max(matches_per_player, K × (P − 1))` | FR-010, FR-028b, FR-032 |
| Required pool | `1 + K·P(P−1)/2 + P·(N − K(P−1))` | FR-012, spec Assumptions |
| Relaxed floor | `1 + N` | FR-017 |
| Feasible | `M ≥ required pool` | FR-012 |

Worked values (verified against `utils/setupGameAssignments.ts` at K=1):

| P | K | N | Required pool |
|---|---|---|---|
| 8 | 0 | 1 | 9 |
| 8 | 0 | 3 | 25 |
| 4 | 1 | 3 | 7 |
| 4 | 1 | 4 | 11 |
| 8 | 1 | 7 | 29 |
| 1 | any | 1 | 2 |

---

## Entity relationships (this slice)

```text
game_sessions ──1:N── participants ──┐
      │                              ├── assignments (settled at start)
      ├──1:N── matches ──────────────┘
      │           ▲
      │           └── common_match_id (FK, one per session)
      ├── matches_per_player          (new)
      ├── shared_matches_per_pair     (new)
      └──1:N── gameplay_events
                  ├── assignment_replaced  (payload: settled set)
                  └── session_started      (payload: startedAt, relaxedConstraints)
```

---

## State transitions

Room state is unchanged in shape; this feature changes what happens *during* the
`joinable → in_progress` transition.

```text
joinable ──start_game_session()──> in_progress
             │
             ├─ lock room row (FOR UPDATE)
             ├─ existing guards: host, state, participants, matches, common match
             ├─ compute P, N, required pool
             ├─ IF M < 1 + N          → RAISE insufficient_match_pool   (FR-017, no override)
             ├─ IF M < required pool AND NOT relax → RAISE assignment_constraints_unsatisfiable (FR-013)
             ├─ DELETE existing assignments        (FR-022)
             ├─ INSERT generated assignments       (FR-001..FR-008, or relaxed FR-015)
             ├─ INSERT assignment_replaced event   (FR-023)
             ├─ UPDATE state, started_at
             └─ INSERT session_started event       (FR-016 flag)
```

All of the above is one transaction — FR-021's all-or-nothing. Any `RAISE` rolls
back the whole block, satisfying FR-011 and FR-020.

**Removed**: the `unassigned_participants` guard. Assignments are now a product of
starting, not a precondition (FR-019, superseding `specs/018` FR-008).

---

## Validation rules

| Rule | Enforced where | Error |
|---|---|---|
| Caller is the host | `start_game_session`, settings RPCs | `not_host` |
| Room is `joinable` | same | `invalid_room_state` |
| At least one active participant | `start_game_session` | `empty_participants` |
| At least one match in pool | same | `empty_matches` |
| Common Match set and in pool | same | `missing_common_match` / `invalid_common_match` |
| Pool ≥ `1 + N` | same | `insufficient_match_pool` |
| Pool ≥ required pool, unless relaxed | same | `assignment_constraints_unsatisfiable` |
| `matches_per_player ≥ K(P−1)` on write | `set_room_assignment_settings` | `per_player_count_below_minimum` |
| Settings writable only while `joinable` | same | `room_not_joinable` |
| Counts non-negative | CHECK constraints | constraint violation |

---

## Concurrency

**Roster lock (FR-005)**: `start_game_session` holds `FOR UPDATE` on the
`game_sessions` row. For that to actually freeze the roster,
`private.join_room_as_registered` must take the same lock — today it uses a plain
`SELECT`, unlike the guest path. Fixing that is part of this slice
(research.md R6). Without it, a registered member can join between the lock and
the participant enumeration, producing a started room with an unassigned
participant.

**Retry (FR-025)**: handled one layer up by `command_idempotency`. A completed
key replays the stored response without re-entering the RPC, so a retry cannot
regenerate a different random set. A failed attempt releases its reservation
(`CommandDispatcher:55-57`), leaving the key reusable.
