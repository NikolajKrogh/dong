# Feature Specification: Configure Room and Start Game

**Feature Branch**: `153-configure-start-game`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Can you help me figure out how I should implement issue #134?"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Host selects remote matches in the lobby (Priority: P1)

As a host in the room lobby, I want to fetch and browse a live catalog of scheduled sports fixtures and select matches to include in our multiplayer game, so that we play with real upcoming sports fixtures.

**Why this priority**: You cannot start or configure a game without selecting matches first. This is a foundational action that turns local-only match structures into a synchronized, remote match pool for all participants.

**Independent Test**: Open the match selection dialog as a host, see a real list of upcoming matches, select some, and confirm they appear under the "Selected Matches" section for all connected users in the lobby.

**Acceptance Scenarios**:

1. **Given** the host is viewing the lobby setup screen, **When** they request to select matches, **Then** they are presented with a list of live or scheduled matches retrieved from the service, grouped by league or date.
2. **Given** the host is browsing the match list, **When** they select one or more matches, **Then** those matches are saved in the room configuration and immediately appear on the screens of all connected participants.
3. **Given** a match has been selected, **When** the host unselects or removes the match, **Then** the match is removed from the room configuration and disappears from all participants' screens.

---

### User Story 2 - Host selects a Common Match (Priority: P1)

As a host, I want to designate exactly one of the selected matches in our room as the "Common Match" that all participants will watch and participate in, so that we have a shared central event for our drinking rules.

**Why this priority**: The "Common Match" is a core gameplay rule of DONG where all players drink at the same events. The game cannot start without a chosen Common Match.

**Independent Test**: Ensure that after selecting multiple matches, the host can mark exactly one as the Common Match and everyone in the room sees that selection indicated in their UI.

**Acceptance Scenarios**:

1. **Given** the host has selected several matches for the room, **When** they nominate a match as the Common Match, **Then** that match is designated as the Common Match in the room configuration and is prominently highlighted on all participants' screens.
2. **Given** a Common Match is already designated, **When** the host selects a different match as the Common Match, **Then** the previous selection is replaced, and exactly one match remains the Common Match.
3. **Given** a designated Common Match exists in the room, **When** the host removes that match from the room's selected matches pool entirely, **Then** the Common Match designation is cleared and must be chosen again before the game can start.

---

### User Story 3 - Host assigns additional matches and starts the game with validation (Priority: P1)

As a host, I want to assign additional selected matches to each participant (either manually or via an automated random assigner) and then start the game, knowing the system will validate that the room configuration is complete and correct before moving to active play.

**Why this priority**: This triggers the actual gameplay phase. Without a start request that validates all room requirements, a host could transition the room with incomplete settings, leaving players stranded or with corrupted game rules.

**Independent Test**: Add two players, select two matches, choose a common match, randomize assignments, and click "Start Game." Verify the room shifts into active gameplay for all connected clients. If any player is missing assignments, verify that the system rejects the start and highlights the error.

**Acceptance Scenarios**:

1. **Given** a room lobby has valid participants, selected matches, a chosen Common Match, and all participants have at least one additional match assigned, **When** the host initiates starting the game, **Then** the system validates and transitions the room state to in-progress.
2. **Given** the room has no selected matches or no designated Common Match, **When** the host attempts to start the game, **Then** the start request is rejected, the room remains in the lobby cabin, and the host receives a precise error explaining that matches must be selected and a Common Match chosen.
3. **Given** some participants in the lobby have not been assigned any matches (other than the Common Match), **When** the host attempts to start the game, **Then** the start request is rejected, and the host is informed that all active participants must have match assignments first.
4. **Given** the room status is not in the joinable lobby state (e.g. it is already in-progress, completed, or closed), **When** a start request is sent, **Then** the request is rejected as invalid.

---

### User Story 4 - Connected devices receive the starting game state automatically (Priority: P1)

As a player in a lobby (host, registered participant, or guest), I want my app to automatically transition to the gameplay dashboard once the host starts the game, so that we can begin scoring and drinking together without refreshing.

**Why this priority**: Core multiplayer delivery. If guests or members don't transition automatically, they get left behind in a dead lobby screen, ruining the synchronized multiplayer experience.

**Independent Test**: Have a host start a fully configured room, and confirm that both a registered member on another device and a guest on a third device automatically navigate to the active gameplay dashboard within a few seconds.

**Acceptance Scenarios**:

1. **Given** a participant is sitting in the lobby screen of a room, **When** the host successfully starts the game, **Then** the participant's device detects the room state transition and automatically navigates them to the active gameplay screen without requiring manual action.
2. **Given** the game has started, **When** participants arrive at the gameplay interface, **Then** each participant sees their correct, assigned matches and the common match initialized to start scoring.

---

### Edge Cases

