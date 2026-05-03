# Feature Specification: Cloud Gameplay Core Data Model

**Feature Branch**: `128-us21-create-the-core-supabase-schema-for-accounts-sessions-participants-matches-assignments-and-events`  
**Created**: 2026-05-03  
**Status**: Draft  
**Input**: User description: "I want to plan for how to implement issue #128 on GitHub. [US2.1] Create the core Supabase schema for accounts, sessions, participants, matches, assignments, and events"

## Clarifications

### Session 2026-05-03

- Q: What is the participant uniqueness rule within a session? → A: Allow at most one participant membership per authenticated account per session; guests rejoin by reclaiming their existing session-scoped participant record.
- Q: How should retries avoid duplicate history-affecting writes? → A: Every history-affecting shared-state command carries a client-generated idempotency key, and the system applies that command at most once per session.
- Q: What happens after a session is completed? → A: Once a session is completed, no further history-affecting writes are allowed in v1.
- Q: How do guests reclaim the same participant record on reconnect? → A: Each guest participant gets a server-issued rejoin token scoped to the session, and the same token reclaims that participant record on reconnect.
- Q: Can a session stop accepting joins before completion? → A: A session stays joinable until it is completed; in v1, completed is the only no-longer-joinable state.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Host Starts A Shared Session (Priority: P1)

As an authenticated host, I can create a cloud-backed game session with a join code, so the game has one canonical shared record that other devices can join.

**Why this priority**: Without a host-owned shared session, multiplayer setup, participant joins, and cloud-backed history cannot exist.

**Independent Test**: Create a host-owned session, then load it again and confirm the host identity, join code, lifecycle state, and common-match metadata are preserved.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** an authenticated host without an active room, **When** the host creates a new shared game session, **Then** the system creates one host-linked session with a unique join code and an initial joinable state.
2. **Given** an existing shared session that has not been completed, **When** the host reopens that session later or from another device, **Then** the same room identity, host ownership, and saved setup metadata are returned and the session remains joinable in v1.

---

### User Story 2 - Session Setup Persists Across Devices (Priority: P1)

As a host, I can persist the participants, match list, and assignment setup for a session, so every joined device sees the same configuration.

**Why this priority**: Shared gameplay cannot begin reliably until the room membership and match responsibilities are stored together and can be reloaded consistently.

**Independent Test**: Save a session containing registered participants, guest participants, matches, a common match, and per-participant assignments, then reload the session and verify the relationships are intact.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** an active session, **When** the host saves participants, matches, and a common match, **Then** the system stores each item under the same session and preserves their relationships.
2. **Given** a mix of registered users and guests in one session, **When** the session setup is loaded, **Then** each participant appears with the correct display identity, membership type, and assignment membership.
3. **Given** a registered user rejoins the same session or a guest reconnects after a disconnect, **When** the system resolves that membership using the durable account identity or the session-scoped guest rejoin token, **Then** it reuses the existing participant record instead of creating a duplicate session membership.
4. **Given** a participant or match does not belong to the current session, **When** an assignment is submitted for that combination, **Then** the system rejects the invalid assignment without changing the valid session setup.

---

### User Story 3 - Gameplay History Remains Auditable (Priority: P2)

As a user who wants trustworthy history and comparisons later, I need gameplay and session changes to be preserved as auditable records, so completed sessions can be reconstructed accurately.

**Why this priority**: Immutable history depends on the session, participant, and assignment foundations above, but it is still required in the same core data-model slice because later read models rely on it.

**Independent Test**: Record representative session lifecycle changes, score changes, and drink updates, then confirm the original sequence remains intact and the final session outcome can be reconstructed from persisted records.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a live session with tracked participants and matches, **When** a gameplay change that affects shared state or history occurs, **Then** the system appends a new event linked to the relevant session and actor instead of overwriting prior history.
2. **Given** the same history-affecting command is retried after an interrupted network request, **When** the retried write carries the same client-generated idempotency key for that session, **Then** the system applies the command at most once and avoids ambiguous duplicate history.
3. **Given** a history-affecting command is submitted without a valid idempotency key, **When** the system evaluates the write, **Then** it rejects the command instead of recording a non-deduplicable shared-state mutation.
4. **Given** a session has been marked completed, **When** a later history-affecting command is submitted for that session, **Then** the system rejects the write and leaves the completed history unchanged.
5. **Given** a completed session, **When** later history or leaderboard work reads the persisted records, **Then** the session outcome can be derived from the stored events and related session data without relying on a client-only snapshot.

---

### Edge Cases

