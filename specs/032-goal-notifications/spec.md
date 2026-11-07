# Feature Specification: Active Game Goal Notifications

## Production scope agreed 2026-11-07

Notifications are automatic goal alerts for the current authorized game. The product has no manual send action, fixed test message, test-only enrollment state, invitation code or development-origin access on the production backend. Browser and server automated tests use isolated fixtures. Production accepts only https://dongthegame.com and https://www.dongthegame.com. Signed-in, guest and solo authorization, per-player session scope, bounded retries, cleanup and operational stop controls remain required. iPhone Home Screen users provide production feedback after release.


**Feature Branch**: `feat/goal-notifications`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "How difficult would it be to send notifications out when a team has scored? I can start with supporting web, and then later android."

**Confirmed scope**: Background web push notifications for matches in the user's active DONG game, whether the game is visible, backgrounded or closed. Native Android delivery follows in a separate feature.

**Mobile browser release scope**: Required background-notification targets are Android Chrome, Android Firefox, Android Samsung Internet and the iPhone Home Screen website on iOS 16.4 or later. Edge, Opera, other browsers and iPad are outside the required notification validation matrix. Ordinary iPhone tabs and unsupported, embedded or private configurations receive setup or fallback guidance. Existing gameplay remains available.

**Staged availability**: Eligible players opt in directly when the server enables their browser target. Android verification can use the isolated HTTPS preview. iPhone users will test the Home Screen flow after production enablement and can report device results.

**iPhone product boundary**: DONG will never have a native iOS app. The user confirmed optional browser Add to Home Screen setup is acceptable for background notifications. This is an installed website using web technology, with no App Store release or native iOS build; normal browser play stays available without that setup.

## Clarifications

### Session 2026-11-06

- Q: Which matches should trigger push notifications for a multiplayer player? → A: Each player chooses within the active game between all room matches and assigned matches plus the common match. The choice lasts for that session. Every new session defaults to assigned matches plus the common match, subject to the common-match preference.
- Q: Should a goal also trigger a system notification while the player has the game open? → A: Send the system notification whenever the player is eligible, including while the game is visible. The in-game toast and DONG sound continue to follow their own settings.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enable and receive active-game goal alerts (Priority: P1)

A player explicitly enables browser goal notifications and receives an alert when a team scores in a match belonging to their active game, even while using another tab or after closing the DONG tab.

**Why this priority**: Players can follow their game without keeping DONG visible.

**Independent Test**: Enable notifications for an active game on a supported browser, close the tab, introduce a new accepted goal, and verify one system notification identifies the scoring team, fixture and updated score.

**Acceptance Scenarios**:

1. **Given** an active game and a capable browser without consent, **When** the player chooses to enable notifications and grants permission, **Then** DONG registers the browser, binds it to the current authorized game and shows enabled status after the binding is acknowledged. The current score establishes a baseline.
2. **Given** an enabled browser and eligible game, **When** DONG accepts a new goal while its tab is backgrounded or closed, **Then** the player receives an alert identifying the scoring team, fixture and accepted score, subject to browser delivery conditions.
3. **Given** a match already has goals, **When** notifications are enabled or the match is added to the game, **Then** its current score establishes a baseline and historical goals are not announced as new.
4. **Given** denied permission or an unsupported browser, **When** the player tries to enable alerts, **Then** DONG explains the state and recovery without preventing gameplay or repeatedly requesting permission.
5. **Given** active solo play or multiplayer participation as host or guest, **When** the player enables alerts, **Then** only matches authorized by that game or participation and covered by the selected scope generate alerts for this browser.
6. **Given** DONG is open in an ordinary iPhone tab, **When** the player chooses background notifications, **Then** DONG explains how to add and open the Home Screen web app. It offers the permission step there once enrollment is available.
7. **Given** installation opens a separate storage context without the previous session/game, **When** the player opens the installed app, **Then** DONG offers sign-in, rejoin or an explicitly supported recovery route without erasing the original game's data or claiming the game transferred automatically.
8. **Given** an embedded browser or unsupported configuration, **When** background notifications are unavailable, **Then** the player can keep playing and receives an explanation with a suitable external-browser or installation path.
9. **Given** a player has opted in and their game is visible, **When** DONG accepts an eligible goal, **Then** it dispatches the system notification and applies the usual in-game feedback settings independently.

