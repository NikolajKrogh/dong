# Feature Specification: Live Lobby Presence & Host Handover

**Feature Branch**: `136-us52-allow-registered-users-and-guests-to-join-a-lobby-and-see-presence`

**Created**: 2026-06-21

**Status**: Draft

**Input**: User description: "I want to figure out how to implement #136 and for this I also want to implement option 2 which we just talked about where if the host leaves the room if another user is signed in the inherit it and if there are multiple let the host choose which should inherit the host role"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registered users and guests join a lobby and see it update live (Priority: P1)

A host has created a room and is on the lobby screen showing the join code. Friends join using the code: anyone who is **signed in** joins as a **registered member**, and anyone who is **not signed in** joins as a **guest**. The host sees each person appear in the participant list automatically, without leaving or refreshing the screen, and each person joining sees the up-to-date roster (host plus everyone else). Roles are clear: exactly one host, the rest labelled registered or guest. When someone leaves, they disappear from everyone's list.

**Why this priority**: This is the core of issue #136 and the foundation for everything else. Until signed-in users can join as registered members, there is no one eligible to inherit the room (US2), and a lobby that doesn't reflect who is actually present is not usable for gathering players. It delivers standalone value: a working, shared waiting room that distinguishes registered members from guests.

**Independent Test**: Open the host lobby on one device; on a second device, signed in as a different user, join with the code and confirm that user appears as a registered member in the host's list within a few seconds without refresh; on a third device (not signed in) join as a guest and confirm they appear labelled as a guest; have one leave and confirm they disappear from everyone's list.

**Acceptance Scenarios**:

1. **Given** a joinable room exists, **When** a signed-in user joins using the room code, **Then** they become a registered member of the room and appear in every participant's roster, labelled as registered, within a few seconds.
2. **Given** a joinable room exists, **When** a user who is not signed in joins using the room code, **Then** they become a guest and appear labelled as a guest; a guest is never a registered member.
3. **Given** a host is viewing the lobby for a joinable room, **When** any participant joins, **Then** that participant appears in the host's list within a few seconds without any manual refresh.
4. **Given** several participants are in the lobby, **When** one of them leaves, **Then** that participant is removed from every other participant's list within a few seconds.
5. **Given** any participant is viewing the lobby, **When** they look at the roster, **Then** exactly one participant is clearly marked as the host (owner) and each other participant is marked as registered or guest.
6. **Given** a participant temporarily loses connectivity, **When** connectivity resumes, **Then** their lobby roster automatically returns to an accurate state without requiring them to re-enter the room.
7. **Given** a user attempts to join with a code for a room that is not joinable (closed, expired, completed, or in progress), **When** they try, **Then** they are told the room is not available rather than being placed into it.
8. **Given** a signed-in registered member or host reopens the app, **When** they have an active room, **Then** the home screen offers a way to return to that room's lobby (determined from server state).
9. **Given** a signed-in user is already in an active room, **When** they try to create or join another room, **Then** they are offered an easy way to leave their current room and proceed (not just an error), and the rule is enforced server-side.
10. **Given** any participant views the lobby, **When** they look for the join code, **Then** the numeric code is shown only to the host; registered members and guests see the roster without it.

---

### User Story 2 - Host leaves and another signed-in player inherits the room (Priority: P2)

A host needs to step away but the game shouldn't die with them. From the lobby, the host chooses to leave. If exactly one other signed-in (registered) player is in the room, that player automatically becomes the new host and the room continues. If more than one signed-in player is present, the host is asked to pick which of them should take over before leaving. The chosen player becomes the host, everyone (including guests) stays in the room, and the roster updates to show the new host.

**Why this priority**: This is the primary new capability the user asked for beyond #136. It keeps rooms alive across host churn and is the main value-add of "option 2." It builds on US1 (you must see who is present to choose a successor) so it is P2.

**Independent Test**: With a host and two registered players in a room, have the host tap Leave, confirm a chooser appears listing only the two registered players, select one, and confirm that player's lobby now shows them as host, the other players remain, and the original host is gone — all reflected live.

**Acceptance Scenarios**:

