# Phase 0 Research: Canonical Player Assignments on Game Start

**Feature**: `specs/020-canonical-assignment-generation` | **Issue**: #135 | **Date**: 2026-07-25

Scope is the **#135 row** of the spec's Delivery Slices table only: automatic
generation, the shortfall warning and host override, the room's two assignment
settings, and retry safety. #184/#185/#186 are out of scope here.

---

## R1 — Where does assignment generation run?

**Decision**: Inside the existing `private.start_game_session` Postgres RPC, under
the `FOR UPDATE` row lock it already takes. The Java `StartGameCommandHandler`
remains the dispatch, authentication, and idempotency layer, and stops being a
validation authority.

**Rationale**:
- FR-021 requires generation + persistence + the `joinable → in_progress`
  transition to be one all-or-nothing outcome. Inside the RPC they are one
  transaction by construction. Generating in Java would require a compensating
  delete on any failure between the two RPC calls.
- FR-005 requires the roster to be locked. `start_game_session` already holds
  `SELECT … FOR UPDATE` on the `game_sessions` row. Generating in Java between
  `get_room_snapshot` and `start_game_session` opens a TOCTOU window that the
  lock cannot close, because the read happens before the lock is taken.
- Constitution §IV (Supabase-first, Java by exception). Java's sanctioned reasons
  are orchestration, secrets handling, external integration, and cross-aggregate
  validation the client cannot safely do. Assignment generation is pure
  computation over rows already in Postgres — none of those apply.

**Alternatives considered**:
- *Generate in `StartGameCommandHandler`, POST the result to
  `set_room_assignments`, then call `start_game_session`.* Rejected: three
  round-trips, no atomicity, and a partially-assigned room on any mid-sequence
  failure — a direct FR-011/FR-021 violation.
- *Generate in a Postgres RPC separate from `start_game_session`.* Rejected: same
  atomicity gap, one fewer round-trip.

