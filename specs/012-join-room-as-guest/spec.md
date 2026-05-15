# Feature Specification: Join Room as Guest

**Feature Branch**: `131-us32-allow-a-guest-to-join-a-room-from-their-own-device-without-creating-an-account`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: User description: "Issue #131: Allow a guest to join a room from their own device without creating an account"

## Clarifications

### Session 2026-05-15

- Q: Should guest names be unique within a room? -> A: Allow duplicate guest names; only blank or whitespace-only names are rejected.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Join Room as a Guest (Priority: P1)

As a guest player, I can enter a room code and guest name on my own device and join the room without creating an account, so I can participate immediately.

**Why this priority**: The feature has no value until a real guest can successfully enter an active room and appear in the shared session.

**Independent Test**: Use a second device or browser session, enter a valid room code and valid guest name for an open room, and confirm the guest reaches the lobby and sees the current session state.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** an active room that is accepting joins, **When** a player enters a valid room code and a valid guest name on their own device, **Then** the player is added to the room as a guest participant.
2. **Given** a guest joins successfully, **When** the room moves from lobby into gameplay, **Then** the guest sees the same session state as the other participants.
3. **Given** a guest joins a room, **When** the join completes, **Then** no durable user account is created for that player.
4. **Given** another participant in the room already has the same guest name, **When** a player enters that same guest name on their own device, **Then** the player is still added to the room as a guest participant.

---

### User Story 2 - Reject Invalid Join Data (Priority: P1)

As a guest player, I get a clear rejection when the room code is wrong, the room is not joinable, or my chosen name is blank or whitespace-only, so I can correct the problem and try again.

**Why this priority**: Invalid joins must fail cleanly to avoid broken room membership and confusing partial participation.

**Independent Test**: Attempt to join with a bad room code, a closed room, or a blank guest name, and verify the join is rejected with a specific explanation.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a player enters an invalid room code, **When** they submit the guest join form, **Then** the app rejects the join and explains that the room could not be found.
2. **Given** a room is no longer accepting joins, **When** a player tries to join with a valid code, **Then** the app rejects the join and explains that the room is not joinable.
3. **Given** a player enters a blank or whitespace-only guest name, **When** they submit the form, **Then** the app rejects the join and explains that a guest name is required.

---

### User Story 3 - Show Guest Limitations Clearly (Priority: P2)

As a guest player, I can see that I am joining as a temporary room-scoped participant, so I understand what this access does and does not create.

**Why this priority**: Clear expectations reduce confusion and support the temporary guest model without blocking the core join flow.

**Independent Test**: Open the guest join modal and the lobby after joining, and verify the guest-only limitations are visible before and after entry.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a player opens the guest join flow from the home screen, **When** the modal loads, **Then** it explains that the player is joining as a temporary guest and not creating an account.
2. **Given** a guest has joined the room, **When** the lobby appears, **Then** the room clearly labels the participant as a guest rather than a permanent account holder.
3. **Given** a guest is viewing the joined room, **When** participant information is shown, **Then** the guest is clearly distinguished from signed-in account holders.

---

### Edge Cases