1. **Given** a host and exactly one other registered participant are in the room, **When** the host leaves, **Then** the host role transfers to that registered participant automatically and the room remains active.
2. **Given** a host and two or more other registered participants are in the room, **When** the host chooses to leave, **Then** the host is prompted to select which registered participant becomes the new host before the departure completes.
3. **Given** the host is prompted to choose a successor, **When** the host views the choices, **Then** only registered participants are offered and guests are not selectable.
4. **Given** the host has selected a successor and confirmed, **When** the handover completes, **Then** the selected participant becomes the host, all other participants (including guests) remain in the room, and every participant's roster shows the new host within a few seconds.
5. **Given** the host is prompted to choose a successor, **When** the host cancels the prompt, **Then** no changes occur and the host remains in the room as owner.
6. **Given** the host has begun leaving, **When** the departure completes, **Then** the departing host no longer appears in any participant's roster.

---

### User Story 3 - Host leaves a guest-only room (Priority: P3)

A host is in a room where the only other people are guests (no other signed-in players). The host leaves. Because a guest cannot become a host, the room cannot continue, so it is closed: the remaining guests are told the room has ended and are returned to a safe starting point. The closed room does not appear as a completed game in anyone's history, because no game was ever played.

**Why this priority**: This is the necessary fallback that makes US2 safe and complete — without it, a host leaving a guest-only room would have no defined outcome. It is lower priority because it is an edge of the handover flow rather than the main path.

**Independent Test**: With a host and only guest participants in a room, have the host leave and confirm the room can no longer be joined with its code, each guest is shown a clear "room ended" message and returned to the home screen, and no new entry appears in game history.

**Acceptance Scenarios**:

1. **Given** a host is in a room with only guest participants, **When** the host leaves, **Then** the room is closed and can no longer be joined with its code.
2. **Given** a room is closed because the host left with only guests present, **When** each remaining guest's device reacts, **Then** the guest is informed the room has ended and is returned to a safe starting state within a few seconds.
3. **Given** a host is the only participant in a room, **When** the host leaves, **Then** the room is closed.
4. **Given** a lobby room is closed before any game started, **When** anyone reviews game history, **Then** no completed-game record exists for that room.

---

### User Story 4 - Unused rooms expire automatically (Priority: P4)

A host creates a room and then never comes back — or a room is simply abandoned. Because the host always keeps their role across disconnects (ownership is never auto-transferred), such a room would otherwise sit around forever, joinable, with its code still valid. To prevent stale rooms from piling up, any **joinable** room that has had no activity for 24 hours is automatically expired: it is closed, can no longer be joined, and anyone who later tries to use it is told it has ended. (Activity means recorded room events — joins/leaves/handovers — not merely having the lobby open.)

**Why this priority**: This is a housekeeping safeguard that follows directly from the deliberate decision to never auto-transfer the host role. It is not on any primary user journey, so it is the lowest priority, but it is needed to keep room codes and the room space from accumulating indefinitely.

**Independent Test**: Create a room, leave it untouched past the inactivity threshold, then attempt to join it with its code and confirm it is rejected as ended; also confirm an active room (with recent activity) is not expired.

**Acceptance Scenarios**:

1. **Given** a room has had no activity for 24 hours, **When** the expiry process runs, **Then** the room is closed and can no longer be joined with its code.
2. **Given** a room had activity within the last 24 hours, **When** the expiry process runs, **Then** the room remains active and joinable.
3. **Given** a room has expired, **When** someone attempts to join it with its code, **Then** they are told the room has ended rather than being placed into it.
4. **Given** a room expires while a participant has its lobby open, **When** the expiry takes effect, **Then** that participant is informed the room has ended and returned to a safe starting state.
5. **Given** a lobby room expires before any game started, **When** anyone reviews game history, **Then** no completed-game record exists for that room.

---

### Edge Cases

