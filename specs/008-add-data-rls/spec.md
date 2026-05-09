# Feature Specification: Protected Multiplayer Data Access

**Feature Branch**: `[125-us22-add-row-level-security-for-profiles-friendships-settings-and-room-data]`  
**Created**: 2026-05-09  
**Status**: Draft  
**Input**: User description: "Plan implementation for issue #125 '[US2.2] Add row-level security for profiles, friendships, settings, and room data' using epic #115 and the existing multiplayer schema context."

## Clarifications

### Session 2026-05-09

- Q: Should this story add the missing social/settings tables now, or only add RLS to whatever already exists? → A: Add the minimal profiles, friendships, and settings tables now, then apply RLS to them and the existing room tables.
- Q: Should friendship records use a request-based lifecycle or a simple accepted-friends list? → A: Use a request-based lifecycle with pending, accepted, declined, and canceled states.
- Q: Should profile records be self-only or visible to other signed-in users? → A: Visible to friendship participants, with read access expanding after a relationship is accepted.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Personal Records Respect Friendship Boundaries (Priority: P1)

As a signed-in player, I can read and update my own profile and settings records, and accepted friends can read my profile but not my settings, so my private data and preferences stay under my control.

**Why this priority**: Personal identity and preference data is the smallest, clearest security boundary. If this fails, the multiplayer platform leaks private user data immediately.

**Independent Test**: Sign in as two different users, confirm each user can read and update their own profile and settings records, confirm an accepted friend can read the profile but not the settings, and confirm unrelated users cannot access either record.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a signed-in player with profile and settings records, **When** that player loads their own account data, **Then** they receive their own profile and settings records.
2. **Given** an accepted friendship between two players, **When** one player loads the other player's profile, **Then** the profile is readable but the settings record remains inaccessible.
3. **Given** a signed-in player, **When** they try to update another player's private profile or settings data, **Then** the change is rejected and no unauthorized record is modified.

---

### User Story 2 - Social And Room Data Is Shared Only With Authorized Members (Priority: P1)

As a multiplayer player, I can see friendship records I am part of and room data for sessions I belong to, so collaboration works without exposing unrelated relationships or rooms.

**Why this priority**: The multiplayer product depends on shared room visibility, but that visibility must stop at the room boundary and the relationship boundary.

**Independent Test**: Create multiple users, at least one friendship, and at least two rooms with different memberships. Confirm only the involved friendship accounts can read the friendship record, and only room hosts or participants can read the matching room snapshot.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a friendship record between two players, **When** either involved player loads their friendship data, **Then** they can see that relationship and an unrelated player cannot.
2. **Given** a room with a host and participants, **When** the host or a current participant loads that room's data, **Then** they can read the session, participant, match, assignment, and event records for that room only.
3. **Given** a signed-in player who is not part of a room, **When** they query that room's data, **Then** they receive no accessible room records.

---

### User Story 3 - Protected Gameplay Writes Stay Behind Approved Actions (Priority: P2)

As a host or participant, I can rely on approved multiplayer actions while unsafe direct data writes stay blocked, so room state cannot be tampered with through unrestricted client access.

**Why this priority**: Read isolation is not enough if clients can still mutate protected room state directly. The feature must preserve trusted write paths and reject unsafe ones.

**Independent Test**: Attempt direct client-style writes against protected room and gameplay records from both authorized and unauthorized users. Confirm unauthorized direct writes fail while approved room actions continue to work through the intended command surface.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** protected gameplay and room-state records, **When** a client attempts an unauthorized direct write, **Then** the write is rejected and no partial state change is stored.
2. **Given** an authorized host or participant using an approved multiplayer action, **When** that action is valid for the room and actor, **Then** the change succeeds without granting unrestricted table access.

---

### Edge Cases

