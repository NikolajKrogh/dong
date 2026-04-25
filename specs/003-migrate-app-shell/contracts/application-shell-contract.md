# Application Shell Contract

## Purpose

Define the internal UI contract that the Tamagui-based application shell must satisfy so the root shell, home screen, preferences screen, and theme-switching behavior remain stable for users and automation during the migration.

## Deliverable Location

- Root shell integration: `app/_layout.tsx`
- Pilot migrated screens: `app/index.tsx`, `app/userPreferences.tsx`
- Shared shell primitives: `components/ui/`
- Planning contract artifact: `specs/003-migrate-app-shell/contracts/application-shell-contract.md`

## Consumers

- End users launching the app on Android, iOS, and web
- Existing automation in `e2e/features/`, `e2e/steps/`, and `e2e/playwright/`
- Future shell-adjacent screens that adopt shared `components/ui/` primitives

## Required Shell Contracts

| Contract Surface | Required outcome | Native expectation | Web expectation |
| ---------------- | ---------------- | ------------------ | --------------- |
| `rootShell` | The application launches inside one active Tamagui-backed shell foundation with the correct theme already applied. | Gesture root, routed screens, and global overlays remain usable inside the active theme. | Routed screens and global overlays render inside the same active theme without unstyled shell flashes. |
| `tokenAndThemeBridge` | The migrated shell uses Tamagui tokens and themes that preserve the current DONG visual language. | Light and dark shell surfaces remain visually consistent with current native behavior. | Light and dark shell surfaces remain visually consistent with current web behavior and existing responsive constraints. |
| `homeScreen` | Home preserves splash or onboarding entry, current-game summary, history summary, and primary navigation actions after migration. | Existing launch and navigation behavior remains intact. | Existing launch and navigation behavior remains intact with no missing entry states. |
| `preferencesScreen` | Preferences preserves settings sections, theme controls, onboarding access, and league-management entry points after migration. | Existing settings flows and modal interactions remain usable. | Existing settings flows and modal interactions remain usable and readable. |
| `themeSwitching` | Changing appearance from preferences updates the visible shell in-session and persists for the next launch. | Theme updates without resetting current screen state. | Theme updates without resetting current screen state. |
| `automationAnchors` | Existing high-value labels and test hooks stay stable or receive coordinated test updates. | Shell launch and theme-switch smoke checks remain executable. | Shell launch, home-shell, and theme-switch smoke checks remain executable. |

## Authoring Rules

- The Tamagui provider must be established once at the root shell rather than per-screen.
- The active shell theme must resolve from the existing persisted app preference, not from a second unrelated theme source.
- Shell primitives under `components/ui/` must consume shared tokens and themes rather than introducing unrelated visual constants.
- Non-migrated screens may continue to use existing style helpers during this feature, but the hybrid theme bridge must keep their visual context compatible with the migrated shell.
- Global shell elements such as toast hosts and overlays must remain inside the themed shell context.
- Existing platform abstractions for gesture and animation behavior must remain the preferred import path when those capabilities are touched by the migration.
- Web E2E coverage should be expressed through Playwright BDD `.feature` scenarios and shared step definitions rather than a separate native automation layer.

## Contract-Specific Acceptance Rules

### Root Shell

- The app launches into a themed shell on Android, iOS, and web.
- The root shell continues to host gesture handling, router stack rendering, and toast presentation.
- Global shell elements do not require a second theme provider to render correctly.

### Token and Theme Bridge

- The mapped shell theme preserves the current brand blue, light and dark surfaces, semantic colors, and text hierarchy described in `DESIGN.md`.
- The shell migration does not silently replace the current design language with default library styling.
- The bridge supports hybrid adoption while the rest of the app still depends on legacy style helpers.

### Home Screen

- Splash or onboarding entry remains available when triggered by current app state.
- Primary home actions such as starting a game, continuing a game, opening history, or opening preferences remain discoverable.
- Existing home state summaries remain readable in both themes.

### Preferences Screen

- Appearance controls remain present and understandable.
- League-management and onboarding entry flows remain reachable.
- Modal-based settings flows open, close, and return to the preferences shell without losing relevant state.

### Theme Switching

- A theme change from preferences updates the visible shell in the same session.
- Relaunching the app preserves the chosen theme.
- Theme changes do not remove or hide key shell actions while the user stays on home or preferences.

### Automation Anchors

- Existing user-visible markers such as `Start New Game`, `Settings`, `Current theme:`, `Open preferences`, and any current shell test identifiers must remain stable or be updated in lockstep with Playwright BDD coverage.
- Any renamed automation anchor must be reflected in the `.feature` scenarios and supporting Playwright step definitions before the feature is considered complete.

## Adoption Contract

The shell migration is acceptable only if all of the following are true:

- `app/_layout.tsx` establishes the active Tamagui-backed shell foundation.
- The migrated home and preferences surfaces render through shared shell primitives or directly through the new tokenized Tamagui layer.
- Existing theme preference behavior remains store-driven and persisted.
- Web and native shell smoke checks continue to pass for launch and theme-switching journeys.
- The visible shell remains recognizably aligned with the documented DONG design language.
