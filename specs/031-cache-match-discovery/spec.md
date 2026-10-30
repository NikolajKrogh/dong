# Feature Specification: Responsive Match Discovery with Reusable Results

**Feature Branch**: `codex/cache-match-discovery`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Improve match discovery with reusable league/date results, selected-league fetching, batched missing or stale results, and immediate display while pending leagues refresh. Fit this into the existing application and preserve shared score-request savings. Deliver the client-side phase first; defer longer shared-backend freshness periods."

## Clarifications

### Session 2026-10-30

- Q: Should fixture discovery refresh automatically after all selected leagues have finished loading? → A: Refresh stale results on picker reopen, date/league changes, return to the foreground, or manual Retry; do not periodically refresh completed results while the picker remains visible. Pending results retain bounded follow-up checks.
- Q: When a league remains pending, how long should automatic follow-up checks continue? → A: Make at most two additional checks after the initial check, respecting the server's retry delay; then retain available fixtures and show a pending message with Retry.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find selected fixtures without unrelated waiting (Priority: P1)

A person setting up a solo game, configuring a hosted room, or editing a running game's selections chooses a date and a few leagues. Each usable result appears without waiting for other leagues. All configured league choices remain available even when their fixtures have not been loaded.

**Why this priority**: Unrelated discovery work and withholding available fixtures cause unnecessary waiting in the core match-selection journey.

**Independent Test**: Select two leagues from seven configured choices and make one respond first. Its fixtures must be usable while the second is pending; the other five must remain selectable without being requested by the picker.

**Acceptance Scenarios**:

1. **Given** seven configured leagues and two selected leagues, **When** the picker opens for a date, **Then** discovery work initiated by the picker targets only those two leagues and all seven choices remain selectable.
2. **Given** one selected league has returned fixtures and another is pending, **When** the first result becomes available, **Then** its fixtures can be selected immediately, the pending league is identified, and the entire picker does not wait for a retry interval.
3. **Given** a date and selected leagues, **When** only the start or end time changes, **Then** the displayed matches update from the day's available results without new discovery requests.
4. **Given** no selected leagues, **When** the picker opens or the last league is deselected, **Then** no discovery work is initiated and the picker explains that a league must be selected.
5. **Given** initial discovery is loading, **When** loading feedback appears, **Then** it uses the existing jumping-football artwork instead of the visible "Loading matches and teams" caption; people requesting reduced motion receive a static equivalent and assistive technologies receive a meaningful loading status.

---

### User Story 2 - Reuse fixtures when returning or adjusting selections (Priority: P1)

A person returns to a viewed date or adds another league. Previously retrieved results are reused per league and date; only missing or outdated selected results need refreshing.

**Why this priority**: Repeated navigation should feel immediate and avoid repeating equivalent discovery work.

**Independent Test**: Open a date for leagues A/B, navigate away and return, then add C. Fresh A/B results must require no additional request and only C needs new discovery work.

**Acceptance Scenarios**:

1. **Given** fresh retained results, **When** the person reopens the same date and leagues during their retention period, **Then** results appear without a blocking loading state or another discovery request.
2. **Given** fresh A/B results, **When** C is added, **Then** A/B remain usable while only C is loaded; removing and re-adding fresh B does not reload it.
3. **Given** multiple selected leagues need loading together, **When** discovery begins, **Then** they are requested together within existing request limits rather than mandating a separate request per league.
4. **Given** a league/date is already loading, **When** another consumer needs it, **Then** both reuse that ongoing work rather than initiating duplicate equivalent work.
5. **Given** results for date A, **When** the person chooses date B, **Then** only results belonging to B are presented as matching the current selection.

---

### User Story 3 - Continue selecting during refresh or failure (Priority: P2)

A person can use retained fixtures while newer information is checked, distinguish checked empty schedules from unfinished checks, and retry without losing selected matches.

**Why this priority**: Old or incomplete information must not create false confidence, a false empty schedule, or an unusable picker.

**Independent Test**: Load fixtures, let freshness expire, then simulate a slow refresh and failure. Retained results must remain usable with accurate status, and a successful retry must not clear the game selection.

**Acceptance Scenarios**:

