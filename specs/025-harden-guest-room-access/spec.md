# Feature Specification: Harden Guest Room Access

**Feature Branch**: `codex/191-harden-guest-room-access`
**Created**: 2026-09-20
**Status**: Draft
**Input**: [Issue #191 — Harden guest room credentials and anonymous join abuse controls](https://github.com/NikolajKrogh/dong/issues/191), under [Identity and Access #120](https://github.com/NikolajKrogh/dong/issues/120)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Join with a protected guest identity (Priority: P1)

As a guest, I can join on my own device and return to the same room while my access is valid, without exposing a reusable credential through ordinary device storage or creating an account.

**Why this priority**: Every later guest action depends on a credential that cannot be guessed or casually copied from storage.

**Independent Test**: Join and reopen a room on native and web; inspect the guest access retained on each platform; simulate unavailable secure randomness and verify that no join request is sent.

**Acceptance Scenarios**:

1. **Given** a joinable room and a guest device with secure credential generation available, **When** the guest joins, **Then** one unpredictable room-scoped identity is created and a retry of that join returns the same participant.
2. **Given** secure credential generation is unavailable, **When** the guest tries to join, **Then** the attempt stops before contacting the room and the guest receives a recoverable explanation.
3. **Given** a native guest has joined, **When** the app is closed and reopened, **Then** the guest can resume with a valid grant, and the bearer credential is absent from ordinary unprotected app storage.
4. **Given** a web guest reloads the same open browser tab, **When** the grant is still valid, **Then** the room can be restored; closing that browser session does not leave a durable bearer credential behind.
5. **Given** an older app version left a guest grant in ordinary storage, **When** the upgraded app starts, **Then** that copy is removed and the guest either resumes after validation using protected storage or is guided through the available recovery path.

---

### User Story 2 - Guest access ends predictably (Priority: P1)

As a guest, I know whether I can still access a room after leaving, expiry, credential replacement, or room closure, and a stolen or stale credential cannot be used afterward.

**Why this priority**: A room-scoped bearer grant must have an enforceable end, including across gameplay and reconnects.

**Independent Test**: Join, refresh or replace the grant, leave, and close the room in separate test rooms; attempt room reads and gameplay actions with both the current and prior credentials.

**Acceptance Scenarios**:

1. **Given** a valid guest grant, **When** it is presented to a different room or to act as another participant, **Then** the request is rejected without disclosing that room or participant's data.
2. **Given** an active room and a guest grant approaching expiry, **When** the guest is online, **Then** access can be renewed without creating a second participant, and the replaced grant ceases to authorize room reads or writes.
3. **Given** the guest's grant expires before renewal, **When** the guest opens or acts in the room, **Then** access is rejected, the local grant is cleared, and the guest sees a safe recovery path appropriate to the room's state.
4. **Given** the guest leaves and the leave is confirmed, **When** the old grant is reused for a snapshot or gameplay action, **Then** it is rejected and the guest is absent from the active roster.
5. **Given** the host completes a room, **When** the shared completion is confirmed, **Then** every guest grant is revoked immediately and the guest cannot continue reading or acting in the room; the completed history still retains that guest's contribution.
6. **Given** a leave request cannot reach the server, **When** the guest leaves, **Then** the app does not claim that server access was revoked; it explains the pending outcome and retries revocation when connectivity returns.
7. **Given** a current grant is copied to another device, **When** either copy is used before revocation, **Then** both are treated as the same room participant with the same permissions; renewal or revocation makes every old copy unusable.
8. **Given** a room is still joinable and a guest grant expires, **When** the room roster is refreshed or the host starts the game, **Then** the guest is absent from the live roster and is not included among the participants eligible for that game, while the guest identity and prior records remain retained.
9. **Given** a guest grant expires after a game has started, **When** an authorized participant views the ongoing game or its history, **Then** the settled participant, assignments, scores, and events remain unchanged while the expired grant is denied access.
10. **Given** a guest is active in an in-progress room, **When** they request to leave and the server confirms it, **Then** the guest loses room access and leaves the active roster while their settled game contribution and event history remain intact.

---

### User Story 3 - Public room entry resists guessing and flooding (Priority: P1)

As a host, I can share a room code with invited guests without anonymous callers being able to enumerate rooms, flood joins, or overwhelm room refreshes.

**Why this priority**: Room code entry and guest snapshots are callable without a registered account and need server-enforced limits.

**Independent Test**: Send invalid and repeated join/snapshot requests from anonymous clients, then verify that excess traffic is limited while legitimate guests and existing room members continue using the room.

**Acceptance Scenarios**:

1. **Given** repeated anonymous guesses at room codes from one caller or against one code, **When** either configured join limit is reached, **Then** further attempts are throttled or rejected before any participant is created, with a safe retry message.
2. **Given** an unknown, closed, or otherwise unavailable room, **When** an unauthenticated caller submits its code, **Then** the caller receives the same public-facing unavailable-room result and cannot infer whether the code names a room.
3. **Given** repeated snapshot requests using invalid grants, **When** the configured read limit is reached, **Then** further requests are limited without exposing room state.
4. **Given** normal invited guests and a guest refreshing a room during play, **When** other anonymous requests are limited, **Then** their allowed joins and room refreshes still complete within the normal service target.
5. **Given** a guest grant expires, **When** anonymous requests continue from the same caller or against the same submitted room code, **Then** existing abuse-window limits remain in effect and are not reset by expiry.

---

### User Story 4 - Guest access has one auditable boundary (Priority: P2)

As a room participant, I can trust that every guest entry point applies the same access rules and that investigations can identify abuse without revealing credentials.

**Why this priority**: Fixing join alone leaves snapshot, lobby choices, gameplay, and other guest actions as alternate paths.

**Independent Test**: Exercise each guest-facing read and action with missing, expired, revoked, cross-room, and valid grants; inspect available operational records and client-visible errors for credential leakage.

**Acceptance Scenarios**:

1. **Given** a missing, expired, revoked, or cross-room grant, **When** any guest-facing room read or action is attempted, **Then** no room data or state change is returned.
2. **Given** a rejected or limited anonymous request, **When** it is recorded for diagnosis, **Then** the record contains the outcome and safe correlation information but no raw guest credential or full room code.
3. **Given** a valid guest action, **When** access rules are tightened, **Then** the guest can still perform the actions permitted to their participant and room state.

---

### User Story 5 - Distinguish host completion from grant expiry (Priority: P1)

As a guest whose access ends because the host completed the room, I can tell the room ended rather than mistaking completion for an expired grant, while the server still denies all room data and gameplay access.

**Why this priority**: Completion must end guest access immediately, while a connected guest still needs a safe terminal signal to reach the dedicated Room Ended experience.

**Independent Test**: Complete one room while a guest grant is valid; separately expire or revoke a grant before completion. Verify only the former receives a data-free `room_ended` result, all guest reads/writes remain denied, and completion/leave/expiry races preserve participant and gameplay history.

**Acceptance Scenarios**:

1. **Given** a guest grant is valid when host completion commits, **When** that guest next requests room state, **Then** the server returns only `room_ended` with no snapshot or participant data, and subsequent mutations remain denied.
2. **Given** a grant expired or was revoked before host completion, **When** the guest next requests room state, **Then** the existing generic access-loss response is returned rather than `room_ended`.
3. **Given** host completion races a confirmed guest leave or grant expiry, **When** the server serializes the outcome, **Then** the committed order determines the terminal result and no participant, gameplay/history, or abuse-window data is deleted or reset.

### Edge Cases

- A join succeeds remotely but its response is lost; retrying with the same pending identity must not create a second participant.
- A token already bound to room A is submitted with room B's code; it must not create a second identity or grant cross-room access.
- A renewal response is lost; retrying renewal must recover the same new grant without leaving the guest locked out or allowing the old grant to read the room.
- A guest goes offline before expiry and returns after it, including while a game is in progress and new joins are closed.
- A guest leaves while offline, reinstalls the app, or clears browser data before queued revocation can be delivered; expiry remains a bounded fallback.
- Two devices attempt to use the same grant, or an attacker replays a copied grant during renewal.
- A valid guest refreshes frequently while anonymous invalid reads are flooding the service; limiting must preserve ordinary refreshes.
- A guest grant expires before game start or during play; expiry changes access and the live lobby roster, but it does not erase a started game's settled participant or event history.
- A guest grant expires while caller- or room-code abuse windows are active; those windows continue independently of participant expiry.
- An older app version still holds a plaintext local grant when this feature is released.
- Room closure races with join, renewal, or a guest gameplay command; the terminal room state wins.
- A request fails partway through access validation; neither partial membership nor partial gameplay writes may remain.
- Completion races with a guest leave or an already-expired grant; only a grant valid at the committed completion event receives `room_ended`.
- A delayed/replayed terminal request arrives after the original grant expiry; no room data is returned.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every new guest grant MUST be generated from a cryptographically secure source with sufficient unpredictability for a bearer credential. Guest joining MUST fail closed when that source is unavailable.
- **FR-002**: A guest grant MUST identify exactly one guest participant in exactly one room; reuse against another room or participant MUST be rejected.
- **FR-003**: A retry of the same unresolved join MUST resolve to the original participant and MUST NOT create a duplicate guest or join event.
- **FR-004**: Native devices MUST retain a guest bearer grant only in platform-protected credential storage. Web access MUST use a documented browser-session strategy that avoids durable bearer storage and states its same-origin script exposure limit.
- **FR-005**: On upgrade, any legacy grant in unprotected storage MUST be removed. A guest with a valid legacy grant MAY be transferred to protected storage only after the server confirms its validity; otherwise the app MUST offer the normal join or access-lost path.
- **FR-006**: Each guest grant MUST have an enforced expiry no later than 48 hours after issue. Valid guests in active rooms MUST be able to renew before expiry without changing their participant identity; ordinary snapshot reads MUST NOT silently extend expiry.
- **FR-007**: Renewal MUST replace the prior grant atomically, be safe to retry after an uncertain response, and leave no interval in which an unconfirmed replacement permanently locks out the legitimate guest. A replaced grant MUST NOT authorize room reads or writes.
- **FR-008**: A guest MUST be permitted to leave a joinable or in-progress room. A confirmed leave MUST revoke access immediately and remove the guest from the active roster; it MUST preserve settled game contribution and history. If confirmation is unavailable, the client MUST show the pending state and retry revocation; it MUST NOT represent local clearing as confirmed revocation.
- **FR-009**: Host completion MUST immediately revoke every guest grant. A completed or closed room MUST reject all guest reads and writes; revocation MUST NOT remove historical participants or alter scores, assignments, or gameplay events.
- **FR-010**: An expired, revoked, or unknown grant MUST be denied consistently across guest snapshots, lobby actions, and gameplay commands. The client MUST clear unusable local access and explain whether rejoining is possible in the current room state.
- **FR-011**: Anonymous join attempts MUST be limited by caller and submitted room code, with limits enforced before a guest is created. Limits MUST be configurable and must not depend on client-side controls.
- **FR-012**: Anonymous snapshot requests MUST be limited by caller and grant, with stricter handling for invalid grants. Valid guests' ordinary refresh cadence MUST remain usable under the configured limits.
- **FR-013**: Before a room code is proven valid to an invited participant, public responses for unknown and unavailable rooms MUST be indistinguishable. Limited callers MUST receive a safe retry response without room or participant details.
- **FR-014**: Guest tokens MUST NOT appear in URLs, analytics, crash reports, logs, user-visible errors, or persisted gameplay events. Abuse records MAY retain only non-reversible correlation values and a reason category.
- **FR-015**: Each guest-facing operation MUST enforce least-privilege access to its room and permitted action, including privileged room reads and state changes; no anonymous caller may invoke internal operations directly.
- **FR-016**: Security controls MUST preserve authorized guest joins, active-room recovery, permitted lobby and gameplay actions, and signed-in host/member access on native and web.
- **FR-017**: Join, renewal, revocation, expiry, and denial behavior MUST be covered by automated tests, including invalid, replayed, cross-room, terminal-room, and over-limit requests.
- **FR-018**: When a guest grant expires before a joinable room starts, the guest MUST be omitted from the live room roster and the next game's eligible participant set. Expiry MUST NOT be recorded as a confirmed leave or delete the guest identity or prior records. If expiry occurs after game start, it MUST NOT change the settled participants, assignments, scores, or gameplay events.
- **FR-019**: Expiring or revoking a guest grant MUST NOT reset or refund anonymous abuse limits keyed by caller or submitted room code.
- **FR-020**: A guest grant valid at canonical host completion MUST receive a data-free `room_ended` terminal outcome on the next guest snapshot request. This outcome MUST NOT authorize a snapshot, room read, or mutation.
- **FR-021**: A grant expired, replaced, left, or revoked before host completion MUST retain the existing generic access-loss behavior; unknown callers MUST NOT learn whether a room exists or ended. Any completion-only grant-matching metadata MUST be non-reversible, non-authorizing, and retained with the existing historical participant row without deleting history or abuse records.

### Key Entities

- **Guest grant**: A bearer credential for one guest participant in one room, with issue and expiry times and a current, replaced, revoked, or expired state.
- **Guest participant**: A temporary, room-scoped person with no permanent account. Their identity remains stable when their grant is renewed.
- **Room**: The shared session with a join code, active participants, and joinable, in-progress, completed, or closed state.
- **Join attempt**: A guest's proposed code and name plus a retry identity, producing one participant or a safe rejection.
- **Abuse window**: A bounded count of anonymous attempts associated with a caller, submitted code, or invalid grant; it does not contain the raw credential.
- **Revocation outcome**: Whether leaving was confirmed by the server, remains pending retry, or has already been rendered moot by expiry or room closure.
- **Live room roster**: The participants currently eligible to appear as active in the room and, before game start, be included in the game. Guest eligibility depends on a current, unexpired grant; the roster is distinct from persisted participant and game history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In native and web validation, 100% of guest joins fail before a network join request when secure credential generation is unavailable; no generated credential uses predictable fallback randomness.
- **SC-002**: In native storage inspection and browser-session tests, zero guest bearer credentials remain in unprotected native storage or durable browser storage after joining, restarting, or closing the browser session.
- **SC-003**: In the access test matrix, 100% of expired, replaced, revoked, completed-room, and cross-room grants fail to read room data or change state; completed and closed rooms reject all guest access while retaining completed history.
- **SC-004**: Repeating a join or renewal after a lost response produces one participant and one current grant in 100% of tested retries.
- **SC-005**: In abuse tests, 100% of attempts beyond the configured anonymous join and invalid-read quotas are limited, while a valid group of eight invited guests can join and active guests can continue their normal refresh cadence.
- **SC-006**: In traffic, event, and diagnostic samples from the validation journeys, zero raw guest credentials and full room codes appear outside their intended confidential exchange.
- **SC-007**: At least 95% of authorized guest joins and room refreshes complete within five seconds under normal conditions and while unrelated anonymous traffic is being limited.
- **SC-008**: In native and web journeys, 100% of guests receiving confirmed revocation or expiry see an accurate access state and a usable recovery explanation within five seconds of the next online interaction.
- **SC-009**: In every tested joinable-room expiry case, the expired guest is absent from both host and guest live-roster views on the next successful refresh and is excluded from the game-start participant set; participant identity and any started-game history remain intact.
- **SC-010**: In every tested expiry case, caller- and submitted-code abuse windows retain their prior counts and continue enforcing configured limits.
- **SC-011**: In 100% of confirmed in-progress guest departures, the prior grant is denied on the next request, the guest is absent from the active roster, and settled game history is unchanged.
- **SC-012**: In 100% of host-completion cases, every guest grant is denied before completion returns while participant and gameplay history remain unchanged.
- **SC-013**: In 100% of tested completion/expiry/leave orderings, only a grant valid at the completion event receives `room_ended`; that response contains no snapshot or participant data and all later reads/writes are denied.
- **SC-014**: Terminal classification grants no room access; cleanup does not delete participants, gameplay events, completed history, or abuse-window counts.

## Assumptions

- Guest participants remain temporary identities scoped to one room and intended for use on one device or browser session; guests do not become registered users or hosts.
- A currently valid bearer grant cannot prove which physical device holds it. A copied grant can impersonate that same participant until it is replaced, revoked, or expires; protection at rest, secrecy in diagnostics, and short validity reduce this residual risk.
- A grant lasts at most 48 hours from issue. An online guest may renew it before that deadline; an offline guest returning after expiry may rejoin only if the room still accepts new guests. The app explains the loss of access if the game has already started.
- A completed room and a closed room offer no guest access. Completed history available to registered users is governed by its existing authorization rules.
- If a grant expires before the room starts, the guest is no longer a live roster/game-start participant, but expiry is not a voluntary departure and does not set the confirmed-leave state. If it expires after start, only access ends; the settled game's history is unchanged. Abuse-window accounting is independent of this lifecycle.
- Web browser sessions may restore a room in the same tab, but closing the session can remove the guest's ability to return. The join flow should make this limitation clear before play.
- The feature changes guest identity and access protection, not scoring rules, room assignment rules, or registered-user sign-in.
- Existing guest join and room lifecycle work in #131 and #136 are prerequisites; the active-game guest actions introduced with #190 are included in the access review.
- Rate-limit thresholds and windows will be chosen in planning from the expected room size and refresh cadence, with the acceptance tests proving both abuse resistance and normal use.

## Platform & State Impact

- **Native and web**: Both platforms must produce equally strong credentials and handle join, restore, expiry, and access loss consistently. Native uses protected persistence; web uses a browser-session policy with an explicit residual script-risk statement.
- **Authentication and guest access**: Hosts remain authenticated; guest joins remain anonymous and tied to a single room-scoped identity. All guest-facing operations share the same validity rules.
- **Shared state**: The room remains authoritative for membership, grant validity, and permitted gameplay. Grant replacement and leave must not create duplicate participants or partially apply actions.
- **Migration and backfill**: Existing native plaintext grants require a safe upgrade path. Existing active guest credentials need an expiry and revocation transition without silently converting guests into new participants. Planning must include recovery and rollback notes for persisted data and access rules.
- **Scope boundary**: Guest credential security, anonymous abuse control, in-progress voluntary leave, and the distinction between live access and retained game history are in scope. A guest who leaves during play cannot mutate or read the room afterward, but the participant and settled contribution remain in history.

## Delivery & Automation Impact

- **Unit coverage**: Secure generation failure, protected storage and legacy-grant cleanup, browser-session behavior, renewal retries, pending leave, expiry handling, and user messages.
- **Database and API coverage**: Invalid, expired, replaced, revoked, cross-room, replayed, terminal-room, and over-limit requests; expired-before-start roster and game-start eligibility; preservation of settled game history; privilege and room-state enforcement on every guest entry point.
- **End-to-end coverage**: Existing #191 coverage remains historical. For the 2026-09-27 amendment, the user explicitly prohibited adding or running E2E tests; automate authorization/state transitions with pgTAP and unit/static checks, and leave browser/native acceptance to the user in T051/T074. Principle V's new-screen E2E coverage is intentionally unmet and recorded in #024's plan.
- **Applicable skills for planning and implementation**: `speckit-plan`, `supabase`, `supabase-postgres-best-practices`, `database-testing`, `react-native-testing`, and `codebase-memory`.
