# Feature Specification: Host Reassignment During an Active Game

**Feature Branch**: `186-us57-allow-the-host-to-reassign-player-matches-during-an-active-game`

**Created**: 2026-08-03

**Status**: Draft

**Input**: GitHub issue #186 — `[US5.7] Allow the host to reassign player matches during an active game` (epic #116, depends on #135)

---

## Canonical spec notice

**This file does not define new requirements.** The full clarified behaviour for
this feature lives in
[`specs/020-canonical-assignment-generation/spec.md`](../020-canonical-assignment-generation/spec.md),
which is the shared reference for four GitHub issues (#135, #184, #185, #186).
That document's Delivery Slices table assigns this issue (#186) its own row:

> Host reassignment during an active game — **US7** — FR-043 to FR-049, incl. FR-047a to FR-047c

Where anything below disagrees with `specs/020/spec.md`, **020 wins except for
the explicit deltas in this section and the Delivery scope table below** — this file
exists only so `/speckit-plan` and `/speckit-tasks` have a feature directory to
work in without touching the already-shipped planning artifacts of #135, #184, or
#185 (`specs/020/`, `specs/021/`, `specs/022/`). The requirements below keep
020's original identifiers (FR-043 to FR-049) so the GitHub issue's subtasks and
020's traceability table continue to key off the same numbers. The known FR-049
premise correction and the server/client ownership split are authoritative here
until they are copied back to 020.

**Dependency status**: #135 (canonical server-side settlement at start,
`specs/020-canonical-assignment-generation`) is the hard dependency — this issue
*mutates* the settled assignment set that #135 creates. This is the only one of
020's four slices that touches a **live game** rather than the lobby, which is
why it was split out during clarification on 2026-07-25 and is worth reviewing on
its own.

---

## Delivery scope: server slice only