- **Successor disappears mid-choice**: The host is choosing among multiple registered players and the selected one leaves before the host confirms. The system MUST re-validate eligibility at confirmation and let the server re-decide the outcome: if one eligible member remains, transfer to them; if several remain, re-prompt; if none remain, fall through to closing the room. The host is never left on a dead-end/stale list, and the room is never left without a host.
- **Successor list collapses to zero mid-choice**: If every eligible member leaves while the host is choosing, the flow MUST gracefully become a room closure (US3), surfaced to the host with a brief "everyone left — close the room?" confirmation rather than silently closing.
- **Connectivity loss during handover**: The host's departure-with-handover MUST be atomic — either the new host is fully in place or nothing changes. The room MUST never end up with zero hosts or two hosts.
- **Rapid join/leave churn**: With many participants joining and leaving quickly, every participant's roster MUST converge to the correct membership.
- **Accessing a closed room**: A guest attempting to use the code for a room that has been closed MUST receive a clear "room ended / not available" message rather than a silent failure.
- **Guest leaving never triggers handover**: Only the host's departure can change ownership; a guest or non-host registered participant leaving simply updates the roster.
- **Involuntary host disconnection**: A host who closes the app or loses connectivity (without using the explicit Leave action) is treated as temporarily away, not as having left; ownership does not transfer and the room is not closed (see Assumptions).
- **Concurrent join during handover**: A new participant joining at the same moment a handover occurs MUST end up in the room with the correct (new) host reflected.
- **Host disconnects but never returns**: Ownership is never auto-transferred, so the room stays owned by the absent host until either someone is explicitly handed the room or the room is expired by the 24-hour inactivity rule (see US4). The room is never silently left in an inconsistent state.
- **Activity just before expiry**: A join, leave, handover, or any gameplay/state change MUST count as activity and reset the inactivity countdown, so an actively-used room is never expired.
- **Interacting with an expired room**: Any attempt to join or act on an already-expired room MUST be rejected with a clear "room ended" outcome, identical to a host-closed room.

## Requirements *(mandatory)*

### Functional Requirements

**Joining a lobby (US1)**

