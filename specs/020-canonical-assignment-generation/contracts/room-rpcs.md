# Contract: Supabase RPCs — Canonical Assignment Generation

**Feature**: `specs/020-canonical-assignment-generation` | **Issue**: #135

Every RPC follows the repo's established shape: a `private.*` implementation
(`SECURITY DEFINER`, `SET search_path = ''`, granted to `service_role` only) and a
thin `public.*` wrapper granted to `authenticated`. Errors are raised as bare
snake_case strings so `StartGameCommandHandler.mapSupabaseError` can switch on them.

---

## 1. `public.set_room_assignment_settings` — NEW

Host sets the room's per-player and shared-per-pair counts (FR-028 to FR-031).

```sql
public.set_room_assignment_settings(
    session_id              uuid,
    matches_per_player      int,
    shared_matches_per_pair int
) RETURNS void
```

**Guards**

| Condition | Error |
|---|---|
| No `auth.uid()` | `not_authenticated` |
| Room absent | `room_not_found` |
| Caller is not `owner_account_id` | `not_host` |
| `state <> 'joinable'` | `room_not_joinable` |
| Either argument `< 0` | `invalid_assignment_settings` |
| `matches_per_player < shared_matches_per_pair × (P − 1)` for the current active roster | `per_player_count_below_minimum` |

`P` counts participants with `left_at IS NULL`. The last guard is FR-031; note it
validates against the roster *at write time*, which is why FR-032 re-floors at
start when the roster has since grown.

**Idempotent**: writing the values already stored is a no-op success. Emits no
gameplay event — these are configuration, not gameplay, and the room snapshot
carries them.

---

## 2. `private.compute_room_assignment_plan` — NEW (internal helper)

Shared by the snapshot read and the start transition so feasibility is computed
once, in one place (FR-012).

```sql
private.compute_room_assignment_plan(p_session_id uuid) RETURNS jsonb
```

Returns:

```json
{
  "participantCount":      4,
  "poolSize":              6,
  "matchesPerPlayer":      1,
  "sharedMatchesPerPair":  0,
  "effectivePerPlayer":    1,
  "requiredPoolSize":      5,
  "relaxedFloor":          2,
  "feasible":              true,
  "startable":             true
}
```

- `effectivePerPlayer` = `max(matchesPerPlayer, sharedMatchesPerPair × (P − 1))` (FR-010)
- `requiredPoolSize` = `1 + K·P(P−1)/2 + P·(N − K(P−1))` (FR-012)
- `relaxedFloor` = `1 + effectivePerPlayer` (FR-017)
- `feasible` = `poolSize >= requiredPoolSize` — the constraints can be honoured
- `startable` = `poolSize >= relaxedFloor` — a start is possible, relaxed if not feasible

`STABLE`. Pure read, no mutation — this is what makes FR-014 hold without a paused
mutation (research.md R2).

---

## 3. `private.build_guest_room_snapshot` — MODIFIED

Gains one key so every client sees the requirement continuously (FR-024, FR-033):

```json
{
  "sessionId": "…",
  "state": "joinable",
  "commonMatchId": "…",
  "participants": [ … ],
  "matches": [ … ],
  "assignments": [ … ],
  "assignmentPlan": { …output of compute_room_assignment_plan… }
}
```

**Compatibility**: additive only. Existing keys, ordering, and types are unchanged,
so `180_room_snapshot_access.test.sql` and the guest-join tests continue to pass.
Both `get_room_snapshot` and the guest snapshot path inherit it automatically.

---

## 4. `public.start_game_session` — MODIFIED

```sql
public.start_game_session(
    session_id       uuid,
    idempotency_key  uuid,
    relax_constraints boolean DEFAULT false   -- NEW
) RETURNS jsonb
```

**Behaviour inside the existing `FOR UPDATE` transaction**, in order:

