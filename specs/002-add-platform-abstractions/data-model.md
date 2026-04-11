# Data Model: Introduce Platform Abstractions for Web Blockers

## Overview

This feature does not introduce persisted runtime data. The data model below defines the conceptual entities that the shared platform layer must represent so the capability contracts, fallbacks, and consumer behavior can be implemented and tested consistently.

## Entity: PlatformCapabilityContract

**Purpose**: The canonical shared interface for one platform-sensitive behavior that screens consume without knowing the underlying platform implementation details.

| Field                | Type     | Description                                                    |
| -------------------- | -------- | -------------------------------------------------------------- |
| `id`                 | enum     | `audio`, `dateInput`, `animation`, `visibility`, or `gesture`. |
| `consumerFacingName` | string   | Human-readable name used in docs and tests.                    |
| `supportedPlatforms` | string[] | Platforms with full or primary support.                        |
| `fallbackPlatforms`  | string[] | Platforms that require degraded or alternate behavior.         |
| `outcomeGuarantee`   | string   | The user outcome the contract must preserve across platforms.  |
| `status`             | enum     | `draft`, `implemented`, or `adopted`.                          |

**Relationships**:

- Owns one or more `CapabilityImplementation` entries.
- Defines one or more `CapabilityFallback` entries.
- Is consumed by one or more `ConsumingSurface` entries.

**Validation rules**:

- Every contract must define both the primary outcome and the fallback outcome.
- Every contract must name at least one consuming surface before the feature is considered complete.
- Fallback platforms may be empty only if the contract behaves identically everywhere.

**State transitions**:

- `draft` -> `implemented` -> `adopted`

## Entity: CapabilityImplementation

**Purpose**: A platform-specific execution path behind a shared capability contract.

| Field           | Type   | Description                                                              |
| --------------- | ------ | ------------------------------------------------------------------------ |
| `contractId`    | enum   | Parent capability identifier.                                            |
| `platform`      | enum   | `ios`, `android`, or `web`.                                              |
| `driver`        | string | The underlying package or runtime surface used by that platform branch.  |
| `entryPoint`    | string | Shared module entry consumed by screens.                                 |
| `behaviorClass` | enum   | `full`, `degraded`, or `noOp`.                                           |
| `notes`         | string | Any platform-specific nuance that callers must not have to re-implement. |

**Relationships**:

- Belongs to one `PlatformCapabilityContract`.
- May activate one `CapabilityFallback`.

**Validation rules**:

- Each platform branch must be represented exactly once for the platforms in scope.
- `behaviorClass` must align with the documented fallback rules for that contract.

## Entity: CapabilityFallback

**Purpose**: The explicit alternate behavior used when full parity is unavailable or unnecessary on a given platform.

| Field              | Type   | Description                                                                   |
| ------------------ | ------ | ----------------------------------------------------------------------------- |
| `contractId`       | enum   | Parent capability identifier.                                                 |
| `platform`         | enum   | Platform where the fallback applies.                                          |
| `trigger`          | string | Condition that causes the fallback path to be used.                           |
| `fallbackType`     | enum   | `alternateUI`, `reducedAnimation`, `noOpWithSignal`, or `primaryControlOnly`. |
| `preservedOutcome` | string | What the user can still accomplish.                                           |
| `userVisibility`   | enum   | `silent`, `implicit`, or `explicit`.                                          |

**Relationships**:

- Belongs to one `PlatformCapabilityContract`.
- Is exercised by one or more `ConsumingSurface` entries.

**Validation rules**:

- Every fallback must preserve a user outcome, not just avoid a crash.
- `silent` visibility is allowed only when the fallback remains intuitive and non-destructive.

## Entity: ConsumingSurface

**Purpose**: A screen or reusable component that depends on one or more platform capability contracts.

| Field                  | Type   | Description                                            |
| ---------------------- | ------ | ------------------------------------------------------ |
| `name`                 | string | Screen or component name.                              |
| `path`                 | string | Repository path to the consumer.                       |
| `requiredCapabilities` | enum[] | Capability contracts used by the consumer.             |
| `currentRisk`          | enum   | `buildBlocker`, `behaviorDrift`, or `migrationRisk`.   |
| `adoptionState`        | enum   | `legacyDirectImport`, `sharedContract`, or `verified`. |

**Relationships**:

- Depends on one or more `PlatformCapabilityContract` entries.

**Validation rules**:

- Every consumer in the current blocker scope must list at least one required capability.
- Consumers can reach `verified` only after adopting shared contracts and passing native/web regression checks.

**State transitions**:

- `legacyDirectImport` -> `sharedContract` -> `verified`

## Entity: VisibilitySnapshot

**Purpose**: The normalized app/page visibility signal exposed to consumers.

| Field           | Type    | Description                                                            |
| --------------- | ------- | ---------------------------------------------------------------------- |
| `state`         | enum    | `active`, `inactive`, `background`, or `hidden`.                       |
| `source`        | enum    | `AppState` or `document.visibilityState`.                              |
| `isInteractive` | boolean | Whether user-triggered behavior such as sound playback should proceed. |
| `capturedAt`    | string  | Timestamp or sequencing marker used in tests and debugging.            |

**Relationships**:

- Produced by the `visibility` capability contract.
- Consumed directly by the `audio` capability contract and any screen-level behavior that gates on foreground state.

**Validation rules**:

- `isInteractive` must be derivable from `state` without screen-specific logic.

## Entity: DateInputValue

**Purpose**: The normalized value model used by the shared date-input contract regardless of which picker renders.

| Field            | Type    | Description                                        |
| ---------------- | ------- | -------------------------------------------------- |
| `mode`           | enum    | `date` or `time`.                                  |
| `displayValue`   | string  | User-facing formatted value shown in the control.  |
| `isoValue`       | string  | Canonical serialized value used by screen state.   |
| `isEmptyAllowed` | boolean | Whether the consuming surface can clear the value. |
| `validationRule` | string  | Format or range constraint the value must satisfy. |

**Relationships**:

- Produced by the `dateInput` capability contract.
- Consumed by `MatchFilter` and future schedule-based surfaces.

**Validation rules**:

- The same outward value semantics must be preserved on native and web.
- Display formatting can vary by renderer, but `isoValue` must stay stable for filtering logic.

## Relationship Summary

- `PlatformCapabilityContract` is the core entity for each blocker category.
- `CapabilityImplementation` and `CapabilityFallback` describe how each contract behaves per platform.
- `ConsumingSurface` maps the current migration surface and adoption status.
- `VisibilitySnapshot` and `DateInputValue` are normalized value models that reduce screen-specific platform branching.
