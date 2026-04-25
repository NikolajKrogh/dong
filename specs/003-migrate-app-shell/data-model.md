# Data Model: Migrate Application Shell

## Overview

This feature does not introduce new persisted domain records. The model below defines the conceptual shell entities that must be designed consistently so the Tamagui migration can preserve existing behavior while changing the rendering foundation.

## Entity: ShellThemePreference

**Purpose**: The canonical appearance selection that determines which shell theme is active at launch and after live theme changes.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `name` | enum | `light` or `dark`. |
| `source` | enum | `storePersistedPreference`. |
| `appliesAt` | enum[] | `launch`, `screenRender`, and `liveToggle`. |
| `persisted` | boolean | Whether the preference survives app restarts. |
| `fallbackName` | enum | Theme to apply if stored state is unavailable. |

**Relationships**:

- Selects one `TamaguiThemeVariant`.
- Is consumed by one `ShellProviderComposition`.
- Is exercised by one or more `ShellVerificationJourney` entries.

**Validation rules**:

- The active shell theme must always resolve from one source of truth.
- Live theme changes must update the visible shell without clearing existing screen state.

## Entity: TamaguiTokenCatalog

**Purpose**: The canonical token mapping that translates the current DONG design language into Tamagui-consumable values.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | string | Identifier for the token catalog version used by the shell. |
| `sourceFiles` | string[] | Design sources such as `DESIGN.md`, `app/style/palette.ts`, and `app/style/theme.ts`. |
| `colorRoles` | string[] | Brand, surface, text, border, and semantic roles required by the shell. |
| `spacingScale` | string[] | Shared spacing values used by migrated shell surfaces. |
| `radiusScale` | string[] | Rounded-corner values used by cards, buttons, and modals. |
| `typographyRoles` | string[] | Text hierarchy roles required by home and preferences. |
| `compatibilityMode` | enum | `hybrid` while legacy style helpers and Tamagui coexist. |

**Relationships**:

- Produces one or more `TamaguiThemeVariant` entries.
- Is consumed by `ShellPrimitive` entries.

**Validation rules**:

- The catalog must cover all visual roles required by the migrated shell surfaces.
- Token naming must preserve the meaning of the current design roles rather than inventing unrelated replacements.

## Entity: TamaguiThemeVariant

**Purpose**: A concrete light or dark theme exposed through the Tamagui provider.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `name` | enum | `light` or `dark`. |
| `derivedFrom` | string | Reference to the `TamaguiTokenCatalog` source. |
| `surfaceRoles` | string[] | Background and card values used by shell containers. |
| `textRoles` | string[] | Primary, secondary, muted, and inverse text values. |
| `semanticRoles` | string[] | Success, danger, warning, and info mappings. |
| `status` | enum | `draft`, `wired`, or `verified`. |

**Relationships**:

- Belongs to one `TamaguiTokenCatalog`.
- Is selected by one `ShellThemePreference`.
- Is applied through one `ShellProviderComposition`.

**State transitions**:

- `draft` -> `wired` -> `verified`

## Entity: ShellProviderComposition

**Purpose**: The root composition that makes Tamagui theming available to routed screens and shell-level UI.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | string | Provider composition identifier. |
| `rootPath` | string | Root shell entry, expected to be `app/_layout.tsx`. |
| `providerOrder` | string[] | Ordered list of provider or wrapper layers active in the root shell. |
| `themeSource` | enum | `zustandThemePreference`. |
| `includesGlobalOverlays` | boolean | Whether toast and similar global shell UI render inside the themed shell. |
| `coverageState` | enum | `unverified`, `unitVerified`, or `journeyVerified`. |

**Relationships**:

- Consumes one `ShellThemePreference`.
- Applies one `TamaguiThemeVariant`.
- Encloses one or more `MigratedShellSurface` entries.

**Validation rules**:

- The composition must keep routed screens and global shell UI in the same theme context.
- The provider order must not create competing theme sources.

## Entity: ShellPrimitive

**Purpose**: A reusable Tamagui-backed building block used by migrated shell screens.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `name` | string | Primitive name such as screen scaffold, section card, or action button. |
| `variantSet` | string[] | Supported visual variants required by home and preferences. |
| `tokenDependencies` | string[] | Theme or token roles the primitive consumes. |
| `behaviorGuarantee` | string | User-visible behavior the primitive must preserve. |
| `currentConsumers` | string[] | Migrated surfaces currently using the primitive. |
| `status` | enum | `planned`, `adopted`, or `verified`. |

**Relationships**:

- Consumes one `TamaguiTokenCatalog`.
- Is used by one or more `MigratedShellSurface` entries.

**Validation rules**:

- A primitive must improve reuse across at least two shell surfaces or represent a clear shell-level need.
- Primitive variants must preserve the existing information hierarchy and action prominence.

## Entity: MigratedShellSurface

**Purpose**: A root shell surface or pilot screen that adopts the new Tamagui-backed foundation.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `name` | string | Surface name such as root shell, home screen, or preferences screen. |
| `path` | string | Repository path for the surface entry point. |
| `surfaceType` | enum | `rootLayout`, `screen`, or `modalShell`. |
| `stateDependencies` | string[] | Store or controller state the surface reads. |
| `automationAnchors` | string[] | Existing labels or test identifiers that verification relies on. |
| `migrationState` | enum | `legacy`, `hybrid`, `tamaguiBacked`, or `verified`. |

**Relationships**:

- Is enclosed by one `ShellProviderComposition`.
- Uses one or more `ShellPrimitive` entries.
- Participates in one or more `ShellVerificationJourney` entries.

**State transitions**:

- `legacy` -> `hybrid` -> `tamaguiBacked` -> `verified`

## Entity: ShellVerificationJourney

**Purpose**: A user-visible shell flow that validates the migrated foundation across platforms.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | string | Journey identifier. |
| `platforms` | string[] | Platforms where the journey must pass. |
| `entryState` | string | Initial state required to start the journey. |
| `steps` | string[] | User-facing actions or transitions in the journey. |
| `assertions` | string[] | Visible outcomes that must hold after the journey runs. |
| `automationSurface` | enum[] | `jest` and/or `playwright`. |

**Relationships**:

- Exercises one `ShellProviderComposition`.
- Covers one or more `MigratedShellSurface` entries.
- Validates one `ShellThemePreference`.

**Validation rules**:

- At least one journey must validate launch into the themed shell.
- At least one journey must validate the web shell flow of home -> preferences -> theme switch -> continued shell use through a Playwright-backed `.feature` scenario.

## Relationship Summary

- `ShellThemePreference` selects the active `TamaguiThemeVariant`.
- `TamaguiTokenCatalog` supplies the visual values that both `TamaguiThemeVariant` and `ShellPrimitive` depend on.
- `ShellProviderComposition` applies the selected theme and encloses migrated surfaces.
- `MigratedShellSurface` entries adopt `ShellPrimitive` building blocks while preserving existing state logic.
- `ShellVerificationJourney` entries protect the launch, navigation, and appearance-switching flows required by the specification.