1. Existing guards, unchanged: `not_authenticated`, `room_not_found`, `not_host`,
   `invalid_room_state`, `empty_participants`, `empty_matches`,
   `missing_common_match`, `invalid_common_match`.
2. **Removed**: the `unassigned_participants` guard (FR-019 — assignments are now
   a product of starting, superseding `specs/018` FR-008).
3. Compute the plan against the locked roster.
4. `poolSize < relaxedFloor` → `insufficient_match_pool`. Raised **even when
   `relax_constraints` is true** — relaxation loosens the overlap rule, never the
   arithmetic floor (FR-017).
5. `NOT feasible AND NOT relax_constraints` → `assignment_constraints_unsatisfiable`
   (FR-013).
6. `DELETE FROM public.assignments WHERE session_id = …` (FR-022).
7. Generate and insert (research.md R3):
   - **Constrained**: deal K unused matches to each of the `P(P−1)/2` pairs, then
     `N − K(P−1)` private matches per participant, then the Common Match to all.
   - **Relaxed**: deal N matches per participant at random from the pool minus the
     Common Match, overlap unconstrained, then the Common Match to all.
   - Both orders randomised via `ORDER BY random()` (FR-006).
8. Insert `assignment_replaced` with the settled set in the payload (FR-023).
9. `UPDATE state = 'in_progress', started_at = now()`.
10. Insert `session_started` with `{"startedAt": …, "relaxedConstraints": <bool>}`
    (FR-016).

**Returns**:

```json
{
  "status": "started",
  "sessionId": "…",
  "relaxedConstraints": false,
  "assignmentsCreated": 8
}
```

**Invariant note**: step 7's constrained construction deals disjoint groups from a
pool whose size was checked at step 5, so it cannot fail. Implement the
post-condition as an assertion, not a recovery path (research.md R3).

---

## 5. `private.join_room_as_registered` — MODIFIED (correctness fix)

Change the room read from a plain `SELECT` to `SELECT … FOR UPDATE`, matching the
guest path in `026_guest_room_join.sql`.

```sql
-- before
SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.join_code = v_join_code;
-- after
SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.join_code = v_join_code FOR UPDATE;
```

**Why**: without it, under READ COMMITTED a registered join can commit between
`start_game_session` taking its row lock and enumerating the roster, yielding a
started room containing a participant with no assignments — a direct FR-005
failure (research.md R6). With it, joins serialize behind an in-flight start,
observe `in_progress`, and are rejected by the existing state guard.

No signature or return-shape change; callers are unaffected.

---

## Error string → `ErrorCode` mapping

| RPC error | `ErrorCode` | HTTP |
|---|---|---|
| `room_not_found` | `ROOM_NOT_FOUND` | 422 |
| `not_host` / `forbidden` | `FORBIDDEN` | 403 |
| `invalid_room_state` | `INVALID_ROOM_STATE` | 422 |
| `empty_participants` | `EMPTY_PARTICIPANTS` | 422 |
| `empty_matches` | `EMPTY_MATCHES` | 422 |
| `missing_common_match` | `MISSING_COMMON_MATCH` | 422 |
| `invalid_common_match` | `INVALID_COMMON_MATCH` | 422 |
| `insufficient_match_pool` | `INSUFFICIENT_MATCH_POOL` *(new)* | 422 |
| `assignment_constraints_unsatisfiable` | `ASSIGNMENT_CONSTRAINTS_UNSATISFIABLE` *(new)* | 422 |
| `invalid_assignment_settings` | `INVALID_ASSIGNMENT_SETTINGS` *(new)* | 422 |
| `per_player_count_below_minimum` | `PER_PLAYER_COUNT_BELOW_MINIMUM` *(new)* | 422 |

`UNASSIGNED_PARTICIPANTS` becomes unreachable and is removed from
`StartGameCommandHandler.mapSupabaseError`. Keep or drop the enum constant as the
implementation prefers, but no RPC raises it after this change.
