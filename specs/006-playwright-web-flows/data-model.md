# Browser Flow Model: Web Flow Browser Coverage

This feature does not change app data. The model below describes the automation artifacts that define the browser coverage.

## Entities

### BrowserFlowSuite

| Field           | Meaning                                                          |
| --------------- | ---------------------------------------------------------------- |
| `name`          | Human-readable name for the browser coverage suite               |
| `canonicalPath` | Primary feature/spec file that owns the browser journey coverage |
| `entrypoint`    | Command or Playwright config used to run the suite               |
| `projects`      | Browser projects or viewport variants used by the suite          |
| `sharedSteps`   | Shared step files or fixtures used across scenarios              |

**Relationships**: Owns one or more browser scenarios and reuses shared step helpers.

**Rules**:

- The canonical suite should own the home smoke path and the setup-to-start-game journey.
- Duplicate smoke checks should not define the same behavior in a second place.

### BrowserScenario

| Field              | Meaning                                                    |
| ------------------ | ---------------------------------------------------------- |
| `title`            | Scenario name or user journey label                        |
| `purpose`          | What regression or flow the scenario validates             |
| `viewportSet`      | Viewport or project variants the scenario must pass under  |
| `readinessMarkers` | Page markers that indicate the app is ready for assertions |
| `dataset`          | Parameterized test values for the journey                  |

**Relationships**: Belongs to a browser-flow suite and may use shared step helpers.

**Rules**:

- Smoke scenarios must wait for app-specific content, not only the page load event.
- Journey scenarios should be reusable across multiple data sets.

### SharedStepHelper

| Field            | Meaning                                                        |
| ---------------- | -------------------------------------------------------------- |
| `path`           | File that owns the reusable step or fixture logic              |
| `responsibility` | What the helper abstracts, such as startup or readiness checks |
| `consumers`      | Scenarios or specs that use the helper                         |

**Relationships**: Shared by more than one browser scenario.

**Rules**:

- Startup and readiness logic should be centralized.
- Helpers should be generic enough to support the smoke and journey flows.

### SetupJourneyDataset

| Field            | Meaning                                                       |
| ---------------- | ------------------------------------------------------------- |
| `players`        | Player list or count used for the setup journey               |
| `matches`        | Match inputs or match count used for the journey              |
| `commonMatchId`  | Common match selection when the journey requires one          |
| `assignmentMode` | Manual or parameterized assignment style used in the scenario |

**Relationships**: Feeds the setup-to-start-game browser scenario.

**Rules**:

- The journey should accept more than one valid dataset.
- The browser flow should not require test rewriting for each variant.

### StandaloneRegressionSpec

| Field            | Meaning                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `path`           | Standalone Playwright spec path                                       |
| `regressionType` | Unique layout or geometry regression being checked                    |
| `keepOrRetire`   | Whether the spec remains after the BDD suite covers the same behavior |

**Relationships**: Optional companion to the canonical browser-flow suite.

**Rules**:

- Keep a standalone spec only if it verifies something the BDD flow does not.
- If the BDD suite covers the behavior already, retire the duplicate standalone spec.

## Validation Rules

- The suite must expose one clear home smoke path and one clear setup journey.
- Readiness must be based on app-specific markers or selectors.
- Shared helpers must be reused across browser scenarios where possible.
- The browser coverage must remain repeatable under the viewport configurations used by the suite.