**Consequence**: `StartGameCommandHandler.validate()` loses its five-rule
optimistic check. Those rules already exist in `start_game_session` as the
authoritative backstop (see that RPC's docstring), so removing the Java copy
deletes a duplicate rather than a safeguard. The handler keeps its
`mapSupabaseError` switch, which is what turns RPC error strings into `ErrorCode`s.

---

## R2 — How does a two-step "warn, then override" interaction fit a stateless command endpoint?

**Decision**: Feasibility is a **read**, not a paused mutation. The room snapshot
carries the pool requirement and whether the current configuration is satisfiable.
The client renders the warning from that read and, if the host chooses to proceed,
calls `start-game` **once** with an explicit `relaxConstraints: true` in the
command payload.

**Rationale**:
- FR-014 requires the room to be untouched while the host decides. With a read,
  this is true because *no mutating call has been made yet* — there is no
  reservation to hold open, no state to unwind.
- FR-033 already requires the lobby to display the required pool size
  continuously. That obliges a readable feasibility computation regardless, so
  reusing it for the warning adds no surface.
- It avoids a third idempotency state. `public.command_idempotency` models exactly
  two: reserved-in-flight (`response_status IS NULL`) and completed. A start that
  is neither would need a schema and protocol change.
- US8 scenario 2 ("the relaxed continuation is the same attempt") is satisfied
  observably: the room starts once, with one assignment set, because only one
  mutating call is ever made.

**Alternatives considered**:
- *422 on shortfall, then a second `start-game` carrying the flag.* Workable —
  `CommandDispatcher` releases the reservation on handler failure
  (`CommandDispatcher:55-57`), so a same-key retry re-reserves and proceeds
  (verified, see R7). Rejected anyway: it makes the warning a side effect of a
  failed mutation, and requires the client to interpret a 422 as a question rather
  than an error.
- *A dedicated `preview-start-game` command.* Rejected: a new command type and
  handler for something the snapshot poll can carry.

**Consequence**: `relaxConstraints` is a payload field on the existing
`start-game` command, not a new command type. The server still enforces FR-017
(hard rejection when the pool holds fewer distinct matches than the effective
per-player count) even when the flag is set — relaxation loosens the overlap rule,
never the arithmetic floor.

---

## R3 — The generation algorithm

**Decision**: Port the existing solo algorithm's invariants to plpgsql,
generalising its hard-coded overlap of one into the configurable
`shared_matches_per_pair` (K). Construction is greedy over disjoint groups:

1. Take the pool minus the Common Match, in random order.
2. For each of the `P(P−1)/2` participant pairs, in random order, take K unused
   matches and assign each to both members of the pair.
3. Each participant now holds `K(P−1)` matches. If the effective per-player count
   N exceeds that, give each participant `N − K(P−1)` further unused matches,
   each used by exactly one participant.
4. Assign the Common Match to everyone.

**Rationale**:
- Every match dealt in step 2 goes to exactly two participants and every match in
  step 3 to exactly one, which is what makes "exactly K shared per pair"
  well-defined (spec Assumptions). A match held by three participants would
  contribute to three pairs' overlap.
- The construction consumes disjoint groups from a pool whose size was already
  checked, so **it cannot fail once the feasibility check passes**. This means
  FR-010's "generation cannot satisfy the invariants" rejection path is
  unreachable in automatic mode. Document it as an assertion, do not write a
  recovery path for it.
- Randomness via `ORDER BY random()` on both the pair order and the match order
  satisfies FR-006 and SC-011.

**Feasibility formula** (matches spec Assumptions, verified against
`utils/setupGameAssignments.ts` at K=1: P=4/N=3 → 7, P=4/N=4 → 11):

```
required_pool = 1 + K·P(P−1)/2 + P·(N − K(P−1))
```

**Relaxed mode** (FR-015): skip steps 2–3 entirely; deal each participant N
matches drawn at random from the pool minus the Common Match, overlap unconstrained.
Requires only `pool_size − 1 ≥ N`, which is FR-017's floor.

**Alternatives considered**:
- *Keep the algorithm in TypeScript and call it from Java.* Rejected under R1.
- *A backtracking solver for tighter pools.* Rejected: the greedy construction is
  complete for every pool the feasibility formula admits, so backtracking would
  only ever run on inputs already rejected.

---

## R4 — Room settings storage and defaults

**Decision**: Two columns on `public.game_sessions`:

| Column | Type | Default |
|---|---|---|
| `matches_per_player` | `int NOT NULL` | `1` |
| `shared_matches_per_pair` | `int NOT NULL` | `0` |

Effective per-player count at start = `max(matches_per_player, K·(P−1))` (FR-028b).

**No assignment-mode column in this slice.** FR-027 (a room with no mode set
behaves as automatic) is exactly what lets #135 ship without it; #184 adds it.

**Rationale for the defaults** — this is the decision the clarification session
turned on:
- `K = 0` by default keeps the pool requirement **linear** (`1 + P`): nine
  fixtures for an eight-player room. A default of `K = 1` would impose the
  quadratic requirement (`1 + P(P−1)/2` = **29** fixtures for eight players) on
  every host who never touched the setting — precisely the outcome the
  clarification existed to remove.
- `K = 1` is the *solo* flow's behaviour, not multiplayer's. Today's multiplayer
  round-robin in `useRoomConfigure.randomizeAssignments` gives each participant
  one extra match with no pairing guarantee, so `K = 0, N = 1` is also the
  behaviour-preserving default for existing rooms.
- `NOT NULL DEFAULT 1` rather than nullable-means-derived: at K=0 a derived floor
  would be `0`, giving every participant the Common Match alone — degenerate, and
  called out as such in the spec's Edge Cases. A literal default of 1 avoids the
  column DDL silently making that choice.

**Backfill**: both columns are `NOT NULL DEFAULT`, so existing rooms adopt
`K=0, N=1` without a data migration. Rooms already `in_progress` or `completed`
are unaffected — the settings are read only at start.

---

## R5 — Publication and event history

**Decision**: Reuse the existing `assignment_replaced` and `session_started` event
types. Carry the relaxation flag (FR-016) in the `session_started` payload.

**Rationale**:
- `supabase/migrations/010_constrain_gameplay_events.sql` `CHECK`-constrains
  `event_type` to a fixed list that already contains both. Reusing them means
  **no constraint migration** in this slice.
- FR-023 (settlement recorded in auditable history) and constitution §III are
  satisfied by `assignment_replaced` carrying the full settled set in its payload,
  which `set_room_assignments` already does today.
- FR-024 (clients read the canonical set from the snapshot they already poll) is
  satisfied by `build_guest_room_snapshot`, which already emits `assignments`.

**Known consequence to hand to #184**: once host-assigned mode exists, drafts and
settlement would both emit `assignment_replaced`, and history could not tell
"host edited a draft" from "server settled the game". #184 should introduce a
distinct type at that point — noted in that issue rather than pre-emptively
migrating the CHECK constraint here.

---

## R6 — FR-005 roster lock: a real gap in the join path

**Finding**: `private.join_room_as_registered`
(`supabase/migrations/032_room_membership_rpcs.sql`) reads the room with a
**plain** `SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.join_code = …`
— no `FOR UPDATE`. The guest path (`026_guest_room_join.sql`) *does* take
`FOR UPDATE`.

**Why it matters**: under READ COMMITTED, a registered member's join can commit
between `start_game_session` acquiring its row lock and its
`SELECT count(*) FROM participants`. The result is an `in_progress` room holding
a participant with no assignments — a direct failure of FR-005 and of User Story 1
acceptance scenario 4. This is latent today (assignments are a start
*precondition*, so the same race merely produced an unassigned participant in a
started game); this feature makes it a correctness bug because generation now
enumerates the roster.

**Decision**: Add `FOR UPDATE` to the room read in `join_room_as_registered`,
matching the guest path. Joins then serialize behind an in-flight start, observe
`in_progress`, and are rejected by the existing state guard.

**Alternative considered**: re-count the roster after generation and abort on
change. Rejected: it converts a race into a spurious failure the host cannot act
on, and leaves the same window open for every future roster-sensitive operation.

---

## R7 — Idempotency behaviour on a shortfall

**Finding (verified)**: `CommandDispatcher` releases the reservation when a
handler throws (`CommandDispatcher:53-57` → `idempotencyService.release(...)`),
and `private.release_command_idempotency` deletes the row. A key used by a failed
attempt is therefore reusable.

**Consequence**: even in the fallback path where a client does hit a shortfall
rejection and retries with `relaxConstraints: true`, the same idempotency key
re-reserves and proceeds. `reserve_command_idempotency` keys on
`(idempotency_key, command_type, room_id)` and does **not** include the payload,
so the flag does not need to participate in the key.

**But note**: under R2 this path is not the design. The warning is resolved from
the feasibility read, and `start-game` is called once with the flag already set.
Implementers should not build a two-call handshake.

---

## R8 — Test levels

**Decision**:

| Behaviour | Level | Location |
|---|---|---|
| Generation invariants (FR-002/003/007/008), boundaries, randomness (SC-011) | pgTAP | `supabase/tests/database/230_canonical_assignment_generation.test.sql` |
| All-or-nothing start, draft supersession, retry (FR-021/022/025) | pgTAP | same file |
| Settings guards — host-only, lobby-only, below-minimum (FR-029/030/031) | pgTAP | same file |
| Join/start race (R6) | pgTAP | same file |
| `start-game` payload, `relaxConstraints`, error mapping | JUnit/MockMvc | `command-api/src/test/.../StartGameCommandHandlerTest` |
| Feasibility display, settings controls, removal of client randomiser | Jest | `__tests__/hooks/useRoomConfigure.test.ts`, lobby component test |
| Host configures → starts → second device shows same assignments | Playwright BDD | `e2e/features/` + `e2e/steps/configure-start-game.steps.ts` |

**Rationale**: the generator lives in plpgsql, so pgTAP *is* its unit-test level —
constitution §V's "unit tests for all new feature behavior" is met there, not in
Jest. The Playwright journey is required by §V because the lobby gains new
controls and the start flow changes materially.

---

## R9 — Client changes

**Decision**:
- Delete `randomizeAssignments` from `hooks/useRoomConfigure.ts` and the
  "Randomize Assignments" control (`testID="lobby-randomize-assignments"`) from
  `app/lobby/[sessionId].tsx`. It computes assignments client-side, which FR-050
  forbids and FR-001 supersedes.
- Keep `setAssignments` / `set_room_assignments` in place. It is unused by #135's
  flow but is the seam #184 builds host-assigned mode on; removing and restoring
  it would be churn.
- Add lobby controls for the two settings and a display of the pool requirement
  and current feasibility (FR-033).

**Rationale**: FR-052 confines this feature to multiplayer, so
`utils/setupGameAssignments.ts` and `app/setupGame.tsx` are untouched. The solo
flow keeps its on-device behaviour.

---

## Skills consulted (constitution §VI)

- `.agents/skills/supabase-postgres-best-practices` — RLS and `SECURITY DEFINER`
  boundaries, index strategy for the new settings reads, locking guidance
  informing R6.
- `.agents/skills/database-design-expert` — column defaults and backfill-free
  migration shape in R4.
- `.agents/skills/database-testing` — migration and transaction-isolation test
  coverage in R8, specifically the race test for R6.
- `.agents/skills/java-springboot` — constructor injection and package-by-feature
  already followed by `command/`; no structural change needed for R1's handler
  simplification.
