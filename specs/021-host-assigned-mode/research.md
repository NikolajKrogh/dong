# Research: Assignment Mode Setting + Host-Assigned Allocation

**Input**: `spec.md` (this directory) — the #184 slice of
`specs/020-canonical-assignment-generation/spec.md`.

**Method**: Direct inspection of the post-#135 codebase
(`supabase/migrations/036_canonical_assignment_generation.sql`,
`hooks/useRoomConfigure.ts`, `app/lobby/[sessionId].tsx`, `types/room.ts`,
`command-api/.../StartGameCommandHandler.java`), since the GitHub issue's
"Implementation notes" were written before #135 (PR #187) merged and are stale
in places noted below.

---

## R1: Where does the assignment mode live?

**Decision**: A new Postgres enum `public.assignment_mode` — `('automatic',
'host_assigned', 'player_picked')` — and a `NOT NULL DEFAULT 'automatic'`
column `game_sessions.assignment_mode`.

**Rationale**: Mirrors the existing enum pattern
(`session_state`, `participant_membership_type`,
`public.participant_session_role` — see `001_create_types.sql`,
`025_session_ownership_roles.sql`). `NOT NULL DEFAULT 'automatic'` satisfies
FR-027 ("a room with no explicitly set mode behaves as automatic") for free —
no nullable-plus-coalesce needed anywhere it's read.

**Alternatives considered**: A plain `text` column with a `CHECK ... IN (...)`
constraint, matching `event_type`'s style. Rejected: this repo's precedent for
a small closed set of room/participant states is an enum type, and
`player_picked` needs to exist as a valid value now even though #185 is the
one that implements it, so the type must be created here.

## R2: Where do host allocations live before start?

**Decision**: Reuse `public.assignments` as-is. No new table.

**Rationale**: The GitHub issue's implementation notes (written pre-#135)
worried that `public.assignments` "after #135 becomes the settled table" and
said draft allocations need "storage distinct from" it. Reading the actual
post-#135 code shows this concern doesn't hold: `start_game_session`
unconditionally `DELETE`s the room's `public.assignments` rows before
generating (line ~327 of migration 036), and **nothing else writes to that
table while a room is `joinable`** except the pre-existing
`private.set_room_assignments` RPC (migration 035, still present and still
host-only + `joinable`-only). So during the lobby, any row in
`public.assignments` already *is* a draft by construction — it only becomes
"settled" the moment `start_game_session` decides to keep it instead of
deleting it. Host-assigned mode's only actual change is **what
`start_game_session` does with those rows at start**: preserve-and-fill
instead of delete-and-regenerate. `hooks/useRoomConfigure.ts`'s `setAssignments`
already calls `setRoomAssignments`, confirming this is the live seam, not a
removed one.

**Alternatives considered**: A separate `assignment_drafts` table keyed the
same way as `assignments`. Rejected as unnecessary complexity — it would need
its own RLS, its own FK shape, and a copy step at start; the existing table
already has the right composite PK/FK shape (`(session_id, participant_id,
match_id)`, same-session FKs to `participants` and `matches`) and the right
lifecycle (cleared at every start, host-only writable pre-start).

## R3: Mode-conditional minimum enforcement (FR-011)

**Decision**: Both `private.compute_room_assignment_plan` and
`private.set_room_assignment_settings` must branch on
`v_room.assignment_mode`. The FR-009 minimum
(`shared_matches_per_pair × (participants − 1)`) is folded into
`effective_per_player` **only when `assignment_mode = 'automatic'`**; in
`host_assigned` (and later `player_picked`), `effective_per_player` is exactly
the stored `matches_per_player`, unraised.

**Rationale**: FR-011 is explicit that host-assigned mode's stored count "MUST
NOT be silently raised." `compute_room_assignment_plan` is shared by the
snapshot's `assignmentPlan` read and `start_game_session`'s own settlement
(both call it), so fixing it once fixes both surfaces FR-010/FR-011/FR-032
touch. `set_room_assignment_settings`'s own `v_minimum` guard (today
unconditional — see migration 036 lines 213–223) must gate the same way, or a
host in host-assigned mode would be blocked from storing a count the mode
doesn't even enforce.

**Alternatives considered**: Duplicating `compute_room_assignment_plan` into a
mode-specific variant. Rejected — the function already receives the full room
row; branching internally is a smaller diff and keeps the snapshot and start
path reading one definition, preserving the atomicity property migration 036
was designed around (research.md R2 in specs/020).

## R4: `start_game_session`'s host-assigned branch

**Decision**: Add a third generation branch alongside the existing
`v_feasible` (constrained) / `NOT v_feasible` (relaxed) branches in migration
036. When `v_room.assignment_mode = 'host_assigned'`:

1. Do **not** `DELETE FROM public.assignments` up front for this mode — read
   the existing rows first (these are the host's allocations) and keep them.
2. Exclude the Common Match from what counts as a "held" allocation, per the
   spec's no-op rule (User Story 5's edge case) — a host row equal to
   `(participant, common_match_id)` is not counted as one of the participant's
   *additional* matches.
