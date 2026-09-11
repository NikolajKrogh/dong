# Feature Specification: Server-Authoritative Multiplayer Gameplay

**Feature Branch**: `186-us57-allow-the-host-to-reassign-player-matches-during-an-active-game`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "Explore GitHub issue #190 on the existing #186 branch."

## Context and Scope

Multiplayer rooms currently share a settled game only until play begins. Each
device then continues from its own local copy, so goals, drinks, assignment
changes, reconnects, and game completion can diverge. This feature makes the
active multiplayer room the canonical game while preserving the existing local
experience for solo games.

Issue #190 is the integration feature for the user outcomes also tracked by
#138 (completion), #139 (drinks), #140 (recovery), #141 (goals), and the client
half of #186 (reassignment). #190 owns the integrated acceptance boundary,
while those related issues remain independently deliverable implementation
slices. #192 owns additional release-pipeline gates rather than product
behavior.

## Clarifications

### Session 2026-08-16

- Q: How should #190 relate to #138, #139, #140, #141, and the client half of #186? → A: #190 owns the integrated outcome while the related issues remain independently deliverable implementation slices.
- Q: Who may record ordinary goals and drinks in an active multiplayer game? → A: Any active participant, including a guest, may adjust any manual match score and any active participant's drink total.
- Q: How should provider-controlled match scores participate in shared gameplay? → A: Provider scores are canonical shared values; participants cannot edit them, and all clients converge on accepted provider updates and corrections.
- Q: What is the trusted boundary for provider scores? → A: Only the authenticated Supabase Edge Function may fetch and commit provider observations through service-role-only RPCs; clients submit only a room ID and idempotency key, and Java remains fixture-discovery-only.
- Q: What is the history source of truth for a completed multiplayer game? → A: The shared history entry is canonical; devices may cache it for display but must not create a separate game record.
- Q: Which multiplayer actions should appear optimistically? → A: Goals and drinks update optimistically; reassignment and completion remain pending until canonical confirmation.

### In Scope

- Shared goals and drink totals for every active participant.
- Recovery from stale, backgrounded, restarted, or temporarily disconnected
  clients.
- Host completion from the active game, followed by consistent final results.
- The host-only reassignment experience enabled by #186's server capability.
- Native and web behavior for the same multiplayer journeys.
- Continued support for local-only solo games.

### Out of Scope

- Spectators or people who are not active room participants.
- Editing a completed game's recorded events or final results.
- Queuing gameplay changes while fully offline for later submission.
- Fabricating historical events for games completed before this feature.
- General CI and release-gate expansion tracked by #192.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Everyone Plays One Shared Game (Priority: P1)

An active participant records a manual goal or drink change and every device in
the room converges on the same accepted result. A retry does not apply the same
action twice, and simultaneous distinct actions are all preserved.

**Why this priority**: A multiplayer game is not trustworthy while each device
keeps an independent score and drink record.

**Independent Test**: Start one active room on two clients, submit goals and
drinks from both clients—including simultaneous actions and a retried action—and
verify both clients and the final shared state contain every distinct accepted
action exactly once.

**Acceptance Scenarios**:

1. **Given** two active participants viewing the same game, **When** either one
   records a goal for any manually scored match, **Then** both clients show the
   same new score within five seconds and the action appears once in the game's
   audit history.
2. **Given** two active participants viewing the same game, **When** one records
   or removes a half-drink for a participant, **Then** both clients show the
   same non-negative drink total within five seconds.
3. **Given** the same gameplay action is retried, **When** the shared game
   processes both attempts, **Then** the action affects the result exactly once.
4. **Given** two participants submit different valid actions at nearly the same
   time, **When** both are accepted, **Then** neither action is lost and all
   clients converge on the combined result.
5. **Given** a client displays an immediate goal or drink change, **When** the
   shared game rejects that action, **Then** the client restores the canonical
   value and explains why the action failed.
6. **Given** a provider-controlled match, **When** an accepted provider update
   or correction changes its score, **Then** every client displays the same
   canonical score and no participant-authored goal action is fabricated.

---

### User Story 2 - Recover the Current Game (Priority: P1)

A participant who backgrounds, restarts, or temporarily loses connectivity can
return to the active room and recover its current participants, assignments,
scores, and drink totals without manual repair.

**Why this priority**: Shared writes are only useful if a stale client cannot
continue from an obsolete copy and overwrite or misrepresent the game.

**Independent Test**: Make one client stale while another records several
changes, then resume or restart the stale client and verify it matches the
canonical room before accepting another gameplay action.

**Acceptance Scenarios**:

1. **Given** a participant's client missed several accepted changes, **When** it
   returns to the active game, **Then** it shows the current roster,
   assignments, scores, and drinks within ten seconds.
2. **Given** a stale local value conflicts with the shared game, **When**
   recovery completes, **Then** the shared value replaces the stale value.