1. **Given** outdated retained results, **When** the picker reopens, **Then** they appear with an updating or outdated status while refreshed results are requested in the background.
2. **Given** one successfully checked empty schedule and another pending or failed league check, **When** results appear, **Then** only the successfully checked league is described as having no fixtures.
3. **Given** a response returns saved information without a new successful source check, **When** it is reused, **Then** the information does not gain a new freshness period solely because the response just arrived.
4. **Given** pending results with retry guidance, **When** the picker remains active, **Then** at most two additional checks after the initial check respect the supplied delay and update pending leagues without blocking available fixtures; if still pending afterward, available fixtures remain usable and a pending message with Retry is shown.
5. **Given** a refresh failure or lost connectivity, **When** retained results exist, **Then** they remain visible with an accurate warning and retry action; without retained results, an error or offline state appears instead of an empty-schedule claim.
6. **Given** a fixture already selected for a game, **When** filters change, a refresh fails, or refreshed discovery omits it, **Then** the existing selection is preserved and existing eligibility checks still apply when saving or starting the game.
7. **Given** all selected leagues have finished loading, **When** their results become stale while the picker remains visible, **Then** no periodic discovery refresh starts; reopening the picker, changing date/leagues, returning to the foreground, or manual Retry rechecks freshness and refreshes stale selected results.

---

### User Story 4 - Safely change screens and filters on web and Android (Priority: P2)

A person can quickly change dates or leagues, leave the picker, and return without old responses overwriting the current selection or hidden screens polling indefinitely. Both supported platforms follow the same rules.

**Why this priority**: Faster loading must remain correct during navigation, concurrent use, and foreground changes.

**Independent Test**: Delay results while switching dates and leagues, leave one of two consumers, and background the application. Verify current-selection accuracy, completion for the remaining consumer, and suspension of unnecessary follow-ups.

**Acceptance Scenarios**:

1. **Given** a slow request for A, **When** the person selects B and A arrives later, **Then** A cannot replace B's displayed results or status.
2. **Given** two consumers sharing a request, **When** one leaves, **Then** the remaining consumer can still receive its result.
3. **Given** no active consumer needs pending results or the application is no longer interactive, **When** another follow-up would occur, **Then** unnecessary follow-ups stop; returning to an active picker rechecks freshness before resuming.
4. **Given** identical controlled fixtures and interactions on web and Android, **When** discovery is used, **Then** demand scope, reuse, partial-result visibility, and failure handling have equivalent outcomes.

### Edge Cases

