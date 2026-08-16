# Contract: Mid-Game Reassignment

**Feature**: `specs/023-mid-game-reassignment` | **Date**: 2026-08-03

Interfaces this slice exposes. Everything lands in migration
`041_mid_game_reassignment.sql` plus the client RPC wrapper in
`utils/supabaseClient.ts`.

---

## 1. `public.reassign_participant_matches` — NEW RPC

Follows the established two-function pattern: a `private.` implementation
holding the logic, and a thin `public.` `SECURITY DEFINER` wrapper that is the
only thing `authenticated` may execute (as in `040_end_running_game.sql:93-101`).

### Signature

```sql
public.reassign_participant_matches(
  session_id      uuid,
  participant_id  uuid,
  match_ids       uuid[],   -- the participant's COMPLETE new set of POOL
                            -- matches; excludes the Common Match (R10)
  idempotency_key uuid
) RETURNS jsonb
```

`match_ids` is the desired end state for that participant, not a delta. The RPC
computes the added/removed delta server-side, so two clients cannot disagree
about what "remove match X" meant against differing local views.

`match_ids` MUST be non-null, contain no null elements or duplicates, and have
the same cardinality as the participant's current non-Common assignment set.
The RPC sorts it canonically before fingerprinting or returning it.

**The Common Match is outside this set, and outside the delta** (R10).
Settlement writes a real `assignments` row for it for every participant
(`036:383-385`) — it is not a virtual assignment. Excluding it from `match_ids`
without also excluding it from the delta would delete it on every call. So both
the `DELETE` and the added/removed computation carry
`AND match_id <> v_room.common_match_id`. This, not the guard in step 6, is what
enforces FR-048's "MUST NOT be able to remove the Common Match".

**Grants**: `REVOKE ALL ... FROM PUBLIC, anon, authenticated` on the `private.`
function, `GRANT EXECUTE ... TO service_role`; the `public.` wrapper grants
`EXECUTE` to `authenticated` only. Guests hold no `auth.uid()` and are rejected
at the first guard (R9).

### Guard order (normative)

Guards run in this order, all before any write, with the room row held under
`SELECT ... FOR UPDATE`:

1. `auth.uid()` present → else `not_authenticated`
2. Room exists → else `room_not_found`
3. `owner_account_id = auth.uid()` → else `not_host` *(FR-044)*
3a. Resolve exactly one active owner participant for `(session_id, auth.uid())`
   → else `host_participant_not_found`. This participant is the non-null
   `actor_participant_id` on the event *(FR-053)*.
3b. Validate `participant_id`, `match_ids`, and `idempotency_key` are non-null;
   validate that `match_ids` has no null or duplicate entries → else
   `invalid_reassignment_input` *(FR-051)*.
3c. **Idempotency replay** — if an event already exists for
   `(session_id, idempotency_key)`, compare its stored request fingerprint. If
   equal, return its payload and stop; if different, raise
   `idempotency_key_reused`. See §Idempotency.
   **Position is deliberate, in both directions.** *After* the authorisation
   guards, because replaying first would disclose a stored payload to any caller
   who guessed a session and key. *Before* the state guard, because a retry
   whose original succeeded must keep returning that result even if the game has
   since ended — otherwise a lost response to the last reassignment of a game
   turns into a spurious `game_not_in_progress` on retry.
4. `state = 'in_progress'` → else `game_not_in_progress` *(FR-044 — covers
   `joinable`, `completed`, and `closed`; do **not** delegate to the 009
   trigger, which misses `closed` — R5)*
5. Target participant is in this session and `left_at IS NULL` → else
   `participant_not_in_room`
6. No `match_ids` entry equals `game_sessions.common_match_id` → else
   `cannot_reassign_common_match`. **Input validation only** — FR-048's actual
   guarantee is the delta scoping above, because a check here cannot protect a
   row the `DELETE` would otherwise sweep (R10)
7. Every `match_ids` entry exists in `public.matches` for this session → else
   `match_not_in_room_pool` *(FR-048; the composite FK is the backstop, but
   the explicit check is what produces the clean error FR-048a requires — R10)*
