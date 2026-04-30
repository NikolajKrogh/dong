# Feature Specification: Responsive Core Screens

**Feature Branch**: `[124-us14-migrate-core-screens-to-responsive-tamagui-layouts]`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: User description: "Migrate core screens to responsive layouts for setup, gameplay, and history, preserving existing flows on mobile and web."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Responsive Setup Flow (Priority: P1)

As a user starting a new game, I want the setup flow to remain usable on narrow and wide screens so I can add players, select matches, assign matches, and start the game without layout issues.

**Why this priority**: Setup is the gateway to the main game flow, so it must stay readable and usable at every supported screen size before the other screens can be considered complete.

**Independent Test**: Open setup on a phone-sized viewport and a desktop web viewport; complete the wizard and confirm that the primary actions remain visible and usable at each size, including any screen-specific wide-layout arrangement.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** the setup flow on a narrow viewport, **When** a user adds players and matches, **Then** the form controls, progress steps, and primary actions remain visible and usable without clipping.
2. **Given** the setup flow on a wide viewport, **When** a user moves through the wizard, **Then** the screen may reorganize into a screen-specific multi-column or split-pane layout as long as the action order stays intact and the content avoids overlapping, clipping, or unreadable stretching.

---

### User Story 2 - Responsive Gameplay Screen (Priority: P2)

As a user in an active game, I want the gameplay screen to adapt to different screen sizes so I can review match state, switch views, and use quick actions comfortably on mobile and web.

**Why this priority**: Gameplay is the core ongoing screen during a session, so it needs to remain stable across device sizes after setup is complete.

**Independent Test**: Open an active game on a phone-sized viewport and a desktop web viewport, switch between the available views, and open the quick action and end-game controls to confirm they stay usable, including any screen-specific wide-layout arrangement.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** the gameplay screen on a narrow viewport, **When** a user switches between the available views, **Then** the content remains readable and the primary controls remain reachable.
2. **Given** the gameplay screen on a wide viewport, **When** a user opens quick actions or end-game controls, **Then** the screen may reorganize into a screen-specific multi-column or split-pane layout as long as the main content remains stable and the overlays remain centered, readable, and usable.

---

### User Story 3 - Responsive History Screen (Priority: P3)

As a user reviewing past games, I want the history screen to stay readable and navigable across screen sizes so I can browse sessions, player summaries, and statistics without layout regressions.

**Why this priority**: History is important for review but follows the setup and gameplay flows, so it can be completed after the core in-session experience.

**Independent Test**: Open history on a phone-sized viewport and a desktop web viewport, change tabs, sort the session list, and open a session detail view to confirm all interactions remain usable, including any screen-specific wide-layout arrangement.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** the history screen on a narrow viewport, **When** a user changes tabs or opens a session detail view, **Then** the content stays accessible and no controls are hidden off-screen.
2. **Given** the history screen on a wide viewport, **When** a user sorts and browses sessions, **Then** the screen may reorganize into a screen-specific multi-column or split-pane layout as long as the content remains readable and easy to navigate.

---

### Edge Cases

- The viewport is very narrow, such as split-screen or a compact browser window, and all primary actions still need to remain reachable.
- The viewport changes size while a modal or detail view is open, and the current interaction must remain usable.
- Long player names, team names, or history entries wrap over multiple lines and should not break the layout.
- Empty and near-empty states still need to look intentional on phone-sized and wide desktop widths.
- Wide desktop layouts should not stretch cards, lists, or tabs so far that scanning becomes difficult.
- Screen-local child components and modals used by the core screens should continue to behave responsively when their layouts need to change with the parent screen.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: Native and web must both adapt the same screen flows to viewport size, with layouts remaining functional at narrow phone widths and wide desktop web widths. Wide desktop layouts may reorganize into screen-specific multi-column or split-pane arrangements where that improves readability, and tablet-sized widths follow the same wide-screen behavior as desktop.
- **Shared State Model**: The existing application state remains the source of truth for setup progress, active game state, and history content; this feature changes presentation only.
- **Identity Model**: No authenticated roles or user identity changes are introduced.
- **Migration / Backfill**: No data migration or backfill is required; existing saved preferences, game state, and history remain valid.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Add regression coverage for the responsive layout behavior of the setup, gameplay, and history screens, including phone-sized and desktop-wide viewport checks, preserved interaction paths, screen-local child components or modals that affect layout, and empty-state rendering.
- **E2E Test Coverage**: Required. Add web end-to-end coverage for the setup, gameplay, and history journeys across a phone-sized viewport and a desktop web viewport to catch overflow, clipping, and modal usability regressions. The browser harness must set those viewport sizes explicitly.
- **Applicable Skills**: `react-doctor`, `react-native-testing`

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST present the setup flow in a layout that remains usable on narrow phone screens and wide desktop web screens.
- **FR-002**: System MUST present the gameplay screen in a layout that preserves access to match review, player review, and action controls across the supported phone and desktop web viewport classes.
- **FR-003**: System MUST present the history screen in a layout that preserves access to session browsing, sorting, tab switching, and detail views across the supported phone and desktop web viewport classes.
- **FR-004**: System MUST adapt screen spacing, alignment, and content width across each core screen and any screen-local child component or modal that affects layout so that primary controls remain visible and readable at the supported viewport classes.
- **FR-005**: System MUST prevent responsive layout changes from breaking the existing setup, gameplay, and history navigation flows.
- **FR-006**: System MUST preserve current screen behavior when the viewport changes during use, including when a modal or detail view is open.
- **FR-007**: System MUST keep existing stored game and preference data valid and unchanged during the layout migration.
- **FR-008**: Users MUST be able to complete the primary setup, gameplay, and history tasks without encountering clipping, overlap, or blocked interactions at the supported phone and desktop web viewport classes.

### Key Entities _(include if feature involves data)_

- **Screen Layout Profile**: The responsive arrangement rules that determine how each core screen uses the available viewport width.
- **Setup Flow State**: The visible state of the setup journey, including player entry, match entry, assignment, and start controls.
- **Gameplay View State**: The active in-session view, including match review, player review, quick actions, and end-game controls.
- **History View State**: The browsing and detail state for prior games, including tabs, sorting, and session detail views.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In validation across supported phone-sized and desktop-wide viewport classes, 100% of the setup, gameplay, and history screens open without runtime errors or visibly broken layouts.
- **SC-002**: In scripted end-to-end checks, users can complete the core setup, gameplay, and history journeys successfully on web at both phone-sized and desktop-wide viewport sizes.
- **SC-003**: 100% of reviewed responsive variants keep primary actions visible and reachable, with no severity-1 clipping or overlap issues found in the migrated screens.
- **SC-004**: Existing game and history data remains intact in 100% of upgrade smoke tests after the responsive layout changes are applied.

## Assumptions

- The feature is limited to layout and responsiveness changes, not a redesign of gameplay rules or stored data.
- The existing screen flows remain the source of truth for what each screen must support.
- Wide desktop layouts may use additional horizontal space, but they must preserve the same underlying actions and navigation paths.
- Existing persistent game, preference, and history data does not require migration.
