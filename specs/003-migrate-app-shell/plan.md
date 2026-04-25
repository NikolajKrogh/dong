# Implementation Plan: Migrate Application Shell

**Branch**: `121-us13-install-tamagui-and-migrate-the-application-shell` | **Date**: 2026-04-19 | **Spec**: `/specs/003-migrate-app-shell/spec.md`
**Input**: Feature specification from `/specs/003-migrate-app-shell/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Complete the Tamagui foundation for the Expo app, wrap the root shell in a Tamagui provider driven by the existing persisted theme preference, and migrate the home and preferences surfaces to Tamagui-backed shell primitives while preserving the current DONG design language, state ownership, navigation flows, toast behavior, platform adapter usage, and light/dark theme switching on native and web.

## Technical Context

**Language/Version**: TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace  
**Primary Dependencies**: Expo Router 4, React 18.3.1, Zustand 5, AsyncStorage, Tamagui 1.141.5, `@tamagui/babel-plugin` 1.141.5, `react-native-toast-message`, `react-native-safe-area-context`, existing `platform/` adapters, and the current shell theme sources in `app/style/palette.ts` and `app/style/theme.ts`  
**Storage**: Existing Zustand + AsyncStorage persistence remains canonical; no new persisted storage or schema changes are planned  
**Testing**: Jest-Expo 52 regression coverage for root-shell provider composition, migrated home and preferences behavior, and any new shell primitives; web-only Playwright coverage should be authored through `.feature` scenarios and step definitions for the shell journeys  
**Applicable Skills**: `project-planner` loaded for planning; implementation should run `react-doctor` after React changes land and check `react-native-testing` only if Testing Library-based component tests are added or existing tests are migrated  
**Target Platform**: Expo Android, iOS, and web  
**Project Type**: Cross-platform Expo/React Native application  
**Performance Goals**: Preserve current launch responsiveness, avoid visibly unthemed shell content at startup, and keep migrated home/preferences interactions responsive across narrow mobile layouts and wider web layouts  
**Constraints**: Must preserve the existing DONG visual language, keep Zustand as the theme and preferences source of truth, retain current navigation and toast behavior, reuse `platform/` abstractions for gesture and animation concerns, complete the currently incomplete Tamagui config/compiler wiring, and limit UI migration scope to the root shell plus the home and preferences flows rather than redesigning the full app  
**Scale/Scope**: Touch root integration files such as `tamagui.config.ts`, `babel.config.js`, `playwright.config.ts`, and `app/_layout.tsx`; migrate `app/index.tsx`, `app/userPreferences.tsx`, and selected `components/preferences/*` surfaces; add shared shell primitives under `components/ui/`; bridge legacy theme files under `app/style/`; and extend targeted Jest coverage plus web Playwright BDD artifacts in `e2e/features/app-shell.feature` and `e2e/steps/app-shell.steps.ts`

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- PASS: Cross-platform behavior and fallback expectations are explicit for the root shell, home, preferences, and theme-switching behavior on native and web.
- PASS: No shared-state ownership changes are introduced; Zustand remains the canonical source of truth for theme, preferences, current game state, and history, and the plan only changes how those values are rendered.
- PASS: No immutable event, migration, backfill, or RLS scope changes are introduced because persisted schemas and history storage remain untouched.
- PASS: Work remains sliced into independently deliverable user stories with Gherkin acceptance criteria in the specification.
- PASS: The test strategy includes required unit coverage and explicit end-to-end shell verification because this is a substantial UI change affecting launch, navigation, and theme switching.
- PASS: Applicable skills were identified before planning began; `project-planner` was loaded and implementation-stage React/testing skills are recorded.

## Project Structure

### Documentation (this feature)

```text
specs/003-migrate-app-shell/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── application-shell-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── _layout.tsx
├── index.tsx
├── userPreferences.tsx
└── style/
components/
├── preferences/
└── ui/
platform/
store/
test-utils/
__tests__/
├── app/
├── components/
└── platform/
e2e/
├── features/
├── playwright/
└── steps/
tamagui.config.ts
babel.config.js
playwright.config.ts
```

**Structure Decision**: This remains a single Expo application. The Tamagui foundation belongs at the repository root so `app/_layout.tsx` can apply it once, while reusable shell building blocks should live under `components/ui/` so the home and preferences migrations can share layout primitives without forcing a full-app rewrite. Web E2E coverage should use Playwright BDD with `.feature` scenarios in `e2e/features/`, shared steps in `e2e/steps/`, and configuration in `playwright.config.ts`.

## Phase 0 Output

- `research.md` resolves the root-provider composition, theme source of truth, token and theme migration strategy, shell primitive strategy, screen migration boundaries, and testing strategy.

## Phase 1 Output

- `data-model.md` defines the conceptual entities for shell themes, token mapping, provider composition, migrated shell surfaces, reusable primitives, and verification journeys.
- `contracts/application-shell-contract.md` defines the internal UI contract for the root shell, home, preferences, theme switching, and automation anchors.
- `quickstart.md` defines the implementation order, verification commands, and smoke checks for native and web.
- Copilot agent context is refreshed after the design artifacts are written.

## Post-Design Constitution Check

- PASS: The design artifacts preserve native and web behavior expectations for launch, home, preferences, and theme switching.
- PASS: The design keeps state ownership in Zustand and introduces no persistence or multiplayer complexity.
- PASS: The contract and data model keep work aligned to the spec’s independently testable user stories rather than a broad redesign.
- PASS: The verification plan includes required unit regression coverage and explicit web Playwright BDD shell journey checks.
- PASS: Skills remain explicit: planning used `project-planner`, and implementation follow-on guidance records `react-doctor` and conditional `react-native-testing` usage.

## Complexity Tracking

No constitution violations or exceptional complexity adjustments were required.
