# Feature Specification: Migrate Application Shell

**Feature Branch**: `[121-us13-install-tamagui-and-migrate-the-application-shell]`  
**Created**: 2026-04-19  
**Status**: Implemented  
**Input**: User description: "Implement GitHub issue #121 to establish the new application-shell design foundation while keeping the current home and preferences experience visually and behaviorally aligned with the existing DONG design language."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Consistent Shell Foundation (Priority: P1)

As a user launching the app on native or web, I want the app shell to start inside a consistent design-system foundation so the first screen feels polished, themed, and familiar on every platform.

**Why this priority**: The shell foundation is visible on every launch and is a prerequisite for any migrated screen to look and behave consistently.

**Independent Test**: Launch the app on native and web, confirm the root shell is styled immediately, and verify shell-level UI such as toasts, overlays, safe-area handling, and gesture-enabled navigation remain usable.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** the app starts on native or web, **When** the root layout renders, **Then** the shared shell foundation is active before the user reaches a routed screen.
2. **Given** the shell foundation is active, **When** global shell elements such as toasts, overlays, safe-area chrome, and gesture handling render, **Then** they remain visible and usable inside the themed shell.
3. **Given** a user has a saved appearance preference, **When** the app launches, **Then** the shell starts in the correct theme without resetting existing preferences.

---

### User Story 2 - Home Screen Preserves Current Experience (Priority: P2)

As a returning user, I want the home screen moved onto the shared shell foundation without changing how I start, continue, or review a game so the app still feels familiar.

**Why this priority**: The home screen is the default landing surface and the highest-traffic shell screen after launch.

**Independent Test**: Open the app, dismiss splash or onboarding if needed, and verify the home screen still presents its current entry states, summaries, and navigation entry points on native and web.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** first-launch, in-progress, and history-present home states exist, **When** a user opens the home screen on native or web, **Then** the screen preserves the current visual hierarchy, spacing rhythm, and primary actions.
2. **Given** the user taps the preferences entry point from home, **When** navigation occurs, **Then** the preferences screen opens without regressions in routing or retained state.
3. **Given** the app is in light or dark mode, **When** the home screen renders, **Then** brand colors, semantic states, and readability remain aligned with the current design language.

---

### User Story 3 - Preferences Screen Keeps Control Flows (Priority: P3)

As a user adjusting settings, I want the preferences screen moved onto the shared shell foundation while keeping the same controls and modal flows so I can manage settings without relearning the interface.

**Why this priority**: Preferences is the pilot settings surface and contains the appearance flow that proves the migrated shell still responds correctly to theme changes.

**Independent Test**: Open preferences from home, change appearance, open each modal-based settings flow, and return to home with the updated shell still active.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** the preferences screen is opened, **When** a user views settings on native or web, **Then** appearance, notification, league-management, and onboarding entry sections remain available and readable.
2. **Given** the user changes the active appearance mode from preferences, **When** the selection is applied, **Then** the visible shell updates in the same session and retains the chosen mode.
3. **Given** modal-based settings flows are opened from preferences, **When** users add leagues, manage leagues, choose defaults, or reopen onboarding, **Then** each flow opens, closes, and returns to preferences without losing relevant state.

---

### Edge Cases

- The app opens into splash or onboarding before the user reaches home; the migrated shell must stay styled and navigable during those early states.
- A user switches theme while a settings modal, toast, or overlay is visible; layered surfaces must remain readable and correctly ordered.
- Existing saved game or preference data is present from a prior version; the shell migration must not clear or invalidate stored data.
- Native and web layouts shift between narrow and wider viewports; headers, scroll containers, and primary actions must remain visible without clipping.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: The root shell, home screen, and preferences screen must render with equivalent structure and theming on native and web, including safe areas, gestures, overlays, and existing wider-layout constraints.
- **Shared State Model**: The existing app store remains the canonical source of truth for appearance mode, preferences, current game session data, and history summaries; the migration reuses the same read and write paths.
- **Identity Model**: No authenticated roles are introduced; behavior continues to apply to the current local-device user session.
- **Migration / Backfill**: Existing persisted preferences and game data must remain compatible with no reset, re-entry, or manual data repair.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Add regression coverage for shell activation, preserved home-screen entry states, preferences sections and modal entry points, appearance switching, navigation continuity, and persisted-state compatibility.
- **E2E Test Coverage**: Required. Cover the primary shell journey of launch -> home -> preferences -> appearance change -> continued shell usage with Playwright on the web, authored through a `.feature` file plus supporting step definitions.
- **Applicable Skills**: `react-doctor`

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST activate a shared shell design foundation during application startup on native and web.
- **FR-002**: System MUST express the current DONG visual language through shared color, spacing, surface, semantic, and typography roles so migrated shell surfaces remain visually familiar.
- **FR-003**: System MUST preserve current home-screen entry states, including splash or onboarding entry, active game summary, and history summary, after the shell migration.
- **FR-004**: System MUST preserve current navigation paths between home, preferences, and existing shell-level routes.
- **FR-005**: System MUST preserve preferences capabilities for appearance, sound and notification settings, league configuration, and onboarding access within the migrated screen.
- **FR-006**: System MUST apply appearance changes across the visible shell in the same session and continue honoring any previously saved appearance choice on the next launch.
- **FR-007**: System MUST keep shell-level elements such as toast notifications, overlays, safe-area handling, and gesture-enabled navigation usable after the migration.
- **FR-008**: System MUST support equivalent light and dark theme behavior on native and web for the root shell, home, and preferences surfaces.
- **FR-009**: System MUST maintain compatibility with existing persisted user preferences, current game data, and history data without requiring users to reconfigure or restart their sessions.
- **FR-010**: Users MUST be able to launch the app, use the home screen, open preferences, and return to home without encountering missing content or blocked interactions.

### Key Entities _(include if feature involves data)_

- **Shell Theme Preference**: The persisted appearance choice that determines which shell theme is applied at launch and when changed in settings.
- **Home Entry State**: The top-level conditions that determine whether splash, onboarding, current game information, or history summary is shown on the home screen.
- **Preferences Configuration**: The set of user-managed appearance, notification, league, and onboarding settings exposed through the preferences screen.
- **Design Token Set**: The canonical visual roles that preserve the current brand, semantic states, spacing, and hierarchy across migrated shell surfaces.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of launch smoke tests on supported native and web targets reach a fully styled shell without blank or visibly unthemed root content.
- **SC-002**: 100% of defined acceptance scenarios for shell activation, home behavior, preferences behavior, and appearance switching pass before release.
- **SC-003**: In 100% of scripted validation runs, users can launch the app, open preferences from home, change the active appearance mode, and continue using the shell in the same session without restarting the app.
- **SC-004**: Design review of the migrated home and preferences screens in light and dark modes reports zero severity-1 mismatches against the current shell's information hierarchy, color roles, or action prominence.
- **SC-005**: Post-migration verification shows previously saved preferences and game-session data remain intact in 100% of sampled upgrade test runs.

## Assumptions

- The current DONG design language documented in the repository remains the authoritative visual reference for this migration.
- Existing local persistence continues to store appearance, league, and game-session data without a schema change.
- Other routed screens may continue using the current UI approach until they are explicitly scheduled for migration.
- Global shell behaviors such as toasts, onboarding access, and gesture handling remain in scope only to the extent needed to keep them working inside the migrated shell.
- Previously completed design-language and platform-abstraction work remains available and can be reused by the shell migration.