3. For every active participant, count their current additional (non-Common)
   assignment rows. If fewer than `effective_per_player` (which under R3 is
   simply the stored `matches_per_player`, uncapped upward, unraised
   downward), fill the shortfall by drawing random matches from the pool
   (excluding the Common Match and excluding matches that participant already
   holds) until they reach the count. Record which participant IDs needed any
   filling.
4. Then, same as today: every active participant gets the Common Match,
   inserted with `ON CONFLICT (session_id, participant_id, match_id) DO
   NOTHING` — necessary now because a host may have already explicitly
   allocated the Common Match to a participant (the no-op edge case), which
   would otherwise collide with this step's insert on the composite PK.
5. Participants with **no** active roster membership are not touched — any
   stray draft rows for a participant who left are simply superseded, same as
   today's unconditional delete would have done for them (they're not in
   `v_participant_ids`, so they're never read as "held").

Steps 1–3 do not apply to automatic/relaxed generation, which keep their
existing delete-then-regenerate behavior unchanged.

**Rationale**: This is the direct implementation of FR-036 ("keep every match
the host allocated, fill any shortfall from the pool") and the issue's
acceptance scenario ("stored set is exactly what the host allocated" when
complete). The `ON CONFLICT DO NOTHING` resolves the Common Match collision
identified while reading the existing final INSERT (migration 036, the
"every active participant also holds the Common Match" step) — today that
step assumes a freshly-emptied table, which host-assigned mode's
preserve-first behavior breaks without this guard.

**Alternatives considered**: Deleting everything and requiring the client to
resubmit the full allocation set including fill via a second round-trip.
Rejected — contradicts FR-036, which requires the *server* to fill shortfalls
atomically within the start transaction, matching the all-or-nothing property
FR-021 already established for automatic mode.

## R5: Reporting which participants were filled in (FR-037's start-time echo)

**Decision**: `start_game_session`'s returned `jsonb` gains a
`filledInParticipantIds: string[]` field (empty array outside host-assigned
mode, or when nothing needed filling), populated from R4 step 3, and the same
list is also carried in the `session_started` event payload. **Neither of
these reaches the client over HTTP.** The host-facing echo of "who was filled
in" is satisfied **pre-start**, in the lobby: the same per-participant
shortfall computation R9 already establishes for the "still short" indicator
tells the host, before they press Start, exactly who the server will fill in
if they proceed — which is the set FR-037 cares about, learned earlier than a
post-start message would deliver it.

**Correction from an earlier draft of this research**: this decision
originally assumed the RPC's `filledInParticipantIds` field would reach the
client through the start-game HTTP response, the same way it read
`{status, sessionId, relaxedConstraints, assignmentsCreated}` as a precedent.
That precedent doesn't hold: `command-api/.../CommandResult.java` documents an
explicit boundary — *"Handler internals never leak to clients"* — and
`CommandResponse` (the actual wire DTO) only carries
`{commandType, roomId, idempotencyKey, status, timestamp}`. `relaxedConstraints`
is *computed* into the RPC's return and into the `session_started` event for
history/audit purposes, but it was never itself forwarded to the client either
— the lobby's shortfall warning that surfaces relaxation to the host is a
**pre-start** read of `assignmentPlan.feasible`, not a post-start message. This
feature follows the same pattern rather than bending the boundary rule.

**Why the RPC field and the event payload still exist**: pgTAP calls
`public.start_game_session` directly (not through Java/HTTP), so
`filledInParticipantIds` on the RPC's return is what T018–T022's tests assert
against — it is load-bearing for verifying the generation branch's behavior
even though the client never reads it. The `session_started` copy gives the
room's auditable history (FR-023) the same fact `relaxedConstraints` already
records there, for the same reason.

**Alternatives considered**: Diffing the pre-start and post-start snapshot's
`assignments` arrays client-side. Rejected: every active participant gains the
Common Match row at start regardless of mode, so a naive diff would mark
everyone as "filled in"; excluding the Common Match from the diff still
requires threading the pre-start snapshot across the lobby→game-dashboard
navigation boundary that occurs at the same moment (the room transitions to
`in_progress` and the screen unmounts), which is more fragile than reading
data the lobby already has before that transition. Extending `CommandResponse`
to forward RPC detail. Rejected — contradicts the documented boundary rule,
and the pre-start route satisfies the same host-facing need without touching
Java at all (research.md R8 stays true).

## R6: New RPC for the mode setting, not an extension of the counts RPC

**Decision**: A new pair `private/public.set_room_assignment_mode(session_id
uuid, mode text)`, separate from `set_room_assignment_settings`.

**Rationale**: The client already calls `setAssignmentSettings` (counts) and
`setAssignments` (allocation) independently and optimistically
(`hooks/useRoomConfigure.ts`); the mode picker is a third, independent lobby
control with its own client-side confirm-first gate (FR-030a) that has nothing
to do with the numeric settings. Bundling it into
`set_room_assignment_settings`'s signature would force every count change to
also pass a mode value (or vice versa), coupling two independently-clicked UI
controls for no benefit. Validation is otherwise identical to
`set_room_assignment_settings`: host-only, `joinable`-only (FR-030).

**Alternatives considered**: A single combined
`set_room_assignment_settings(session_id, matches_per_player,
shared_matches_per_pair, mode)`. Rejected for the coupling reason above, and
because it would force a needless client migration of the already-shipped
counts call.

## R7: No new `gameplay_events` event type, no CHECK-constraint migration

**Decision**: `set_room_assignment_mode` does **not** emit a `gameplay_events`
row, matching `set_room_assignment_settings`'s existing behavior (verified:
that function updates `game_sessions` directly and emits nothing). Allocation
via `set_room_assignments` continues to emit `assignment_replaced` exactly as
it already does today (migration 035) — no change needed there either.