3. **Given** a participant is disconnected, **When** they try to change shared
   gameplay state, **Then** the action is not silently queued and the client
   prompts them to reconnect and refresh.
4. **Given** the participant was removed or the room ended while disconnected,
   **When** they return, **Then** they cannot submit further gameplay changes
   and see the appropriate ended or access-lost state.

---

### User Story 3 - End the Multiplayer Game Cleanly (Priority: P1)

The current host ends the game from the active-game experience. The accepted
shared state becomes final, all clients stop changing it, and signed-in players
can find the same canonical completed-game record.

**Why this priority**: Normal multiplayer games currently leave the shared room
running and only save a device-local result, so shared history is never
completed through the primary journey.

**Independent Test**: Record gameplay from two clients, have the host end the
game from the active screen, and verify both clients see the same final result,
later writes fail, and the completed record equals the accepted shared state.

**Acceptance Scenarios**:

1. **Given** an active multiplayer game, **When** the current host confirms End
   Game, **Then** the screen shows completion as pending until the shared game
   confirms completion, before the host leaves the active-game experience.
2. **Given** a game has completed, **When** any client attempts another goal,
   drink, or assignment change, **Then** the change is rejected and the final
   result remains unchanged.
3. **Given** participants recorded gameplay from multiple devices, **When** the
   game completes, **Then** its completed record contains the final shared
   scores, drinks, participants—including participants who left early—and
   assignment history.
4. **Given** a non-host participant is in an active game, **When** they view the
   game controls, **Then** they cannot end the shared game.
5. **Given** host responsibility changes during play, **When** the room reflects
   the handover, **Then** only the new host can end the game.

---

### User Story 4 - Host Corrects Assignments During Play (Priority: P2)

The current host can replace a participant's non-common match assignments from
the active game. Other devices see the new assignments without losing goals or
drinks already recorded.

**Why this priority**: This completes the user-facing half of #186 after shared
gameplay and room recovery establish a safe source of truth.

**Independent Test**: Record scoring and drinks, reassign a participant as the
host, and verify two clients converge on the new assignment while all previous
gameplay remains unchanged and later attribution follows the new assignment.

**Acceptance Scenarios**:

1. **Given** an active game and an eligible participant, **When** the host
   replaces that participant's assignable matches, **Then** the control remains
   pending until acceptance and all clients show the accepted assignment within
   five seconds.
2. **Given** goals and drinks were recorded before reassignment, **When** the
   assignment changes, **Then** those records and totals remain unchanged.
3. **Given** scoring occurs after reassignment, **When** participant attribution
   is displayed or finalized, **Then** it follows the assignment in force at
   the time of that scoring.
4. **Given** a non-host, invalid selection, stale room, or ended game, **When** a
   reassignment is attempted, **Then** nothing changes and the user receives a
   clear explanation.
5. **Given** host responsibility changes during play, **When** clients refresh,
   **Then** reassignment controls move from the former host to the new host.

---

### User Story 5 - Solo Play Remains Local and Reliable (Priority: P2)

A person playing without a multiplayer room continues using the existing local
game flow, including scoring, drinks, completion, and local history.

**Why this priority**: Multiplayer authority must not introduce network
requirements or regressions into the established solo experience.

**Independent Test**: Start and complete a solo game while offline and verify
all current local controls and history behavior still work without a room.

**Acceptance Scenarios**:

1. **Given** a game has no active multiplayer room, **When** the user records
   goals or drinks, **Then** the changes remain local and do not require a
   network connection.
2. **Given** a solo game, **When** the user ends it, **Then** it is saved to
   local history exactly once using the existing behavior.
3. **Given** a multiplayer game, **When** it completes, **Then** the client does
   not create a separate local-history game record; any device copy is only a
   cache of the canonical shared entry.

### Edge Cases

- A participant double-taps a control or retries after an uncertain response.
- Different clients change the same score or drink total at nearly the same
  time; every distinct accepted action must be retained in a deterministic
  order.
- A decrement races with another decrement at zero; totals must never become
  negative.
- The app backgrounds after showing an immediate local change but before the
  shared result arrives.
- Connectivity is lost after an action reaches the shared game but before the
  response returns; retry must resolve to the original outcome.
- A client resumes after the host transferred, the participant left, the room
  expired, or the game completed.
- A host ends the game while another valid gameplay action is in flight; the
  canonical ordering decides whether that action is included or rejected.
- A reassignment arrives while another client is recording gameplay; prior
  records remain attributed to the assignment active when they were accepted.
- Provider-controlled match scores are corrected or move backwards; clients
  must converge on the accepted canonical score without producing duplicate
  manual-goal records.
- A client from an older app version opens a room created after this feature;
  it must not be allowed to overwrite newer canonical gameplay with stale local
  values.
