# Quickstart: Validating Mid-Game Reassignment

**Feature**: `specs/023-mid-game-reassignment` | **Date**: 2026-08-03

How to prove this slice works. Design details live in
[data-model.md](data-model.md) and
[contracts/reassignment-rpc.md](contracts/reassignment-rpc.md); this file is the
run guide.

> **Scope**: server slice only. There is no UI to click and no journey to walk —
> the client half is [#190](https://github.com/NikolajKrogh/dong/issues/190).
> Validation is pgTAP plus one unit test. That is the whole of it, and a green
> run here means the slice is done.

---

## Prerequisites

- Docker running (the local Supabase stack needs it)
- `npm install` completed
- `.env.local` present (`npm run auth:env`)

```bash
npm run db:start
```

```bash
npm run db:reset
```

`db:reset` re-runs every migration in order, including
`041_mid_game_reassignment.sql`.

---

## 1. Database validation (pgTAP)

```bash
npm run db:test
```

Expected: the whole suite green, including the new
`supabase/tests/database/240_mid_game_reassignment.test.sql`. That file must
cover, at minimum:

**Guards (FR-044, FR-048)** — each asserts the error *and* that no row changed:
- a non-host member is rejected with `not_host`
- a guest is rejected (no `auth.uid()`)
- reassignment in `joinable` → `game_not_in_progress`
- reassignment after `end_game_session` → `game_not_in_progress`
- reassignment in a `closed` room → `game_not_in_progress`
  *(the important one: the 009 trigger does **not** cover `closed` — R5)*
- `match_ids` naming the Common Match → `cannot_reassign_common_match`
- a match from another session → `match_not_in_room_pool`, not a raw `23503`
- a participant with `left_at` set → `participant_not_in_room`
- a null array, null array element, or duplicate match ID →
  `invalid_reassignment_input`
- a desired set with fewer or more non-Common matches than the participant's
  settled set → `assignment_count_mismatch`
- a broken room with no unique active owner participant →
  `host_participant_not_found`, with no event written

**The Common Match survives (FR-048, R10)** — the assertion that catches the
defect the design originally had, and none of the guard tests above would:
- after a perfectly ordinary reassignment with a valid `match_ids` that simply
  omits the Common Match (as it must), the participant **still holds their
  Common Match row** in `public.assignments`
- the same after several consecutive reassignments
- neither `addedMatchIds` nor `removedMatchIds` in any recorded event ever
  mentions the Common Match
- the completion snapshot contains each participant's Common Match row
- `player_assignments` in `completed_session_summaries` still includes the
  Common Match after the snapshot repoint — this is **pre-existing** behaviour
  (`_history_completed_assignments` reads the table unfiltered) that the
  repoint must not quietly drop

**Immutability (FR-045)** — the headline assertion:
- record scoring, capture `participants.current_drink_total` and both
  `matches.home_score`/`away_score`, reassign, and assert every value is
  identical afterwards
- assert the session's `gameplay_events` count for pre-existing rows is
  unchanged and no row was updated

**Audit (FR-047)**:
- exactly one `assignment_reassigned` per reassigning call
- **zero** events when the computed delta is empty (the no-op rule — otherwise
  FR-047b would flag a game whose assignments never changed)
- a retry with the same `idempotency_key` produces no second event

**Idempotency and concurrency (R12)**:
- a retry with the same key **returns the original payload**, and never raises
  a raw `23505`
- a retry with the same key and a different participant or desired match set
  raises `idempotency_key_reused` and changes nothing
- two concurrent calls with one key resolve through fingerprint comparison after
  the unique-index race; equal inputs replay and different inputs conflict
- a retry with the same key whose delta would now be *non-empty* (because
  another reassignment landed in between) still replays the original and
  changes nothing — this is the case the lookup exists for, and it fails
  loudly without it
- a retry arriving after the game has completed still replays the original
  rather than raising `game_not_in_progress` — the lookup sits before the state
  guard for exactly this
- a **non-host** presenting a valid existing key gets `not_host`, not the stored
  payload — the lookup sits after the authorisation guards for exactly this
- two sequential reassignments to the same participant from differing starting
  views both succeed, the later one wins, and **both** are recorded as events
  (last-write-wins is the documented behaviour; the test pins it so a future
  change to it is a deliberate one)

**Snapshot (FR-047a)**:

> ⚠️ **End the game from the lobby, not the game screen.** The game screen's End
> Game button is local-only — it saves to the device and never calls
> `end_game_session` (`040`'s header comment says so; see R6a). A room ended
> that way stays `in_progress` until the 15-minute expiry job flips it to
> `closed`, so **no snapshot is written and the game never enters server-side
> history**. That is a pre-existing gap owned by #190, not a failure of this
> slice. In pgTAP, call `private.end_game_session` directly.

- `end_game_session` writes one `assignment_snapshots` row per live assignment
- every snapshot row carries the same `expected_assignment_count`, equal to the
  number of rows captured for that session
- mutating `public.assignments` afterwards leaves the snapshot untouched
- `UPDATE`/`DELETE` on `assignment_snapshots` raises
  `assignment_snapshot_is_immutable`
- a second `end_game_session` call does not produce a differing snapshot
- a deliberately partial snapshot insert is rejected with
  `assignment_snapshot_incomplete`, so it can never be displayed or silently
  fall back through the history read path

**History (FR-047b, FR-047c)**:
- a reassigned completed game reports `assignments_changed_during_play = true`;
  an untouched one reports `false`
- `player_assignments` reflects the snapshot, not the live table, after the live
  table is mutated post-completion
- **fallback**: a completed session with no snapshot (simulating a pre-feature
  or legacy-imported game) still reports its live assignments — this is what
  makes "no backfill" true (R7)
**The invariant (FR-047c) — the highest-value test in the slice** (R11):

> `assignment_snapshots` for a completed session **equals**
> `replay(kickoff map, ordered assignment_reassigned deltas)`.

The kickoff map is `payload -> 'assignments'` of the **last**
`assignment_replaced` event before `session_started` (035's
`set_room_assignments` may emit several while the room is still `joinable`).
Fold the deltas forward by `sequence_number`, applying `removedMatchIds` then
`addedMatchIds`, and compare the resulting set to the snapshot rows.

One assertion proves three things at once: the snapshot is honest, the recorded
deltas are complete, and FR-047c's reconstruction actually works rather than
being merely asserted in prose. It is also the **only** test that catches an RPC
which writes the assignment rows correctly but records a wrong or partial delta
in the event payload.

Exercise it with at least: one reassignment, several reassignments to the same
participant, a match moved away and later moved back, and a game with no
reassignments at all (where the replay is the kickoff map unchanged).

Plus the per-moment case FR-047c names directly:
- from the same records, the map *before* a given reassignment is recoverable
  and differs from the snapshot

---

## 2. Client unit tests

```bash
npm test
```

Only the RPC wrapper is in scope. `__tests__/utils/supabaseClient.reassign.test.ts`
asserts that each Postgres error name in the
[contract's vocabulary](contracts/reassignment-rpc.md) maps to its intended typed
client error, and that a success payload round-trips to
`ReassignParticipantMatchesResponse`.

```bash
npm run lint
```

**Not tested here** (moved to #190 with the code): the game screen's snapshot
poll, the host-only control, the history indication, and the R3 re-hydration
constraint. Do not add a Playwright test to this slice — there is no UI change
for it to exercise, and constitution §V only requires one where there is.

---

## 3. Verifying by hand (optional)

There is nothing to click. To exercise the RPC directly against the local stack,
mint a token for the host account and call it through PostgREST:

```bash
npx supabase gen bearer-jwt --role authenticated --sub <host-account-uuid>
```

Then `POST /rest/v1/rpc/reassign_participant_matches` with the four parameters
from the contract. The useful checks are the ones the pgTAP suite already
automates — that a non-host gets `not_host`, and that a completed room gets
`game_not_in_progress` rather than a trigger message.

---

## Definition of done

### Validation run (2026-08-16)

- `npm run db:reset` and `npm run db:test`: green (38 files, 526 assertions).
- Focused wrapper suite: green (13 tests).
- `npm run lint`: exit 0; the repository still reports its existing warning set.
- Full `npm test -- --runInBand --watchAll=false` reaches the existing
  `ShellCard` platform tests but fails in the repository's Node 26 test setup
  because `window.dispatchEvent` is unavailable. The focused feature suite has
  no failures, and no feature-caused regression was found.

- [x] `npm run db:test` green, including all of §1
- [ ] `npm test` green, including the wrapper's error-mapping test
- [x] `npm run lint` clean (exit 0; existing warnings remain)
- [x] Reassigning changes no goal, drink, or prior event row
- [x] Every refusal returns its documented error name, never a raw `23503`
- [x] Invalid arrays, changed slot counts, and conflicting key reuse change no
      assignment and write no event
- [x] Every reassignment event names the authenticated host's active owner
      participant as actor
- [x] An ordinary reassignment leaves the participant's Common Match row intact
- [x] A retried request replays its original result — including after the game
      ended — and a non-host never receives a replayed payload
- [x] Understood that the snapshot assertions only fire for games ended via
      `end_game_session`; the game screen's End Game does not reach it (R6a)
- [x] Completing a game writes an immutable snapshot; mutating the live table
      afterwards does not change the completed game's history
- [x] A completed session with no snapshot still reports its live assignments
      (the fallback that makes "no backfill" true)
- [x] A partial snapshot insert is rejected as incomplete and never exposed as
      history
- [x] `assignments_changed_during_play` is true for a reassigned game and false
      for every game that was not
- [x] **The §1 invariant holds**: snapshot == replay(kickoff map, deltas), for
      every reassignment shape listed there
- [x] A completed game that was never reassigned reads exactly as it does today

**Not in this definition**: any user-visible behaviour. This slice deliberately
ships none — see plan.md §Notes.