- A generated join code collides with another active session.
- A guest participant disconnects and rejoins the same active session from their own device and must reclaim the existing session-scoped participant record with the previously issued rejoin token.
- A registered participant joins after the host created the room but before gameplay starts.
- An assignment references a participant or match from a different session.
- The same gameplay command is retried after a timeout or reconnect with the same idempotency key.
- A history-affecting shared-state command arrives without an idempotency key or reuses a key for a conflicting payload.
- A session is completed or closed while a late gameplay update is still in flight.
- A client submits a new history-affecting command after the session has already been completed.
- A client attempts to join a completed session that is no longer joinable.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: No new user-facing UI ships in this story. Native and web clients are both expected to rely on the same cloud data model once later integration stories connect them, while current local-only play continues unchanged for now.
- **Shared State Model**: The cloud data model becomes the canonical source of truth for authenticated accounts, hosted sessions, participants, matches, assignments, and immutable gameplay history. The existing locally persisted session snapshot remains a temporary local representation until multiplayer integration is delivered.
- **Identity Model**: Only authenticated hosts can create and own sessions. Registered participants may link to durable accounts. Guests join from their own device with a join code, remain session-scoped identities in v1, and reclaim the same participant record through a server-issued session-scoped rejoin token.
- **Migration / Backfill**: No backfill or import work is included here. Existing local history remains intact, and one-time local-to-cloud import is handled separately.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Add automated persistence checks that validate required relationships, uniqueness rules, lifecycle transitions, and immutable event recording for accounts, sessions, participants, matches, and assignments.
- **E2E Test Coverage**: No end-to-end UI coverage is required in this story because it establishes backend data foundations rather than a new user-visible flow. Client integration stories should add the first cross-device journey coverage.
- **Applicable Skills**: supabase, supabase-postgres-best-practices, database-testing

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST maintain a durable account record for each authenticated user who can host or participate in cloud-backed sessions.
- **FR-002**: The system MUST allow only authenticated hosts to create a new shared game session and MUST associate each session with exactly one host account.
- **FR-003**: The system MUST provide each active shared session with a join code that resolves to one active session at a time.
- **FR-004**: The system MUST persist session lifecycle information needed to distinguish joinable, in-progress, and completed sessions, where completed is the only no-longer-joinable state in v1.
- **FR-004a**: Once a session is completed, the system MUST reject any further history-affecting writes for that session in v1.
- **FR-005**: The system MUST store participants as session members with a display identity, a membership type, an optional link to a durable account, and at most one participant membership per durable account per session.
- **FR-006**: The system MUST support session-scoped guest participants whose identity ends with the session, is not treated as a durable account in v1, and can be reclaimed on rejoin instead of creating a duplicate guest membership.
- **FR-006a**: The system MUST issue each guest participant a server-generated rejoin token scoped to the session and use that token to reclaim the same guest participant record on reconnect.
- **FR-007**: The system MUST store matches under a specific session and preserve the information needed to reconstruct the tracked fixture list, common-match selection, and score progression.
- **FR-008**: The system MUST store assignments only between participants and matches that belong to the same session.
- **FR-009**: The system MUST preserve enough session data to reconstruct the current shared setup, including participants, matches, common-match designation, and per-participant match assignments.
- **FR-010**: The system MUST record gameplay and session mutations that affect shared state or historical totals as immutable events linked to the relevant session and actor.
- **FR-011**: The system MUST require every history-affecting shared-state command to include a client-generated idempotency key scoped to the session.
- **FR-012**: The system MUST apply a history-affecting shared-state command at most once per session for a given idempotency key and reject conflicting reuse of the same key.
- **FR-013**: The system MUST reject writes that would create duplicate active room identities, orphaned relationships, or ambiguous duplicate event outcomes.
- **FR-014**: The core data model MUST leave richer authorization rules, read-optimized history and leaderboard views, and local-to-cloud import behavior to their planned follow-up stories without blocking those later additions.

### Key Entities _(include if feature involves data)_

- **Account**: A durable identity for an authenticated user who can host sessions and optionally participate across many sessions.
- **Game Session**: One hosted room and play instance with host ownership, join code, lifecycle state, common-match reference, and time boundaries.
- **Participant**: A session member represented either by a durable account or a guest-only session identity, with display name, session role, and a uniqueness rule that prevents duplicate durable-account memberships within one session.
- **Guest Rejoin Token**: A server-issued token scoped to one session and one guest participant record that allows a reconnecting guest to reclaim the same session membership.
- **Match**: A football fixture tracked inside a session, including teams, schedule context, and score state over the lifetime of the session.
- **Assignment**: A session-scoped association that tells which participants are responsible for which matches beyond the common match.
- **Gameplay Event**: An immutable record of a session mutation such as join, setup change, score change, drink adjustment, or session transition, with actor and ordering context.
- **Idempotency Key**: A client-generated command identifier scoped to one session that prevents the same history-affecting shared-state command from being applied more than once.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Hosts can create a new shared session and retrieve the same hosted session data, including join code and lifecycle state, in 100% of validation scenarios.
- **SC-002**: In 100% of validation scenarios, a saved session reloads with the same participant list, common match, match list, and assignment map that were originally submitted.
- **SC-003**: Valid join attempts by registered users and guests appear in the target session within 5 seconds of successful submission in normal test conditions, and a reconnecting guest using the same rejoin token resolves to the existing participant record.
- **SC-004**: In 100% of validation scenarios, persisted records can reproduce the final session outcome from stored events and related session data without reading a client-only snapshot.
- **SC-005**: In 100% of validation scenarios, retrying the same history-affecting command with the same session-scoped idempotency key produces one authoritative outcome.
- **SC-006**: Invalid writes involving cross-session relationships, duplicate active join codes, duplicate participant memberships, missing or conflicting idempotency keys, or duplicate event submissions are rejected in 100% of validation scenarios without leaving partial session data behind.
- **SC-007**: In 100% of validation scenarios, a completed session rejects any new history-affecting write without altering the stored event sequence.

## Assumptions

- The existing local session model of players, matches, common match, assignments, and drink totals remains the baseline domain shape that cloud persistence must represent.
- A single authenticated host owns each shared session in v1.
- Registered participants can be associated to durable accounts, but guest identities only need to exist for the lifetime of the session.
- Read-optimized summaries such as history comparisons and leaderboards are handled in separate follow-up work.
- Existing local persistence remains available until cloud-backed session flows ship.
- Gameplay events are treated as the authoritative historical record, and derived summaries can be built later from those records.