- Empty selections, duplicate league codes, and reordered selections must not produce unnecessary or duplicate work.
- A checked empty schedule is reusable while fresh; partial, pending, and failed results must not become complete empty schedules.
- Mixed responses retain separate freshness and availability for each league.
- Midnight rollover and daylight-saving transitions must not reuse results under the wrong discovery date or alter existing date/time interpretation.
- Manual retry during equivalent ongoing work must not duplicate it or bypass a supplied retry delay.
- Two additional automatic checks are the limit for a league/date loading cycle. A newly attached consumer must share the ongoing cycle rather than reset its allowance. Once that cycle ends pending, an explicit manual Retry may start a new cycle after any applicable retry delay.
- Configured-league changes must update chooser options without deleting game selections or allowing old responses to restore removed options.
- Reopening after retention ends or the application restarts may require loading again; it must not imply prior in-memory results still exist.
- Signing in or out must not cause private room data or tracking credentials to become reusable public fixture information.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every existing match-picker entry point MUST use the currently selected leagues and discovery date to determine demand; configured but unselected leagues MUST NOT be loaded speculatively by this feature. See Story 1 scenarios 1 and 4.
- **FR-002**: Reusable results MUST be identified separately by league and discovery date; changing only the display time window MUST NOT trigger discovery. See Story 1 scenario 3 and Story 2 scenario 5.
- **FR-003**: Fresh results MUST be reused across picker navigation and consumers during their retention period without an equivalent new request. See Story 2 scenarios 1, 2, and 4.
- **FR-004**: Missing or stale selected results MUST retain the ability to be loaded together within established request-size limits, and simultaneous equivalent demand MUST share ongoing work. See Story 2 scenarios 3 and 4.
- **FR-005**: Available selected results MUST become usable before other selected leagues finish, without a blocking follow-up delay. See Story 1 scenario 2.
- **FR-006**: Retained results MUST remain usable during refresh or failure with clear current, outdated, incomplete, and failure states. See Story 3 scenarios 1 and 5.
- **FR-007**: Client fixture reuse MUST be limited to complete league/date results that the server did not mark stale and whose last successful provider check is less than 60 seconds old. Receiving old information again MUST NOT restart that period. Expiring this reuse deadline permits another check; it MUST NOT itself display an outdated warning for a complete result the server still considers fresh. Server-stale results and missing, invalid or future source-check timing remain outdated. This client policy MUST NOT claim exact live-score freshness or replace authoritative save/start checks. Checked empty schedules MUST remain distinct from pending, failed, and partial checks. See Story 3 scenarios 2 and 3.
- **FR-008**: Each league/date loading cycle MUST make at most two automatic follow-up checks after its initial check, honoring each supplied retry delay. If still pending after those checks, it MUST stop automatic follow-ups and display a pending message with Retry while keeping available fixtures usable. Equivalent consumers MUST share the cycle and its allowance. Follow-ups MUST stop when no active consumer needs them or the application is no longer interactive. An explicit manual Retry may start a new cycle after any applicable retry delay, without duplicating ongoing work. See Story 3 scenario 4 and Story 4 scenario 3.
- **FR-009**: Late responses MUST NOT overwrite newer active selections, and detaching one consumer MUST NOT cancel work still required by another. See Story 4 scenarios 1 and 2.
- **FR-010**: The chooser MUST retain all configured eligible league options regardless of which results are loaded or selected. See Story 1 scenario 1.
- **FR-011**: Discovery reuse and refresh MUST preserve game selections, host/guest permissions, authoritative save/start checks, running-game scores, and existing shared provider-request limits. See Story 3 scenario 6 and the regression coverage below.
- **FR-012**: This phase MUST support web and Android without requiring new accounts, persistent fixture downloads, database schema changes, data backfills, or changes to shared-provider scheduling/freshness policies. See Story 4 scenario 4 and the scope assumptions.
- **FR-013**: Only public fixtures and discovery status may be shared across discovery consumers; room-specific data and tracking credentials MUST remain under existing access rules. See the privacy edge case and regression coverage below.
- **FR-014**: After selected leagues finish loading, discovery MUST refresh stale selected results only on picker reopen, date/league changes, return to the foreground, or manual Retry. Simply remaining on the screen MUST NOT initiate periodic refreshes. Bounded pending-result follow-ups remain permitted under FR-008. See Story 3 scenario 7.
- **FR-015**: Initial-loading feedback MUST use the existing jumping-football artwork in place of the visible "Loading matches and teams" caption, with a static reduced-motion equivalent and an accessible loading status. Loading feedback MUST NOT prevent use of already available fixtures. See Story 1 scenario 5.

### Required Coverage and Platform Impact

- Automated unit coverage is required for new reuse, batching, freshness, pending-result, retry, and lifecycle behavior, including the edge cases above.
- At least one automated end-to-end journey must cover reopening the picker, adding a league without reloading fresh leagues, and using available fixtures while another league remains pending. It must exercise an existing game-setup entry point.
- Web and Android acceptance evidence must identify the environment and confirm navigation, date/time filtering, background/foreground transitions, and preserved selections. Test scripts must follow the repository's required interactive application-exploration process before interactions are authored.
- Regression coverage must verify existing solo, room-configuration, and running-game selection behavior, permission checks, and unchanged live-score acquisition. Local fixtures, hosted endpoint checks, browser tests, and physical-device evidence must be reported separately.

### Key Entities *(include if feature involves data)*

