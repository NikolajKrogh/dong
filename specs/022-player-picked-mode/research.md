# Research: Player-Picked Assignment Mode

**Input**: `spec.md` (this directory) — the #185 slice of
`specs/020-canonical-assignment-generation/spec.md` (User Story 6,
FR-038–042, plus FR-038a/FR-040a/FR-041a from this issue's own tracking).

**Method**: Direct inspection of the post-#184 codebase
(`supabase/migrations/037_host_assigned_mode.sql`, `035_configure_start_game_rpcs.sql`,
`032_room_membership_rpcs.sql`, `026_guest_room_join.sql`,
`013_enable_rls_and_grants.sql`, `017_room_read_rls.sql`, `007_create_assignments.sql`,
`app/lobby/[sessionId].tsx`, `components/guestJoin/GuestJoinLobby.tsx`,
`hooks/useRoomConfigure.ts`, `hooks/useGuestRoomSession.ts`, `types/room.ts`,
`types/guestRoom.ts`, `utils/supabaseClient.ts`, `e2e/steps/browser-flow.helpers.ts`).
The GitHub issue's "Implementation notes (codebase seams)" were written during
#135's clarification and are **stale in three places**, each recorded below
(R6, R11, R12) and summarised in the table at the end.

**Scope decision resolved with the requester before planning**: the guest pick
UI is **in scope for this issue** (see R10). This was a genuine product fork,
not a technical one, because guests today have no lobby screen at all — only a
read-only summary card.

---

## R1: Where do player picks live?

**Decision**: A **new table** `public.assignment_picks`, shaped exactly like
`public.assignments` — `(session_id, participant_id, match_id, created_at)`,
PK `(session_id, participant_id, match_id)`, composite same-session FKs — but
with `ON DELETE CASCADE` on both FKs (R5) and its own RLS policy set (R4).

**Rationale**: This is the one place #184's "reuse `public.assignments`"
decision (021 research R2) genuinely does not carry over. R2 there rested on
"nothing writes to `public.assignments` while the room is `joinable` except
the host-only `set_room_assignments`", which made every pre-start row a draft
*by construction*. Player-picked mode breaks exactly that premise: it
introduces a second, **non-host** writer with a different authorisation shape
(FR-038a). Sharing one table would mean a participant's write path and the
host's write path targeting the same rows, with no way to tell whose intent a
row represents — and `set_room_assignments` is replace-all, so a host action
would silently wipe every participant's picks. Separate storage keeps the two
drafts independent and keeps `set_room_assignments` untouched.

**Alternatives considered**:
- *Reuse `public.assignments` with a `source` discriminator column.* Rejected:
  changes the shape of a table two shipped features already depend on, and
  still leaves `set_room_assignments`'s replace-all semantics destroying picks.
- *A `jsonb` picks blob on `game_sessions`.* Rejected: no FK integrity against
  the pool or the roster, no per-row cascade, and concurrent picks from
  different participants would contend on one row.

## R2: The pick RPC shape — replace-all, not pick/release pairs

**Decision**: One logical operation, exposed as two RPC pairs (one per identity
kind, R3): `set_my_room_picks(p_session_id uuid, p_match_ids uuid[])` and
`set_my_room_picks_as_guest(p_guest_token text, p_match_ids uuid[])`. Each
replaces *that caller's own* picks for the room with the submitted set.

**Rationale**: Three things fall out of replace-all for free.

1. **FR-040's cap becomes race-free.** A `pick_one` RPC has to
   read-then-write (`count(*) < N` then insert), and two rapid picks from one
   device can both pass the check. With replace-all the submitted array
   *is* the resulting count, so `array_length(p_match_ids, 1) > matches_per_player`
   is a single-statement decision with no read-modify-write window.
2. **Release needs no second RPC.** "Release a pick" (FR-040) is submitting the
   set without it — the same shape `set_room_assignments` already uses, and the
   same shape the lobby client already builds for host allocation
   (`toggleAllocation` in `app/lobby/[sessionId].tsx` reconstructs the full
   array rather than sending a diff).
3. **Idempotency is inherent** (constitution II requires each mutation to
   define it): submitting the same set twice is a no-op, and last-write-wins
   per participant is the correct conflict rule because a participant only ever
   races themselves across their own devices.

The RPC still takes `FOR UPDATE` on the `game_sessions` row. Not for the cap —
for **mutual exclusion with `start_game_session`**, which takes the same lock
(migration 037 line 332). Without it a pick could land between settlement's
roster lock and its seed-from-picks read, producing a participant whose pick
neither made it into the settled set nor survived as a pick. At ≤8 participants
on a 4s poll the serialisation cost is nil.

**Alternatives considered**:
- *`pick_room_match` + `release_room_match` (4 RPCs with guest variants).*
  Rejected for the cap race and the doubled surface.
- *`toggle_room_match_pick`.* Rejected: a toggle's outcome depends on unseen
  server state, so a retried request can invert the user's intent — the exact
  hazard replace-all avoids.

## R3: Authorising a non-host participant's own write (FR-038a)

**Decision**: Two RPC pairs mirroring the established
`leave_room_as_member` / `leave_room_as_guest` split
(`032_room_membership_rpcs.sql` lines 241 and 289):

| Caller | RPC | Identity resolution | Grant |
|---|---|---|---|
| Registered member **or host** | `set_my_room_picks(session_id, match_ids)` | `auth.uid()` → `participants.account_id`, `membership_type = 'registered'`, `left_at IS NULL` | `authenticated` |
| Session-scoped guest | `set_my_room_picks_as_guest(guest_token, match_ids)` | `sha256(token)` → `participants.guest_rejoin_token_hash`, `membership_type = 'guest'`, `left_at IS NULL` | `anon`, `authenticated` |

Neither RPC accepts a `participant_id` argument. The participant row is
**derived** from the caller's own credential, which is what makes FR-039's
"MUST NOT be able to change another participant's picks" structurally true
rather than merely checked — there is no parameter through which to name
someone else.

**Rationale**: This is the first room mutation a non-host may perform, and the
repo already contains exactly the right precedent for the two identity kinds:
guests authenticate by room-scoped token because they have no `auth.uid()`
(`026_guest_room_join.sql` hashes the token with `extensions.digest(...,
'sha256')`; `leave_room_as_guest` reuses that hash lookup). Both new functions
are `SECURITY DEFINER` with `SET search_path = ''`, matching every other RPC
in this codebase.

The host uses the *member* RPC, not a third one: the host is an ordinary
participant of their own room (`session_role = 'owner'`, `membership_type =
'registered'`) and must pick their own matches like anyone else. No
`owner_account_id` check appears in either function — that is the point.

**Alternatives considered**:
- *One RPC taking an optional `guest_token`, falling back to `auth.uid()`.*
  Rejected: a single function whose authorisation path depends on which
  argument is null is the shape most likely to be got wrong later, and it
  would need `anon` grants on a function registered members also call.
- *RLS `WITH CHECK` policies instead of RPCs.* Rejected: guests are the `anon`
  role with no `auth.uid()`, so no RLS predicate can identify them; guest
  access in this codebase is universally mediated by `SECURITY DEFINER`
  functions that resolve the token themselves.

## R4: RLS and grants for the new table

**Decision**: Mirror `public.assignments` exactly
(`013_enable_rls_and_grants.sql`, `017_room_read_rls.sql`):

- `REVOKE ALL ... FROM anon, authenticated`
- `GRANT SELECT ON public.assignment_picks TO authenticated`
- `GRANT SELECT, INSERT, UPDATE, DELETE ... TO service_role`
- `ALTER TABLE public.assignment_picks ENABLE ROW LEVEL SECURITY`
- `CREATE POLICY assignment_picks_room_members_select ... FOR SELECT TO
  authenticated USING (private.can_access_session(session_id))`
- **No** INSERT/UPDATE/DELETE policy for `authenticated` — every write goes
  through the `SECURITY DEFINER` RPCs of R3.

**Rationale**: The constitution requires persistent schema changes to ship
with "migrations, indexes, and RLS updates". #184 never had to satisfy this
clause because it added no table; this is the first new table in the
#135/#184/#185/#186 line, so the clause binds here. `private.can_access_session`
(current definition at `025_session_ownership_roles.sql` line 203 — note it
checks `owner_account_id`, not the stale `host_account_id` of the original 017
version) is the same predicate every other room table's read policy uses.
Indexes on `session_id`, `participant_id`, and `match_id`, matching
`007_create_assignments.sql`.

Guests read picks through `build_guest_room_snapshot` (R7), which is
`SECURITY DEFINER` and therefore bypasses RLS — the same route guests already
read participants, matches, and assignments by. No `anon` grant is needed on
the table itself.

## R5: FK cascade — and the issue's stale claim about leaving

**Decision**: Both FKs get `ON DELETE CASCADE`:
`(session_id, participant_id) → participants(session_id, id)` and
`(session_id, match_id) → matches(session_id, id)`.

**The match cascade is load-bearing.** `private.remove_room_match`
(`035_configure_start_game_rpcs.sql` line 92) **hard-deletes** the match row,
and explicitly deletes dependent `public.assignments` rows first (line 88)
because that table has no cascade. Without a cascade here, a host removing a
match that any participant had picked would fail on an FK violation. Declaring
the cascade is preferable to editing a shipped RPC: it cannot be forgotten, and
it keeps `remove_room_match` byte-for-byte unchanged.

**The participant cascade is defensive only** — and this corrects the issue.

> **Stale issue claim**: *"`leave_room_as_member` in `032_room_membership_rpcs.sql`
> deletes the participant row, so pick storage needs an FK/cascade decision."*

`leave_room_as_member` does **not** delete the participant row. It soft-leaves
(`UPDATE public.participants SET left_at = now()`, line 263), as does
`leave_room_as_guest` (line 308) and `leave_room_as_host`
(`033_host_leave.sql` line 70 — whose header comments the reason: *"Soft-leave
(`left_at`) keeps the audit FK valid"*). Nothing in the codebase hard-deletes a
participant. So **FR-041a is satisfied by the roster filter at settlement, not
by a cascade**: settlement reads picks only for participants in the locked
active roster (`left_at IS NULL`), exactly as #184's T024 already established
for stray host allocations. A departed participant's pick rows persist,
inert and invisible to settlement.

This matters beyond tidiness: had we relied on the cascade, FR-041a would have
silently failed, because the delete it waits for never happens.

## R6: Settlement — *not* the same shape as host-assigned

**Decision**: A fourth branch in `private.start_game_session`. In
`player_picked` mode:

1. **Full** `DELETE FROM public.assignments WHERE session_id = p_session_id` —
   the same unconditional delete automatic/relaxed modes do. Host-assigned's
   *selective* delete exists only because its drafts live in that very table;
   picks live elsewhere, so there is nothing to preserve in `assignments`.
2. **Seed** `public.assignments` from `public.assignment_picks`, filtered three
   ways: `participant_id = ANY(v_participant_ids)` (the locked roster —
   FR-041a, R5), `match_id` still present in `public.matches` for the session,
   and `match_id <> v_room.common_match_id` (R8).
3. **Fill** each participant's shortfall against `effectivePerPlayer` — the
   identical count-and-fill loop host-assigned mode already runs (migration
   037 lines 394–418), recording `filledInParticipantIds`.
4. **Common Match** insert for every active participant with
   `ON CONFLICT ... DO NOTHING`, already present and already correct.

Only steps 1–2 are new. Step 3 is literally the same loop; the two modes differ
in *how `public.assignments` gets seeded*, then converge.

> **Stale spec-of-mine claim, corrected here**: this feature's own `spec.md`
> Dependencies section says player-picked settlement is "the same shape" as
> host-assigned's, "seeded from picks instead of host allocations". That
> undersells the difference — the delete step inverts (selective → full), and
> the seed is a cross-table copy with two filters host-assigned has no need of.
> Treated as one branch with a shared tail, not a parameterisation of the
> existing one.

**Rationale**: Direct implementation of FR-041 ("keep every match each
participant picked and fill any remaining slots from the pool"). The pool-
membership filter in step 2 is not redundant with the FK cascade: it also
covers the *ordering* case where a match is removed and re-added, and it makes
the invariant local to the settlement code rather than dependent on a
constraint declared 30 migrations earlier.

**Alternatives considered**: *Copy picks into `public.assignments` at pick time
and settle as host-assigned does.* Rejected — that is R1's rejected shared-table
design wearing a different hat, and it would let `set_room_assignments` destroy
picks.

## R7: Progress rides the existing snapshot (FR-042)

**Decision**: `private.build_guest_room_snapshot` gains one additive key,
`'picks'`, shaped like the existing `'assignments'` key
(`[{participantId, matchId}]`, ordered by `participant_id, match_id`).

**Rationale**: This one `CREATE OR REPLACE` serves **both** client
surfaces, because `private.get_room_snapshot` delegates to it
(`032_room_membership_rpcs.sql` line 74) and so does
`private.get_guest_room_snapshot` (`026_guest_room_join.sql` line 269). So
host, registered member, and guest all receive pick progress from the poll they
already run, with no new fetch — satisfying FR-042 and the spec's "must ride
the existing snapshot" constraint in one edit. #184 set this precedent with
`assignmentMode` (migration 037 line 109).

Per-participant progress is then **derived client-side** (`count(picks where
participantId = X) / assignmentPlan.matchesPerPlayer`), exactly as #184 derives
its "still short" indicator (021 research R9) — no server-computed progress
field to keep in sync with the client's own arithmetic.

**Note on poll cadence**: registered/host lobby polls at
`LOBBY_POLL_INTERVAL_MS = 4000`; the guest session polls at
`GUEST_ROOM_POLL_INTERVAL_MS = 1000` (`hooks/useGuestRoomSession.ts`). Guests
therefore see others' progress *sooner* than the host does. The spec's
"must not imply instant feedback for another participant's picks" applies to
both; no UI may show another participant's pick as immediately confirmed.

## R8: The Common Match, both ways round

**Decision**: Two distinct guards, for two distinct events.

- **Picking it** (FR-040a): the pick RPC strips `common_match_id` from
  `p_match_ids` before validating and storing — a silent no-op, not an error,
  and the UI never offers it as a pool entry. It therefore never counts toward
  the cap.
- **It *becoming* the Common Match after someone picked it**: `set_common_match`
  (`035_configure_start_game_rpcs.sql` line 108) can promote a match a
  participant already picked. Settlement's step-2 filter
  (`match_id <> v_room.common_match_id`, R6) drops that pick, leaving the
  participant one short, and step 3 fills them. Correct by FR-040a's logic —
  they hold the Common Match anyway — and it requires no change to
  `set_common_match`.

**Rationale**: FR-040a as written covers only the first direction. The second
is reachable by ordinary host behaviour and would otherwise leave a
participant permanently one match short of the count with no code path noticing.
Migration 037 line 398 already established the "exclude the Common Match when
counting held matches" pattern; both guards are that pattern applied at the two
points where it is needed.

## R9: No new `gameplay_events` type — and no touch to the CHECK constraint

**Decision**: Picking emits no `gameplay_events` row. `010_constrain_gameplay_events.sql`
and `031_room_lifecycle.sql`'s `chk_gameplay_events_event_type` constraint are
**not** modified.

**Rationale** (constitution III will be read against this, so the argument is
explicit rather than assumed):

- **Picks are draft churn, not history.** Eight participants toggling picks for
  a few minutes would write hundreds of rows describing intentions that the
  settled set supersedes wholesale.
- **Settlement is already evented, and captures every surviving pick.**
  `start_game_session` emits `assignment_replaced` carrying the full settled
  assignment map plus `session_started` carrying `filledInParticipantIds`
  (migration 037 lines 473–504). FR-023's reconstructibility requirement is met
  by that record: what each participant *ended up holding*, and who needed
  filling, is fully derivable. Nothing about a completed game is unreconstructible
  for want of per-pick events.
- **The apparent asymmetry with host allocation is incidental.** Host
  allocations emit `assignment_replaced` only because they reuse
  `set_room_assignments`, which has emitted that event since migration 035 for
  a different purpose. It is not evidence of a "drafts are evented" policy —
  the sibling lobby-configuration mutations `set_room_assignment_settings` and
  `set_room_assignment_mode` both emit nothing (021 research R7). Picks follow
  the settings precedent.

> **Stale issue claim**: *"`010_constrain_gameplay_events.sql` `CHECK`-constrains
> `event_type`; new event kinds need that constraint extended in a new
> migration."* True as a conditional, but its antecedent is false here — and
> note the constraint has since moved: `031_room_lifecycle.sql` line 25 drops
> and recreates it, so a future extension must edit the 031 version, not 010.

**Alternatives considered**: *Emit `participant_pick_changed`.* Rejected on the
volume and precedent grounds above; revisitable if a genuine audit need for
lobby-time drafts ever surfaces (it would then apply to the settings and mode
RPCs equally, which is out of scope here).

## R10: Guest pick UI — scope resolved with the requester

**Decision**: **In scope.** Guests get a real pick control on their own device.

**The fork that made this a question**: the spec's Platform-impact line assumed
a guest pick surface exists. It does not. Verified:
`app/lobby/[sessionId].tsx` is documented and built for "the host and
registered members" only; `hooks/useGuestRoomSession` is consumed by **no**
screen in `app/` (only by `hooks/useGuestRoomJoin` and its tests); a guest's
entire room view is `components/guestJoin/GuestJoinLobby.tsx` — a read-only
card showing room state, a temporary-access explainer, and the participant
list. It has no match pool, no settings, no actions.

**Consequences of choosing in-scope**: `GuestJoinLobby` gains the match pool
and a pick control; `useGuestRoomSession` gains a `setMyPicks` action;
`GuestRoomSnapshot` gains the three keys the underlying jsonb already returns
but the TypeScript type never declared — `assignmentMode`, `assignmentPlan`,
and now `picks` (R11). The alternative (server-ready now, guest UI deferred to
a follow-up issue) was presented and declined.

**Where the pick UI lives for registered participants**: `app/lobby/[sessionId].tsx`
currently splits into an `isHost ?` branch (matches, mode, settings, start) and
an else branch ("Waiting for the host to start the game…"). The pick control
must render in **both**, because the host is a participant who picks their own
matches too. Extracting one `components/lobby/PlayerPickPanel.tsx` used by both
branches — and reused by `GuestJoinLobby` — avoids three copies of the same
cap-and-toggle logic.

## R11: Client types — the guest snapshot type is behind the wire

**Decision**: Add `picks: RoomPickSummary[]` to `RoomSnapshot`; add
`assignmentMode`, `assignmentPlan`, **and** `picks` to `GuestRoomSnapshot`.

**Rationale**: `types/room.ts`'s `RoomSnapshot` already tracks the wire shape
faithfully (#184 added `assignmentMode`). `types/guestRoom.ts`'s
`GuestRoomSnapshot` does **not**: it declares neither `assignmentMode` (added
to the shared builder by migration 037) nor `assignmentPlan` (added by 036),
even though `build_guest_room_snapshot` — the single source for both snapshot
RPCs — returns both to guests today. The guest type is a stale narrower view.
Since the guest pick UI needs `matchesPerPlayer` for the cap and
`assignmentMode` to decide whether to render at all, all three keys get
declared now. This is a type-only correction; no server change is needed for
the two pre-existing keys.

New error codes on `ROOM_ERROR`: `pickLimitExceeded: "pick_limit_exceeded"`,
`roomNotPlayerPicked: "room_not_player_picked"`, `notAParticipant:
"not_a_participant"`, plus reuse of the existing `matchNotFound` for a pick
outside the pool.

## R12: e2e — there are no multi-context helpers

> **Stale issue claim**: *"Playwright BDD ... two-device journey;
> `e2e/steps/browser-flow.helpers.ts` has the multi-context helpers."*

**Finding**: it does not. `grep` for `newContext` across `e2e/steps/` returns
nothing; the suite runs one page per scenario and simulates other actors by
mutating shared mock state behind `page.route` handlers —
`mockConfigureStartGameServices` (line 927) for the room RPCs and command-api,
`mockGuestRoomRpcServices` (line 827) for the guest RPCs, with helpers like
`transitionMockGuestRoomToState` standing in for "the mocked host starts
gameplay". `lobby-presence-host-handover.feature` expresses "the room has two
registered members" the same way.

**Decision**: Follow the existing pattern rather than introducing real
multi-context tests in this slice.

- `e2e/features/configure-start-game.feature` — host switches to player-picked,
  picks their own matches, sees a *second* participant's progress (injected via
  mock snapshot state), starts, and the settled set reflects the picks.
- `e2e/features/guest-room-join.feature` — a guest in a player-picked room sees
  the pool, picks up to the cap, is refused the one past it, and releases one.

Together these cover "two participants picking on separate devices" at the
fidelity this suite is built for. Real dual-context Playwright would be a
suite-wide infrastructure change, out of scope here and worth its own issue if
wanted.

## R13: Java `command-api` — no changes

**Decision**: Untouched, same as #184 (021 research R8).

**Rationale**: Picks are direct-to-Supabase RPCs via `RoomRpcClient` /
`GuestRoomRpcClient` (`utils/supabaseClient.ts`), never through the Java
service. `start_game_session`'s new branch is internal to the RPC — its
signature, its five guards, and its error vocabulary are unchanged, so
`StartGameCommandHandler.mapSupabaseError` needs no new case. Verified as a
regression check only.

## R14: Migration and pgTAP file numbering

**Decision**: One migration, `supabase/migrations/038_player_picked_mode.sql`
(next after `037_host_assigned_mode.sql`). One pgTAP file,
`supabase/tests/database/250_player_picked_mode.test.sql` (next after
`240_host_assigned_mode.test.sql`).

**Rationale**: Matches the repo's sequential `NNN_slug.sql` /
`NNN_slug.test.sql` conventions. Everything in this slice is one migration:
the table, its grants/RLS/indexes, two RPC pairs, and `CREATE OR REPLACE` of
`build_guest_room_snapshot` and `start_game_session` (both keep their
signatures, so existing `REVOKE`/`GRANT` carry over and no `DROP FUNCTION` is
needed).

**One ordering note for `/speckit-tasks`**: `010_schema.test.sql` asserts
hardcoded column lists. #184's CI caught exactly this when `assignment_mode`
was added (fix commit `be9c830`). A new *table* may or may not trip that test
depending on how it enumerates — check it in the same task that adds the table,
not after CI.

## R15: Reuse the existing match-selection UI, don't invent a third idiom

**Decision**: Build the pick UI on the **`components/setupGame`** match-selection
idiom — the app's mature visual language for "tap matches to select them" — by
extracting its presentational core into shared components, rather than extending
#184's flat button row or writing new markup.

**The two idioms currently in the codebase**:

| | `components/setupGame/AssignmentSection.tsx` (solo flow) | `app/lobby/[sessionId].tsx` (#184's allocation) |
|---|---|---|
| Match card | Team logos, `LinearGradient`, VS divider, kickoff time, numbered badge, `checkmark-circle` / `ellipse-outline` selection icon | `ShellActionButton` labelled `"Arsenal v Chelsea"` |
| Per-player card | Collapsible header, chevron, `n/total` count badge, responsive wide-grid | Plain `Text` line `"Name — 1/2 (short)"` |
| Layout options | Grid ⇄ list toggle | none |
| Styles | `createSetupGameStyles(colors)` + `useColors()` | Tamagui tokens inline |

The setupGame idiom is what users already associate with picking matches in this
app, and it already solves every problem the pick panel has: Common Match
exclusion (`nonCommonMatches`), a `count/total` badge
(`getAssignmentCount`), a `toggleMatchAssignment(playerId, matchId)` callback
shape, team logos via `getTeamLogoWithFallback`, and responsive wide-layout
handling. #184's row was expedient for a host allocating on behalf of others;
it is too thin for the surface a participant will actually spend time in.

**What to extract** into `components/matchSelection/`:

1. `SelectableMatchList.tsx` — the grid ⇄ list toggle plus the two card
   renderers currently inlined as `AssignmentSection`'s `renderMatchItem` /
   `renderCompactMatchItem`. Props: a match view-model array, `selectedMatchIds`,
   `onToggleMatch`, and an optional `disabledMatchIds` (new — needed for the cap:
   at the limit, unpicked matches disable while picked ones stay releasable).
2. `MatchSelectionCard.tsx` — the collapsible header + `n/total` badge shell,
   which the pick panel uses once (for "my picks") and the progress readout uses
   read-only per participant.

**The badge denominator must be a prop, not baked in.** `AssignmentSection`'s
badge is `getAssignmentCount(player.id) / nonCommonMatches.length` — the
denominator is **pool size**. The pick panel needs
`count / assignmentPlan.matchesPerPlayer` — the **cap**. If the extracted card
hard-codes either, the result is a silent display change in the solo flow
(violating FR-052) or a wrong cap readout in the panel. The existing responsive
test will not catch it: it asserts only the `AssignmentPlayersGrid` /
`AssignmentPlayerCard` testIDs and their layout, never the badge text. So the
extracted component takes `selectedCount` and `totalCount` as explicit props,
and the extraction task asserts the solo flow's rendered badge text is unchanged.

`AssignmentSection` is then refactored to consume both. **Behaviour must not
change** — FR-052 keeps the solo flow exactly as it is, so this is a
presentation-only extraction, and
`__tests__/components/setupGame/AssignmentSection.platform.test.tsx` guards it
via the `AssignmentPlayersGrid` / `AssignmentPlayerCard` testIDs, which the
extraction must preserve verbatim.

**One adapter is required.** `AssignmentSection` works on the Zustand store's
`Match` (`homeTeam`, `awayTeam`, `startTime`); the room snapshot supplies
`RoomMatchSummary` (`homeTeamName`, `awayTeamName`, `kickoffAt`). So the
extracted components take a neutral view-model
(`{ id, homeTeam, awayTeam, startTime? }`) and the pick panel maps
`RoomMatchSummary` → that shape — the same three-field mapping the lobby screen
already performs when hydrating the store at start
(`app/lobby/[sessionId].tsx`, the `setMatches` call).

**For the progress readout** (FR-042), extend `components/lobby/ParticipantList.tsx`
with an optional per-participant trailing badge rather than adding a second
participant list beside it. It already renders the roster with a `· role` badge
on both the lobby and (in shape) the guest card, so progress becomes one more
badge on a list every surface already shows.

**Rationale**: this is the smallest amount of *new* UI code for the largest
surface in the slice, and it converges the multiplayer lobby toward the app's
established look instead of adding a third style. It also means the guest
surface — which has no scaffolding at all (R10) — inherits a finished visual
language rather than needing one designed for it.

**Alternatives considered**:
- *Copy the markup into a new `PlayerPickPanel` and import only
  `createSetupGameStyles` / `getTeamLogoWithFallback`.* Rejected: duplicates ~80
  lines of card markup, which is exactly the code that drifts between two
  copies.
- *Extend #184's `ShellActionButton` row.* Rejected: cheapest to write, but it
  is the surface participants spend the most time in, and it would entrench the
  thinner idiom rather than the app's real one.
- *Reuse `ConfigureMatchesModal`.* Rejected: it browses the **ESPN catalogue**
  via `getMatchDiscoveryApiClient` to *add* matches to the pool. Picking is
  confined to the host's already-selected pool and must never reach the
  catalogue (FR-039) — the opposite data source.

## R16: The cap can be lowered *after* picks exist

**Decision**: Bound settlement's seed per participant
(`row_number() … <= effectivePerPlayer`, contracts §4 step 2) rather than
trimming picks inside `set_room_assignment_settings`.

**The hole this closes**: `set_room_assignment_settings` may lower
`matches_per_player` at any time while the room is `joinable`, and it does not
touch picks. Sequence: cap is 3 → a participant picks 3 → the host drops the cap
to 2. Settlement seeds all 3 picks, then step 3's fill loop computes
`v_needed := 2 − 3 = −1`, which is not `> 0` — so it neither fills nor
**trims**. That participant would hold 3 additional matches while everyone else
holds 2, violating FR-003 and this spec's own "every participant holds exactly
the effective per-player count" success criterion.

Migration 037's fill loop was never required to trim because host-assigned mode
is *deliberately* uncapped (FR-034) — an over-allocation there is the host's
intent. Player-picked mode has a hard cap (FR-040), so an over-hold is not a
reachable intended state; it is reachable only through this ordering. Inheriting
037's loop unchanged would therefore inherit a bug that mode never had.

**Rationale for the seed-side bound over trimming on settings change**: it keeps
`set_room_assignment_settings` byte-for-byte unchanged (consistent with this
slice touching no existing RPC), it is enforced at the one point that decides
what a started game runs on, and it cannot be bypassed by any future writer of
`assignment_picks`. Trimming at settings-change time would additionally destroy
a participant's picks on a change the host might immediately revert.

**Which picks survive the bound**: `ORDER BY random()`, matching the
non-determinism FR-006 already requires wherever the system chooses matches
itself. A "keep the earliest-picked" rule (`ORDER BY created_at`) was considered
and rejected as implying a fairness guarantee the spec does not make.

**Alternatives considered**: *Reject the settings change while any participant
holds more than the new count.* Rejected — it blocks a legitimate host action on
other participants' draft state, and FR-030's guards on that RPC are
deliberately limited to host-only/lobby-only.

---

## Summary: issue claims vs. post-#184 reality

| Issue claim | Verified reality | Resolution |
|---|---|---|
| `leave_room_as_member` "deletes the participant row", so picks need a cascade decision | All three leave paths **soft**-leave (`left_at = now()`); nothing hard-deletes a participant | R5: FR-041a is satisfied by settlement's roster filter; participant cascade is defensive only. Relying on the cascade would have silently failed |
| `010_constrain_gameplay_events.sql` constrains `event_type`, so a new event kind needs a migration | True conditionally, but no new event kind is warranted (R9) — and the constraint now lives in `031_room_lifecycle.sql`, not 010 | R9: no event, no constraint migration |
| `browser-flow.helpers.ts` "has the multi-context helpers" for a two-device journey | No `newContext` anywhere in `e2e/`; other actors are simulated via shared mock state | R12: follow the existing single-context mock pattern |
| Draft picks need storage distinct from `public.assignments` | **Correct** — and for a sharper reason than stated: the blocker is `set_room_assignments`'s replace-all destroying picks, plus two writers with different authorisation shapes | R1: new `public.assignment_picks` table |
| Guests write room state for the first time; enforce server-side, UI restraint insufficient | **Correct**, and the `leave_room_as_member`/`_as_guest` split is the right precedent | R3: two RPC pairs, participant derived from the credential, never from a parameter |