- A room has participants who left during play; their accepted events and final
  contribution remain in history even though they cannot submit new actions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST retain enough active-room and participant context
  for a multiplayer client to recover the same game after navigation,
  backgrounding, or restart.
- **FR-002**: The system MUST distinguish multiplayer games from solo games;
  shared-state rules MUST apply only when an active multiplayer room exists.
- **FR-003**: Every multiplayer goal, drink total, assignment, room state, and
  host role MUST have one canonical shared value outside any individual client.
- **FR-004**: Any active room participant, including a guest, MUST be able to
  adjust any manually scored match and any active participant's drink total
  while the game is in progress; ending the game and reassigning matches remain
  host-only actions.
- **FR-005**: A gameplay change MUST be authorized against the caller's current
  active participant identity and room membership at the time it is accepted.
- **FR-006**: Goal, drink, assignment, and completion changes MUST be rejected
  unless the room is in the state that permits that change.
- **FR-007**: Every gameplay change MUST carry a request identity so retrying the
  same intent produces the original result without applying it twice.
- **FR-008**: Reusing a request identity for different intent MUST be rejected
  without changing shared state.
- **FR-009**: Distinct valid changes submitted concurrently MUST be ordered
  deterministically and MUST NOT silently overwrite or discard one another.
- **FR-010**: Score and drink decrements MUST NOT produce negative values.
- **FR-011**: Every accepted gameplay change MUST append an immutable audit
  record identifying the room, acting participant, affected target, ordered
  position, request identity, and resulting change.
- **FR-012**: Canonical totals and completed summaries MUST be reconstructible
  from retained gameplay and lifecycle records, with documented recovery for
  any stored summary.
- **FR-013**: Every connected client MUST converge on accepted participants,
  assignments, scores, drink totals, room state, and host role within five
  seconds under normal connectivity.
- **FR-014**: A returning client MUST replace stale multiplayer gameplay values
  with the current canonical room values before accepting another change.
- **FR-015**: Goal and drink interactions MUST update optimistically and MUST
  reconcile to the accepted canonical result, restoring the prior value with a
  clear explanation when rejected. Reassignment and completion MUST remain
  pending and MUST NOT appear complete until canonically confirmed.
- **FR-016**: The system MUST NOT silently queue shared gameplay changes while
  fully disconnected; users MUST be told to reconnect and refresh.
- **FR-017**: Refreshing assignments or host role MUST NOT reset or rewrite
  accepted goals, drink totals, or other unrelated gameplay state.
- **FR-018**: Provider-controlled matches MUST remain unavailable for participant
  score editing. Accepted provider updates and corrections MUST become canonical
  shared scores, retain provider provenance, and MUST NOT be represented as
  participant-authored goal actions.
- **FR-018a**: Clients MUST NOT submit provider scores, provider/source IDs,
  leagues, observation times, or actor IDs. Provider observations MUST be
  fetched by the JWT-authenticated Supabase Edge Function and committed only
  through service-role-only RPCs after current room membership is revalidated.
- **FR-018b**: Provider trust MUST be documented as server-side HTTPS ingestion,
  not cryptographically signed proof that ESPN authored a response.
- **FR-019**: The current host MUST be able to end an active multiplayer game
  from the active-game experience.
- **FR-020**: Game completion MUST finalize the latest accepted shared state
  atomically and MUST reject gameplay changes ordered after completion.
- **FR-021**: Every connected client MUST leave the editable active state and
  receive the same final result after completion.
- **FR-022**: A completed multiplayer record MUST include final scores, drink
  totals, the assignment timeline, and all participants who contributed during
  the game, including those who left early.
- **FR-023**: A completed multiplayer game MUST have exactly one canonical
  shared history entry. A client MAY cache that entry for display, but MUST NOT
  create a separate local game record for the same session.
- **FR-024**: The current host MUST be able to access the reassignment control
  during play; non-hosts MUST not be presented with that control.
- **FR-025**: Reassignment MUST preserve all previously accepted scoring and
  drink records, and later attribution MUST use the assignment active when each
  later action is accepted.
- **FR-026**: Host handover MUST update end-game and reassignment permissions on
  every client without requiring a new game.
- **FR-027**: Guests who remain active room participants MUST be able to use the
  same shared goal and drink interactions and see the same final result as
  signed-in participants; persistent account history is not promised to guests.
- **FR-028**: A person outside the room or a participant who has left MUST NOT be
  able to read protected active-game state or submit gameplay changes.
- **FR-029**: Native and web clients MUST provide equivalent multiplayer
  gameplay, recovery, completion, and host-control outcomes.
- **FR-030**: Existing completed games MUST remain readable without fabricated
  events or rewritten totals. No historical backfill is required.
- **FR-031**: Gameplay audit records and the data needed to reconstruct a
  completed result MUST be retained for the lifetime of that completed result.