---

### User Story 2 - Control and end delivery (Priority: P2)

A player can turn off push notifications and stops receiving newly dispatched alerts when their game or participation ends.

**Why this priority**: Background delivery must remain tied to consent and a finite game.

**Independent Test**: Disable alerts, remove a selected match, leave a room, end a game and expire a solo session; verify later goals do not cause dispatches for the affected scope.

**Acceptance Scenarios**:

1. **Given** enabled notifications, **When** opt-out is acknowledged, **Then** no subsequent final send authorization can succeed for that browser until the player explicitly enables alerts again. A send already authorized can still reach the device.
2. **Given** a game association, **When** DONG accepts match removal, game completion, active-game replacement or room departure, **Then** subsequent final send authorizations exclude that scope.
3. **Given** finite solo tracking or guest authorization, **When** it expires with the browser closed, **Then** notification eligibility ends without requiring the browser to reopen.
4. **Given** a signed-in player, **When** they sign out or switch accounts, **Then** local sign-out can complete while notification revocation is pending. After DONG's notification server acknowledges the stop, no later final send authorization succeeds for the previous enrollment. An already authorized attempt can still arrive. A different account must opt in and bind its own active game.
5. **Given** the existing common-match notification preference is off, **When** that match has a goal, **Then** no push is dispatched for it; other eligible matches remain governed by the separate push opt-in.
6. **Given** two players in the same room choose different match scopes, **When** a provider-backed match that neither is assigned to and that is not the common match has a goal, **Then** only the player following every room match is eligible for the alert.
7. **Given** a player follows assigned matches, **When** their assignment or chosen scope changes, **Then** subsequent alerts follow the acknowledged scope without replaying earlier goals.
8. **Given** a player followed every room match in a previous session, **When** they enter a new multiplayer session, **Then** their scope defaults to assigned matches plus the common match.

---

### User Story 3 - Open an alert and trust its meaning (Priority: P3)

A player opens an alert to return to its game, with clear handling when the game ended or access expired.

**Why this priority**: An alert should provide a useful route back without exposing another game or resurrecting an old session.

**Independent Test**: Open alerts for current and expired games; replay a goal through retries, enrichment and multiple tabs.

**Acceptance Scenarios**:

1. **Given** valid access to the alert's game, **When** the alert is opened, **Then** DONG opens or focuses that game and makes the relevant match identifiable.
2. **Given** an ended game or expired access, **When** the alert is opened, **Then** DONG shows an appropriate message without exposing protected room details or replacing the current game.
3. **Given** a goal encountered through retries, room replay, another tab or richer details, **When** processed again, **Then** DONG keeps one logical alert for that browser and occurrence. Any retry uses the same delivery identity and notification tag. Device presentation is verified separately.

### Edge Cases

