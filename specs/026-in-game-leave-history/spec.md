# Feature Specification: In-Game Leave and Preserved History

**Feature Branch**: `codex/165-in-game-leave-history`
**Created**: 2026-09-28
**Status**: Implemented locally; manual multiplayer acceptance pending
**Input**: [Issue #165](https://github.com/NikolajKrogh/dong/issues/165), its live requirements, and the goal objective.

## Clarifications

### Session 2026-09-28

- Q: Should the live issue's immediate leaver result be implemented alongside final history? → A: Yes; the user delegated the sensible scope choice, and both are required for a complete result.
- Q: Can Android be used for exploration while E2E testing remains prohibited? → A: Yes; connected Android/ADB/ARTEMIS may be used, and no E2E tests are to be authored or run.

## User Scenarios & Testing

### User Story 1 - Leave a running game (Priority: P1)

A registered participant or guest can confirm departure from a running game. Their participation, current drinks, and the state of their result remain available while others continue.

**Why this priority**: Departure must not erase a played contribution or let a departed identity change the game.

**Independent Test**: Leave after a drink change, retry the leave, and inspect the room and write authorization.

**Acceptance Scenarios**:

1. **Given** a running game and an active participant with drinks, **When** they confirm Leave Game, **Then** the canonical participant remains with the same drink total and a departure time.
2. **Given** a confirmed departure, **When** the same request is retried, **Then** exactly one departure event exists and the result is unchanged.
3. **Given** a departed participant, **When** they attempt a gameplay write, **Then** it is rejected while active participants can continue.
4. **Given** a joinable lobby, **When** a participant leaves there, **Then** the established lobby departure behavior remains unchanged and no played result is created.

---

### User Story 2 - See the result after leaving (Priority: P1)

The departing participant can see the result captured at departure. A registered participant can retrieve it from cloud history on another signed-in device; a guest keeps a device-local result.

**Why this priority**: The live issue explicitly requires the leaver's result to be saved when they leave, even before the host finishes.

**Independent Test**: Leave during play, open history before completion, and compare the result with the departure event.

**Acceptance Scenarios**:

1. **Given** a registered participant leaves during play, **When** they open cloud history before completion, **Then** their captured result appears once.
2. **Given** a guest leaves during play, **When** they open history on that device, **Then** their captured result appears once without retaining room access.
3. **Given** scores or another participant's drinks change later, **When** the leaver revisits their departure result, **Then** the captured values have not changed.

---

### User Story 3 - Complete with early leavers (Priority: P1)

The host can finish the game with all participants who played, including early leavers and their frozen state. The in-game menu offers a dedicated leave action on web and native.

**Why this priority**: The shared result must remain complete and the departure action must be reachable from active play.

**Independent Test**: Depart, continue play, finish, and inspect completed history on a registered participant's device.

**Acceptance Scenarios**:

1. **Given** a participant left early, **When** the host ends the game, **Then** completed history includes that participant, their departure time, and their preserved drink total.
2. **Given** a running multiplayer game on web or native, **When** an active participant opens Game actions, **Then** Leave Game is distinct from Home, Setup, and End Game and asks for confirmation.
3. **Given** a cancelled or failed leave, **When** the participant returns to play, **Then** their access and state remain intact and the failure is visible.

### Edge Cases

- A network timeout after server confirmation must not generate another event or duplicate history.
- A guest grant may expire while a leave is pending; preserve canonical participation and never create a false confirmed result.
- A host can hand over an active game to an eligible registered participant. Without one, the established host close behavior applies; the UI must warn that the game will close.
- Departed participants remain in game hydration and final history but leave the active roster.
- A final completed history row replaces the same session's provisional departure result for a registered participant.

## Requirements

### Functional Requirements

- **FR-001**: An in-progress leave MUST retain the canonical participant and freeze their current drink total and assignment state.
- **FR-002**: Each confirmed departure MUST have exactly one immutable `participant_left` event with a server-captured result; retries MUST be safe.
- **FR-003**: Departed identities MUST lose room read and gameplay write access according to current member and guest authorization contracts, while active participants continue.
- **FR-004**: Registered early leavers MUST be able to retrieve their captured result in cloud history before host completion; guests MUST receive a device-local captured result after confirmed departure.
- **FR-005**: Completed history MUST include all participants who played, including early leavers and their frozen state. The provisional registered result MUST not duplicate the completed result.
- **FR-006**: The in-game Leave Game action MUST exist on web and native, with confirmation, error handling, and host handover/close handling. Home and Setup MUST remain navigation actions.
- **FR-007**: Joinable lobby leave behavior MUST remain unchanged.
- **FR-008**: No production or hosted database is changed by this work.

### Key Entities

- **Participant**: A room member with identity, membership type, drink total, and optional departure time.
- **Departure event**: One immutable record naming the departed participant, time, and captured result.
- **Captured result**: Participant, match, and assignment state at departure, visible only under the leaver's applicable history contract.
- **Completed session**: The host-finalized canonical session containing every played participant.

## Success Criteria

### Measurable Outcomes

- **SC-001**: One confirmed leave produces one departure event across repeated requests.
- **SC-002**: A leaver's drink total and captured result remain identical after subsequent game activity.
- **SC-003**: One early leaver appears exactly once in final completed history.
- **SC-004**: On web and native, an active participant can reach and confirm Leave Game from Game actions.

## Assumptions

- #136 and #138 are closed; #191 guest grant lifecycle is already on the base branch.
- Host handover and close rules remain as implemented; this feature preserves the departing host's result where a game was in progress.
- Focused unit and database tests are required. The user prohibited authoring or running E2E tests; this leaves the constitution's journey coverage gate intentionally unmet and is recorded in the plan.
