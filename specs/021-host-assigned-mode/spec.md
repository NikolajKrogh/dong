# Feature Specification: Assignment Mode Setting + Host-Assigned Allocation

**Feature Branch**: `184-us55-host-assigned-allocation`

**Created**: 2026-07-25

**Status**: Draft

**Input**: GitHub issue #184 — `[US5.5] Allow the host to allocate player matches by hand` (epic #116, depends on #135)

---

## Canonical spec notice

**This file does not define new requirements.** The full clarified behaviour for
this feature lives in
[`specs/020-canonical-assignment-generation/spec.md`](../020-canonical-assignment-generation/spec.md),
which is the shared reference for four GitHub issues (#135, #184, #185, #186).
That document's Delivery Slices table assigns this issue (#184) its own row:

> Assignment mode setting + host-assigned allocation — **US3** (partially: the
> mode setting), **US5** — FR-011, FR-026–027, FR-029–030, FR-034–037

Where anything below disagrees with `specs/020/spec.md`, **020 wins** — this file
exists only so `/speckit-plan` and `/speckit-tasks` have a feature directory to
work in without touching #135's already-shipped planning artifacts
(`specs/020/plan.md`, `specs/020/tasks.md`). The sections below are copied
verbatim from 020 and scoped to what this issue delivers; do not edit
requirements here — edit 020 and copy forward.

**Dependency status**: #135 (canonical server-side settlement at start) is
**closed and merged** ([PR #187](https://github.com/NikolajKrogh/dong/pull/187),
merged 2026-07-25). This issue's second input into the settlement path #135 built
can now land.

---

## Overview

Promote the host's lobby assignment editing from a throwaway draft into a real,
persisted **assignment mode**, where the host allocates matches to each
participant by hand and the server settles that allocation at game start. This
also introduces the room-level **assignment mode setting** itself (automatic /
host-assigned / player-picked), which #185 then extends with its third option
(player-picked) and #186 with mid-game reassignment.

---

## Clarifications

### Session 2026-07-25

- Q: Can the host allocate more than the room's configured per-player count to a single participant in host-assigned mode? → A: **Uncapped.** The host may allocate more than the count; the stored set is exactly what was allocated. The per-player count still governs when the server fills a *shortfall* (FR-036), but it does not cap the host's own choices.
- Q: When switching mode discards an existing draft, must the host confirm before it's discarded? → A: **Confirm-first.** The switch is blocked behind a confirmation dialog; declining leaves the mode and the draft unchanged.
- Q: Can the host allocate the same match to more than one participant in host-assigned mode? → A: **Shared allowed.** The host may allocate the same match to any number of participants; no exclusivity rule applies outside automatic mode.
- Q: Can the host remove or change a match already allocated to a participant before start? → A: **Revisable.** The host can add or remove any participant's allocated matches at any time while the room is in the lobby state.
- Interpretation recorded during implementation (2026-07-25, not a user-facing question — a technical constraint discovered while building): "the host is told which players were filled in" (scenario 3 below, FR-037) is satisfied **pre-start**, not as a post-start message. The Java command-api's response envelope does not forward RPC/handler internals to the client (an existing, documented boundary — `relaxedConstraints` already lives behind it: it's computed into the RPC's result and the audit event, never into the HTTP response). The lobby already has to show which participants are short of their count before the host presses Start (FR-037's other clause); telling the host who *will* be filled in, in that same pre-start view, satisfies the intent earlier and without a new server-to-client channel. `filledInParticipantIds` still exists on the RPC's return and in the `session_started` event payload, for pgTAP and the room's history — just not as something the client fetches after starting.

## User Scenarios & Testing *(mandatory)*

### User Story 3 - The host chooses how matches get decided (Priority: P2) — mode setting only, this issue

Before starting, the host picks how the room's assignments will be decided:
generated automatically or allocated by the host (player-picked is #185's third
option). The choice belongs to the room, so every participant sees which mode is
in effect and the lobby shows them the right thing to do.

**Why this priority**: The mode determines what the lobby shows every participant
and how the start behaves, so it gates User Story 5. It is separable from #135
because automatic mode is a workable default on its own.

**Independent Test**: Change the mode on the host device, confirm a second
participant's device reflects the new mode, reload both, confirm it persisted.

**Acceptance Scenarios**:

1. **Given** a room in the lobby,
   **When** the host selects an assignment mode,
   **Then** the mode is stored on the room,
   **And** every participant's lobby view reflects that mode.

2. **Given** a room whose mode has never been set,
   **When** any client views the room,
   **Then** the mode reads as automatic.

3. **Given** a room that is no longer in the lobby state,
   **When** anyone attempts to change the assignment mode,
   **Then** the change is rejected and the stored mode is unchanged.

4. **Given** a room where participants have already made picks or the host has
   already made manual allocations,
   **When** the host attempts to switch to a different mode,
   **Then** the host is asked to confirm that the existing draft arrangement will
   not carry over before the switch takes effect,
   **And** if the host declines, the mode and the draft are both left unchanged,
   **And** if the host confirms, the mode changes and the draft is discarded.

---

### User Story 5 - The host allocates matches by hand (Priority: P2)

In host-assigned mode the host works through the roster in the lobby, giving each
player their matches from the room's pool. The lobby shows who is complete and who
is still short, and the host cannot start with anyone unallocated unless they let
the server fill the gap.

**Why this priority**: This promotes `specs/018`'s draft assignment editing into a
real mode with meaning, and it is the mode a host reaches for when they want full
control over who watches what.

**Independent Test**: Set the mode to host-assigned, allocate matches to some but
not all players, confirm the lobby shows the outstanding ones, then start and
confirm the stored set matches what was allocated.

**Acceptance Scenarios**:

1. **Given** a room in host-assigned mode,
   **When** the host allocates matches to a player,
   **Then** the allocation is stored on the room,
   **And** every participant's lobby view reflects it.

2. **Given** a room in host-assigned mode where every player has their full
   per-player count,
   **When** the host starts the game,
   **Then** the stored assignment set is exactly what the host allocated, plus the
   Common Match for everyone.

3. **Given** a room in host-assigned mode where some players are short of their
   per-player count,
   **When** the host starts the game,
   **Then** the server keeps what was allocated and fills each shortfall from the
   pool,
   **And** the host is told which players were filled in.

4. **Given** a room in host-assigned mode,
   **When** anyone other than the host attempts to allocate matches,
   **Then** the attempt is rejected.

---

### Edge Cases (relevant to this slice)

- **Mode switched after picks or allocations exist**: the draft does not carry
  over, and the host must explicitly confirm before it is discarded — the switch
  does not take effect on a decline.
- **Host-assigned room where the host allocates the Common Match explicitly**:
  treated as a no-op, since everyone holds the Common Match by definition.
- **Overlap setting in a non-automatic mode**: stored but not enforced, and the
  lobby must not imply it is being honoured.
- **Host allocates the same match to several participants**: permitted without
  restriction in host-assigned mode; each of those participants simply holds that
  match in their settled set.
- **A count valid in one mode but not another**: a host sets a count in
  host-assigned mode, then switches to automatic where the FR-009 minimum is
  higher. The switch must surface the new minimum rather than silently changing
  the number participants were shown.

---

## Requirements *(mandatory)*

### Functional Requirements

**Room configuration**

- **FR-026**: The room MUST carry a persisted assignment mode — automatic,
  host-assigned, or player-picked — visible to every participant.
- **FR-029** (mode clause): The host MUST be able to change the assignment mode
  while the room is in the lobby state, in addition to the per-player and
  shared-per-pair counts already covered by #135.
- **FR-030**: Changing the mode MUST be rejected when the room is no longer in the
  lobby state, and MUST be rejected for anyone other than the host.
- **FR-030a**: When a room being switched away from has an existing draft
  arrangement (host allocations or player picks), the host MUST explicitly
  confirm the switch before it takes effect. Declining MUST leave both the mode
  and the draft unchanged. This confirmation is a client-side gate on the same
  host-only, lobby-only mutation FR-030 already governs — it does not introduce a
  separate server-side rule.

**Host-assigned mode**

- **FR-034**: In host-assigned mode the host MUST be able to allocate matches from
  the room's pool to any participant while the room is in the lobby state. The
  host's allocations are uncapped — the host MAY allocate more than the room's
  configured per-player count to a participant, and the server MUST NOT reject or
  trim an allocation for exceeding that count. The same match MAY be allocated to
  any number of participants — host-assigned mode has no exclusivity rule between
  participants for a given match.
- **FR-035**: Allocation MUST be rejected for anyone other than the host.
- **FR-035a**: The host MUST be able to remove or change a participant's
  allocated matches, not only add to them, at any point while the room remains
  in the lobby state.
- **FR-036**: At start, the system MUST keep every match the host allocated and
  fill any participant's shortfall from the pool.
- **FR-037**: The lobby MUST show the host which participants are still short of
  the per-player count, and MUST tell the host, before they start, which of
  those participants the server will fill in if they proceed — satisfying
  "the host is told which players were filled in" pre-start rather than as a
  separate post-start message (see the implementation-interpretation note
  above). A participant allocated at or above the count MUST NOT be shown as
  short, regardless of how far above it they are.

**Mode-scoped exception to #135's rules**

- **FR-011**: The exact-overlap rule of FR-007 (020), and its derived minimum of
  FR-009 (020), MUST apply only to automatic generation. Host-assigned mode is
  constrained by the per-player count alone, and in that mode the count the host
  set is the count participants get — it MUST NOT be silently raised. This means
  the FR-031/FR-032 minimum-enforcement behaviour #135 shipped for automatic mode
  MUST become mode-conditional rather than unconditional once this issue lands.

### Key Entities

- **Room / Session**: Gains a persisted assignment mode alongside the per-player
  count and shared-per-pair count #135 already added.
- **Assignment Mode**: How the room's assignments are decided — automatic or
  host-assigned in this slice (player-picked follows in #185).
- **Draft Allocation**: The host's pre-start intention for a participant in
  host-assigned mode — informs settlement but is not itself canonical until the
  server settles it at start. Needs storage distinct from `public.assignments`,
  which after #135 holds the *settled* set.

---

## Success Criteria *(mandatory)*

- **SC**: In 100% of successful host-assigned starts, every participant holds
  exactly the effective per-player count of additional matches (drawn from
  `specs/020` SC-003).
- **SC**: A room in host-assigned mode with some participants short of their count
  starts successfully, keeps every host allocation, fills the shortfall from the
  pool, and reports which participants were filled in, in 100% of such starts.
- **SC**: Changing the assignment mode is visible on a second participant's device
  within the room's normal ~4s snapshot poll, with no additional wait.

---

## Assumptions

- **The assignment mode is a new persisted room setting** with no existing home in
  the room's data — confirmed in `specs/020`.
- **The server always settles at start**; host allocations inform settlement but
  are never themselves the canonical set — confirmed in `specs/020`.
- **A one-participant room is valid** and the host-assigned rules apply to it the
  same as any other roster size.
- **Clients keep the existing ~4-second room snapshot poll** as their
  synchronisation mechanism; no realtime subscription is introduced here.

---

## Dependencies

- **#135 / `specs/020-canonical-assignment-generation`** (closed, merged via
  [PR #187](https://github.com/NikolajKrogh/dong/pull/187)): supplies canonical
  server-side settlement at start, the `AssignmentPlan` feasibility read, the
  `set_room_assignment_settings` RPC, and the `relaxConstraints` start-game
  parameter this issue plugs a second input into.
- **`specs/018-configure-start-game`**: supplies `public.set_room_assignments`
  (host-only + `joinable`-only replace-all of `public.assignments`, emitting an
  `assignment_replaced` event) and `hooks/useRoomConfigure.ts`'s `setAssignments`
  — the seam host-assigned allocation builds on, noting that table now holds the
  *settled* set post-#135 so draft allocations need their own storage.

---

## Out of Scope

- **Player-picked mode.** Deferred to #185.
- **Mid-game reassignment.** Deferred to #186.
- **Enforcing the overlap rule outside automatic mode.** Host-assigned mode is
  bound by the per-player count alone (FR-011).
- **Automatic reassignment when the roster changes mid-game.**

---

## Platform, Auth, Shared-State, and Migration Impact

- **Platform impact**: The lobby gains a mode selector and a per-participant
  allocation interface, plus a warning when switching modes discards an existing
  draft. Must behave identically on native and web.
- **Auth / guest impact**: Only the host may set the mode or allocate matches in
  host-assigned mode.
- **Shared-state impact**: Continues #135's shift of assignment authorship to the
  server — host allocations are drafts, the server settles them at start.
- **Migration / backfill impact**: Requires a schema change adding the assignment
  mode column, defaulting to automatic (unset reads as automatic per FR-027 in
  020) so existing rooms need no backfill. Draft allocations need storage distinct
  from `public.assignments`. `supabase/migrations/010_constrain_gameplay_events.sql`'s
  `CHECK` on `event_type` needs extending in a new migration if a new event kind is
  introduced for mode changes or host allocation.
- **Test strategy**: pgTAP for the host-only and `joinable`-only guards on mode
  changes and allocation; Playwright BDD extending
  `e2e/steps/configure-start-game.steps.ts` for the host-assigned journey;
  `npm test && npm run lint` before PR.
