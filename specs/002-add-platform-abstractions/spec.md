# Feature Specification: Introduce Platform Abstractions for Web Blockers

**Feature Branch**: `111-add-platform-abstractions`  
**Created**: 2026-04-11  
**Status**: Draft  
**Input**: User description: "I am ready to implement the next user story on github. It should be US1.2 #122 which you can look up with the github mcp server."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Remove Screen-Level Web Blockers (Priority: P1)

As a contributor preparing screens for web support, I need shared platform capability rules for audio feedback, date entry, animation behavior, app visibility, and gesture-driven actions so affected screens no longer fail when those behaviors differ across platforms.

**Why this priority**: This directly removes the blockers that prevent affected screens from loading and being migrated for web work. Until this is in place, every screen migration repeats the same compatibility problem.

**Independent Test**: Open representative affected screens in native and web environments and confirm they load without capability-related blocking failures while still providing supported behavior or an explicit fallback.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** an affected screen needs one of the covered platform capabilities, **When** the screen is opened in a web environment, **Then** it uses the shared platform behavior and does not fail because of platform-only dependencies.
2. **Given** a contributor adds one of the covered capabilities to a screen, **When** they use the shared platform behavior, **Then** they do not need to solve platform compatibility separately within that screen.

---

### User Story 2 - Preserve Task Completion Across Platforms (Priority: P2)

As a player using the app on native or web, I need the app to preserve the outcome of audio cues, date selection, animation cues, visibility handling, and gesture-based actions so I can complete the same tasks even when the interaction pattern differs by platform.

**Why this priority**: Unblocking web is not enough if key interactions become confusing or incomplete. The product still needs usable, predictable outcomes on both native and web.

**Independent Test**: Run a representative native flow and matching web flow that exercise the covered capabilities and verify the user can complete the same tasks from start to finish.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a platform fully supports a covered capability, **When** the user triggers that interaction, **Then** they receive the expected outcome for that platform.
2. **Given** a platform cannot match the primary interaction exactly, **When** the user reaches that step, **Then** the app provides a clear fallback that still lets them complete the surrounding task.

---

### User Story 3 - Centralize Future Compatibility Improvements (Priority: P3)

As a contributor continuing the web migration, I need platform-specific behavior defined once in shared capability contracts so future compatibility improvements can be made centrally instead of screen by screen.

**Why this priority**: The immediate blocker removal matters most, but long-term velocity depends on avoiding repeated compatibility work across multiple screens.

**Independent Test**: Update one shared capability behavior and verify that multiple consuming screens benefit from the change without separate compatibility edits.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a new screen needs one of the covered capabilities, **When** a contributor adopts the shared capability contract, **Then** they can proceed without researching the platform difference from scratch.
2. **Given** a compatibility improvement is made to a shared capability, **When** affected screens use that capability, **Then** they inherit the improvement without changing their own feature logic.

---

### Edge Cases

- What happens when a platform restricts immediate audio playback or notification sounds? The app must fail safely and keep the user moving through the task without confusion.
- How does the system handle a platform that cannot offer the same date-entry or gesture pattern as native? It must provide an alternate interaction that still completes the task.
- What happens when animation behavior or app visibility events are unavailable, delayed, or less precise on a platform? The app must fall back to predictable behavior that does not break screen flow.
- What happens while only some screens have adopted the shared capabilities? The migration must support mixed adoption without breaking existing game progress or preferences.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: Native and web behavior must be defined for audio feedback, date entry, animation behavior, app visibility, and gesture-driven actions. Where identical behavior is not possible, the app must provide an explicit fallback that preserves task completion.
- **Shared State Model**: Platform lifecycle and capability signals must come from shared capability contracts. This feature does not change the canonical ownership of game state, history, or user preference data.
- **Identity Model**: Authenticated hosts, registered users, and guests are unaffected. The same platform behavior rules apply regardless of identity.
- **Migration / Backfill**: Existing screen-level handling of the covered platform blockers must move to shared capability contracts incrementally, without invalidating persisted preferences, saved history, or in-progress games.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Shared platform adapter behavior must be covered for audio playback gating, app visibility mapping, date input normalization, animation fallback selection, gesture fallback selection, and the representative consumer logic that depends on those abstractions.
- **E2E Test Coverage**: No new end-to-end test is required for this story because it does not introduce a new primary journey, major navigation change, or material interaction redesign. Native and web smoke verification is still required for splash/loading, onboarding, setup-game filtering, and game-progress behavior.
- **Applicable Skills**: `project-planner` for planning; `react-native-testing` when component tests are written; `react-doctor` after React changes are implemented.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST define shared platform capability contracts for audio feedback, date entry, animation behavior, app visibility, and gesture-driven actions.
- **FR-002**: Affected screens MUST use the shared capability contracts instead of solving platform differences independently within each screen.
- **FR-003**: For each covered capability, the system MUST define the intended native behavior and the intended web behavior or fallback outcome.
- **FR-004**: The system MUST allow affected screens to open in a web environment without failures caused by unavailable platform-only behavior.
- **FR-005**: The system MUST provide a supported fallback whenever a covered capability cannot behave the same way across platforms.
- **FR-006**: Each fallback MUST preserve the user’s ability to complete the surrounding task even when the interaction pattern changes.
- **FR-007**: Shared capability contracts MUST be reusable so screens can adopt them independently during migration.
- **FR-008**: The system MUST make capability limitations explicit so contributors can tell whether a behavior is fully supported or intentionally degraded on a given platform.
- **FR-009**: Replacing screen-level blocker handling with shared capability contracts MUST not change unrelated game rules, scoring behavior, or saved user preferences.
- **FR-010**: The system MUST support incremental migration so affected screens can adopt shared capability contracts one at a time.
- **FR-011**: A compatibility improvement made to a shared capability MUST benefit all consuming screens that rely on that capability.
- **FR-012**: The feature MUST define expected fallback outcomes for restricted or unsupported platform behavior so failures do not appear silent or unpredictable.

### Key Entities _(include if feature involves data)_

- **Platform Capability Contract**: A shared definition of a cross-platform behavior, including intended outcome, supported contexts, and fallback expectations.
- **Capability Fallback**: The alternate behavior used when a platform cannot provide the primary interaction.
- **Consuming Screen**: A screen or shared flow that depends on one of the covered platform capabilities.
- **Visibility Signal**: A shared representation of whether the app is active or backgrounded in the current platform context.
- **Interaction Outcome**: The user-perceivable result of a capability, such as hearing a cue, selecting a date, seeing an animation cue, or completing a gesture-driven action.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of representative affected screens using the covered capabilities can be opened in a web environment without capability-related blocking failures.
- **SC-002**: Contributors can connect a covered capability to a new screen in under 15 minutes using the shared capability contracts and documented fallback behavior.
- **SC-003**: In representative native and web flows, users can complete 100% of sampled tasks that depend on the covered capabilities without being blocked by missing platform behavior.
- **SC-004**: A compatibility improvement made in one shared capability can be reflected across all sampled consuming screens without additional screen-specific compatibility work.

## Assumptions

- The current blocker scope is limited to audio feedback, date entry, animation behavior, app visibility, and gesture-driven actions identified in issue #122.
- Matching the user outcome across platforms is more important than reproducing the exact same interaction pattern everywhere.
- Existing game rules, history, scoring, and preference behavior remain in scope only where platform blocker removal would otherwise disrupt them.
- Affected screens can adopt the shared capability contracts incrementally rather than through a single all-at-once migration.
