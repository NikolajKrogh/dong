# Feature Specification: Predictable navigation and usable mobile web

**Feature Branch**: `web-navigation`
**Feature Directory**: `specs/029-web-android-ux`
**Created**: 2026-10-17
**Status**: Specified; implementation not started
**Input**: Improve the audited DONG journeys on web and Expo Android. Generate a common specification, plan and bounded subagent tasks before implementing or creating worktrees.

## Context and scope

The [mobile web audit](../../docs/mobile-web-ux-audit-2026-10-16.md) and [navigation audit](../../docs/navigation-audit-2026-10-16.md) record inconsistent Back behavior, lost task position, game-mode changes during navigation, inaccessible controls, compact-screen overlap and hidden destinations. Their evidence distinctions remain authoritative: source-only risks are not runtime-confirmed failures; a general scroll trap is not yet proven.

Six independently testable stories fit within the five proposed delivery changes. Web and Android share outcomes; web additionally requires meaningful addresses and refresh/Back/Forward behavior. Native iOS release work is excluded; mobile website responsiveness is not restricted to Android browsers.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preserve the current game during configuration navigation (Priority: P1)

As a player, I can inspect configuration or room status without changing game mode or leaving its membership.

**Why this priority**: Source shows Setup clearing multiplayer context and entering solo setup.
**Independent Test**: Enter configuration/status from solo, registered host/member and guest gameplay; confirm unchanged game identity/membership and existing edit permissions.

**Acceptance Scenarios**:

1. **Given** a solo game, **When** I choose Setup, **Then** its existing configuration and local game data remain available.
2. **Given** a registered multiplayer game, **When** I choose room/configuration, **Then** the current room opens without becoming solo; host/member editing follows existing role and phase rules.
3. **Given** guest gameplay, **When** I inspect configuration/status, **Then** a permitted guest status view or explicit explanation opens, never a registered-only dead end or solo conversion.
4. **Given** loading, expired, ended or inaccessible session state, **When** I request configuration, **Then** the appropriate state and a safe exit appear without fabricating a game.

### User Story 2 - Dismiss overlays and return to the actual caller (Priority: P1)

As a player, Back dismisses what I opened, child-page arrows restore their caller, and Home leaves the view without ending participation.

**Why this priority**: Back leaves gameplay behind a sheet; Friends header return creates duplicate parents.
**Independent Test**: Game actions → Back retains gameplay; Requests → Search → header Back restores Requests; another Back leaves Friends; lobby Home retains re-entry.

**Acceptance Scenarios**:

1. **Given** Game actions, History sort/details or default-league selection is open, **When** I press browser/system Back, **Then** only the top task overlay closes and the underlying selection remains. Close/Escape provide equivalent dismissal where applicable.
2. **Given** an Android keyboard over a focused overlay field, **When** system Back dismisses the keyboard, **Then** it does not also leave the task.
3. **Given** Requests → Search/Blocked accounts, **When** I use header Back, **Then** the existing caller/tab is restored; another Back does not reveal a duplicate Friends screen. Retaining text must not resend commands.
4. **Given** active gameplay/lobby, **When** I choose an explicit Home action and resume three times, **Then** the same session remains available without a leave/end mutation or accumulating duplicate task screens.
5. **Given** direct History/Friends/gameplay entry with absent history, missing data or required sign-in, **When** loading settles, **Then** an explanation and working Home/parent or Sign in action are available. Successful authentication returns to the permitted intended destination.
6. **Given** a stale or unauthorized target, **When** I open its link, **Then** private cached content stays hidden and safe recovery is offered.

### User Story 3 - Keep my task position (Priority: P2)

As a web user, I can restore setup and History position through refresh and browser navigation; Android retains a coherent task/step Back sequence.

**Why this priority**: The current UI retains some data while losing the user's place.
**Independent Test**: Advance valid setup steps and History tab/comparison/detail/sort, refresh and use Back/Forward; repeat with invalid prerequisites/targets.

**Acceptance Scenarios**:

1. **Given** valid prerequisites, **When** setup advances and I refresh or use Back/Forward, **Then** the requested valid step/data restore without adding pending player input twice.
2. **Given** a direct later-step request without prerequisites, **When** hydration completes, **Then** the earliest unmet step and an explanation appear. Loading is not mistaken for missing data.
3. **Given** History tab/comparison/completed-game identity/sort choices, **When** I refresh or return, **Then** permitted meaningful choices restore; Back closes details before leaving the list.
4. **Given** malformed/obsolete parameters or removed data, **When** the route resolves, **Then** it normalizes to a documented safe state without loops or an inaccessible modal.
5. **Given** sign-out/account change/revoked friendship, **When** a previous target remains in the address, **Then** current authorization controls results and stale private data stays hidden.

### User Story 4 - Use controls through keyboard and assistive technology (Priority: P1)

As a keyboard, screen-reader or autofill user, I can identify, reach and operate primary controls and account fields.

**Why this priority**: Shared primary actions lack web control semantics and focus.
**Independent Test**: Navigate Home → setup by keyboard; inspect names/roles/current state/forms/errors; repeat essential Android controls with TalkBack.