- An unchanged score, initial snapshot, manual score edit or historical import is not a new provider goal.
- A downward correction or retraction does not produce a goal alert. Cancel unsent alerts for retracted goals; already displayed alerts cannot reliably be recalled. Separate correction alerts are outside v1.
- A score increase without reliable individual goal detail produces one truthful score-update alert for the accepted change. Do not invent scorers, times or a complete sequence; later enrichment must not repeat it.
- Multiple established goals may be summarized in one alert with the new score. Penalty shootout changes do not count as normal goals in v1.
- Several rooms or tabs referencing a match must not multiply alerts on one browser subscription. Separate opted-in browsers may each receive it once.
- Offline devices, expired subscriptions, revoked permission and delivery failures must not prevent score acceptance or gameplay.
- Alert dispatch eligibility expires five minutes after DONG accepts the evidence; the delivery service's retention must be limited to the remaining window. This is not an absolute display-time guarantee once handed off. Uncertain older changes must be described as score updates.
- A change committed before final send authorization prevents newly ineligible sends. If a stop follows that authorization, handoff or presentation can still occur. If the stop cannot reach the server, show “Notification stop pending” and retry when DONG next opens or regains connectivity while open. A browser-side unsubscribe can be attempted but does not acknowledge the server stop. Honor the browser's visible-notification requirement for delivered pushes.
- Closing a solo tab cannot report an uncommunicated local game ending. Its last acknowledged selection remains eligible only until finite expiry or an accepted stop/change.
- Browser shutdown, operating-system settings, battery restrictions and connectivity may delay or prevent delivery. Closing a DONG tab must not itself end eligibility.
- iPhone tab and Home Screen contexts may have different login/game state. Installation is not proof of game transfer; separate installed copies can also have separate subscriptions.
- Permission may be revoked outside DONG, including browser automatic revocation. A stored opt-in or a successful send does not prove current delivery readiness or visible/audible alerts.
- Unsupported action buttons, vibration, custom sound or images must not prevent the basic fixture/score message and normal tap-to-open journey from working.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Provide explicit per-browser push opt-in and opt-out. Existing sound/common-match defaults MUST NOT count as consent to system notifications.
- **FR-002**: Request browser permission only after an intentional enable action. Distinguish registered, enabled for this game, disabled, denied, installation-required, unavailable, unsupported and setup-failed states with accessible controls and useful recovery guidance. Registration MUST NOT claim delivery is guaranteed or that device-level notification settings have been verified.
- **FR-003**: Cover provider-backed matches in the browser's active solo game. In the active multiplayer game, each authorized host or guest MUST be able to choose all provider-backed room matches with fresh accepted score evidence (including unassigned matches) or their current assigned matches plus the common match. All-room scope uses existing score coverage and adds no provider requests. The setting is personal to that player and game session. Every new session defaults to assigned matches plus the common match. The common-match preference applies to both choices. Scope changes MUST NOT alter other players' settings or replay earlier goals. Individually followed teams, unrelated matches and manual score changes are excluded.
- **FR-004**: Identify fixture and accepted score, and the scoring team when established. Omit unknown player or occurrence details.
- **FR-005**: Base eligibility and alert creation on accepted shared match evidence and validated game association, independently of an open tab. Successful in-game opt-in binds the browser to the authorized active game and establishes its score baseline before showing it as enabled for that game. Client claims MUST NOT authorize arbitrary room access or notification recipients.
- **FR-006**: Suppress retrospective alerts from baselines and changes predating activation/selection. Reprocessing an accepted change MUST NOT create another logical alert for the same browser.
- **FR-007**: Distinguish new goals, score-only updates, corrections and enrichment as specified in Edge Cases; suppress pending alerts invalidated by newer accepted evidence.
- **FR-008**: Use bounded retries, logical deduplication across retries/tabs and five-minute dispatch expiry after acceptance. Limit delivery-service retention to the remaining window, rather than restarting it on retry. Notification failures MUST NOT roll back goals, block room processing or trigger extra provider polling. Do not promise exactly-once transport delivery or absolute display-time expiry. After applying the transit margin, skip a send if its remaining TTL rounds down to zero.
- **FR-009**: Recheck consent, the player's acknowledged session scope and current assignments where applicable, participation and expiry before dispatch. An acknowledged stop MUST prevent any later final send authorization for the affected scope. A send with final authorization before the stop may still be handed off or displayed. Keep one pending stop per installation for the old enrollment generation, using the existing installation control credential independently of the account session. A stale retry MUST NOT revoke a newer enrollment.
- **FR-010**: Cease attempts for provider-confirmed invalid or expired endpoints. If browser permission and DONG consent still hold for the same authorized installation, offer subscription repair without resetting the player's choices. Retire the old endpoint, establish a fresh score baseline and prevent duplicate registrations. Transient errors and sender configuration errors MUST NOT clear player consent or invalidate the endpoint. A different account must opt in explicitly.
- **FR-011**: Include only fixture/score information and an opaque game reference in notifications. Exclude join codes, guest credentials, session tokens, player drinking details and delivery credentials.
- **FR-012**: Validate access when opening alerts. Opening MUST NOT implicitly join, restart, replace or mutate a game.
- **FR-013**: Preserve solo in-app goal feedback and existing sound and common-match preferences. A disabled common-match preference suppresses push for that match. Enabling it MUST NOT automatically enable push. The reported missing multiplayer toast and sound are a separate foreground bug to verify and fix before enabling multiplayer goal push.
- **FR-014**: Support the mobile browser scope above with capability-based setup guidance. Explain how to add and open the DONG website from the iPhone Home Screen, and provide a usable external-browser path for embedded browsers lacking push. Keep unsupported browsers playable. Use the same direct opt-in flow for eligible iPhone Home Screen and Android installations. The server enforces target policy, valid game authority and enrollment limits.
- **FR-015**: Native Android delivery is deferred at the user's request. Preserve gameplay and current feedback; native UI MUST NOT claim background push is enabled. Android browser use follows web capability rules.
- **FR-016**: Protect subscription ownership and delivery records from unrelated users/guests. Validate untrusted delivery destinations and limit registration abuse; clients MUST NOT gain general-purpose outbound messaging access.
- **FR-017**: Distinguish pending, attempted, accepted-by-delivery-service, failed, suppressed and expired outcomes in operational evidence. Service acceptance MUST NOT be reported as proof that a user saw an alert.
- **FR-018**: Remove expired game associations within 24 hours of expiry and revoked/invalid subscriptions within 24 hours of detection; retain attempt diagnostics for at most seven days. Cleanup MUST continue when sends are disabled and preserve existing game history and evidence needed by it.
- **FR-019**: Installation into a separate storage context MUST NOT silently lose, replace or invent an active game association. Explain sign-in/rejoin/recovery requirements; preserve the original context's data. Unrecoverable local-only game state MUST be disclosed before encouraging migration of an ongoing game.
- **FR-020**: Reconcile current permission and subscription with stored opt-in when DONG opens or returns to the foreground; expose repair for an expired or missing endpoint while permission and consent still hold. When DONG observes browser permission has been revoked or reset, clear DONG consent, stop eligibility and require a fresh opt-in after the player restores permission. Recovery MUST work from the page without relying on a background subscription-change event. Never automatically request denied permission.
- **FR-021**: The essential alert MUST remain understandable with plain title/body and a normal tap. Custom sound, vibration, images and action buttons MUST NOT be prerequisites, and system mute/Focus choices MUST be respected.
- **FR-022**: Dispatch an eligible system notification whether the game is visible, backgrounded or closed. Foreground visibility and in-game feedback MUST NOT suppress push. Each supported delivery path MUST honor its visible-notification rules. Do not use silent push as background polling. Validate duplicate handling without violating those rules.
- **FR-023**: Expose only automatic alerts for accepted goals. Do not include a manual send operation or test-only UI. Report enabled status only after the current game association is acknowledged, and provide browser permission recovery when needed.

