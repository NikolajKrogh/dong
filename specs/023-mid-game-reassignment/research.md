# Phase 0 Research: Host Reassignment During an Active Game

**Feature**: `specs/023-mid-game-reassignment` | **Date**: 2026-08-03 | **Issue**: #186

All findings below were verified against the repository at commit `0297a52`.
Numbers in the "Watch out" section of GitHub issue #186 that this research
contradicts are called out explicitly — the issue's seam notes were written
2026-07-25 and two of them are now stale or incomplete.

---

## R0 — Applicable skills (constitution §VI)

**Decision**: `.agents/skills/` contains `supabase`,
`supabase-postgres-best-practices`, `database-design-expert`,
`database-testing`, `react-native-testing`, and `project-planner`, all of which
apply to this slice. Implementation MUST load `supabase` +
`supabase-postgres-best-practices` before writing migration 041,
`database-testing` before writing the pgTAP suite, and `react-native-testing`
before the client tests.

**Rationale**: Constitution §VI and the delivery-workflow bullet require an
explicit statement of which skills apply, rather than an implied review.

---

## R1 — Does recorded scoring depend on the assignment record? *(load-bearing)*

The spec's central assumption, restated from issue #186 and marked
"re-verify before implementation". Re-verified 2026-08-03, and the answer is
**yes it holds — but the reason is not the one the issue gives.**

**Server side**: confirmed as the issue describes, and more strongly than it
claims. `public.assignments`
(`supabase/migrations/007_create_assignments.sql`) is a bare
`(session_id, participant_id, match_id)` join table with no scoring columns.
Drink totals live on `participants.current_drink_total`
(`004_create_participants.sql`), goals on `matches.home_score`/`away_score`,
and `gameplay_events.actor_participant_id` is on the row
(`008_create_gameplay_events.sql`). Nothing recomputes a total by joining
assignments.

**But there is no server-side scoring at all yet.** `score_changed` and
`drink_changed` are present in the `event_type` CHECK list
(`010`, widened in `031`) and *nothing writes them*. A repo-wide search for
`score_changed`, `drink_changed`, `record_score`, and `current_drink_total`
writes finds no RPC and no client call. `current_drink_total` is only ever
*read*, by the history read models (018–022).

**Client side — this is where the real risk lives.** In-game scoring is
entirely local Zustand state:
- `hooks/useGameProgressController.ts:93-140` — `handleGoalIncrement` /
  `handleGoalDecrement` mutate `matches[].homeGoals/awayGoals` in the store.
- `hooks/useGameProgressController.ts:142-172` — `handleDrinkIncrement` /
  `handleDrinkDecrement` mutate `players[].drinksTaken`.
- `hooks/useGameProgressController.ts:58-69` — `getPlayersWhoDrink` is the
  **only** consumer of `playerAssignments`, and it is a pure forward-looking
  attribution function: given a match that just scored, who drinks *now*.

**Decision**: FR-045 and FR-046 hold structurally on both sides — `drinksTaken`
accumulates on the player, goals accumulate on the match, and neither is
derived from `playerAssignments`. Changing the assignment map changes only
future attribution, which is exactly FR-046.

**Alternatives considered**: Versioning assignments with validity intervals
(`valid_from`/`valid_to`) so scoring could be re-derived per moment. Rejected —
nothing derives scoring from assignments in the first place, so the versioning
would buy only the FR-047c reconstruction, which the event log already
supplies more cheaply and more auditably.

---

## R2 — The game screen is not server-connected *(largest scope discovery)*

**Finding**: FR-049 says every client picks up a reassignment "through the room
snapshot it already polls". **The active game screen polls nothing.**

- `app/gameProgress.tsx` renders entirely from `useGameProgressController`,
  which reads `players`, `matches`, `commonMatchId`, `playerAssignments` from
  `useGameStore()` — the local AsyncStorage-backed Zustand store.
- `store/store.ts` has no `sessionId`, no room identity of any kind. The game
  screen literally cannot poll a room it does not know it is in.
