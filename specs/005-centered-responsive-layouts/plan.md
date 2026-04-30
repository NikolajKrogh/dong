# Implementation Plan: Restore Centered Responsive Layouts

**Branch**: `124-us14-migrate-core-screens-to-responsive-tamagui-layouts` | **Date**: 2026-04-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from [spec.md](spec.md)

## Summary

Restore centered, predictable responsive layout behavior across Home, Setup,
Game Progress, History, and Settings. The implementation should make the shared
shell own centering and max-width behavior, use one shared wide-layout breakpoint,
constrain the setup wizard's wide frame, and replace ad hoc per-screen spacing
with the shared primitives where that restores alignment.

## Technical Context

**Language/Version**: TypeScript 5.3.3 in Expo SDK 52 / React Native 0.76.9 / React 18.3.1  
**Primary Dependencies**: Expo Router 4, Tamagui 1.141.5, `react-native-safe-area-context`, `react-native-toast-message`, `react-native-reanimated`, Zustand 5, AsyncStorage  
**Storage**: N/A for this feature; existing Zustand + AsyncStorage state remains unchanged  
**Testing**: Jest-Expo route tests, React Native Testing Library for component-level assertions when needed, headed Playwright BDD for visual confirmation  
**Applicable Skills**: project-planner, react-native-testing  
**Target Platform**: Expo native mobile plus web/browser  
**Project Type**: mobile-app with web support  
**Performance Goals**: Keep centered layouts stable across resize and orientation changes without introducing visible layout jitter  
**Constraints**: Preserve the current visual design language, avoid persistence changes, and keep the fix centered on alignment rather than redesign  
**Scale/Scope**: 5 primary screens, 1 shared shell, 1 setup wizard, several shared UI primitives, and route-level responsive tests

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Cross-platform behavior and fallback expectations are defined for native and web.
- Shared-state changes are not required; canonical state and mutation paths are unchanged.
- Data-model changes are not required; no migration, backfill, or RLS work is introduced.
- Work is sliced into independently deliverable user stories with Gherkin-style acceptance criteria.
- The test plan defines unit coverage for every new behavior and end-to-end coverage for the substantial UI change.
- Applicable repository and domain skills were identified before planning began.

Result: PASS

## Implementation Phases

### Phase 0: Research and Planning Artifacts

Deliverables: [research.md](research.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md), and updated Copilot context.

Exit criteria:

- Shared shell behavior, breakpoint strategy, and test strategy are documented.
- No unresolved clarification markers remain in the planning artifacts.
- The plan reflects the current repo structure and current route surfaces.

### Phase 1: Shared Responsive Shell Contract

Deliverables: ShellScreen contract cleanup, shared breakpoint helper, and any shared card/action width mode adjustments.

Exit criteria:

- The shared shell centers wide layouts without conflicting width/alignment rules.
- The wide-layout breakpoint is defined once and reused by the affected routes/components.
- Shared primitives can be used to constrain content instead of repeating route-local margins.

### Phase 2: Home and Settings Alignment

Deliverables: Home route and Settings route adopt the same responsive shell contract.

Exit criteria:

- Home content, current-game card, history stats card, and preferences action align to one center axis.
- Settings keeps its header and scroll content readable on phone and centered on wide screens.
- Route-level tests for Home and Settings cover the phone-vs-wide shell behavior.

### Phase 3: Setup Wizard Stabilization

Deliverables: SetupWizard wide layout, stepper/sidebar sizing, navigation alignment, and setup-local width rules.

Exit criteria:

- The setup wizard stays inside one centered frame on wide screens.
- Stepper, main panel, and nav buttons remain visually aligned across steps.
- The screen no longer depends on conflicting `width: 100%` and centering rules that cause drift.

### Phase 4: Route Audit and Verification

Deliverables: Re-check Game Progress and History, then finalize regression coverage and manual browser checks.

Exit criteria:

- Game Progress and History still center correctly after the shared shell change.
- Existing route tests continue to pass for phone and wide layouts.
- Headed Playwright verification confirms the targeted screenshots and flows no longer drift.

## Project Structure

### Documentation (this feature)

```text
specs/005-centered-responsive-layouts/
├── plan.md          # This file
├── research.md      # Phase 0 output
├── data-model.md    # Phase 1 output
└── quickstart.md    # Phase 1 output
```

### Source Code (repository root)

```text
app/
├── index.tsx
├── setupGame.tsx
├── gameProgress.tsx
├── history.tsx
├── userPreferences.tsx
└── style/

components/
├── ui/
├── setupGame/
├── gameProgress/
└── history/

__tests__/
└── app/
```

**Structure Decision**: Single Expo mobile app with shared UI primitives, route-level screen files under `app/`, setup-specific components under `components/setupGame/`, and responsive regression tests under `__tests__/app/`. No external contracts directory is required because this feature is UI-only.

## Complexity Tracking

No constitution violations require justification for this feature.
