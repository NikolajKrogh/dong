# Feature Specification: Host Creates Room

**Feature Branch**: `152-espn-match-proxy` *(current branch; will be updated when a dedicated branch is created)*

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "Issue #137 [US5.1] Allow an authenticated host to create a room and receive a shareable code"

**GitHub Issue**: [#137](https://github.com/NikolajKrogh/dong/issues/137) | Parent Epic: [#116](https://github.com/NikolajKrogh/dong/issues/116)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Host Creates a Room and Receives a Join Code (Priority: P1)

As a signed-in host, I can create a multiplayer room and immediately receive a unique join code so that I can share it with other players and invite them to the session.

**Why this priority**: This is the entry point to the entire multiplayer room lifecycle. Nothing else in the epic is possible without a room existing. It is the minimum deliverable for any multiplayer interaction.

**Independent Test**: Sign in as a host, trigger room creation, and verify that a room is created, a unique code is shown to the host, and the host appears as the owner participant in the new room.

**Acceptance Scenarios**:

1. **Given** a signed-in host is ready to start a multiplayer session, **When** they choose to create a room, **Then** a unique join code is generated for that room.
2. **Given** a signed-in host creates a room, **When** the room is created, **Then** the room is in a joinable lobby state where other players can join.
3. **Given** a signed-in host creates a room, **When** the room is created, **Then** the host is recorded as the room's owner participant, with their registered display name.
4. **Given** a signed-in host creates a room, **When** the creation completes, **Then** the join code is displayed to the host so it can be shared with other players.

---

### User Story 2 - Host Is Navigated to the Lobby After Room Creation (Priority: P1)

As a signed-in host, after creating a room I am immediately taken to the lobby screen where I can see the join code and wait for other players to join.

**Why this priority**: Without landing in the lobby after creation, the host has nowhere to see the code and no way to know the room is ready. This is the first part of the lobby experience.

**Independent Test**: Create a room and confirm the app navigates to the lobby screen without any additional user steps, and the join code is visible there.

**Acceptance Scenarios**:

1. **Given** a room has been successfully created, **When** the creation completes, **Then** the host is taken to the lobby screen for the new room without any additional manual steps.
2. **Given** the host has been navigated to the lobby, **When** viewing the lobby, **Then** the join code is displayed prominently.
3. **Given** the host has been navigated to the lobby, **When** viewing the participant list, **Then** the host appears as the first (and only) participant in the room.

---

### Edge Cases

- What happens when an unauthenticated or guest user attempts to create a room?
- What happens if the network is unavailable when the host tries to create a room?
- What happens if room code generation produces a collision with an existing active code?
- What if the host already has one or more active rooms — is a second room allowed?
- What if the room creation request is submitted twice (e.g., button tapped twice or retry after timeout)?

## Platform & State Impact *(mandatory)*

- **Platform Behavior**: Room creation and the post-creation lobby view must be available on both native and web. The join code must be visible and easily readable on both platforms so the host can share it by voice or message.
- **Shared State Model**: The room is the canonical shared-state object. All participants who subsequently join will reference the same room identified by the join code. The host-participant entry created at room creation is the authoritative record of host identity within that room.
- **Auth / Guest Impact**: Room creation requires full authentication. An unauthenticated or guest user must not be able to create a room. The system must reject or prevent unauthenticated creation attempts gracefully.
- **Migration / Backfill**: No migration or backfill is required. The existing database schema already supports rooms (sessions), join codes, ownership, and participant roles.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Only authenticated users can create a room; unauthenticated users MUST NOT be permitted to trigger room creation.
- **FR-002**: Room creation MUST generate a unique, human-readable join code that is guaranteed to be distinct from all currently active room codes.
- **FR-003**: The created room MUST start in a joinable lobby state, allowing other players to join before the game begins.
- **FR-004**: The creating user MUST be automatically added as the room's owner participant at the time of creation, with their registered display name.
- **FR-005**: The join code MUST be displayed to the host immediately after room creation is confirmed.
- **FR-006**: The host MUST be automatically navigated to the lobby screen for the newly created room upon successful completion.
- **FR-007**: Room creation MUST be idempotent against duplicate submission: submitting the same request twice MUST NOT create two rooms.
- **FR-008**: If room creation fails, the host MUST receive a clear error message and be able to retry.

### Key Entities *(include if feature involves data)*

- **Room**: A shared session with a unique join code, an owner (the creating host), a state (lobby → active → completed), and a list of participants. Rooms begin in lobby/joinable state at creation.
- **Participant**: A player within a room. The creating host is automatically added as the first participant with owner/host role at room creation.
- **Join Code**: A unique, short, human-readable code tied to a single active room. Used by other players to find and join the room. Must be unique across all currently active rooms.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in host can create a room and see the join code in under 5 seconds under normal network conditions.
- **SC-002**: Join codes are guaranteed to be unique across all currently active rooms.
- **SC-003**: 100% of successful room creation requests result in the host being recorded as a participant with owner role.
- **SC-004**: The host reaches the lobby screen after room creation without any additional manual navigation steps.
- **SC-005**: The join code is legible and shareable from the lobby screen on both native and web platforms.

## Assumptions

- The host has an active, registered account and is signed in at the time of room creation.
- Join codes are short and human-readable (e.g., 4–6 alphanumeric characters) to allow easy sharing by voice, message, or screenshot.
- A host is permitted to create a new room even if they already have prior active rooms; old rooms are not automatically closed.
- Standard mobile/web app performance expectations apply: room creation should feel immediate under normal network conditions.
- The host's display name is sourced from their registered profile and does not need to be re-entered at room creation time.
- Room creation is a single, synchronous-feeling action from the host's perspective — no multi-step wizard is needed for this story.