**Decided 2026-08-03.** This issue delivers the **server half** of US7/US7a. The
client half is blocked on
[#190](https://github.com/NikolajKrogh/dong/issues/190) and moves there.

Planning research (`research.md` R2) established that the active game screen has
no connection to the room it belongs to: it renders from the local store, the
store holds no `sessionId`, the lobby hydrates it once at start, and there is no
server-side scoring anywhere in the repo. FR-049's premise — "the room snapshot
it already polls" — is false for that screen, and #186's acceptance criterion
"every connected device reflects the new assignment on its next refresh"
describes a refresh that does not exist.

Building that missing sync inside this issue would mean adding a snapshot poll to
a screen with no server truth to sync against, which is precisely what creates
the FR-045 data-loss trap in R3. It belongs in #190 with the rest of the
foundation.

| Requirement | Delivered here | Moves to #190 |
|---|---|---|
| FR-043 — host may change a participant's matches | ✅ RPC | UI to invoke it |
| FR-043a — control on the active game screen, host-only | — | ✅ |
| FR-044 — reject non-hosts, and completed/closed rooms | ✅ | — |
| FR-045 — recorded scoring untouched | ✅ server-side | client-side re-verify |
| FR-046 — subsequent scoring follows the new assignment | ✅ server-side | client attribution |
| FR-047 — appended as a distinct history record | ✅ | — |
| FR-047a — completion snapshot, immutable | ✅ | — |
| FR-047b — history conveys assignments changed | ✅ read model | history UI indication |
| FR-047c — snapshot + records reconstruct the timeline | ✅ | — |
| FR-047d — reassignment records retained | ✅ | — |
| FR-048 / FR-048a — Common Match, pool, clean errors | ✅ | error presentation |
| FR-049 — every client picks it up via the snapshot | — | ✅ |

**Accepted consequence**: this issue ships with **no user-visible behaviour**.
The host cannot reassign anything from the UI until #190 lands. That is
deliberate — the alternative was a game screen that trusts the server for
assignments while deliberately ignoring it for scores, on the same payload and
the same poll, an asymmetry that becomes actively wrong the moment #190 lands and
would have to be found and unpicked.

**Tracking contract**: #186 MUST NOT be considered feature-complete merely when
this server slice merges. Product completion also requires #190 to own and close
FR-043a (host-only control), FR-046's end-to-end scoring attribution, FR-047b's
history indication, FR-048a's error presentation, FR-049's active-game
convergence, and a reassignment-specific Playwright journey. Until those items
are copied into #190's checklist, they remain open against #186 even if the
server implementation is complete.

---

## Overview

Half an hour into a game the host realises someone was given a match that has
been postponed, or a late arrival needs swapping in. This feature lets the host —
and only the host — change a participant's assigned matches while the room is
still running, without disturbing anything already recorded.

The defining constraint is that the past is immutable. Goals and drinks already
earned against a match being removed from a participant stay exactly where they
are; the newly assigned match counts from the change onward. Nothing is
recomputed, rolled back, or reconciled.

That constraint creates the second half of the feature, which is about
**history**. A completed game's assignment record is presently derived from the
room's live assignment table, which after a mid-game change describes only the
*end state*. Left alone, history would report a reassigned game as though its
final map applied from kickoff — crediting a participant with matches they never
actually held for part of the game. This slice therefore also captures an
immutable snapshot of the assignment map at completion, states in history that a
game's assignments changed during play, and guarantees that the snapshot plus the
retained reassignment records are together sufficient to reconstruct who held
which match at any moment.

---

## Clarifications

### Session 2026-07-25 (carried forward from `specs/020`)

- Q: How should a completed game's history describe a game whose assignments
  changed mid-play, given the existing history view reads the assignment
  record's end state? → A: **Snapshot the assignment map at completion**, and
  have history read that snapshot rather than the live record. Because a
  snapshot still records the end state, the per-moment timeline is reconstructed
  from the snapshot plus the retained reassignment records, and history must
  additionally convey that a game's assignments changed (FR-047a to FR-047c).
  Confirmed with the requester.
- Q: Does reassignment recompute anything already scored? → A: **No.**
  Retroactive recalculation of any kind is out of scope for 020 — settled
  scoring is never rewritten, by reassignment or otherwise.
- Q: May a participant other than the host reassign during a live game? → A:
  **No.** Player-initiated changes during an active game are explicitly out of
  scope in 020; only the host may reassign once the game is underway.

---

## User Scenarios & Testing *(mandatory)*

### User Story 7 - The host fixes assignments during an active game (Priority: P2)

Half an hour into a game the host realises someone was given a match that has
been postponed, or a late arrival needs swapping in. The host changes that
player's matches from the active game screen. Everyone's device picks up the
change on the next refresh. Nothing that already happened is undone: goals and
drinks already recorded against the removed match stay exactly where they are,
and the new match counts from the change onward.

**Why this priority**: Called out as important, and it is the only part of this
feature that touches a live game rather than the lobby, which makes it the most
sensitive to get right on the history side.

**Independent Test**: Start a game, record scoring against a player's match,
reassign that match to something else, and confirm the player's earlier totals
are unchanged while subsequent scoring follows the new match.

**Acceptance Scenarios**:

1. **Given** an active game,
   **When** the host changes a participant's assigned matches,
   **Then** the change is stored as the room's canonical assignment set,
   **And** every connected device reflects it on its next refresh.
   *(Second clause verified in #190 — see Delivery scope. Here, the assertion
   is that the stored canonical set is what a room snapshot read returns.)*

2. **Given** a participant with goals and drinks already recorded against a
   match,
   **When** the host removes that match from the participant,
   **Then** the participant's already-recorded goals and drinks are unchanged,
   **And** the room's event history retains every one of those records.

3. **Given** a participant who has just been given a new match,
   **When** scoring occurs on that match afterwards,
   **Then** it counts for that participant,
   **And** scoring that occurred on it before the change does not.

4. **Given** an active game,
   **When** a participant other than the host attempts to change any
   assignment,
   **Then** the attempt is rejected.

4a. **Given** a room that has completed or closed,
   **When** the host attempts to change any assignment,
   **Then** the attempt is rejected.

5. **Given** an active game,
   **When** the host changes assignments,
   **Then** the change is appended to the room's event history as a distinct
   record, so the game's assignment timeline is reconstructible afterwards.

6. **Given** an active game,
   **When** the host attempts to remove the Common Match from a participant, or
   to assign a match that is not in the room's pool,
   **Then** the attempt is refused with a clear explanation,
   **And** the participant's assignments are unchanged.

---

### User Story 7a - A completed game's history tells the truth about a reassigned game (Priority: P2)

A player later opens the history entry for a game whose assignments were changed
mid-play. The entry must not present the final map as though it had applied from
kickoff. It records the map as of completion, says plainly that the assignments
changed during the game, and retains enough detail that the per-moment picture
can be reconstructed.

**Why this priority**: Equal to US7 and inseparable from it — the mutation is
only safe to ship if history stops misrepresenting the games it produces. This
covers FR-047a to FR-047c, which the acceptance scenarios of 020's US7 do not
otherwise exercise.

**Independent Test**: Play a game, reassign mid-play, complete it, then confirm
the history entry reports the completion-time map, flags that assignments
changed, and — together with the recorded reassignments — yields the earlier map
as well.

**Acceptance Scenarios**:

1. **Given** a game whose assignments changed during play,
   **When** the game completes,
   **Then** the assignment map as of completion is captured as the game's
   historical assignment record,
   **And** history reports that record rather than the room's live
   assignments.

2. **Given** a completed game whose assignment snapshot has been captured,
   **When** anything subsequently changes in the room's live assignment record,
   **Then** the completed game's historical assignment record is unchanged.

3. **Given** a completed game whose assignments changed during play,
   **When** a player views its history entry,
   **Then** the entry conveys that the assignments changed during the game,
   so the recorded map is not read as describing the whole game.

4. **Given** a completed game whose assignments changed during play,
   **When** the completion snapshot is combined with the game's recorded
   reassignments,
   **Then** the set of matches a participant held at any chosen point in the
   game can be reconstructed.

5. **Given** a completed game whose assignments never changed during play,
   **When** a player views its history entry,
   **Then** the entry reports the same assignments it reports today,
   **And** it does not claim the assignments changed.

---

### Edge Cases (relevant to this slice)

- **Reassigning a match that already has scoring against it**: allowed, and the
  central case. The recorded goals and drinks stay attached to whoever earned
  them; only future scoring follows the new owner.
- **Reassigning the same match away and back again**: each change is its own
  record; the timeline shows both, and the scoring in between belongs to
  whoever held it at the time.
- **Reassignment while another device is mid-poll**: the other device shows the
  old assignment until its next refresh (up to one poll interval). The UI must
  not imply that other devices update instantly.
- **Two hosts, or a host handover mid-reassignment**: authority is checked
  server-side at the moment of the change, so whoever holds host at that moment
  is the one who may reassign — consistent with the room's existing handover
  behaviour.
- **A reassignment attempted the instant the game ends**: rejected on room
  state, and the completion snapshot is unaffected. The boundary is decided by
  the room's state at the time the change is applied, not by the client's view
  of it.
- **A participant who left the room mid-game**: not reassignable; reassignment
  targets participants on the room's active roster.
- **Removing the Common Match**: refused. The Common Match belongs to every
  participant by definition, and although it is recorded per participant like
  any other assignment, it is not a slot the host may reassign — a reassignment
  that changes a participant's other matches must leave it standing untouched.
- **Assigning a match outside the room's pool**: refused with a clear
  explanation rather than a raw storage error.
- **Changing the participant's settled number of non-Common matches**: refused.
  Reassignment replaces slots; it does not add or remove slots, even when the
  game started with relaxed assignment constraints.
- **Malformed desired sets**: a missing set, a set containing a missing value,
  or a set containing the same match more than once is refused without changing
  assignments or writing an event.
- **Reusing an idempotency key for different inputs**: refused as a conflict;
  an idempotency key replays only the exact request it first identified.
- **A host account without an active owner participant**: refused as an invalid
  room identity invariant; no event may be written without an auditable actor.
- **A partial completion snapshot**: treated as invalid at the snapshot insert
  boundary, never as a completed historical map. Snapshot creation and history
  selection are all-or-nothing.
- **Games completed before this feature exists**: they contain no mid-game
  reassignment to misrepresent, so their existing history reading remains
  accurate; they need not be re-derived.
- **Solo (on-device) games**: unaffected — this is a multiplayer room feature.

---

## Requirements *(mandatory)*

### Functional Requirements

Copied from `specs/020-canonical-assignment-generation/spec.md` §Mid-game
reassignment, retaining 020's identifiers.

**Mid-game reassignment**

- **FR-043**: While a game is active, the host MUST be able to change any
  participant's assigned matches.
- **FR-044**: Mid-game reassignment MUST be rejected for anyone other than the
  host, and MUST be rejected once the room has completed or closed.
- **FR-045**: Mid-game reassignment MUST NOT alter, remove, or recompute any
  goal or drink already recorded, including those recorded against a match
  being removed from a participant.
- **FR-046**: After a reassignment, subsequent scoring MUST follow the new
  assignment, and scoring recorded before the change MUST continue to follow
  the assignment that was in force when it happened.
- **FR-047**: Each mid-game reassignment MUST be appended to the room's event
  history as a distinct record, so the assignment timeline of a game is
  reconstructible.
- **FR-047a**: A completed game's assignment record MUST be captured as a
  snapshot at the moment the game completes, rather than read live from the
  room's current assignments. The snapshot is immutable once taken.
- **FR-047b**: Because a snapshot records the map as of completion rather than
  as of kickoff, a completed game's history MUST also convey that its
  assignments changed during play, so the snapshot is not read as describing
  the whole game.
- **FR-047c**: The completion snapshot together with the reassignment records
  of FR-047 MUST be sufficient to reconstruct which matches a participant held
  at any point in a completed game — the snapshot supplying the end state and
  the reassignment records the deltas.
- **FR-048**: Mid-game reassignment MUST NOT be able to remove the Common Match
  from a participant or assign a match outside the room's pool.
- **FR-049** *(corrected delta against 020; → #190)*: Every connected active-game
  client MUST pick up a mid-game reassignment through the room snapshot polling
  connection introduced by #190. The active game screen does not poll that
  snapshot before #190.

**Slice-specific refinements** *(from this issue's own tracking, GitHub #186)*

- **FR-043a** *(→ #190)*: The reassignment control MUST be reachable from the
  active game screen and MUST be presented only to the host.
- **FR-048a**: A refused reassignment (wrong actor, wrong room state, Common
  Match, or out-of-pool match) MUST produce a clear, human-readable explanation
  rather than surfacing an internal storage error, and MUST leave the
  participant's assignments unchanged. *(Here: a distinct, documented error
  identifier per refusal rather than a raw constraint violation. Its
  presentation is #190's.)*
- **FR-047d**: The reassignment records of FR-047 MUST be retained for the life
  of the completed game's history entry, since FR-047c's reconstruction depends
  on them.
- **FR-050**: A reassignment MUST preserve the target participant's settled
  number of non-Common matches. A request with a different cardinality MUST be
  rejected without changing state.
- **FR-051**: The desired match set and idempotency key MUST be present and
  valid. The set MUST contain no missing values or duplicate match identifiers.
  Invalid input MUST be rejected without changing state or writing an event.
- **FR-052**: An idempotency key MUST replay only the exact request originally
  associated with it. Reuse with a different participant or desired match set
  MUST be rejected as an idempotency conflict.
- **FR-053**: Every reassignment record MUST identify the active owner
  participant resolved from the authenticated host account. If that participant
  cannot be resolved, the mutation MUST be rejected before replay or state
  changes.
- **FR-054**: Completion snapshot creation MUST be atomic and complete. History
  MUST NOT select a snapshot unless its rows form the complete assignment map
  captured for that session.
- **FR-055**: Reassignment records and completion snapshots MUST follow the
  completed session's retention lifetime and MUST NOT be independently pruned.
  The current foreign-key-restricted session retention policy remains unchanged;
  any future session-deletion feature MUST define atomic deletion of all three.

---

### Key Entities

- **Assignment**: The canonical, settled participant-to-match mapping that #135
  creates at start. This slice makes it mutable while the room is running, for
  the host only.
- **Reassignment Record**: A distinct, appended entry in the room's event
  history capturing one host-applied change — who changed it, for which
  participant, which matches were added and removed, and when. It is the delta
  half of FR-047c's reconstruction and is never pruned.
- **Completion Assignment Snapshot**: An immutable capture of the room's
  assignment map at the moment the game completes. It replaces the live
  assignment record as the source for a completed game's history and is the end
  -state half of FR-047c's reconstruction.
- **Room / Session**: Gains a mutation that requires the *running* state rather
  than the pre-start state, and gains the completion-time act of taking the
  snapshot.
- **Recorded Scoring**: Goals and drinks already earned. Referenced here only to
  state that this feature never touches them.

---

## Success Criteria *(mandatory)*

- **SC-001**: In 100% of mid-game reassignments, every goal and drink recorded
  before the change is identical afterwards — no total is altered, removed, or
  recomputed.
- **SC-002**: In 100% of mid-game reassignments, scoring that happens after the
  change is attributed according to the new assignment, and scoring that
  happened before it remains attributed according to the assignment in force at
  the time.
- **SC-003**: In 100% of reassignment attempts by anyone other than the host, and in
  100% of attempts made after the room has completed or closed, the attempt is
  rejected and no state changes.
- **SC-004**: In 100% of attempts to remove the Common Match or to assign a match
  outside the room's pool, the attempt is refused with an explanation the host
  can act on, and no state changes.
- **SC-005** *(→ #190)*: Every connected participant's device reflects a
  reassignment within the room's normal ~4-second refresh interval, with no
  additional wait and no app restart. Verified here only to the point the
  server owns: a room snapshot read taken after the change returns the new
  assignment set.
- **SC-006**: 100% of mid-game reassignments appear in the room's event history as a
  distinct record.
- **SC-007**: For 100% of completed games, the assignment map a player sees in
  history is the map as of completion and does not change afterwards, whatever
  happens to the room's live record.
- **SC-008**: For 100% of completed games whose assignments changed during play, the
  history read model reports that they changed; for 100% of games whose
  assignments did not change, it reports that they did not. *(Rendering that
  report in the history entry is #190's.)*
- **SC-009**: For any completed, reassigned game and any chosen moment within it, the
  set of matches each participant held at that moment can be determined from the
  persisted record alone.
- **SC-010**: 100% of requests with a changed slot count, malformed desired set,
  or conflicting idempotency-key reuse are rejected with a stable explanation,
  no assignment change, and no new event.
- **SC-011**: 100% of reassignment events identify the authenticated host's
  active owner participant, and no event can be created with a missing actor.
- **SC-012**: For 100% of completed sessions, history uses either one complete
  immutable snapshot or the documented legacy fallback; it never exposes a
  partial snapshot.

---

## Assumptions

- **Recorded scoring does not derive from the assignment record.** Verified
  2026-07-25: drink totals accumulate as a running total on the participant,
  goals live on the match, and each recorded event names its actor on the row
  itself. Nothing recomputes a total by consulting the assignment mapping. This
  is what makes FR-045 achievable without versioning the assignment data —
  **re-verify before implementation if the scoring path has changed since.**
- **Reassignment is a whole-set operation on one participant at a time.** The
  host changes one participant's matches; there is no bulk or cross-participant
  reshuffle in this slice. The desired set excludes the Common Match and MUST
  contain exactly as many matches as that participant currently holds excluding
  the Common Match, preserving the settled slot count even for relaxed starts.
- **Host authority is evaluated server-side at the moment of the change**, not
  trusted from the client, consistent with every existing room mutation.
- **Concurrent reassignments resolve last-write-wins, accepted as a known
  limitation.** If the host acts from two devices at once — or a host and a
  successor do, after a mid-game handover — the later change silently replaces
  the earlier one, and the earlier device is not told. Nothing is corrupted and
  the history record stays truthful, because both changes really were made. The
  stricter alternative (refusing a change made against a stale view) was
  considered and deferred: the exposure is a single refresh interval, and the
  client that would have to resolve such a conflict is
  [#190](https://github.com/NikolajKrogh/dong/issues/190)'s. Deferred, not
  overlooked — and adoptable later without changing how a reassignment is
  expressed.
- **A repeated identical request is answered, not re-applied.** Because the host
  states the participant's whole set rather than a change to it, a request that
  arrives twice is recognised and answered with the original outcome. The
  participant and a canonical sorted desired set form the request fingerprint;
  a key reused for a different fingerprint is rejected.
- **The authenticated host has one active owner participant in the room.** The
  RPC resolves that participant after the host check and records it as the
  event actor. A missing or ambiguous owner participant is an invariant failure,
  not permission to write an actor-less event.
- **Clients keep the existing ~4-second room snapshot poll** as their
  synchronisation mechanism (FR-049); no realtime subscription is introduced
  here.
- **FR-049's connected-device convergence and FR-046's end-to-end scoring
  attribution are integration outcomes owned by #190.** This slice supplies the
  canonical assignment mutation and its audit/history guarantees; #190 supplies
  active-game polling and server-authoritative scoring needed to prove them.
- **Games completed before this feature shipped need no backfill.** They
  contain no mid-game reassignment, so reading their end state remains accurate
  for them; they may be backfilled from it or left on the existing path — either
  satisfies FR-047a for them.
- **A game's assignments are considered "changed during play" exactly when at
  least one reassignment record exists for it**, which is what FR-047b reports.
- **The kickoff assignment map is already retained** in the room's event history
  from the moment the game starts (verified 2026-08-03). FR-047c's
  reconstruction therefore runs forward from kickoff, and the completion
  snapshot of FR-047a serves as an independently recorded checkpoint that the
  reconstruction is verified against — not as the only source of the end state.

---

## Dependencies

- **#135 / `specs/020-canonical-assignment-generation`**: supplies the canonical
  server-side settled assignment set that this issue mutates, and the
  start-of-game settlement path (`private.start_game_session`) alongside which
  the completion snapshot must be taken.
- **`supabase/migrations/008_create_gameplay_events.sql`**: the room's event
  history, which carries the acting participant on the row with a composite FK
  tying the actor to the same session. This is where FR-047's reassignment
  record belongs.
- **`supabase/migrations/010_constrain_gameplay_events.sql`**: `CHECK`
  -constrains `event_type` to a fixed list. The reassignment event kind **must**
  be added there in a new migration or the insert will fail.
- **`supabase/migrations/018_history_read_models_support.sql`** and
  **`019_history_read_models_history.sql`**:
  `private._history_completed_assignments` feeds `player_assignments`, and it
  reads the **live** assignment table for a completed session. This is the read
  model FR-047a repoints at the snapshot.
- **`supabase/migrations/035_configure_start_game_rpcs.sql`**: the existing room
  mutations all guard `state = 'joinable'`. Reassignment is the first mutation
  that requires the *running* state instead — do not copy that guard blindly.
- **`public.allocate_event_sequence(session_id)`**: allocates the per-session
  event sequence the reassignment record needs;
  `gameplay_events` also carries an `AFTER INSERT` trigger bumping
  `game_sessions.last_activity_at`.
- **`public.assignments` composite FKs**: already enforce that a reassignment
  references a match in the same session's pool — FR-048a requires a clean
  error rather than surfacing the constraint violation.
- **`hooks/useRoomLobby` and `types/room.ts` (`RoomSnapshot`)**: the polled room
  snapshot the reassignment must ride, per FR-049.
- **`app/gameProgress.tsx` and `hooks/useGameProgressController.ts`**: the
  active game screen and its controller — the client seam for the host-only
  reassignment UI (FR-043a).

---

## Out of Scope

- **Retroactive recalculation of any kind.** Settled scoring is never rewritten,
  by reassignment or otherwise (`specs/020`).
- **Player-initiated changes during an active game.** Only the host may reassign
  once the game is underway (`specs/020`).
- **Automatic reassignment when the roster changes mid-game.** A game does not
  redistribute matches on its own; the host may do so by hand under this story.
  History-preserving leave semantics remain tracked in #165 (`specs/020`).
- **Changing the room's assignment mode, per-player count, or match pool
  mid-game.** This slice changes which of the room's existing matches a
  participant holds, nothing else.
- **Reconstructing the timeline as a rendered UI.** FR-047c requires the
  persisted record to be *sufficient* for reconstruction; building a
  moment-by-moment history viewer is not part of this slice.
- **Every client-side surface of this feature**, moved to
  [#190](https://github.com/NikolajKrogh/dong/issues/190): the host-only
  reassignment control (FR-043a), the game screen's room snapshot poll (FR-049),
  the FR-047b history indication, and the presentation of FR-048a's refusals.
  See Delivery scope above.
- **Server-side in-game scoring.** `score_changed` and `drink_changed` remain
  unwritten by anything; making them real is #190's, not this slice's.
- **Abandonment policy for started rooms**, still deferred to #138/#165.

---

## Platform, Auth, Shared-State, and Migration Impact

*(required by the constitution's delivery workflow)*

- **Platform impact**: **None in this slice** — it is server-only, and platform
  -neutral by construction. The client surfaces it enables (a host-only
  reassignment control on the active game screen, and the FR-047b history
  indication) are specified in #190 and must there behave identically on native
  and web. Recording "none" here is the honest answer, not an omission: nothing
  in this issue renders.
- **Auth / guest impact**: Reassignment is host-only (FR-044) and MUST be
  enforced server-side against the caller's actual identity rather than by
  hiding the control. Non-host registered members and session-scoped guests are
  read-only here; this is the inverse of #185's participant-writes-own-row
  shape and follows the existing host-only pattern instead.
- **Shared-state impact**: This is the first mutation of the *settled*
  assignment set after a game has started. It rides the existing polled room
  snapshot (FR-049) rather than introducing a new synchronisation channel, so
  other devices converge within one poll interval. It must not interact with the
  scoring path at all.
- **Migration / backfill impact**: Requires (a) extending the constrained event
  kind list so the reassignment record can be written, (b) storage for the
  completion assignment snapshot, (c) repointing the completed-game history read
  model at that snapshot, and (d) a room-state guard requiring the running
  state. No backfill is required for games completed before this ships (see
  Assumptions); if one is done, it derives from their existing end state.
- **Constitutional note (§III)**: FR-047c is the constitution's
  derived-views-reconstructible-from-persisted-records rule applied to this
  feature — it is why the snapshot alone is insufficient and why the
  reassignment records must not be pruned (FR-047d).
- **Test strategy**: pgTAP under `supabase/tests/database/` carries the whole
  slice — asserting that the participant's running drink total and the matches'
  scores are byte-identical before and after a reassignment, plus the host-only
  guard, the room-state guard for `joinable`/`completed`/**`closed`**, the
  Common-Match and out-of-pool refusals, the reassignment record's presence and
  idempotency, the completion snapshot's immutability, the read-model fallback
  for snapshot-less sessions, and the FR-047c reconstruction. Unit tests cover
  the client RPC wrapper's error mapping. **No Playwright BDD test in this
  slice** — constitution §V requires end-to-end coverage for substantial UI
  changes, and this slice contains no UI change; the journey test belongs with
  the UI in #190. `npm test && npm run lint` before PR.