- The room snapshot is hydrated into the store **once**, by the lobby, at
  `app/lobby/[sessionId].tsx:196-226`, immediately before
  `router.replace("/gameProgress")`.
- `hooks/useRoomLobby.ts` — the ~4s snapshot poll the issue points at — is used
  only by the lobby, `useRoomConfigure`, and the guest hooks. It has no game-screen
  consumer.
- The only polling on the game screen is `useLiveScores` at 60s, which fetches
  ESPN scores through the Java proxy — unrelated to room state.

**Decision**: This slice must add room identity to the store and an
assignment-only room snapshot poll to the game screen. This is the single
largest task in the slice and appears nowhere in issue #186's subtask list; the
issue's "must ride the existing room snapshot (`useRoomLobby` / `RoomSnapshot`)"
note is accurate about the *transport* and wrong about it already reaching this
screen.

**Alternatives considered**:
- *Reuse `useRoomLobby` wholesale on the game screen.* Rejected: it carries
  lobby-only concerns (start-game observation, `seenPreStartRef` redirect
  logic, assignment-plan feasibility) and its consumers expect lobby
  semantics. A narrow `useActiveGameRoomSync` hook that polls the same RPC is
  the smaller surface.
- *Push via Supabase Realtime.* Rejected: the whole product synchronises on the
  ~4s snapshot poll; introducing a second synchronisation mechanism for one
  feature contradicts FR-049 and the established pattern.

---

## R3 — Re-hydration must be assignment-only *(the FR-045 data-loss trap)*

**Finding**: The obvious implementation of R2 — call the lobby's hydration
routine on each poll — **destroys recorded scoring every ~4 seconds.**

`app/lobby/[sessionId].tsx:196-220` hydrates by writing
`matches[].homeGoals: match.homeScore`, `matches[].awayGoals: match.awayScore`,
and rebuilding `players` from the snapshot. Because no server-side scoring
exists (R1), `matches.home_score` and `participants.current_drink_total` on the
server stay at their start-of-game values for the whole game. Re-hydrating with
the lobby shape therefore resets every goal and drink recorded during play back
to zero, on the poll interval.