8. `cardinality(match_ids)` equals the target's current count of non-Common
   assignments → else `assignment_count_mismatch` *(FR-050)*.

**No-op**: if the computed delta is empty, return successfully **without**
writing an event. A reassignment that changes nothing is not a reassignment,
and recording one would make FR-047b's flag true for a game whose assignments
never changed.

### Behaviour

Within one transaction:
1. Delete `public.assignments` rows for `removedMatchIds`, with the
   `match_id <> common_match_id` scope above.
2. Insert rows for `addedMatchIds`. Untouched matches keep their original
   `created_at`, and so does the Common Match row, which is never in either
   list.
3. Insert one `assignment_reassigned` event with
   `public.allocate_event_sequence(session_id)` and the payload in
   [data-model.md §2](../data-model.md).

The event uses the active owner participant resolved at guard 3a as
`actor_participant_id`; the target participant remains separately identified in
the payload.

**Explicitly does not**: touch `participants.current_drink_total`,
`matches.home_score`, `matches.away_score`, or any prior `gameplay_events` row
(FR-045).

**The recorded delta must match the rows actually written.** The event payload
is not a log line — it is replayed against the kickoff map and compared to the
completion snapshot by the FR-047c invariant (data-model.md §6). Compute
`addedMatchIds`/`removedMatchIds` from the same query that drives the
`DELETE`/`INSERT`, in the same transaction, so the two cannot diverge.

### Success response

```json
{
  "sessionId": "<uuid>",
  "participantId": "<uuid>",
  "addedMatchIds":   ["<uuid>"],
  "removedMatchIds": ["<uuid>"],
  "matchIds":        ["<uuid>"],
  "sequenceNumber": 42
}
```

### Error vocabulary

| Error | Meaning | Client message intent (FR-048a) |
|---|---|---|
| `not_authenticated` | No signed-in caller | Sign-in required |
| `room_not_found` | Unknown session | Room no longer exists |
| `not_host` | Caller is not the host | Only the host can change assignments |
| `game_not_in_progress` | Room is `joinable`, `completed`, or `closed` | Assignments can only be changed while the game is running |
| `participant_not_in_room` | Target absent or has left | That player is no longer in the room |
| `host_participant_not_found` | Authenticated owner has no unique active owner participant | Room host identity is inconsistent; refresh or recover the room |
| `invalid_reassignment_input` | Missing key/set, null element, or duplicate match | Choose a valid set of matches and retry |
| `cannot_reassign_common_match` | `match_ids` names the Common Match | The common match belongs to everyone and can't be changed here |
| `match_not_in_room_pool` | Match outside this room's matches | That match isn't part of this room |
| `assignment_count_mismatch` | Desired set changes the participant's settled slot count | Replace every existing slot; matches cannot be added or removed |
| `idempotency_key_reused` | Key was previously bound to different request inputs | Retry this action with a new request key |

Every one of these leaves state unchanged. A raw `23503` constraint violation
reaching the client is a defect, not an expected path.

### Idempotency (constitution §II)

**Replay lookup is guard 3c, after authentication, host authorization, actor
resolution, and structural input validation, but before room-state and target
state checks.** Look up `public.gameplay_events` by
`(session_id, idempotency_key)`. If a row exists, compare the persisted request
fingerprint made from `participant_id` plus the sorted unique `match_ids`. An
equal fingerprint returns the original payload and writes nothing; a different
fingerprint raises `idempotency_key_reused` and writes nothing.

`idempotency_key` is then written to `gameplay_events.idempotency_key`, unique
per session via `ux_gameplay_events_session_idempotency` (008), which backstops
the lookup against a concurrent duplicate.

The fingerprint is stored in the event payload as `requestFingerprint`, and the
canonical request inputs are stored as `requestedMatchIds`. The unique index is
the race backstop: on a concurrent `23505`, re-read the winning event and apply
the same equal-fingerprint replay/different-fingerprint conflict rule rather
than returning the raw constraint violation.

**This is this slice's own decision, not an inherited pattern.** `036`'s
`p_idempotency_key` does *not* work this way: it only composes the event's key
string, and a retried `start_game_session` is rejected by the `state <>
'joinable'` guard at `036:292`, never replayed. That works because starting is
once-per-room. Reassignment is **repeatable** — there is no state transition to
make a second call naturally invalid — so at-most-once has to be explicit here.