- **FR-032**: Automated coverage MUST include shared goal and drink behavior,
  authorization, retries, concurrent distinct changes, stale recovery,
  completion ordering, reassignment without state loss, guest participation,
  solo regression, and a two-client primary journey.

### Key Entities

- **Active Game Context**: Identifies whether play is solo or belongs to a
  multiplayer room, the local participant in that room, and the current host.
- **Gameplay Change**: One requested goal, drink, assignment, or lifecycle
  action with an actor, target, request identity, ordering, and outcome.
- **Canonical Game Snapshot**: The latest roster, host, assignments, scores,
  drinks, and room state used for convergence and recovery.
- **Participant**: A signed-in member or guest with current room membership,
  role, drink total, and retained historical contribution.
- **Match Score**: The canonical home and away totals for a match, including
  whether they are manually controlled or provider-controlled and the provenance
  of the latest accepted value.
- **Assignment Timeline**: The settled assignment map plus ordered changes that
  determine which participant held each match at any point.
- **Completed Game**: The immutable final outcome and reconstructible history of
  one multiplayer session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a two-client test under normal connectivity, 100% of accepted
  goal, drink, and assignment changes appear identically on both clients within
  five seconds.
- **SC-002**: Across retry and uncertain-response tests, the same gameplay
  request changes the final result exactly once in 100% of cases.
- **SC-003**: Across concurrent-action tests, 100% of distinct accepted actions
  are present in the final result and none are silently lost.
- **SC-004**: A stale, restarted, or reconnected client matches the current room
  state within ten seconds and before it can submit another gameplay change.
- **SC-005**: After the host confirms completion, all connected clients show a
  non-editable final state within five seconds and all later gameplay changes
  are rejected.
- **SC-006**: The completed result equals the ordered accepted gameplay record
  in every automated reconstruction test.
- **SC-007**: Unauthorized users, departed participants, non-host completion
  attempts, and non-host reassignment attempts are rejected in 100% of
  automated authorization cases.
- **SC-008**: The primary two-client journey—shared scoring, shared drinks,
  reassignment, reconnect, and completion—passes on web and is smoke-tested on
  at least one physical native device before release.
- **SC-009**: Existing solo scoring, drinks, completion, and local history tests
  continue to pass with no network connection.

## Assumptions

- Issue #135's settled room, roster, match pool, Common Match, and starting
  assignments are available before this feature begins.
- Issue #186's server-side reassignment contract and immutable completion
  assignment history are available on this branch.
- #190 is the integration owner and acceptance boundary for the product
  behavior overlapping #138, #139, #140, #141, and the client half of #186;
  each related issue remains an independently deliverable implementation slice.
- Every active participant, including a guest, may adjust any manually scored
  match and any active participant's drink total. Host authority is additionally
  required only for reassignment and game completion.
- Distinct concurrent goal and drink actions accumulate; retries of one action
  do not. The canonical ordering resolves a gameplay action racing completion.
- Goal and drink interactions are optimistic. Reassignment and completion wait
  for canonical confirmation because they affect permissions, navigation, and
  the completed-history boundary.
- Provider-controlled scores remain read-only to participants and accepted
  provider updates become canonical for every client. How trusted observations
  reach the shared game is a planning decision, provided FR-018 holds.
- Existing completed games are preserved as-is. Active rooms present during
  rollout recover from the shared values available at that time; unsynchronized
  device-only edits cannot be backfilled automatically.
- Normal connectivity means the client can exchange shared state without an
  extended offline period; the five-second convergence target includes the
  normal refresh interval.

## Impact and Dependencies

- **Platform impact**: The active multiplayer journey changes on native and web
  and requires equivalent controls, recovery, errors, and completion behavior.
- **Authentication and guest impact**: Signed-in hosts retain exclusive room
  administration. Active signed-in members and guests may record ordinary
  gameplay; all writes remain bound to current room membership.
- **Shared-state impact**: Multiplayer gameplay becomes canonical and auditable
  outside individual clients, including its completed history entry. Device
  copies of multiplayer history are caches only. Solo gameplay remains local.
- **Migration and backfill impact**: New canonical gameplay records may be
  required for future games. Existing completed history is not rewritten, and
  no synthetic events are created for prior local-only play.
- **Related delivery**: #186 supplies reassignment safety; #190 supplies its
  active-game client and convergence. #192 adds release gates after the product
  journey exists.
- **Required test strategy**: Unit tests cover reconciliation, optimistic
  rollback, recovery, permissions, and solo branching. Shared-state tests cover
  authorization, validation, idempotency, ordering, completion, retention, and
  reconstruction. A two-client end-to-end journey covers goals, drinks,
  reassignment, reconnect, and completion, with native physical-device smoke
  coverage before release.