That is a direct FR-045 violation ("MUST NOT alter, remove, or recompute any
goal or drink already recorded") caused by the mechanism FR-049 requires — and
critically, **the pgTAP suite the issue prescribes would not catch it**, because
those tests assert on server columns that nothing writes during play.

**Decision**: Game-screen re-hydration writes `playerAssignments` and nothing
else. It MUST NOT touch `matches[].homeGoals`, `matches[].awayGoals`, or
`players[].drinksTaken`. New matches or participants appearing in the snapshot
are merged, never wholesale-replaced. This is enforced by a named unit test
asserting local scoring survives a poll that returns changed assignments —
not by a code comment.

**Alternatives considered**: Making the server the source of truth for in-game
scoring so re-hydration is safe. Rejected — that is a much larger feature
(server-side scoring), out of scope here, and 020 already places it outside
this slice.

---

## R4 — The reassignment event type

**Finding**: The issue says the reassignment event kind "must be added" to
`010_constrain_gameplay_events.sql`'s CHECK. Two corrections:

1. The **current** constraint is not 010's — it was dropped and redefined in
   `031_room_lifecycle.sql:24-44`, which added the lobby/handover/closure
   kinds. A new migration must redefine it from 031's list, not 010's.
2. `assignment_replaced` **already exists** in that list — but it is taken.
   Every started game emits exactly one at settlement
   (`035:181`, `036:400`, `037:477`, `038:693`). Reusing it would make
   FR-047b's test — "did this game's assignments change during play?" —
   evaluate true for *every* game ever started.

**Decision**: A distinct event type, `assignment_reassigned`, added in migration
`041`. Payload carries the target participant plus the added and removed match
IDs, which is what FR-047c's delta reconstruction consumes.

**Alternatives considered**: Reusing `assignment_replaced` with a payload
discriminator. Rejected — it makes the FR-047b query a payload inspection
rather than an existence check, and conflates a lobby whole-set replacement
with a per-participant in-game delta.

---

## R5 — Room-state guard and the completed-session trigger

**Finding**: `public.prevent_events_on_completed`
(`009_helpers_and_triggers.sql:16-28`) blocks event inserts when
`state = 'completed'` — **only**. It does not cover `closed`. FR-044 requires
rejecting both.

Also confirmed: every existing pre-start mutation guards `state = 'joinable'`
(`035_configure_start_game_rpcs.sql` and #184/#185's RPCs). Reassignment is the
first mutation requiring `in_progress`, so that guard must not be copied. The
closest precedent is `private.end_game_session`
(`040_end_running_game.sql:38-91`), which guards `in_progress` and raises
`game_not_in_progress` — reuse that error name and shape.

**Decision**: An explicit `IF v_room.state <> 'in_progress' THEN RAISE
EXCEPTION 'game_not_in_progress'` guard, taken under `SELECT ... FOR UPDATE`,
before any write. Never rely on the 009 trigger for the FR-044 rejection: it
misses `closed`, and its message is an internal one.

---

## R6 — Where the completion snapshot is taken

**Finding**: Only one live code path reaches `completed`:
`private.end_game_session` (`040_end_running_game.sql:87`). The other terminal
path, `leave_room_as_host`, sets `closed` (abandoned, not played) and the
history read models only treat `completed` as a played session
(`018:14`, `025:252`). The legacy-import path (`023`/`025`) inserts sessions
that are already `completed`, bypassing `end_game_session` entirely.

`end_game_session` also establishes the ordering constraint: it writes its
`session_completed` event **before** flipping state, because the 009 trigger
rejects inserts once `completed`.

**Decision**: Take the snapshot inside `private.end_game_session`, in the same
transaction, before the state flip — alongside the existing
`session_completed` insert. Idempotent on an already-completed room, matching
that function's existing early return.

### R6a — …but almost nothing reaches `completed` today

**Finding (2026-08-03)**: there are **two** `handleEndGame` functions and they do
entirely different things.

| Where | What it does |
|---|---|
| `app/lobby/[sessionId].tsx:146` | `configure.endGame()` → `end_game_session` → **`completed`** |
| `hooks/useGameProgressController.ts:181` | opens a modal → `saveGameToHistory()`, `resetState()`, `router.replace("/")` — **never tells the server** |

`040`'s own header comment states it: *"the game screen's End Game is purely
local (save to history, reset the store, go home) and never tells the server."*

The lobby is left behind at kickoff (`router.replace("/gameProgress")`), so a
host finishing a game presses the **game screen's** button. The room is never
told; it sits `in_progress` until `expire_stale_rooms` (034, every 15 minutes)
flips it to `closed`. And `closed` is not `completed` — the history read models
gate on `state = 'completed'` (`018:14`, `025:252`).

**Consequence**: for a normal multiplayer game today, the room never reaches
`completed`, never appears in server-side history, and `end_game_session` never
runs. FR-047a/b/c all hang off a state the product's main path does not reach.
(Not strictly unreachable — Home → "Return to room" → lobby → End Game works —
but that is a recovery route, not the flow.)

**Decision: change nothing here.** `end_game_session` is the correct seam; it is
the one function that means "this game is over". The defect is that the game
screen does not call it, which is already in
[#190](https://github.com/NikolajKrogh/dong/issues/190)'s scope. This slice
builds the mechanism correctly and #190 connects the path that fires it. Moving
the snapshot to chase the current broken behaviour would put the right thing in
the wrong place because the wrong thing has not been fixed yet.

**Alternative considered — also snapshot on the `closed` path.** Rejected. It
looks like cheap insurance for expired games but adds nothing: once a room is
terminal nothing mutates `public.assignments` again, so R7's fallback already
serves those sessions accurately from the live table. A second write site would
duplicate for zero information gain, and would imply `closed` rooms are played
games — contradicting `040`'s deliberate distinction, where `completed` means
finished and `closed` means abandoned.

**Documentation obligations this creates** (both discharged):
- The quickstart must tell a validator to end the game **from the lobby**;
  reaching for the game screen's button yields no snapshot and looks like a
  broken feature.
- #190's "wire End Game to the server" bullet is not one item among eight — it
  is what makes server-side history exist at all. Called out there explicitly.

**Alternatives considered**: An `AFTER UPDATE` trigger on `game_sessions`
firing when state becomes `completed`. Rejected — it would also fire for the
legacy-import path's direct inserts/updates, which R7's fallback handles more
honestly, and hidden trigger-driven writes are harder to test and reason about
than an explicit step in the one RPC that means "this game is over".

---

## R7 — Repointing the history read model, and the no-backfill argument

**Finding**: `private._history_completed_assignments` reads live
`public.assignments` (defined `018:41`, redefined `025:282`). It has exactly
**one** consumer: the `player_assignments` lateral of
`public.completed_session_summaries` (`019:73-89`, superseded by `025:479-497`).

Checked and cleared: `_history_participant_session_rollups.session_match_count`
counts `_history_completed_matches`, **not** assignments (`018:96-99`), so it
does not contradict a snapshot. No other read model touches assignments. The
repoint is a single, contained change.

**Decision**: Snapshot-with-fallback. `_history_completed_assignments` reads
the snapshot table when a snapshot exists for the session, and falls back to
live `public.assignments` when it does not.

**Rationale**: This is what makes "no backfill required" true rather than
aspirational. Three classes of completed session exist and all are served
correctly:
- Games completed after this ships → snapshot present, snapshot used.
- Games completed before this ships → no snapshot, no mid-game reassignment
  either (the feature did not exist), so the live table is still accurate.
- Legacy imports (`023`/`025`) → no snapshot, never had a live game, live
  table accurate.

**Alternatives considered**: Backfilling snapshots for all existing completed
sessions. Rejected — it adds a data migration whose only effect is to copy the
live table into a snapshot that says the same thing, and it would still need
the fallback for future legacy imports.

---

## R8 — Expressing FR-047b ("assignments changed during play")

**Decision**: A completed game's assignments changed during play **iff** at
least one `assignment_reassigned` event exists for that session. Surfaced on
`completed_session_summaries` as a boolean (`assignments_changed_during_play`)
derived from that existence check.

**Rationale**: R4's dedicated event type makes this a clean `EXISTS` over
`gameplay_events`, with no payload inspection and no extra column to keep in
sync. It is also self-maintaining for the three session classes in R7: legacy
and pre-feature games have no such events, so the flag is correctly false.

**FR-047c falls out of the same records** — see R11 for the normative
direction (forward, from the kickoff map in the log) and the invariant that
verifies it. This satisfies constitution §III, and it is why FR-047d forbids
pruning those events.

---

## R9 — Authorisation shape

**Decision**: Host-only, server-enforced, following the existing
`v_room.owner_account_id <> v_account → RAISE 'not_host'` pattern used by
`end_game_session` (`040:51`) and every RPC in 035. Guests cannot reach it at
all: the room-scoped guest token path (`026`/`033`) is not wired to this RPC,
so a guest attempt fails on `auth.uid() IS NULL → not_authenticated`.

This is the *inverse* of #185's participant-writes-own-row shape and needs none
of that machinery.

**Idempotency (constitution §II)**: the RPC takes `p_idempotency_key`, matching
035/036's parameter and feeding `gameplay_events.idempotency_key`, which is
uniquely indexed per session (`008`). A retried reassignment is absorbed rather
than double-recorded.

---

## R10 — Common Match and pool confinement (FR-048)

**Corrected 2026-08-03.** An earlier draft of this finding claimed the Common
Match "is not a per-participant assignment row, so removing it is not
expressible against `public.assignments`". **That is wrong**, and the design
built on it contained a defect.

**Finding**: settlement writes a real `public.assignments` row for the Common
Match, for **every** participant — `036:383-385`, and identically in `037` and
`038`:

```sql
-- FR-002: every active participant also holds the Common Match.
INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
SELECT p_session_id, unnest(v_participant_ids), v_room.common_match_id, now();
```

It sits in the table alongside every other assignment. What the *pool* excludes
(`036:336`, `id <> common_match_id`) and what the lobby filters out when
hydrating (`app/lobby/[sessionId].tsx:210-214`) is a presentation and
allocation concern, not a storage one.

**The defect this caused**: with `match_ids` defined as the complete new set
*excluding* the Common Match, and the RPC deleting any row not in that set, the
Common Match row would be deleted on **every call** — while the design claimed
to enforce FR-048. The validation guard did not help: it rejected payloads that
*contained* the Common Match, catching only callers trying to do the right
thing, while the destructive path ran through the delete.

**Decision**: `match_ids` continues to exclude the Common Match — that matches
how the pool, the per-player count (FR-003's "additional" matches), and the
client all already think — but **the delta is scoped to exclude it as well**.
The `DELETE` carries `AND match_id <> v_room.common_match_id`, making the row
structurally untouchable. The explicit guard remains, demoted to input
validation.

This moves FR-048's guarantee from a check to a query scope, which is strictly
stronger: a validation check can be bypassed by a future code path; a `WHERE`
clause on the only `DELETE` cannot.

**Alternatives considered**:
- *`match_ids` is the literal complete set, Common Match included; reject when
  absent.* Rejected: it expresses FR-048 directly but makes forgetting the
  Common Match destructive, and every caller must remember a rule nothing else
  in the codebase applies.
- *A delta API (`addMatchIds`/`removeMatchIds`).* Rejected: it makes FR-048 a
  trivial membership check, but reintroduces exactly what whole-set semantics
  was chosen to avoid — two clients disagreeing about what "remove match X"
  meant against different local views.

**Pool confinement**: `public.assignments`' composite FK to
`matches(session_id, id)` (`007:12`) already prevents assigning a match outside
the session's pool, but surfaces as a raw `23503`. Validate explicitly first,
raising `match_not_in_room_pool`, per FR-048a.

**Consequences to preserve**:
- The kickoff map includes Common Match rows; no delta ever mentions them;
  forward replay leaves them in place; the snapshot holds them. R11's invariant
  is consistent under this decision.
- `_history_completed_assignments` reads the table unfiltered, so
  `player_assignments` in history **already includes the Common Match**. That is
  pre-existing behaviour to preserve, not change — and the snapshot repoint is
  exactly the kind of change that could quietly drop it, so it needs its own
  assertion.

---

## R11 — The kickoff map is already in the event log

**Finding (2026-08-03)**: the settlement event's payload contains the
**complete kickoff assignment map**, not just a marker. `036:397-407` (and
identically `037:477`, `038:693`) writes:

```json
{ "assignments": [ { "participantId": "<uuid>", "matchId": "<uuid>" }, ... ] }
```

So FR-047c's reconstruction also runs *forward* — kickoff map plus the ordered
`assignment_reassigned` deltas — and the end state the snapshot holds is itself
derivable. `assignment_snapshots` is therefore a **denormalization of what the
event log already says**, not a new fact.

This reframes the 2026-07-25 clarification. That session chose "snapshot at
completion" against the alternative of *reading the live table*. Replaying from
the log was not considered, and it satisfies FR-047a's stated rationale equally
well — it never touches the live table either. Constitution §III arguably
prefers it, since the event log is the persisted record §III points at.

**Decision**: keep the snapshot, on three grounds that survive that challenge —
and use the redundancy rather than merely tolerating it.

1. **View complexity.** `_history_completed_assignments` feeds
   `completed_session_summaries`, a *list* view. Forward replay in SQL means,
   per session: find the last `assignment_replaced` before `session_started`
   (035's `set_room_assignments` may emit several pre-start), unnest its jsonb,
   then fold an ordered delta stream over it — a recursive CTE in a hot list
   query, against a three-column table read.
2. **It bounds drift.** Forward replay is correct only if *every* mutation of
   `public.assignments` writes an event. True today; #165 (leave semantics)
   touches exactly this area. A future path that mutates assignments without
   logging makes replay diverge silently, while the snapshot stays true to what
   was actually there at completion.
3. **Two independent observations of the same answer.** The snapshot is read off
   the table at completion; the replay is computed from the log. That is what
   makes the invariant below meaningful rather than circular.

**The invariant this buys** — normative, and the highest-value test in the
slice:

> For any completed session, `assignment_snapshots` equals
> `replay(kickoff map, ordered assignment_reassigned deltas)`.

One assertion proves the snapshot is honest, the deltas are complete, and
FR-047c's reconstruction genuinely works — instead of asserting in prose that
reconstruction is *possible*, which is all the spec can do on its own. It also
catches the class of bug where the RPC writes the assignment rows correctly but
records a wrong or partial delta in the event payload, which no other test in
the suite would notice.

**Consequence for the design**: forward replay (from the kickoff map) is the
**normative** reconstruction direction — simpler to implement and to test than
backward replay from the snapshot. The snapshot is the checkpoint that replay is
validated against, and the read path history actually uses.

**Alternatives considered**: dropping the snapshot and repointing
`_history_completed_assignments` at the replay. Rejected on (1) and (2) above.

---

## R12 — Idempotency and conflict handling for a *repeatable* mutation

Constitution §II requires every shared-state mutation to define both. Whole-set
semantics makes both non-obvious, and an earlier draft of the contract got the
precedent wrong.

**Correction**: that draft said a retry "must return the original result rather
than raising — matching `036`'s `p_idempotency_key` handling." **`036` has no
such handling.** Its `p_idempotency_key` only composes the event's key string;
there is no lookup and no replay. A retried `start_game_session` is *rejected*
by the `state <> 'joinable'` guard at `036:292`. That works because starting is
once-per-room — and it is exactly why the pattern does not transfer.
Reassignment is **repeatable**: no state transition makes the second call
naturally invalid.

**Decision — explicit idempotency replay.** Look up `gameplay_events` by
`(session_id, idempotency_key)`; if present, return its payload and write
nothing. Positioned after the host check but before the room-state guard (see
contract §Guard order for why both halves of that placement matter).

The lookup is load-bearing, not decoration. A duplicate carrying the *same*
target set is already harmless — empty delta, no-op, no write. The case that
bites is a duplicate arriving *after* another change landed: the delta
recomputes non-empty, a stale intention is re-applied, and
`ux_gameplay_events_session_idempotency` (008) raises a raw `23505` at the
client — the exact raw-constraint-violation FR-048a exists to prevent.

**Decision — last-write-wins, accepted deliberately.** `SELECT ... FOR UPDATE`
on the room row serialises concurrent calls, so nothing corrupts. Beyond that,
the last writer wins: two host devices — or a host and a successor after a
mid-game handover, which `033`/`040` permit — each hold a snapshot up to one
poll interval stale, and the second silently reverts the first with no error to
the first host. FR-047c reconstruction stays truthful; the audit log records
both, because from the server's position both were legitimate.

**Alternatives considered**: optimistic concurrency — the caller passes the set
it believes is current, and the RPC refuses on mismatch with
`assignments_changed_concurrently`. More correct, and rejected **for now** on
two grounds: the exposure window is one poll interval on a screen where one
person is realistically acting, and the client that must catch the rejection,
refresh, and re-present the conflict does not exist yet (it is #190's).
Building a concurrency protocol whose only consumer is unwritten is speculative.
It remains an **additive** parameter later — the whole-set shape does not have
to change to adopt it.

**Conditions attached**, so a considered decision is distinguishable from an
unconsidered one: the response returns the resulting `matchIds` (letting #190
detect divergence with no server change), and the limitation is recorded in the
spec's Assumptions so #190 inherits a known constraint rather than filing it as
a bug.

---

## R13 — Review hardening: input, identity, retention, and snapshot completeness

**Finding (2026-08-16)**: cross-artifact review against issue #186 found six
contract boundaries that the first design did not pin down.

**Decisions**:

1. **Preserve settled cardinality.** `match_ids` excludes the Common Match and
   must contain exactly the target participant's current number of non-Common
   assignments. Comparing to the settled rows, rather than recomputing from room
   settings, also preserves games started with relaxed constraints.
2. **Reject malformed sets.** Null arrays, null elements, and duplicate IDs fail
   as `invalid_reassignment_input` before replay or mutation.
3. **Bind idempotency to intent.** The event stores a fingerprint of the target
   participant and sorted desired set. Equal requests replay; different-input
   reuse fails as `idempotency_key_reused`, including after a concurrent unique
   index race.
4. **Resolve the audit actor explicitly.** `gameplay_events.actor_participant_id`
   is non-null and session-scoped (008). Follow 036/038: resolve the active owner
   participant belonging to `auth.uid()` and reject a broken identity invariant
   as `host_participant_not_found`.
5. **Make snapshot completeness observable.** Remove per-row conflict
   suppression. Store the expected total row count with each snapshot row,
   verify the insert count before completion, and reject any partial snapshot
   insert at the statement boundary rather than treating "any row exists" as
   complete in history.
6. **Pin retention.** Reassignment events and snapshots live as long as their
   completed session and cannot be independently pruned. Existing restrictive
   foreign keys remain the session deletion policy; any future deletion feature
   must delete session, events, and snapshot atomically.

**Alternatives considered**: allowing variable slot counts (rejected as a hidden
settings change); replaying any same-key request (rejected because it can report
false success); a separate snapshot manifest table (valid but unnecessary when
the expected count can make the single-table design self-validating).

## R14 — PostgreSQL 17 execution boundary for completeness

**Finding (2026-08-16)**: the first implementation put a completeness assertion
inside the completed-history view. On the local PostgreSQL 17.6 image, that
shape caused a backend crash while the view was planning or executing existing
history queries; a stable wrapper could also be optimized away and fail to
reject a partial insert.

**Decision**: enforce completeness at the write boundary with a statement-level
`AFTER INSERT` trigger over `assignment_snapshots`, and keep the history view a
pure snapshot-or-live-fallback read model. `end_game_session` inserts all rows
in one statement, so valid completion still passes, while a partial insert is
rejected with `assignment_snapshot_incomplete` before it can become visible to
history. The local reset and full pgTAP suite validate this shape against
PostgreSQL 17.6.

---

## Outcome: the issue was rescoped

R2 and R3 together are why #186 was cut down to its **server slice** on
2026-08-03. The client half — the game-screen snapshot poll, room identity in
the store, the host-only reassignment control, and the FR-047b history
indication — moved to
[#190](https://github.com/NikolajKrogh/dong/issues/190), which owns the missing
foundation.

R3 in particular reads differently after that decision. It is not a hazard to
engineer around inside this slice; it is the *symptom* of building
synchronisation onto a screen that has no server truth to synchronise with.
#190 may well dissolve it rather than guard against it: make scoring
server-authoritative first, and the server's values stop being stale.

R1's client-side finding, R2, and R3 are all recorded in #190's issue body so
that work does not have to rediscover them.

---

## Open items carried into implementation

- **`specs/020` FR-049 is inaccurate as written** for the active game screen
  (R2). Not corrected here — 020 is the canonical document and editing it is
  out of this slice's scope. Recorded as a delta; raise it against 020 separately.
- **R1's client-side finding should be re-verified** if server-side scoring
  lands before this slice is implemented. It would not invalidate FR-045, but
  it would change R3's re-hydration rule from "assignment-only" to something
  that can safely include scores.