- **Discovery Selection**: A discovery date and selected league identities. A display time window further narrows available fixtures locally.
- **League-Date Result**: Fixtures, completeness/availability, last successful source-check time, and retry guidance for one league/date. A checked empty schedule is a valid complete result.
- **Discovery Consumer**: An active picker requiring league/date results; consumers may share retained results and ongoing work.
- **Game Match Selection**: Fixtures chosen for a solo game or room, whose lifecycle and authority are independent of discovery-result retention.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In at least 95% of 20 controlled reopen trials per platform, fresh retained fixtures become visible and usable within 200 ms after the picker is ready to display, without another discovery request.
- **SC-002**: In controlled seven-configured/two-selected trials, 100% of discovery demand initiated by the picker targets the two selected leagues. Adding one uncached league requests only that additional league while fresh prior results remain usable.
- **SC-003**: In at least 95% of controlled mixed-speed trials per platform, a usable league result becomes selectable within 250 ms of becoming available to the picker, even when another league remains pending for at least 15 seconds.
- **SC-004**: Repeated time-window and league-order changes produce zero additional discovery requests while underlying results remain fresh; simultaneous consumers initiate at most one equivalent in-flight discovery operation per league/date.
- **SC-005**: All controlled late-response, partial-result, offline, and failed-refresh cases preserve the correct active date/league display and game selection. No pending or failed check is presented as a checked empty schedule.
- **SC-006**: A continuously pending league/date produces at most three checks per loading cycle (one initial check plus two automatic follow-ups), with no check before the supplied retry delay. After exhaustion, no automatic checks occur until explicit manual Retry starts a new cycle after any applicable cooldown; the pending message and Retry remain available. Closing all relevant pickers stops follow-ups, and a second consumer does not reset the allowance. The controlled two-consumer case completes for the remaining consumer after the other leaves.
- **SC-007**: With identical game demand and controlled source fixtures, enabling this feature introduces zero additional live-score provider requests, changes no permission outcomes, and produces no gameplay/history mutations during discovery-only journeys.
- **SC-008**: After all selected leagues finish loading, a controlled idle-picker trial lasting at least 120 seconds (two 60-second client fixture-reuse periods) produces zero automatic discovery requests. Each supported activity trigger refreshes stale selected results while reusing fresh selected results.

## Assumptions

- This is the client-side phase agreed in the preceding discussion. Longer shared-backend freshness periods are deferred; this phase requires no database migration or backend deployment.
- Existing discovery supplies league-specific source-check times, availability, stale-state information, and retry guidance. No new discovery contract is required.
- Reusable results initially live within the current application session. Restart persistence and persistent offline fixture storage are outside scope. Planning must select bounded retention without treating retention as permission to extend freshness.
- Existing provider budgets, request ownership, live-score cadence, and completed-match correction behavior remain authoritative.
- "Fresh" retained discovery means eligible for the 60-second client fixture-reuse policy in FR-007. It is not a guarantee of the catalog's current private acquisition deadline or live score. Later match-summary updates do not invalidate reuse solely because their timestamps differ from the league check; score and save/start authority remain on existing paths.
- Cold-load completion depends on the provider and shared work limits. The feature guarantees prompt display of available information, not an external-provider response-time guarantee.
- Existing discovery-date and local display-time semantics are retained; redefining cross-timezone date interpretation is separate work.
- Solo setup, hosted-room configuration, and running-game editing share discovery behavior wherever current permissions allow access; no new unauthenticated room access is introduced.
- Measurements use controlled data and explicit ready-to-display checkpoints on each platform. Passing those checks does not establish sustained production latency or adoption by older application builds.

## Validation exception — 2026-10-30

The user explicitly requested implementation with unit tests only: "I do not think e2e test is necessary here and unit tests should be enough." No new Playwright/BDD tests, end-to-end runs or per-platform timing-trial gate are required for this delivery. Use module, hook, component and existing compatibility unit tests plus typecheck/lint/build checks. UI latency targets remain unmeasured product targets, not reported passes. Existing device-exploration instructions apply to any preparatory observation; no device acceptance suite is introduced.

### Measurement definitions

For future platform timing trials, picker-ready means the first focused Matches commit after configuration/date/selected leagues are ready; actionable means the first committed fixture view with its selection action enabled. Partial-result timing starts when the validated one-check response is accepted by the discovery implementation, excluding provider waiting. Trials use 20 samples per platform and instrumented timestamps, not model step intervals. These runtime trials are not an implementation gate under the unit-only exception above. Existing pending cadence remains a minimum 15 seconds, honoring longer guidance; delays above 60 seconds stop automatic foreground continuation while preserving their full Retry cooldown.

Android exception — 2026-10-30: The user explicitly said "Do not test on an android device for now." No Android interaction/exploration or acceptance is required in this run. ARTEMIS diagnostics found no connected device and its emulator boot failed; no app interactions ran. Unit tests and local static/build checks are the delivery validation.
