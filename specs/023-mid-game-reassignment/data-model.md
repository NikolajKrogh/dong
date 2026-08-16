# Phase 1 Data Model: Host Reassignment During an Active Game

**Feature**: `specs/023-mid-game-reassignment` | **Date**: 2026-08-03

References [research.md](research.md) findings R4–R10. All migration content
below belongs in a single new migration, `041_mid_game_reassignment.sql`.

---

## 1. `public.assignments` — existing table, new mutability

```
session_id      uuid    NOT NULL
participant_id  uuid    NOT NULL
match_id        uuid    NOT NULL
created_at      timestamptz DEFAULT now()
PRIMARY KEY (session_id, participant_id, match_id)
```
(`supabase/migrations/007_create_assignments.sql`)

**No schema change.** What changes is *when* it may be written: until now only
at settlement, while the room was pre-start. This slice makes it mutable while
`state = 'in_progress'`, host-only.

**Mutation rule**: a reassignment for one participant is applied as a delta —
delete the rows for matches being removed, insert rows for matches being added.
Rows for matches the participant keeps are left untouched, so their `created_at`
continues to record when the participant first got that match.

**The Common Match row is excluded from the delta entirely** (R10). Settlement
writes a real assignment row for it, for every participant (`036:383-385`), so
both the `DELETE` and the added/removed computation must carry
`AND match_id <> common_match_id`. Without that scope, a whole-set payload that
legitimately omits the Common Match deletes it on every call. **This scoping —
not the validation check below — is what enforces FR-048.**

**Validation rules**:

| Rule | Enforced by | Error |
|------|-------------|-------|
| Match belongs to the room's pool | Explicit pre-check, *then* the composite FK to `matches(session_id, id)` as backstop (R10) | `match_not_in_room_pool` |
| Common Match never appears in `match_ids` | Input validation against `game_sessions.common_match_id`; the *guarantee* is the delta scoping above (R10) | `cannot_reassign_common_match` |
| Participant is on the active roster | Explicit pre-check: `participants.left_at IS NULL` | `participant_not_in_room` |
| Caller is the host | `game_sessions.owner_account_id = auth.uid()` (R9) | `not_host` |
| Room is running | `state = 'in_progress'` (R5) | `game_not_in_progress` |
| Desired set is present, non-null, and unique | Explicit structural validation before replay | `invalid_reassignment_input` |
| Desired non-Common count equals the participant's current settled non-Common count | Explicit cardinality comparison under the room lock | `assignment_count_mismatch` |

**Relationship to scoring**: none, and this is load-bearing (R1). No scoring
column reads this table. Deleting an assignment row removes no goal and no
drink — which is exactly why FR-045 is satisfiable without versioning.

---

## 2. `public.gameplay_events` — new event type