- A signed-in player belongs to one room and tries to read data for another active room.
- A friendship is pending, accepted, declined, or canceled, and only the allowed actor for that state transition may change it.
- A completed room remains readable to authorized members but does not allow new direct gameplay mutations.
- A guest or reconnecting participant joins through the room flow without gaining access to unrelated account-private records.
- A host who owns one room cannot use that ownership to access another host's room data.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: No new end-user screen is required for this feature. Native and web clients should observe the same access boundaries once they connect to the shared multiplayer data store.
- **Shared State Model**: The cloud multiplayer store remains the canonical source of truth for shared room data and the new account-linked profile, friendship, and settings records. Direct client reads must follow account ownership, accepted-friend profile visibility, and room membership rules, while privileged state changes remain on approved action paths.
- **Identity Model**: Authenticated accounts own personal records. Accepted friendship participants may read profile records, but settings remain owner-only. Room data is readable only when the caller is the room host or a current participant. Guests continue to rely on controlled room join and reclaim flows rather than broad account-level access.
- **Migration / Backfill**: Existing room data must remain intact while access rules are introduced. This story adds the minimal account-linked profile, friendship, and settings records when they are not already present, then applies RLS to them and the existing room tables without changing prior session history semantics.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Add automated database access-rule tests that verify allowed and denied reads and writes for personal records, friendship transitions, room membership reads, and blocked direct gameplay writes.
- **E2E Test Coverage**: No new end-to-end UI coverage is required unless this story also introduces a new client-facing multiplayer data flow. The primary validation for this story lives at the database policy level.
- **Applicable Skills**: supabase, database-testing, supabase-postgres-best-practices

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST enable row-level security and enforce row-level access rules on every authenticated-client-exposed record group involved in personal data, friendships, and multiplayer room data.
- **FR-002**: The system MUST allow a signed-in user to read and update their own profile record, and allow accepted friendship participants to read that profile record.
- **FR-003**: The system MUST allow a signed-in user to create or update only their own personal settings record.
- **FR-004**: The system MUST prevent a signed-in user from directly mutating another user's profile or settings records, and must prevent access to another user's profile or settings records unless the caller is the owner or an accepted friendship participant for profile reads.
- **FR-005**: The system MUST maintain bilateral friendship records anchored to two authenticated accounts and a request-based relationship state.
- **FR-006**: The system MUST allow only the two accounts involved in a friendship to read that friendship record.
- **FR-007**: The system MUST allow only the actor permitted by the current friendship lifecycle state to create, accept, decline, cancel, or end that friendship relationship.
- **FR-008**: The system MUST allow only the host and current participants of a room to read that room's session, participant, match, assignment, and gameplay records.
- **FR-009**: The system MUST prevent a signed-in user from reading room records for sessions they do not host or participate in.
- **FR-010**: The system MUST reject direct client writes to protected room-state and gameplay records when the caller is not authorized for that specific action.
- **FR-011**: The system MUST preserve approved multiplayer action paths for room creation, joining, setup persistence, gameplay updates, and session completion without requiring unrestricted direct table access.
- **FR-012**: The system MUST provide automated verification for both permitted and rejected access patterns across personal records, friendship records, and room data.
- **FR-013**: The system MUST introduce the minimal account-linked profile, settings, and friendship records needed to enforce these access boundaries when those records are not already present.

### Key Entities _(include if feature involves data)_

- **Profile**: The account-owned personal identity record a signed-in user may manage for themselves and that accepted friendship participants may read.
- **Settings**: The account-owned private preference record that only its owner may manage directly.
- **Friendship**: A bilateral relationship between two authenticated accounts with a request-based lifecycle state such as pending, accepted, declined, or canceled.
- **Room Membership**: The host or participant relationship that grants visibility into one multiplayer room.
- **Room Snapshot**: The full set of room-scoped session, participant, match, assignment, and gameplay records visible to authorized room members.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In 100% of validation scenarios, a signed-in user can read and update their own profile and settings records, and accepted friendship participants can read the profile record without accessing settings or unrelated private records.
- **SC-002**: In 100% of validation scenarios, only the two accounts involved in a friendship can view that friendship record, and unauthorized users receive no accessible friendship data.
- **SC-003**: In 100% of validation scenarios, room hosts and participants can load only the room data for sessions they belong to, and unrelated room queries return no accessible records.
- **SC-004**: In 100% of validation scenarios, unauthorized direct client writes to protected room-state or gameplay records are rejected without leaving partial data changes behind.
- **SC-005**: The automated access-rule validation suite passes locally for allowed and denied cases covering personal records, friendship records, and room data before the feature is considered complete.

## Assumptions

- The existing authenticated account identity remains the durable owner anchor for personal, friendship, and room-scoped access rules.
- Guest players continue to rely on controlled join and reclaim flows for room participation rather than broad direct access to account-private records.
- Read-optimized history, comparison, and leaderboard models remain part of the separate follow-up story in epic #115.