**Acceptance Scenarios**:

1. **Given** primary controls, **When** I navigate/activate them, **Then** roles, names, focus, activation and disabled states are correct; destinations support ordinary web link actions.
2. **Given** compact steps or icon-only Back/remove/password controls, **When** focused or announced, **Then** the action/target and current step are understandable without deciphering glyphs.
3. **Given** account fields, **When** I use labels/autofill/keyboard submit, **Then** their names and purposes are explicit; password visibility and existing submit behavior still work.
4. **Given** failed submission, **When** feedback appears, **Then** the error is visible/announced and field-specific errors are associated. Unrelated background changes do not steal focus or announce hidden goal feedback.
5. **Given** an affected web screen, **When** I navigate document structure, **Then** meaningful headings, a main landmark and descriptive page title identify the screen.

### User Story 5 - Read and reach mobile content (Priority: P2)

As a phone user, I can read labels and reach required content/actions with limited width, keyboard, browser bars, larger text and web landscape.

**Why this priority**: Schedule overlap and step overflow are confirmed; competing scrolling needs populated-state investigation.
**Independent Test**: Inspect setup, populated History/Friends, forms and dialogs at compact/reduced-height sizes; reach each last relevant action by its intended scroll path.

**Acceptance Scenarios**:

1. **Given** 320, 360 and 390 CSS-pixel web widths, **When** badges/steps render, **Then** meaningful titles/controls fit without overlap or page-wide horizontal overflow; shortened labels have an understandable accessible equivalent.
2. **Given** web landscape at 640×360 or text enlarged to 200%, **When** I traverse affected screens, **Then** every primary input/error/Close/submit/navigation control is visible or reachable through the intended scroll owner.
3. **Given** populated ordinary web content, **When** I swipe over lists and their boundaries, **Then** the rest of the page remains practically reachable. Intentional bounded dialogs may scroll independently with accessible dismissal/actions.
4. **Given** Android portrait with keyboard/increased system font size, **When** I edit a relevant field, **Then** value, errors and completion/exit controls remain reachable without shrinking touch controls.
5. **Given** reduced-motion preference, **When** affected transitions occur, **Then** nonessential motion is reduced and state remains clear; native list behavior/performance is retained.

### User Story 6 - Find Friends and History on Home (Priority: P2)

As a user, I can find social/history destinations without discovering them inside profile editing.

**Why this priority**: Friends is buried behind Settings, profile editing and scrolling.
**Independent Test**: Activate labeled Friends/History shortcuts from settled Home; verify signed-in and signed-out outcomes.

**Acceptance Scenarios**:

1. **Given** signed-in Home, **When** navigation appears, **Then** labeled Friends and History shortcuts use the existing layout, each reaching its destination in one activation. Reconcile existing Game Stats so History has no competing duplicate destination.
2. **Given** signed-out Home, **When** I open Friends, **Then** sign-in recovery preserves the intended destination; History retains its existing local/signed-out capabilities.
3. **Given** populated compact Home, **When** game/stats content grows, **Then** shortcuts remain clearly labeled and reachable by page scrolling; all Home content need not fit above the fold.

### Edge Cases

- Fresh-tab versus external browser history: in-app parent fallback works; browser Back must still allow leaving DONG.
- Nested overlays, repeated close/Back, Forward, unmount and refresh: no stale listener, double navigation or synthetic-entry leak.
- Lobby polling changes prerequisites during editing: validate explicit transitions/restoration, not continually force users backward.
- Guest grant expiry, ended room, host change, denied edits: retain existing authorization/recovery.
- Unknown/repeated query values, unavailable detail IDs, self/friend selection, account change and revoked access: normalize without leaking private data.
- Long names, large lists, empty/loading/error states, keyboard and browser resizing: separate ordinary off-screen content from permanent clipping.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Configuration navigation MUST preserve game identity/membership and host/member/guest phase permissions. (US1)
- **FR-002**: Configuration/status entry MUST explain loading/expired/unavailable state and supply safe recovery without manufacturing a game. (US1)
- **FR-003**: Back MUST dismiss the top task overlay before its screen; Close/Escape/keyboard/repeated actions MUST not double-navigate. (US2)
- **FR-004**: Child return MUST restore caller context without duplicate parents. (US2)
- **FR-005**: Gameplay/lobby MUST offer safe Home navigation; three Home/resume cycles MUST preserve session and avoid duplicate task pages. (US2)
- **FR-006**: Missing-data/auth direct entry MUST explain recovery with working fallback and permitted post-sign-in return. (US2)
- **FR-007**: Valid setup position MUST restore through web refresh/Back/Forward, preserving prerequisites and at-most-once pending input; Android step Back MUST be coherent. (US3)
- **FR-008**: History tab/comparison/sort/completed-game identity MUST restore through web refresh/navigation without private result payloads in addresses. (US3)
- **FR-009**: Invalid route choices MUST normalize after hydration without loops; account/permission changes MUST invalidate unauthorized content. (US2, US3)
- **FR-010**: Primary controls MUST provide correct semantics, keyboard activation/focus and disabled behavior; destinations MUST support normal web link actions. (US4)
- **FR-011**: Icons/steps MUST have meaningful names and relevant current/selected state on web/Android. (US4)
- **FR-012**: Account fields MUST have associated names and explicit autofill purposes, preserving visibility and keyboard submission. (US4)
- **FR-013**: Submission errors MUST be announced/associated; unrelated updates MUST not steal focus or announce hidden game feedback. (US4)
- **FR-014**: Affected web screens MUST expose main content, meaningful headings and page titles. (US4)
- **FR-015**: Compact setup headings/badges/steps MUST fit the declared widths/text sizes without overlap or horizontal page overflow. (US5)
- **FR-016**: Required inputs/errors/completion/exit controls MUST remain reachable under keyboard/browser bars/enlarged text/web landscape. (US5)
- **FR-017**: Ordinary mobile web content MUST have an understandable main scroll path; correct proven competing-scroll defects while retaining useful bounded dialogs/native virtualization. (US5)
- **FR-018**: Affected nonessential animations MUST honor reduced-motion preferences. (US5)
- **FR-019**: Home MUST expose labeled Friends/History in its current layout, appropriate signed-out behavior and no competing History destination. (US6)
- **FR-020**: View changes MUST preserve shared-state authorization, immutable history and account/guest isolation; changing screens alone MUST NOT issue leave/end/scoring/friendship commands. (All)