- **Participant leaves during the start action**: If a player leaves the lobby (or loses connection and is removed) at the exact split-second the host starts the game, the server must run validation on the updated participant set. If that departure leaves a player with no matches, or drops the room below the minimum participant count, the start must be rejected and the host notified.
- **Assigned match deleted by host**: If the host deletes a selected match, any assignments corresponding to that match are purged. If this purge leaves any user without their required assignments, the game cannot be started until assignments are resolved.
- **Concurrent start commands (Idempotency)**: If high network latency causes the host to click "Start Game" twice, the system must process the command exactly once. The second request must return a safe success response or recognize the room is already in-progress, without corrupting state or duplication.
- **Starting a stale/closed room**: If the room has expired or been closed by a host's departure, a start request sent from a cached lobby screen must fail gracefully, notifying the user that the room has ended.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST fetch upcoming and live matches from a remote match catalog to drive match selection in the multiplayer lobby.
- **FR-002**: The host MUST be able to add or remove matches from the room's selected matches pool.
- **FR-003**: The host MUST be able to designate exactly one selected match as the Common Match for the room.
- **FR-004**: The host MUST be able to assign selected matches to participants.
- **FR-005**: The system MUST validate that the room has at least one selected match before enabling the Common Match designation.
- **FR-006**: The system MUST validate room requirements at the moment "Start Game" is clicked, and reject starting if validation rules fail.
- **FR-007**: Start validation MUST fail if the room has no selected matches or no designated Common Match.
- **FR-007a**: Start validation MUST fail if the room has zero active participants.
- **FR-008**: Start validation MUST fail if any participant in the room roster has zero assigned matches (excluding the Common Match).
- **FR-009**: Start validation MUST fail if the room's current state is not "joinable" (e.g. it is already in_progress, completed, or closed).
- **FR-010**: Upon successful validation, the system MUST transition the room state from "joinable" to "in_progress".
- **FR-011**: The system MUST record a canonical start event marking the moment the room transitioned to active play. The starting roster, assigned matches, and initial (0-0) scoring state do not need to be duplicated into the event's payload — they remain independently queryable from `public.participants`, `public.assignments`, and `public.matches` as of that transition, and are what the client hydrates on transition (FR-012).
- **FR-012**: Connected clients polling the room snapshot MUST automatically detect the "in_progress" state change and transition their UI to the active gameplay dashboard.
- **FR-013**: The system MUST process a "Start Game" request exactly once per idempotency key, even if the client submits it more than once (e.g. double-click, retry after a timeout). A repeated submission MUST return an equivalent success response instead of an error or a second state transition/duplicate start event.
- **FR-014**: The system MUST NOT create duplicate match entries in a room's selected matches pool when the same remote fixture is added more than once; a repeat add of an already-selected fixture MUST be treated as a no-op success.

### Key Entities

- **Room / Session**: The container for the game, holding state ("joinable" or "in_progress"), the selected matches pool, and active participants.
- **Remote Match Catalog**: The curated feed of real-world sports fixtures available to choose from.
- **Match Selection**: An instances of a fixture chosen from the remote catalog and linked to the active room.
- **Common Match**: The single, shared match highlighted in the room which applies to all players.
- **Match Assignment**: A mapping linking an active participant to a selected match in the room.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A host can open the live match catalog in under 2 seconds under normal network conditions.
- **SC-002**: A start request for a correctly configured room is processed and validated in under 300 milliseconds.
- **SC-003**: Incomplete or invalid starting requests are rejected with a descriptive error message in under 150 milliseconds.
- **SC-004**: 100% of connected participants (including guests) transition to the gameplay dashboard within 5 seconds of the host starting the game.
- **SC-005**: Double-submitting a start command does not cause error pages or create duplicate starting events of any kind.

## Out of Scope

- **`in_progress` idle/abandonment policy**: This feature makes the `in_progress` room state reachable for the first time, but does not define what happens to a room that is started and then abandoned (host disconnects mid-game, no further activity). The existing 24-hour stale-room sweep (`private.expire_stale_rooms`, migration `034_room_expiry.sql`) only closes rooms in the `joinable` state, so an abandoned `in_progress` room will persist indefinitely until this gap is addressed. Resolving it is explicitly deferred to #138/#165, which are better positioned to define activity heuristics appropriate to active gameplay (e.g. based on scoring events) rather than lobby presence.

## Assumptions

- Participants are already present in the lobby (this feature does not include the join/leave flow itself).
- The host is responsible for managing match selection and initiating the start event.
- The default minimum number of participants required to start a game is 1 (allowing solo multiplayer testing/debugging), but standard gameplay occurs with multiple players.
- Regular 4-second polling of the room snapshot remains the synchronization method across clients (no WebSocket connection required for this phase).
- Match scores start at 0-0 upon game initialization.
- Scoring rules (e.g., cups per goal, drink intervals) are inherited from project defaults.