- **FR-0A1**: A signed-in user MUST be able to join an existing joinable room using its code and become a registered member (with their account's display name), not a guest.
- **FR-0A2**: A user who is not signed in MUST join as a guest, and a guest MUST never be recorded as a registered member.
- **FR-0A3**: A registered member MUST be distinguishable from a guest in the roster shown to every participant.
- **FR-0A4**: Joining MUST be rejected with a clear, user-facing reason when the room is not joinable (closed, expired, completed, or in progress).
- **FR-0A5**: A signed-in user MUST NOT become the host by joining; joining only ever creates a member (registered or guest). The host role is established only by room creation (existing behavior) or by handover (US2).
- **FR-0A6**: A signed-in user who is the host or a registered member of an active room MUST be able to return to that room's lobby after reopening the app. The app MUST determine their active room from server-side durable state (not a device-local pointer) and surface a "Return to room" affordance on the home screen.
- **FR-0A7**: The join code MUST be visible only to the host. Registered members and guests see the room and its roster but not the numeric join code.

**One active room at a time (US1)**

- **FR-0B1**: A signed-in user MUST be in at most one active room at a time (as host or registered member), where "active" means any room that is not completed or closed. This MUST be enforced server-side on both room creation and room join, not only in the client.
- **FR-0B2**: When a signed-in user tries to create or join a room while already in an active room, the app MUST offer an easy in-app way to leave their current room and proceed, rather than only showing a dead-end error.
- **FR-0B3**: Leaving the current room as part of switching MUST use the same exit behavior as leaving directly: a registered member simply leaves; a host triggers ownership handover or closure exactly as in US2/US3 (no separate "force close" path).

**Live presence (US1)**

- **FR-001**: The lobby MUST display all current participants of the room, each showing their display name, their role (host/owner or member), and whether they are a registered user or a guest.
- **FR-002**: When a participant joins the room, every participant currently viewing the lobby MUST see the new participant appear within a few seconds without manually refreshing.
- **FR-003**: When a participant leaves the room, every participant currently viewing the lobby MUST see that participant removed within a few seconds. Leaving MUST remove the participant from the durable roster — for registered members and for guests alike (a guest leaving cannot rely on a local-only action; their participant record MUST be removed so others stop seeing them).
- **FR-004**: The lobby MUST clearly indicate which single participant is the current host.
- **FR-005**: Live presence MUST be available both in the host's lobby view and in each guest's lobby view, on both native and web.
- **FR-006**: If live updates are temporarily unavailable, the lobby MUST still present an accurate roster when opened and MUST recover to an accurate roster automatically once connectivity resumes.

**Host departure & ownership handover (US2)**

- **FR-007**: A host MUST be able to leave their room through an explicit action available from the lobby.
- **FR-008**: When a host leaves and exactly one other registered participant is in the room, the system MUST transfer the host role to that participant and keep the room active.
- **FR-009**: When a host leaves and two or more other registered participants are in the room, the system MUST require the host to choose which registered participant becomes the new host before the departure completes.
- **FR-010**: Only registered participants MUST be eligible to inherit the host role; guests MUST NOT be offered as, or able to become, the new host.
- **FR-011**: After a successful handover, the room MUST remain active and all remaining participants (including guests) MUST stay in it; the new host and all participants MUST see the updated host within a few seconds.
- **FR-012**: After a host leaves, the departing host MUST no longer appear in the room's participant roster.
- **FR-013**: The successor-selection prompt MUST allow the host to cancel and remain in the room with no changes.
- **FR-014**: Ownership transfer MUST be atomic and MUST guarantee the room always has exactly one host — never zero, never two — even if the request is interrupted.
- **FR-015**: The system MUST re-validate that a chosen successor is still an eligible registered participant at the moment the handover is confirmed.

**Room closure fallback (US3)**

- **FR-016**: When a host leaves and there are no other registered participants in the room, the system MUST close the room so it can no longer be joined with its code.
- **FR-017**: When a room is closed due to host departure, all remaining participants MUST be informed that the room has ended and returned to a safe starting state within a few seconds.
- **FR-018**: Closing a lobby room that never started a game MUST NOT create a completed-game history record.

**Shared-state & auditability (cross-cutting)**

- **FR-019**: All room membership changes (joins, leaves), ownership handovers, and room closures MUST be recorded as auditable, server-authoritative records consistent with existing history handling.
- **FR-020**: Every shared-state change in this feature (join, leave, handover, closure) MUST be performed through the canonical server-side path so that all devices converge on the same room state.
- **FR-020a**: All leave/handover/closure behavior in this feature applies ONLY while the room is in the joinable (lobby) phase, and MUST be guarded to that phase. Leaving a game that is already in progress (which must preserve participation and write history) is explicitly out of scope and tracked separately (GitHub #165); these lobby leave paths MUST NOT be reused for in-progress leave.
- **FR-021**: The displayed roster and the identity of the host MUST be derived solely from the room's durable membership and ownership records, not from transient connection status. Losing connection MUST NOT remove a participant from the roster and MUST NOT change who is the host. This feature does NOT show any per-participant online/away indicator (deferred as a future enhancement if real-time presence is later adopted).

**Room expiry (US4)**

- **FR-022**: The system MUST automatically expire any **joinable** room that has had no activity for 24 hours by closing it so it can no longer be joined with its code. (Expiry targets joinable lobbies only; in-progress games are out of scope here — a future gameplay story defines their idle policy, since auto-closing a live game could destroy it.)
- **FR-023**: Activity that resets the room's 24-hour window is any recorded room event (join, leave, ownership handover). Merely viewing/polling the lobby does NOT count as activity — a lobby that is open but otherwise idle for 24 hours will expire. (This is an accepted, documented behavior, chosen to avoid per-poll writes.)
- **FR-024**: An expired room MUST behave identically to a host-closed room for anyone who interacts with it afterward: attempts to join are rejected with a clear "room ended" outcome, and any participant viewing it is informed and returned to a safe starting state.
- **FR-025**: Expiring a lobby room that never started a game MUST NOT create a completed-game history record (consistent with host-initiated closure).

### Key Entities *(include if feature involves data)*

- **Room**: The shared waiting space identified by a join code. Has exactly one host at any time, a lifecycle state that includes "joinable" and a terminal "closed/ended" state distinct from a normally completed game, and a notion of last activity used to determine inactivity-based expiry.
- **Participant**: A person in the room. Is either a registered user (signed-in account) or a guest (session-scoped, single-device identity). Has a role of host (owner) or member. (No connection-presence attribute — membership is the only "who is here" signal.)
- **Host role (Ownership)**: The single owner of a room. MUST always be held by a registered participant; never by a guest; never absent while the room is active.
- **Membership / Ownership event**: An auditable record of a join, leave, ownership handover, or room closure, used to keep all devices consistent and to preserve history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a participant joins or leaves, every other participant with the lobby open sees the change within 5 seconds without manual refresh, in at least 95% of occurrences.
- **SC-002**: When a host with exactly one other registered participant leaves, the successor sees that they are now the host within 5 seconds, and the room is never left without a host (zero ownerless rooms).
- **SC-003**: When a host with two or more registered participants leaves, 100% of completed handovers go to the participant the host selected.
- **SC-004**: When a host leaves a room whose only other participants are guests, the room becomes unjoinable and every remaining guest is returned to a safe state with an explanatory message within 5 seconds.
- **SC-005**: Closing an unstarted lobby room never produces a game-history entry (zero spurious completed-game records).
- **SC-006**: A guest is never displayed as the host and is never selectable as a successor (zero occurrences).
- **SC-007**: At no point does a room have two simultaneous hosts or zero hosts while active (zero occurrences across handovers).
- **SC-008**: A host who disconnects without using the explicit Leave action and then returns regains their lobby with their host role intact, 100% of the time, as long as the room has not expired.
- **SC-009**: Rooms with no activity for 24 hours become unjoinable (100% expired after the window), while any room with activity inside the window stays joinable (zero premature expiries).
- **SC-010**: A signed-in user who joins a room with a valid code appears as a registered member to every participant within 5 seconds, and is never shown as a guest or as the host (zero misclassifications).
- **SC-011**: A signed-in user is never simultaneously in two active rooms; attempts to create/join a second room are blocked server-side and resolved via the easy-exit flow (zero double-membership occurrences).
- **SC-012**: The numeric join code is shown only to the host (zero occurrences of a member or guest seeing the code).

## Assumptions

- **Explicit handover only; no auto-transfer**: The host role is never transferred automatically. It changes only when the host explicitly leaves and a successor is chosen/auto-assigned per US2. Because room and ownership state is server-authoritative, a host who disconnects (app close, crash, lost connectivity) keeps their role and resumes it on return — this requires no special handling and is the intended behavior, not auto-transfer.
- **Roster & ownership come from durable state, not live presence**: The participant list and the host identity are read from persisted room/membership records. There is no separate connection-presence signal in this feature, so a flaky connection never removes a participant or changes the host; it just means that participant's device updates a beat later on its next refresh.
- **Stale rooms are bounded by expiry**: The deliberate "no auto-transfer" choice means an abandoned room could otherwise live forever; the 24-hour inactivity expiry (US4) is the safeguard. "Activity" means any join, leave, handover, or gameplay/state change in the room. The exact expiry mechanism (e.g., a scheduled server-side process) is an implementation detail for the plan.
- **Eligible successor definition**: An eligible successor is a registered participant who is a member of the room at the moment the host confirms leaving, excluding the departing host. Guests are never eligible (consistent with the existing rule that an owner must be a registered account).
- **Guests stay session-scoped**: Guests remain single-device, session-scoped identities per the project constitution and cannot hold the host role.
- **Builds on existing room model**: Reuses the authenticated-host, room, and participant model and the single-registered-owner ownership rule established in prior stories (host authentication, guest join, host room creation). It adds a new registered-member join path for signed-in users (no prior path existed — only guest join), and extends room creation with the one-active-room check (FR-0B1) so a user already in a room is guided to leave it first; it does not otherwise change how rooms are created or how guests join.
- **One active room, server-enforced**: "Active" = any room (owned or joined) whose state is not completed or closed. The constraint is enforced in the create and join server paths and surfaced to the client so it can offer the easy-exit flow; it applies to signed-in users (guests already model a single session via their device-local grant).
- **Lobby-phase scope; in-game leave deferred**: Everything here operates in the joinable lobby phase. Leaving an in-progress game with preserved participation, and the host ending a game so history is saved for all (including early-leavers), are deliberately out of scope and tracked in GitHub #165 (and #138); the host's "Start Game"/configuration remains in #134.
- **Registered membership is account-based**: A registered member is tied to a signed-in account and uses that account's display name; eligibility to inherit the host role (US2) is exactly the set of registered members present in the room.
- **Live updates via polling, not subscriptions**: The lobby reflects changes by periodically re-reading the durable room snapshot (a single shared poll interval of ~4 seconds, matching how the existing guest lobby already works), not via a real-time subscription. Brief propagation delays (up to roughly one poll interval plus round-trip) are acceptable; this is the deliberate choice behind FR-021 having no online/away indicator. Real-time subscriptions are a possible future optimization.
- **Platform parity**: Behavior is defined for both native and web; live presence and host departure/handover must work on both.
- **Persistence & access control**: Any new room lifecycle state or ownership/membership event ships with the appropriate migration, indexing, and access-control updates (detailed in the plan).
- **Required coverage**: This change includes unit tests for the successor-selection and closure decision logic and for the live-roster update logic; database-level tests for the ownership-transfer and closure operations and their access boundaries; and at least one end-to-end test covering the live-presence journey and a host-handover journey on web.