**Schema unchanged** (`008_create_gameplay_events.sql`). The CHECK constraint
`chk_gameplay_events_event_type` is dropped and redefined from **031's** list
(not 010's — R4), adding one value:

```
'assignment_reassigned'
```

**Why not reuse `assignment_replaced`** (R4): every started game already emits
exactly one at settlement (`035:181`, `036:400`, `037:477`, `038:693`).
Reusing it would make FR-047b's "did assignments change during play?" check
true for every game ever started.

**Payload** (`jsonb`) — the delta half of FR-047c's reconstruction:

```json
{
  "participantId": "<uuid>",
  "requestedMatchIds": ["<uuid>", "..."],
  "requestFingerprint": "<sha256-of-participant-and-canonical-set>",
  "addedMatchIds":   ["<uuid>", "..."],
  "removedMatchIds": ["<uuid>", "..."],
  "resultingMatchIds": ["<uuid>", "..."]
}
```

`resultingMatchIds` is redundant with the deltas but is recorded deliberately:
it makes a single event self-describing for a reader and lets a reconstruction
be cross-checked rather than trusted blindly.

`requestedMatchIds` is sorted and duplicate-free. `requestFingerprint` binds the
idempotency key to the target participant and canonical desired set; it is not
an authorization token. The event row's non-null `actor_participant_id` is the
active owner participant resolved from `auth.uid()`, while `participantId` is
the participant whose assignments changed.

**The payload is load-bearing, not decorative.** §6's invariant replays these
deltas against the kickoff map and compares the result to the snapshot, so a
delta that is wrong or partial — even where the assignment rows it wrote were
correct — fails the suite. That is the point: nothing else in the slice would
catch it.

**Ordering**: `sequence_number` from `public.allocate_event_sequence(session_id)`,
as every other event. This is the ordering FR-047c's replay depends on.

**Idempotency**: `idempotency_key` carries the caller-supplied key, unique per
session by `ux_gameplay_events_session_idempotency` (008). Equal-fingerprint
retries replay; different-fingerprint reuse raises `idempotency_key_reused`.
A concurrent unique violation is resolved by re-reading and applying the same
rule, never by leaking raw `23505`.

**Retention**: never pruned (FR-047d) — FR-047c's reconstruction depends on
these rows outliving the game.

**Existing triggers that apply unchanged**:
- `bump_room_last_activity` (031) — a reassignment counts as room activity and
  therefore defers expiry. Correct and intended.
- `trg_prevent_events_on_completed` (009) — blocks inserts once `completed`.
  A backstop only; it misses `closed` (R5), so it is **not** the FR-044 guard.

---

## 3. `public.assignment_snapshots` — NEW table (FR-047a)

The immutable end-state checkpoint.

**It is a denormalization, deliberately** (R11). The kickoff map is already in
the settlement event's payload, so the end state is derivable from the log
alone. The snapshot is kept for three reasons — it keeps a recursive replay CTE
out of a hot list view, it bounds drift if a future path ever mutates
assignments without logging an event (#165 touches this area), and being read
independently of the log it makes the §6 invariant a real cross-check rather
than a tautology.

```
session_id      uuid        NOT NULL REFERENCES public.game_sessions(id)
participant_id  uuid        NOT NULL
match_id        uuid        NOT NULL
captured_at     timestamptz NOT NULL DEFAULT now()
expected_assignment_count int NOT NULL CHECK (expected_assignment_count > 0)
PRIMARY KEY (session_id, participant_id, match_id)
```

Composite FKs mirror `public.assignments`' — to
`participants(session_id, id)` and `matches(session_id, id)` — so a snapshot row
can never reference a participant or match from another session.

**Written**: once, inside `private.end_game_session`
(`040_end_running_game.sql`), in the same transaction, **before** the state flip
to `completed` (R6). Ordering matters for the same reason 040's own
`session_completed` insert is ordered that way.

> **Reachability caveat (R6a)**: today the game screen's End Game is local-only
> and never calls `end_game_session`, so real games expire to `closed` instead
> of completing, and this write rarely fires. The seam is right; the path that
> fires it is #190's. When validating, end the game **from the lobby**.

`expected_assignment_count` is the total number of assignment rows selected for
the session at completion and is repeated on every row. History considers a
snapshot usable only when all rows agree on that value and the session row count
equals it. This makes a partial snapshot detectable rather than silently valid.

**Immutability and completeness (FR-047a, FR-054)**: enforced, not merely intended —
- `REVOKE ALL` from `anon` and `authenticated`; only `service_role` and the
  `SECURITY DEFINER` functions touch it.
- A `BEFORE UPDATE OR DELETE` trigger raising
  `assignment_snapshot_is_immutable`, so even a future `SECURITY DEFINER`
  function cannot silently rewrite history.
- A statement-level `AFTER INSERT` completeness trigger raising
  `assignment_snapshot_incomplete` unless the inserted rows already form the
  complete map for every affected session. `end_game_session` inserts the map
  in one statement, so a partial snapshot cannot reach a completed history
  read.
- The snapshot is one `INSERT ... SELECT` in the completion transaction, with no
  per-row conflict suppression. The room lock serializes completion, and the
  existing already-completed return makes retries idempotent. Any conflict is an
  invariant failure that rolls back the whole completion.
- Completion verifies inserted row count equals the captured expected count
  before changing the room to `completed`.

**Not written for**: rooms reaching `closed` (abandoned, and the history read
models only treat `completed` as played — R6), and legacy imports, which insert
`completed` sessions directly. Both are served by the fallback in §4.

**Backfill**: none (R7). The fallback makes existing completed sessions
correct as they stand.

---

## 4. History read models

### `private._history_completed_assignments` — repointed (FR-047a)

Currently reads live `public.assignments` (defined `018:41`, redefined
`025:282`). Redefined to **snapshot-with-fallback**:

- If snapshot rows exist, all carry one expected count, and their count equals
  that expected count → return those rows. The insert trigger makes this the
  only supported post-feature state; an incomplete write is rejected before
  the rows can be read.
- Otherwise → return the live `public.assignments` rows, as today.

This is what makes "no backfill required" true rather than aspirational (R7):
post-feature games use the snapshot; pre-feature games had no reassignment to
misrepresent; legacy imports never had a live game.

**Consumers**: exactly one — the `player_assignments` lateral of
`public.completed_session_summaries` (`025:479-497`, superseding `019:73-89`).
Verified that `_history_participant_session_rollups.session_match_count` counts
matches, **not** assignments (`018:96-99`), so nothing else can contradict the
snapshot.

### `public.completed_session_summaries` — new column (FR-047b)

```
assignments_changed_during_play  boolean  NOT NULL
```

Derived, not stored:

```sql
EXISTS (
  SELECT 1 FROM public.gameplay_events e
  WHERE e.session_id = session_rollups.session_id
    AND e.event_type = 'assignment_reassigned'
)
```

Correct by construction for all three session classes (R8): legacy imports and
pre-feature games have no such events, so the flag is false — which is the
truth, and satisfies the spec's US7a scenario 5 regression case.

The view is redefined wholesale (a view cannot gain a column via
`CREATE OR REPLACE` with a changed output list), so migration 041 must
`DROP VIEW` and recreate it with the existing grants reapplied.

---

## 5. Client state — **design only, built in #190**

> **Not part of this slice.** The client half moved to
> [#190](https://github.com/NikolajKrogh/dong/issues/190) (see plan.md §Summary).
> This section is retained as the design record so #190 inherits it rather than
> rediscovering it — in particular the re-hydration table below, which is the
> constraint that keeps FR-045 true on the client.

### `store/store.ts` — new active room identity (R2)

The store today holds `players`, `matches`, `commonMatchId`,
`playerAssignments` and **no room identity**, so the game screen cannot poll a
room it does not know it is in.

```ts
activeRoomSessionId: string | null   // set by the lobby at hydration,
                                     // cleared on End Game / reset
```

Set in `app/lobby/[sessionId].tsx` alongside the existing hydration
(`:196-226`); cleared wherever `resetState()` runs.

### `hooks/useActiveGameRoomSync.ts` — NEW (R2, R3)

Polls the room snapshot on the same ~4s cadence as `useRoomLobby`, for the
session in `activeRoomSessionId`. Inert when that is null (solo games).

**It writes `playerAssignments` and nothing else.**

| Store field | Re-hydrated on poll? | Why |
|---|---|---|
| `playerAssignments` | **Yes** | The point of the feature (FR-049) |
| `matches[].homeGoals` / `awayGoals` | **Never** | Local in-game scoring; server value is stale from kickoff (R1). Overwriting = FR-045 violation |
| `players[].drinksTaken` | **Never** | Same |
| `players` / `matches` membership | Merge only | New entries may appear; existing entries are never replaced |
| `commonMatchId` | Yes | Immutable during a game; safe |

This table is the design's most important constraint. Implementations that
reuse the lobby's hydration shape (`app/lobby/[sessionId].tsx:196-220`, which
writes `homeGoals: match.homeScore`) reset every recorded goal and drink on
each poll. It must be covered by a named unit test in #190.

Note that #190 may dissolve the constraint rather than implement it: if that
issue makes scoring server-authoritative *first*, the server's values stop being
stale and re-hydration can safely include them. The rule above is what applies
for as long as scoring remains local.

---

## 6. Entity relationships

```
game_sessions ──1:N── participants ──┐
      │                              ├── assignments          (live, mutable in-game)
      ├──1:N── matches ──────────────┤
      │                              └── assignment_snapshots (frozen at completion)
      │
      └──1:N── gameplay_events
                 └── assignment_reassigned  (the per-change deltas)

FR-047c reconstruction (normative direction: FORWARD, per R11)

  map_at(T) = kickoff map                    -- payload.assignments of the LAST
                                             -- `assignment_replaced` before
                                             -- `session_started`
            + assignment_reassigned deltas   -- ordered by sequence_number,
              with sequence_number <= T      -- apply removed, then added

  Invariant, asserted in pgTAP:
    assignment_snapshots(session) == map_at(completion)
```

**Why forward, and not backward from the snapshot**: the kickoff map is already
in the log — `036:397-407` writes the complete `(participantId, matchId)` set
into the settlement event's payload (R11). Folding deltas forward over it is
simpler to implement and to test than undoing them in reverse, and it makes the
snapshot an *independently observed* checkpoint rather than the replay's own
starting point. That independence is what stops the invariant above from being
circular: the snapshot is read off the table at completion, the replay is
computed from the event log, and they must agree.

**Care point for the replay**: `035`'s `set_room_assignments` also emits
`assignment_replaced`, potentially several times while the room is still
`joinable`. The kickoff map is the **last** such event before `session_started`
— not the first, and not any single one.

---

## 7. State transitions

No new session state. The slice adds one mutation valid **only** in
`in_progress` — the first of its kind, as every prior room mutation guards
`joinable` (R5).

```
joinable ──start_game_session──> in_progress ──end_game_session──> completed
                                     │                                 ▲
                                     │  reassign_participant_matches    │
                                     │  (host only, repeatable)         │
                                     └──────────────────────────────────┘
                                        snapshot taken on this edge

Rejected: reassignment in joinable (game_not_in_progress),
          in completed or closed (game_not_in_progress),
          by anyone but the host (not_host).
```
