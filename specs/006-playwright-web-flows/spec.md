# Feature Specification: Web Flow Browser Coverage

**Feature Branch**: `006-playwright-web-flows`  
**Created**: 2026-05-03  
**Status**: Draft  
**Input**: User description: "Set up Playwright end-to-end testing for web flows"

## Clarifications

### Session 2026-05-03

- Q: Where should the canonical browser-flow coverage live for issue #150? -> A: Make `e2e/features/app-shell.feature` and `e2e/steps/app-shell.steps.ts` the canonical browser-flow suite, and keep standalone specs only for unique layout or geometry regressions.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Reliable Home Smoke Coverage (Priority: P1)

As a maintainer, I can run browser smoke tests against the web app and confirm the home screen loads, so basic browser regressions are caught before more complex journeys run.

**Why this priority**: Home is the first browser-visible entry point, so it is the fastest way to catch a broken web launch or hydration issue.

**Independent Test**: Start the web app and run the browser smoke suite to confirm the home screen becomes visible and the result is repeatable.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** the web app is running, **When** the browser smoke suite executes, **Then** it opens the app in a browser and confirms the home screen loads successfully.
2. **Given** the app needs time to hydrate or show onboarding, **When** the browser smoke suite runs, **Then** it waits for the actual home content instead of passing on a loading shell.

---

### User Story 2 - Core Setup Journey Coverage (Priority: P1)

As a maintainer, I can run an end-to-end browser test that completes the setup flow and starts a new game, so the primary browser journey is protected from future regressions.

**Why this priority**: The setup-to-game path is the main user journey that the browser suite must protect.

**Independent Test**: Complete the setup journey in the browser with representative test data and confirm the next game state is reached.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a browser session is available, **When** a user completes the core setup journey, **Then** the test verifies the flow reaches the expected next state.
2. **Given** the setup flow uses different data sets such as player counts or match selections, **When** the journey runs with those values, **Then** the same flow remains reusable without rewriting the test steps.

---

### User Story 3 - Maintainable Local And CI Runs (Priority: P2)

As a maintainer, I can run the browser suite locally and in CI with one repeatable command and a clear file structure, so the tests are easy to discover and keep stable over time.

**Why this priority**: The suite only helps if it is easy to run, easy to understand, and not split across overlapping browser checks.

**Independent Test**: Run the browser suite from a clean workspace and confirm the same results appear locally and in CI-oriented execution.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a clean workspace, **When** the browser test command runs, **Then** it completes without manual browser setup and reports consistent results.
2. **Given** duplicate browser checks exist for the same user-visible behavior, **When** the suite is organized, **Then** the behavior is covered once in the canonical flow and reused through shared steps.

---

### Edge Cases

- The web app may hydrate slowly before the home screen is usable.
- First-launch onboarding may appear before home content is visible.
- The local browser port may already be in use or may point to the wrong app.
- Persisted state from earlier runs should not make the smoke or journey tests pass incorrectly.
- Setup journeys should fail clearly when required inputs are missing or incomplete.
- The browser suite should remain repeatable across different viewport sizes used by the project.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: Browser coverage applies to the web app; native app behavior is unchanged.
- **Shared State Model**: No shared state or persistence model changes are required.
- **Identity Model**: No authentication or identity changes are required.
- **Migration / Backfill**: None.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Add tests only for any new test-support helpers or data builders introduced for the browser suite; no app behavior change is expected.
- **E2E Test Coverage**: Yes. Author the home smoke path and the setup-to-start-game journey in the BDD browser-flow suite, and keep standalone Playwright specs only for unique layout or geometry regressions that do not fit the shared flow cleanly.
- **Applicable Skills**: systematic-debugging

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The browser test suite MUST verify that the web app opens successfully and reaches a visible home screen.
- **FR-002**: The browser test suite MUST cover the primary setup-to-start-game journey end-to-end.
- **FR-003**: The browser test suite MUST use shared test steps or fixtures so the smoke path and the setup journey reuse the same startup and readiness logic.
- **FR-004**: The browser test entrypoint MUST support local execution and CI execution without manual browser wiring.
- **FR-005**: The browser suite MUST tolerate hydration delay, onboarding, and prior persisted state without producing false passes.
- **FR-006**: Duplicate browser checks that verify the same user-visible behavior MUST be consolidated into the canonical browser flow or removed.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A maintainer can run one browser test command and observe at least one successful home smoke result and one successful setup journey result.
- **SC-002**: The primary browser journey completes successfully on every browser viewport configuration used by the suite.
- **SC-003**: The browser suite runs with the same pass/fail outcome in local execution and CI-oriented execution when the app is healthy.
- **SC-004**: Repeated runs from a clean workspace produce consistent results without relying on stale app state.
- **SC-005**: The suite exposes a single clear path for browser-flow coverage instead of forcing maintainers to keep multiple overlapping smoke tests in sync.

## Assumptions

- The browser suite targets the Expo web app only.
- Existing app behavior, storage, and gameplay rules do not change.
- Any test-support helpers added for this feature live under the test automation area and do not change the app runtime.
- First-launch onboarding can be dismissed or seeded in tests when needed.