### Key Entities

- **Browser Subscription**: One browser's delivery destination, protected credentials, consent and lifecycle status; separate from other devices' choices.
- **Game Notification Association**: Authorized subscription link to active solo play or a multiplayer participant, selected matches or personal multiplayer session scope, common-match preference and finite eligibility.
- **Accepted Match Change**: Established provider evidence identifying a goal, score update or correction, its revision and acceptance time.
- **Notification Delivery**: One logical alert per match change/browser, with bounded retry/expiry and recorded disposition.

### Platform, Identity and Data Impact

- **Web**: Adds consent, permission recovery, system alerts and opening alerts. Validate background behavior on supported browsers before release.
- **Native Android**: Explicitly deferred by the user. A follow-up specification and device validation are required before enabling native delivery.
- **Auth and guests**: Reuse account, room-guest and finite solo authorization. No new account requirement for solo/guest play; active-game association does not create general team following.
- **Shared state**: Consume accepted match changes without changing scores, assignments, drinking consequences or game history.
- **Migration/backfill**: Start new consent/delivery records empty. Do not convert existing preferences to consent or backfill historical alerts. Plan additive persistence, access controls, cleanup and rollback that disables delivery without deleting history.

### Required Test Strategy

- Unit coverage for permission states, eligibility, baseline suppression, identity changes, classification, duplicate suppression, expiry and retries.
- Persistence/authorization coverage for subscription ownership, host/guest/solo isolation, expiry and concurrent processing.
- Web end-to-end coverage for enable, denied permission, background/closed-tab delivery, opt-out and opening alerts, with controlled match changes and isolated data.
- Real-browser delivery checks in addition to mocked tests, recording unsupported configurations and provider-delay limits. Explore mobile browser journeys with Playwright and axe on the physical Android device where supported. Use ARTEMIS for Android notification-tray verification.
- Device coverage includes iPhone tab-to-install transition, storage isolation, Home Screen delivery when closed and Notification Center, Android Chrome, Firefox and Samsung Internet, embedded browsers, permission changes, offline recovery and opening alerts after expiry. Record iPhone evidence from production users as it becomes available. A separate lock-screen check is outside the required matrix.
- Native Android gameplay remains a regression concern; native push tests belong to its later release.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On each supported, configured browser under healthy network and unrestricted device settings, at least 95% of 20 eligible alerts measured under controlled conditions display within 30 seconds after DONG accepts new evidence, including visible-game and closed-tab tests. Report provider delay separately; record offline and battery-restricted results independently rather than promising this latency in all device states.
- **SC-002**: Across 100 controlled duplicate, retry and enrichment cases, DONG creates at most one logical delivery per eligible change per browser and zero baseline or historical-goal deliveries. Retries reuse the logical identity. Record observed device presentation and any duplicate displays separately, including after an uncertain handoff.
- **SC-003**: Controlled opt-out, departure, identity-change, match-scope change and expiry cases produce zero successful final send authorizations outside the eligible scope after the change is committed or the authority expires. Exercise a stop acknowledged before final authorization and one acknowledged after final authorization but before network handoff. Record the latter race separately.
- **SC-004**: Permission/setup cases expose accurate states; an eligible player can enable or disable within three DONG interactions each, excluding browser permission and settings dialogs. Returning to DONG after external revocation clears the enabled status and shows recovery guidance without an automatic permission prompt.
- **SC-005**: Isolation tests produce zero unauthorized deliveries and zero private game credentials or drinking details in notification content.
- **SC-006**: Controlled notification failures preserve all accepted scores/gameplay consequences; zero alerts are dispatched after their five-minute eligibility window, and retries never extend delivery-service retention beyond the remaining window. Record observed late-display races separately.
- **SC-007**: Every tested iPhone ordinary-tab and unsupported embedded-browser case shows an accurate next step without claiming push is enabled; installation tests preserve the original context's data and explain any missing session/game state.
- **SC-008**: On every supported browser, a user-triggered delivery test can be requested and its handoff outcome shown without representing it as confirmed display; essential content and tap behavior work without optional notification features.

## Assumptions

- The user confirmed background push and active-game matches. Either team's goals qualify when the match is within the player's notification scope and the common-match preference permits it.
- Existing accepted score changes and goal revisions support identity, but complete live provider detail is not guaranteed.
- Acquisition cadence/budgets stay unchanged. Current source defaults use roughly 60-second live refreshes; immediate notification measured from the real-world goal is not promised.
- Browser delivery is best effort, dependent on permission, connectivity and execution conditions. Fully shut-down browsers/devices are not guaranteed delivery.
- Finite solo tracking/guest authorization remain eligibility limits; opting in does not extend tracking/session lifetime.
- Five-minute expiry, seven-day diagnostics and per-browser consent are bounded initial defaults to validate during planning.
- Capacity must fit the existing free-tier constraint; quantify fan-out/storage during planning.