### Platform, auth, shared-state and migration impact

Web adds meaningful addresses, browser navigation/refresh, keyboard and document semantics. Android retains portrait/native-list behavior with hardware Back, software keyboard and TalkBack acceptance. Native iOS release work is excluded; mobile web must remain responsive regardless of phone OS.

Reuse existing sign-in/username onboarding, member and guest permissions. Navigation observes existing server game state; it does not redefine game rules. No schema, backend endpoint, backfill or additional persistence store is expected. If implementation discovers a backend change is needed, revise the plan before widening scope.

### Required automated coverage

Every story requires unit/component tests for new behavior. Substantial UI changes require primary Playwright BDD journeys and executable Android journey coverage using a supported runner and device-verified interactions. Explore through ARTEMIS before writing Android interaction tests. Browser mocks do not establish physical Android or hosted authorization acceptance; unavailable runtime gates remain incomplete.

### Key Entities

- **Task position**: destination/step/tab/target/sort/detail identity, validated against prerequisites and authorization.
- **Return context**: existing caller and relevant selection, or safe fallback with no caller.
- **Task overlay**: topmost dismissible view plus underlying task position and close lifecycle.
- **Game/session context**: existing solo data or room identity/phase/role; navigation observes rather than redefines it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All configuration scenarios retain game identity/membership, with zero unintended mutations. (US1)
- **SC-002**: Every scoped overlay dismisses on first relevant Back; child returns and three Home/resume cycles produce zero duplicate screens on web/Android. (US2)
- **SC-003**: All valid setup/History destinations restore; invalid/unavailable ones end in an explained safe state. (US3)
- **SC-004**: All affected primary controls are keyboard-operable/named; audited forms/headings/errors pass declared web/Android accessibility checks. (US4)
- **SC-005**: The declared width/height/text/keyboard matrix has zero overlapping primary labels, unreachable required controls or page-wide horizontal overflow; every populated scroll case reaches its last relevant action. (US5)
- **SC-006**: Signed-in Home opens Friends/History in one activation; signed-out Friends offers sign-in and returns to the permitted destination. (US6)
- **SC-007**: Every accepted story has automated coverage and separately recorded web/Android runtime evidence; mocked tests are never reported as live acceptance. (All)

## Assumptions

- Five delivery changes remain useful; the six stories are acceptance units, not necessarily six branches.
- No visual rebrand, persistent navigation bar, new offline synchronization architecture, backend redesign or native iOS release.
- Sort choice is meaningful view state; an open sort panel is transient. Detail links resolve only data available to the current account/device.
- General scroll-trap discovery is required; retaining a bounded scroller is valid if evidence supports it.
- No expansion of currently permitted in-progress room editing.
- Terms document/link (W07) is a separate follow-up; no legal content/acceptance behavior is invented.

## Clarifications

### Session 2026-10-17

- Q: Home shortcuts or persistent navigation? → A: Home shortcuts using the existing layout.
- Q: Include terms content/link or defer? → A: Defer the terms document/link to a separate follow-up.

## Audit traceability

| Findings | Story | Disposition |
| --- | --- | --- |
| N01 | US1 | Preserve game mode/context |
| N03–N07, N09 | US2 | Overlay/return/recovery/safe exit |
| W04, N02 | US3 | Meaningful position and history |
| W01, W05, W06, W08, W09 | US4 | Controls/forms/headings/feedback |
| W02, W03; scroll/keyboard/motion investigations | US5 | Geometry plus evidence-led investigation |
| N08 | US6 | Labeled Home shortcuts |
| W07 | Separate follow-up | Explicitly deferred by user |