**Rationale**: The GitHub issue's "watch out" note about extending
`010_constrain_gameplay_events.sql`'s `CHECK` constraint was written before
#135 landed and assumed a new event kind would be needed. Reading the actual
precedent set by `set_room_assignment_settings` (the sibling room-setting
mutation #135 already shipped) shows room-configuration changes in the lobby
are not currently event-sourced — only match-pool and assignment mutations
are. Mode is a lobby configuration setting, not gameplay history, so following
the existing precedent (silent update, visible via the next snapshot poll) is
consistent rather than an arbitrary omission. This also means **no migration
touches `010`**, simplifying the change.

**Alternatives considered**: Emitting `assignment_mode_changed` for
audit-trail completeness. Rejected for this slice on consistency grounds
above; can be revisited later if a real audit need surfaces for lobby
settings generally (would then apply to the counts RPC too, which is out of
scope here).

## R8: Java `command-api` — no changes

**Decision**: Neither `StartGameCommandHandler` nor `ErrorCode` needs
modification for this slice.

**Rationale**: Mode changes and allocation are direct-to-Supabase RPC calls
through `RoomRpcClient` (`utils/supabaseClient.ts`), the same path
`setAssignmentSettings`/`setAssignments` already use — they never go through
the Java command service. `start_game_session`'s host-assigned branch (R4) is
entirely internal to the RPC; its call signature, return shape (aside from the
additive `filledInParticipantIds` field, R5), and error cases are unchanged,
so `StartGameCommandHandler.mapSupabaseError` needs no new case.

## R9: Per-participant "still short" display (FR-037, lobby-time)

**Decision**: No new server field. The lobby already receives
`snapshot.assignments: RoomAssignmentSummary[]` (participant/match pairs) and
`snapshot.assignmentPlan.matchesPerPlayer`. The client can already compute,
per participant, `count(assignments where participantId = X and matchId !=
commonMatchId) < matchesPerPlayer` directly from the existing snapshot shape.

**Rationale**: `RoomSnapshot.assignments` already carries every row of
`public.assignments` for the room — which, per R2, *is* the current draft in
host-assigned mode before start. No new RPC field is needed; this is a
client-side lobby rendering change only (`app/lobby/[sessionId].tsx`).

**Alternatives considered**: A server-computed
`participantsShort: string[]` field on `assignmentPlan`. Rejected as
redundant — the raw data to compute it client-side is already present in
every snapshot poll, and adding a server field would be one more thing to keep
in sync with the client's own count logic.

## R10: Mode-switch confirmation (FR-030a) is client-only

**Decision**: The confirmation dialog when switching modes with an existing
draft is implemented entirely in `app/lobby/[sessionId].tsx`; no server-side
gate is added beyond the existing host-only/`joinable`-only check
`set_room_assignment_mode` already performs (R6).

**Rationale**: Confirmed explicitly in spec.md's FR-030a — this is UX
friction to prevent an accidental discard, not a data-integrity rule. The
server has no way to distinguish "host confirmed" from "host didn't" short of
adding a parameter that would just be a client-trusted flag anyway (no
different in effect from not checking at all). The existing pattern in this
codebase for consequential client-only confirmations is the "Leave Room"
button's confirm flow already in the same file (`lobby-close-confirm`,
`lobby-close-confirm-button`) — this follows that precedent.

## R11: pgTAP test file numbering

**Decision**: New file `supabase/tests/database/240_host_assigned_mode.test.sql`
(next available number after `230_canonical_assignment_generation.test.sql`).

**Rationale**: Matches this repo's `NNN_slug.test.sql` sequential convention
under `supabase/tests/database/`.

---

## Summary of what #135's shipped code got right vs. what the issue assumed

| Issue assumption (pre-#135) | Post-#135 reality | Resolution |
|---|---|---|
| `public.assignments` "becomes the settled table," drafts need distinct storage | Nothing writes there pre-start except the still-live `set_room_assignments`; it's a draft store by construction until `start_game_session` decides otherwise | R2: reuse it, no new table |
| `event_type` CHECK constraint may need extending for a new event kind | `set_room_assignment_settings` (the sibling settings RPC) already ships with **no** event emission | R7: follow that precedent, no migration to `010` |
| `hooks/useRoomConfigure.ts`'s `randomizeAssignments` still exists as a seam to remove | Already removed; `setAssignments`/`setAssignmentSettings`/`startGame` are the current, final surface | No action — confirms scope is additive only |