Why the lookup is load-bearing rather than belt-and-braces: a duplicate carrying
the *same* target set is already harmless (empty delta → the no-op rule → no
write). The case that bites is a duplicate arriving *after* another change
landed. Without the lookup, the delta recomputes non-empty, a stale intention is
re-applied, and the unique index raises a raw `23505` at the client — precisely
the raw-constraint-violation FR-048a exists to prevent.

### Conflict handling: last-write-wins (constitution §II)

Concurrent reassignments are serialised by the `SELECT ... FOR UPDATE` on the
room row. Beyond that, **the last writer wins, and this is a deliberate
accepted limitation, not an oversight.**

Two host devices — or a host and a successor after a mid-game handover, which
`033`/`040` permit — each hold a room snapshot up to one poll interval stale.
Device A sets Bob to `{m1, m2}`; device B, which never saw that, sets Bob to
`{m1, m3}`. Both succeed. A's change is silently reverted, and the event log
records both as legitimate reassignments, because from the server's position
they were. Nothing is corrupted and FR-047c reconstruction stays truthful — but
the host on device A gets no error.

**Rejected for now: optimistic concurrency.** The caller would pass the
assignment set it believes is current and the RPC would refuse on mismatch with
`assignments_changed_concurrently`. More correct, and deferred because the
window is one poll interval on a screen where realistically one person is
acting, and because the client that must catch the rejection, refresh, and
re-present the conflict does not exist yet — it is
[#190](https://github.com/NikolajKrogh/dong/issues/190)'s. A concurrency
protocol whose only consumer is unwritten is speculative.

**Two conditions on accepting this**, so that a considered decision does not
look like an unconsidered one:

1. The response returns `matchIds`, the resulting set. #190 can compare it to
   what it sent and refresh on divergence, with no server change.
2. The limitation is recorded in the spec's Assumptions, so #190 inherits a
   known constraint rather than filing it as a bug.

Should two-device hosting prove common, the optimistic token is an **additive**
parameter later — the whole-set shape does not have to change.

---

## 2. Client RPC wrapper

`utils/supabaseClient.ts`, on the existing room RPC client interface beside
`endGameSession`:

```ts
reassignParticipantMatches(
  input: ReassignParticipantMatchesInput,
): Promise<ReassignParticipantMatchesResponse>;
```

with both types added to `types/room.ts`. Error mapping follows the existing
convention in that file: the Postgres error name is matched and converted to a
typed client error carrying the message intent above.

---

## 3. Room snapshot — unchanged shape

`RoomSnapshot.assignments: RoomAssignmentSummary[]` (`types/room.ts:65-80`)
already carries what FR-049 needs. **No snapshot contract change in this slice.**
What is missing is a *consumer* on the active game screen (R2) — a client gap,
not a contract gap, and it is [#190](https://github.com/NikolajKrogh/dong/issues/190)'s.

Binding on #190 when it builds that consumer: it MUST apply the assignment-only
rule in [data-model.md §5](../data-model.md) for as long as scoring remains
local — read `assignments`, ignore `matches[].homeScore`/`awayScore` and
`participants[].currentDrinkTotal`. Those fields are accurate for the lobby and
stale from kickoff during a game, because no server-side scoring exists (R1).
Treating them as authoritative mid-game destroys recorded scoring (R3).

---

## 4. `public.completed_session_summaries` — additive change

Gains one column (FR-047b):

```
assignments_changed_during_play  boolean  NOT NULL
```

Existing columns, ordering, and grants are unchanged. `player_assignments`
keeps its shape and meaning but now resolves through the snapshot when one
exists (data-model.md §4) — a source change, not a contract change.

Because a view cannot gain a column via `CREATE OR REPLACE`, migration 041
drops and recreates it, reapplying the `REVOKE`/`GRANT` block from `025`.

**Client**: there is currently no client query or generated type for this server
history view; the app's history screen remains local. This slice changes the
database contract only. #190 adds the consumer type and renders the indication.
Existing database consumers that ignore the additive column continue to work.
