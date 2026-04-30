# Feature Specification: Restore Centered Responsive Layouts

**Feature Branch**: `124-us14-migrate-core-screens-to-responsive-tamagui-layouts`  
**Created**: 2026-04-30  
**Status**: Draft  
**Input**: User description: "Create a spec for the screens that are no longer centered correctly and need a shared responsive layout fix."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Centered Home Experience (Priority: P1)

As a returning or new player, I can open Home and see the primary call to action, summary cards, and settings shortcut centered and balanced on both phone and desktop/web, so the screen feels intentional instead of shifted or crowded.

**Why this priority**: Home is the app entry point and the fastest place to notice a layout regression.

**Independent Test**: Open Home on phone-sized and wide viewports and confirm the main content stays centered without horizontal drift or clipping.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a phone-sized viewport, **When** I open Home with no active game, **Then** the start action and supporting controls remain visually centered and readable.
2. **Given** a wide desktop/web viewport, **When** I open Home with an active game, **Then** the game card and history card remain centered in the content area instead of stretching edge-to-edge.

---

### User Story 2 - Stable Setup Wizard (Priority: P2)

As a player creating a game, I can move through setup steps on phone and wide screens without the stepper, cards, or navigation controls drifting out of alignment, so the wizard remains easy to scan and use.

**Why this priority**: Setup is the core path that must stay clear and usable before gameplay can begin.

**Independent Test**: Walk through setup on phone and wide screens and check each step for consistent alignment.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a wide desktop/web viewport, **When** I move between setup steps, **Then** the step indicator, main panel, and navigation stay aligned within one stable centered frame.
2. **Given** a phone-sized viewport, **When** I add players and matches, **Then** the setup content stacks cleanly and no controls move off-center or outside the viewport.

---

### User Story 3 - Consistent Core Screens (Priority: P3)

As a player checking progress, history, or preferences, I can use those screens on both phone and wide layouts with centered content and aligned header or footer actions, so the app feels consistent across the main routes.

**Why this priority**: These screens are important, but they support the primary flow rather than starting it.

**Independent Test**: Open Game Progress, History, and Settings on phone and wide views and confirm primary content stays centered and controls align to the same visual axis.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a wide desktop/web viewport, **When** I open Game Progress or History, **Then** the main content remains centered and aligned with the same width rules used elsewhere.
2. **Given** a phone-sized viewport, **When** I open Settings, **Then** the header and scroll content remain readable and do not drift horizontally.

---

### Edge Cases

- Very wide screens should not keep expanding the main content forever.
- Very narrow phone screens should still show all primary actions without clipping.
- Empty states and long text labels should wrap or reflow without shifting the center axis.
- Rotating the device or resizing the browser should preserve the same centered alignment.
- Screens with active game cards, long player names, or long team names should not push buttons or cards off-center.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: Native phone layouts stay full-width; wide native and web layouts use the same centered content rules and readable line lengths.
- **Shared State Model**: No persistent data model changes are required.
- **Migration / Backfill**: None.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Add or update route-level responsive tests for Home and Settings, and keep the existing Setup, History, and Game Progress viewport assertions passing.
- **E2E Test Coverage**: Yes. The visual regression is user-facing and should be checked end-to-end on phone and desktop/web journeys for Home, Setup, Game Progress, History, and Settings.
- **Applicable Skills**: react-native-testing, systematic-debugging

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: On wide viewports, Home, Setup, Game Progress, History, and Settings MUST present their primary content in a centered layout with consistent visual margins on both sides.
- **FR-002**: On phone-sized viewports, the same screens MUST remain full-width and readable without horizontal overflow or off-center drift.
- **FR-003**: The setup flow MUST keep the step indicator, step content, and navigation controls aligned within one stable visual frame across all steps.
- **FR-004**: Shared cards and action controls used by the affected screens MUST align to the same center axis rather than relying on different per-screen offset values.
- **FR-005**: The centered layout MUST remain stable when the viewport changes size or orientation, without requiring the user to restart the screen.
- **FR-006**: Empty states, long labels, and active-game summaries MUST remain readable and visually centered within the intended content area.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In manual verification, all affected screens appear centered and balanced on both phone and wide viewports with no visible left/right drift.
- **SC-002**: On standard phone widths, primary content remains fully visible without horizontal scrolling for 100% of the targeted screens.
- **SC-003**: On wide desktop/web viewports, the main content region on each targeted screen remains within a consistent readable column and does not expand to the edges.
- **SC-004**: Responsive regression tests covering the targeted routes pass for both phone and wide viewport cases.
- **SC-005**: At least one manual pass through Home, Setup, Game Progress, History, and Settings confirms the centered layout remains correct after navigation and viewport changes.

## Assumptions

- The visual design language stays the same; only alignment, width constraints, and spacing needed to restore centering will change.
- The same width threshold can be used across the affected screens to decide when to center the content.
- No persisted game data, preference data, or gameplay rules will change as part of this work.
- The feature should behave consistently on native and web unless a platform-specific constraint prevents identical spacing.