- A room code is valid, but the room has ended or is no longer accepting joins.
- A guest submits the join form while the network is unavailable or unstable.
- A player enters the correct code, but the room becomes full or closes before the join completes.
- A guest joins from a second device using the same room code and expects the first device state to persist.
- The guest join modal is opened on web or native while the room data is still loading.
- A player taps Join twice or retries after a lost network response, and the room must still end up with one guest participant for that device-scoped token.
- A guest reloads with a stored guest token that the server no longer recognizes, and the app must clear the local grant and return the player to the home-owned guest join flow.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: The guest join flow must work consistently on native and web, including on a second device used only for joining a room. The same room-code and name flow should lead to the lobby and gameplay state on every supported platform.
- **Shared State Model**: The room session remains the canonical shared state. Guest membership is session-scoped and belongs to the room only; joining as a guest must not create a durable account or alter unrelated local app data.
- **Identity Model**: A guest is a temporary room participant with a room-scoped display name that may duplicate another participant's name and no linked account. Registered users and hosts keep their durable identities, but guest identity ends with the room session.
- **Migration / Backfill**: No migration or backfill is required. Existing rooms should continue to work, and this feature only adds guest join behavior on top of the current shared-room model.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Cover guest join form validation, room-code and joinability checks, blank-name rejection, duplicate-name acceptance, guest participant creation, persisted grant restore, expired-grant clearing, leave-and-clear behavior, and guest limitation messaging.
- **E2E Test Coverage**: Yes. Add a primary cross-device journey where one device hosts an open room and a second device joins as a guest, sees the lobby, then observes the host transition the room into gameplay and receives the same room-state update. Cover the web journey with Playwright BDD and keep a native smoke path in quickstart until native automation exists.
- **Applicable Skills**: supabase, supabase-postgres-best-practices, database-testing, react-native-testing, playwright-bdd

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The app MUST allow a player to join an existing room as a temporary guest using a room code and guest name without creating an account.
- **FR-002**: The app MUST validate that the room exists and is joinable before adding the guest to the room.
- **FR-003**: The app MUST reject a guest join when the room code is invalid or the room is not joinable.
- **FR-004**: The app MUST reject a guest name that is blank or whitespace-only.
- **FR-005**: The app MUST allow multiple guest participants in the same room to share the same guest name.
- **FR-006**: The app MUST create a room-scoped guest participant record when the join succeeds.
- **FR-007**: The app MUST keep guest participants visible in the lobby and gameplay state for the session they joined.
- **FR-008**: The app MUST clearly explain in the join flow and lobby that guests are temporary, room-scoped participants and do not create permanent accounts.
- **FR-009**: The app MUST preserve the room's existing host and registered participant identities when a guest joins.
- **FR-010**: The app MUST persist a successful guest room grant locally, restore the joined room when the grant remains valid, and clear the grant when the server reports the grant expired or invalid.
- **FR-011**: The app MUST treat repeated join submissions that reuse the same device-scoped guest token as the same join attempt and MUST return the existing guest participant instead of creating a duplicate guest row.

### Key Entities _(include if feature involves data)_

- **Room**: An active multiplayer session identified by a room code and a joinable lifecycle state.
- **Guest Participant**: A temporary room-scoped participant with a display name that may duplicate another participant's name and no linked durable account.
- **Guest Join Attempt**: A player's submitted room code, guest name, and device-scoped guest token used to enter a room.
- **Guest Room Session Grant**: The local room-scoped credential that restores or refreshes guest access on the same device.
- **Join Result**: The accepted or rejected outcome of a guest join attempt, including any reason the app shows to the player.
- **Lobby State**: The shared room state visible before gameplay begins, including guest membership.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In validation, 100% of successful guest join attempts render a usable lobby from a single successful join response, without requiring a second snapshot read before the first lobby render.
- **SC-002**: In validation, 100% of guest join attempts with an invalid room code, a closed room, or a blank or whitespace-only guest name are rejected before the player enters the room.
- **SC-003**: In validation, 100% of successful guest joins create a session-scoped participant without creating a durable account.
- **SC-004**: In validation, 100% of guest join modals and lobbies show that the participant is temporary and room-scoped.
- **SC-005**: In validation, 100% of successful guest joins can see the same gameplay state as the rest of the room after the room transitions from lobby to play.
- **SC-006**: In validation, a player can successfully join a room using the same guest name as another participant, and both guest participants remain separate room members.
- **SC-007**: In validation, replaying the same device-scoped guest token for the same room returns the same participant and does not create a duplicate guest participant row.

## Assumptions

- Room join codes and room joinability already exist as part of the shared multiplayer room model.
- A guest name is valid when it is trimmed and non-empty; duplicate guest names are allowed within the same room.
- Duplicate account creation is not allowed or needed for guest participants.
- Guest participants are session-scoped and disappear when the room session ends.
- Native and web should present the same guest join rules and messages.
- The client generates a room-scoped guest token before the first join submission and reuses it across retries until the join attempt resolves.
