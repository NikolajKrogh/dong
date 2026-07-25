# Feature Specification: Player-Picked Assignment Mode

**Feature Branch**: `185-us56-player-picked-matches`

**Created**: 2026-07-25

**Status**: Draft

**Input**: GitHub issue #185 — `[US5.6] Allow players to pick their own matches from the host's pool` (epic #116, depends on #184)

---

## Canonical spec notice

**This file does not define new requirements.** The full clarified behaviour for
this feature lives in
[`specs/020-canonical-assignment-generation/spec.md`](../020-canonical-assignment-generation/spec.md),
which is the shared reference for four GitHub issues (#135, #184, #185, #186).
That document's Delivery Slices table assigns this issue (#185) its own row:

> Player-picked selection — **US6** — FR-038 to FR-042

Where anything below disagrees with `specs/020/spec.md`, **020 wins** — this file
exists only so `/speckit-plan` and `/speckit-tasks` have a feature directory to
work in without touching #135's or #184's already-shipped planning artifacts
(`specs/020/plan.md`, `specs/020/tasks.md`, `specs/021/plan.md`,
`specs/021/tasks.md`). The sections below are copied verbatim from 020 and
scoped to what this issue delivers, plus the slice-specific refinements this
issue's own tracking (GitHub issue #185) adds on top; do not edit 020's
requirements here — edit 020 and copy forward.

**Dependency status**: #184 (assignment mode setting + host-assigned
allocation, `specs/021-host-assigned-mode`) is **closed**, with its work merged
via [PR #187](https://github.com/NikolajKrogh/dong/pull/187) and
[PR #188](https://github.com/NikolajKrogh/dong/pull/188). It supplies the
`assignment_mode` column, the `set_room_assignment_mode` RPC, and the lobby's
mode selector — which currently offers only `automatic` and `host_assigned`;
the selector's `player_picked` option is intentionally withheld pending this
issue. This branch is cut from `184-us55-host-assigned-allocation` (rather than
from the shared integration branch) because that branch carries follow-up
fixes for #184 not yet folded into a merged PR; rebase onto the integration
branch once those land, before opening this issue's PR.

---

## Overview

Add the third and last assignment mode: **player-picked**. Each participant —
host, registered non-host member, or session-scoped guest — opens the room on
their own device and chooses which of the host's already-selected matches they
want, up to the room's per-player count. Nobody browses the wider match
catalogue; the choice is confined to the pool the host curated for the room.
The lobby shows every participant's progress so the host can see who is ready
without waiting on them: a participant who never finishes picking does not
block the start, because the server completes their set from the pool the
moment the game starts.

This is the first mode in which a participant other than the host writes
room-scoped state. Every mutation #135 and #184 introduced is host-only;
picking needs a genuinely different authorisation shape — *this participant,
on their own row only* — enforced server-side, because guests authenticate by
room-scoped token rather than `auth.uid()`.

---

## Clarifications

### Session 2026-07-25

- Q: Does player-picked mode give participants access to the wider match
  catalogue? → A: **No.** Participants choose only from the pool the host
  already selected for the room, per `specs/020`'s clarification session.
- Q: What happens when a participant has not finished picking by the time the
  host starts? → A: **The server fills the shortfall at start**, keeping what
  the participant already chose (`specs/020`'s clarification session).
- Q: Does the per-player count or the shared-per-pair overlap rule apply to
  player-picked selections? → A: **Only the per-player count.** The
  exact-overlap rule is automatic-mode-only (FR-011); a participant's picks
  are bounded solely by the count, and enforcing exact overlap against free
  choice would create dead-ends where a participant has no legal pick left.
- Q (this issue, carried from issue #185's tracking): can a participant pick
  the Common Match, or unpick it? → A: **No-op, like host-assigned mode's
  equivalent case (FR-034/021).** The Common Match belongs to every
  participant by definition; it is never offered as a pickable pool entry and
  is not counted against the per-player cap.

---

## User Scenarios & Testing *(mandatory)*

### User Story 6 - Players pick their own matches (Priority: P2)

In player-picked mode each participant opens the room on their own device and
chooses which of the host's selected matches they want, up to the room's
per-player count. The lobby shows everyone's progress so the host can see who
is ready. A player who never finishes picking does not hold the room hostage —
the server completes their set when the game starts.

**Why this priority**: This is the mode that makes the lobby feel like a shared
room rather than a host's console, but automatic mode already delivers a
working game, so it does not gate the P1 stories.

**Independent Test**: Set the mode to player-picked, have two devices each pick
a different number of matches, confirm each device sees the other's progress,
start, and confirm each player's stored set contains their own picks.

**Acceptance Scenarios**:

1. **Given** a room in player-picked mode,
   **When** a participant picks a match from the room's pool,
   **Then** the pick is stored against that participant,
   **And** every participant's lobby view shows the updated progress.

2. **Given** a participant who has already picked their full per-player count,
   **When** they attempt to pick another match,
   **Then** the pick is refused until they release one of their existing
   picks.

3. **Given** a room in player-picked mode where some participants have picked
   fewer than the per-player count,
   **When** the host starts the game,
   **Then** each participant keeps every match they picked,
   **And** the server fills each remaining slot from the pool,
   **And** the resulting set still gives every participant the full
   per-player count.

4. **Given** a room in player-picked mode,
   **When** a participant attempts to pick a match that is not in the room's
   selected pool,
   **Then** the pick is refused.

5. **Given** a room in player-picked mode,
   **When** a participant attempts to change another participant's picks,
   **Then** the attempt is rejected.

---

### Edge Cases (relevant to this slice)

- **Player-picked room where nobody picks anything**: every set is filled by
  the server at start; the game is indistinguishable from an automatic one.
- **A participant leaves after picking**: their picks leave with them and free
  up nothing else — remaining participants are unaffected. Note that all three
  leave paths **soft**-leave (`left_at`), so this is satisfied by settlement's
  roster filter rather than by a cascade — the GitHub issue's claim that
  `leave_room_as_member` deletes the participant row is stale
  (see [research.md](research.md) R5).
- **A participant picks, then the host switches away from player-picked
  mode**: covered by #184's existing confirm-before-discard behaviour
  (FR-030a) — the draft (here, the picks) does not carry over, and the host
  must confirm before it is discarded.
- **The Common Match**: never offered as a pickable pool entry and never
  counted against the per-player cap, mirroring host-assigned mode's
  equivalent no-op (020's edge cases).
- **Overlap setting in player-picked mode**: stored but not enforced, and the
  lobby must not imply it is being honoured (020's edge cases).
- **A count valid in one mode but not another**: a host has participants
  picking under a stored count, then switches to automatic where the FR-009
  minimum is higher; the switch must surface the new minimum rather than
  silently changing the number participants were shown (020's edge cases,
  mirrored from #184's own equivalent case).
- **Progress visibility lags by up to one poll interval**: pick progress rides
  the existing ~4s room snapshot poll, not a realtime channel. The lobby must
  not imply instant feedback for another participant's picks.

---

## Requirements *(mandatory)*

### Functional Requirements

**Player-picked mode**

- **FR-038**: In player-picked mode every participant MUST be able to pick
  their own matches from the room's selected pool while the room is in the
  lobby state.
- **FR-038a**: A pick MUST be attributable and enforceable against the
  authenticated caller's own participant row only — a registered non-host
  member's `auth.uid()`-backed identity, or a session-scoped guest's
  room-scoped token — never against an arbitrary participant ID supplied by
  the caller. This is enforced server-side; UI-level restraint alone is not
  sufficient (Overview; this is the first mode in which a non-host writes
  room-scoped state).
- **FR-039**: Participants MUST NOT be able to pick a match outside the room's
  selected pool, and MUST NOT be able to change another participant's picks.
- **FR-040**: A participant MUST NOT be able to hold more picks than the
  room's per-player count, and MUST be able to release a pick to make room
  for another.
- **FR-040a**: The Common Match MUST NOT be offered as a pickable pool entry
  and MUST NOT count against a participant's per-player cap — picking or
  releasing it is a no-op, mirroring host-assigned mode's equivalent case
  (FR-034/021).
- **FR-041**: At start, the system MUST keep every match each participant
  picked and fill any remaining slots from the pool.
- **FR-041a**: A participant who leaves the room before start MUST take their
  picks with them; their departure MUST NOT free a slot, alter another
  participant's picks, or leave an orphaned pick row once they are removed
  from the roster.
- **FR-042**: The lobby MUST show every participant how far each participant
  has progressed through their picks.

**Mode-scoped exception to #135's rules** *(carried forward from 020/021, restated for this slice)*

- **FR-011**: The exact-overlap rule of FR-007 (020), and its derived minimum
  of FR-009 (020), MUST apply only to automatic generation. Player-picked mode
  is constrained by the per-player count alone, and in that mode the count the
  host set is the count participants get — it MUST NOT be silently raised.

### Key Entities

- **Draft Pick**: A participant's own pre-start intention in player-picked
  mode — one participant, one pool match, capped by the per-player count.
  Informs settlement but is not itself canonical until the server settles it
  at start. Needs storage distinct from `public.assignments`, which after
  #135 holds only the *settled* set, and distinct from #184's host-allocation
  draft storage, since a pick's write authority is the participant, not the
  host.
- **Room / Session**: Already carries the persisted assignment mode, per-player
  count, and shared-per-pair count from #135/#184; player-picked is its third
  mode value.
- **Participant**: Gains the ability to hold draft picks against their own row
  in player-picked mode — the first non-host write of room-scoped state.

---

## Success Criteria *(mandatory)*

- **SC**: In 100% of successful player-picked starts, every match a
  participant picked appears in that participant's settled set (`specs/020`
  SC-008).
- **SC**: In 100% of successful player-picked starts, every participant holds
  exactly the effective per-player count of additional matches, whether from
  their own picks, server fill, or both (`specs/020` SC-003).
- **SC**: In 100% of pick attempts that would exceed the per-player count, the
  pick is refused and no state changes until an existing pick is released.
- **SC**: In 100% of attempts by a participant to pick outside the room's pool
  or to alter another participant's picks, the attempt is rejected and no
  state changes.
- **SC**: A participant's pick is visible in every other participant's lobby
  view within the room's normal ~4s snapshot poll, with no additional wait.

---

## Assumptions

- **Player-picked mode does not give players access to the match catalogue.**
  Confirmed in `specs/020`; participants choose only from the pool the host
  already selected for the room.
- **The server always settles at start.** Draft picks inform settlement but
  are never themselves the canonical set — confirmed in `specs/020`.
- **Guest write-authorisation reuses the existing room-scoped token pattern**
  from `supabase/migrations/026_guest_room_join.sql` and the token-scoped
  guest leave path in `033_host_leave.sql`, rather than introducing a new
  authentication mechanism for this one mode.
- **A one-participant room is valid** and player-picked behaves the same as
  any other roster size for it — trivially, the sole participant either picks
  their own count or has it filled by the server.
- **Clients keep the existing ~4-second room snapshot poll** as their
  synchronisation mechanism for pick progress; no realtime subscription is
  introduced here.
- **Pick storage needs an FK/cascade decision** consistent with
  `leave_room_as_member` (`032_room_membership_rpcs.sql`) deleting the
  participant row, so a departing participant's picks are removed rather than
  orphaned.

---

## Dependencies

- **#184 / `specs/021-host-assigned-mode`** (closed, merged via
  [PR #187](https://github.com/NikolajKrogh/dong/pull/187) /
  [PR #188](https://github.com/NikolajKrogh/dong/pull/188)): supplies the
  `assignment_mode` column and enum, `set_room_assignment_mode`, the
  mode-conditional `effectivePerPlayer`/minimum-floor exemption in
  `private.compute_room_assignment_plan` and
  `private.set_room_assignment_settings`, and the lobby's mode selector —
  which this issue extends with its third, currently-withheld option.
- **#135 / `specs/020-canonical-assignment-generation`**: supplies canonical
  server-side settlement at start (`private.start_game_session`), the
  `AssignmentPlan` feasibility read, and the pattern host-assigned mode
  established in `037_host_assigned_mode.sql` for a shortfall-fill branch. The
  count-and-fill *tail* is shared verbatim; the seed differs more than "same
  shape, seeded from picks" suggests — the delete step inverts from selective to
  full, and the seed is a cross-table copy with roster/pool/Common-Match filters
  host-assigned has no need of (see [research.md](research.md) R6).
- **`supabase/migrations/026_guest_room_join.sql`** and **`033_host_leave.sql`**:
  establish the room-scoped guest token pattern this issue's participant-owns
  -their-own-row authorisation reuses.
- **`hooks/useRoomLobby`** and **`app/lobby/[sessionId].tsx`**: supply the
  polled room snapshot the lobby already renders; pick progress must ride this
  snapshot rather than a new fetch. Note this screen serves the host and
  registered members only.
- **`components/guestJoin/GuestJoinLobby.tsx`** and
  **`hooks/useGuestRoomSession`**: the guest's entire room surface — today a
  read-only summary card with no match pool and no actions. This is where a
  guest's pick UI must be built, and it is the largest client cost in the slice
  (see [research.md](research.md) R10).
- **`components/setupGame/AssignmentSection.tsx`** and
  **`app/style/setupGameStyles.ts`**: the app's existing match-selection UI
  (team-logo cards, grid ⇄ list toggle, collapsible `n/total` count cards). The
  pick UI is built by extracting and reusing this rather than adding a third
  visual idiom (see [research.md](research.md) R15).
- **`supabase/migrations/010_constrain_gameplay_events.sql`**: `CHECK`-constrains
  `event_type`; if a pick is recorded as a gameplay event (rather than only as
  a row in dedicated pick storage), that constraint needs extending in a new
  migration.

---

## Out of Scope

- **A readiness or "lock in" gate in player-picked mode.** Participants pick,
  and the server completes whatever is unfinished at start; there is no
  explicit ready-check protocol (`specs/020`).
- **Access to the wider match catalogue.** Picks are confined to the host's
  selected pool.
- **Enforcing the overlap rule in player-picked mode.** Bound by the
  per-player count alone (FR-011).
- **Mid-game reassignment.** Deferred to #186.
- **Automatic reassignment when the roster changes mid-game.**

---

## Platform, Auth, Shared-State, and Migration Impact

- **Platform impact**: The lobby gains a per-participant pick interface
  (confined to the room's pool, capped by the per-player count, with a
  release action) and a per-participant progress display visible to everyone.
  Must behave identically on native and web, and on a session-scoped guest's
  device as well as a registered member's.
- **Auth / guest impact**: This is the first room mutation a session-scoped
  guest or a registered non-host participant can perform beyond their own
  presence. Every existing room mutation (`035_configure_start_game_rpcs.sql`,
  #184's `set_room_assignment_mode`, `set_room_assignments`) is host-only,
  checking `v_room.owner_account_id <> v_account`. Picking needs the different
  shape described in FR-038a — *this participant, on their own row* — and
  MUST be enforced server-side against the caller's actual identity (guest
  token or `auth.uid()`), not client-side restraint.
- **Shared-state impact**: Continues #135's shift of assignment authorship to
  the server: picks are drafts, the server settles them at start, exactly as
  #184's host allocations already are.
- **Migration / backfill impact**: Requires new storage for draft picks,
  distinct from `public.assignments` (settled set) and from #184's host
  -allocation draft storage. Needs an FK/cascade decision for a participant
  who leaves before start (FR-041a). If picks are recorded via a new gameplay
  event kind, `010_constrain_gameplay_events.sql`'s `CHECK` constraint needs
  extending in a new migration. No backfill of existing rooms is needed: the
  `assignment_mode` column already defaults to `automatic` (#184), so rooms
  that never adopt player-picked mode are unaffected.
- **Test strategy**: pgTAP under `supabase/tests/database/` — especially the
  "a participant may only write their own picks" boundary, tested as a guest
  and as a registered non-host member, the pool-confinement and cap-and
  -release rules, the start-time fill-from-pool behaviour, and the
  participant-leaves-before-start cascade. Playwright BDD under
  `e2e/features/` + `e2e/steps/` for the two-device journey (see
  `e2e/steps/browser-flow.helpers.ts` for the existing multi-context helpers).
  `npm test && npm run lint` before PR, matching #184's precedent.
