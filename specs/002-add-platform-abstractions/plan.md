# Implementation Plan: Introduce Platform Abstractions for Web Blockers

**Branch**: `111-add-platform-abstractions` | **Date**: 2026-04-11 | **Spec**: `/specs/002-add-platform-abstractions/spec.md`
**Input**: Feature specification from `/specs/002-add-platform-abstractions/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Introduce a shared `platform/` capability layer that isolates the current web blockers behind reusable interfaces for audio playback, date input, animation fallbacks, app visibility, and gesture behavior. The implementation will replace direct native-only or platform-sensitive imports in the affected screens with shared adapters, keep current user outcomes intact on Android and iOS, provide explicit web fallbacks where parity is not practical, and add Jest coverage for the new platform decision logic plus representative consumer regressions.

## Technical Context

**Language/Version**: TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace  
**Primary Dependencies**: Expo Router 4, React 18.3.1, Zustand 5, AsyncStorage, `expo-av`, `react-native-date-picker`, `react-native-ui-datepicker`, `lottie-react-native`, `react-native-gesture-handler`, `react-native-reanimated`, Jest-Expo 52  
**Storage**: Existing Zustand + AsyncStorage persistence remains unchanged; no new storage for this feature  
**Testing**: Jest unit coverage for platform adapters and fallback-selection logic, plus targeted regression tests for affected consumer behavior in `app/gameProgress.tsx`, `components/setupGame/MatchFilter.tsx`, `components/OnboardingScreen.tsx`, and `components/gameProgress/TabNavigation.tsx`; no new end-to-end test is required because the story does not introduce a new primary journey or major navigation redesign  
**Applicable Skills**: `project-planner` loaded for planning; implementation should also check `react-native-testing` when component tests are written and `react-doctor` after React changes land  
**Target Platform**: Expo Android, iOS, and web  
**Project Type**: Cross-platform Expo/React Native application  
**Performance Goals**: Preserve current task completion behavior while keeping abstractions lightweight enough that audio cues, date selection, tab switching, and loading states remain responsive and web screens load without capability-related blocking errors  
**Constraints**: Must not change game rules, scoring, history, or persisted preferences; must support incremental adoption; must avoid native-only imports from consuming screens; must prefer existing dependencies over broad library migrations; must define explicit web fallbacks where full parity is not feasible  
**Scale/Scope**: Replace direct capability usage across `app/gameProgress.tsx`, `components/setupGame/MatchFilter.tsx`, `components/OnboardingScreen.tsx`, `components/gameProgress/TabNavigation.tsx`, `app/index.tsx`, and `components/setupGame/MatchList.tsx`, while adding a new shared platform layer and associated tests

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- PASS: Cross-platform behavior and fallback expectations are explicitly in scope for audio, date input, animation behavior, app visibility, and gestures on native and web.
- PASS: No shared-state ownership changes are introduced; Zustand remains the canonical source of truth for game, history, and preference state, and this feature only changes platform capability access paths.
- PASS: No persistence, event-model, migration, backfill, or RLS changes are introduced.
- PASS: Work remains sliced into independently deliverable user stories with Gherkin acceptance criteria in the specification.
- PASS: The test strategy includes required unit coverage for the new platform behavior and targeted native/web regression verification; no new end-to-end test is required because the feature does not create a new or substantially redesigned primary UI journey.
- PASS: Applicable skills were identified before planning work began; `project-planner` was loaded for planning and implementation follow-on skills are recorded.

## Project Structure

### Documentation (this feature)

```text
specs/002-add-platform-abstractions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── platform-capability-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── _layout.tsx
├── index.tsx
└── gameProgress.tsx
components/
├── OnboardingScreen.tsx
├── gameProgress/
│   └── TabNavigation.tsx
└── setupGame/
    ├── MatchFilter.tsx
    └── MatchList.tsx
hooks/
├── useLiveScores.ts
├── useMatchData.ts
└── useTeamFiltering.ts
platform/
├── animation/
├── audio/
├── date-input/
├── gestures/
└── visibility/
__tests__/
├── app/
├── components/
└── platform/
```

**Structure Decision**: This is a single Expo application. The shared capability contracts should live in a new top-level `platform/` directory so platform behavior is separated from feature screens and can be adopted incrementally across `app/` and `components/`. Existing screens remain in place and only switch imports to the shared layer.

## Phase 0 Output

- `research.md` resolves the capability-layer location, audio strategy, date-input strategy, animation fallback strategy, app visibility strategy, gesture fallback strategy, and test strategy.

## Phase 1 Output

- `data-model.md` defines the conceptual capability entities, fallback rules, and consuming surfaces for the shared platform layer.
- `contracts/platform-capability-contract.md` defines the required internal contract for audio, date input, animation, visibility, and gesture abstractions.
- `quickstart.md` defines the implementation order, verification flow, and expected smoke checks for native and web.
- Copilot agent context is refreshed after design artifacts are written.

## Post-Design Constitution Check

- PASS: The design artifacts define native behavior, web behavior, and explicit fallback expectations for every capability in scope.
- PASS: The plan leaves Zustand, history, and preference persistence untouched, so no shared-state or migration complexity is introduced.
- PASS: The contract keeps the work story-first by enabling screens to adopt the shared capability layer incrementally.
- PASS: The design includes required unit-test coverage and targeted regression verification for the affected platform-sensitive screens.
- PASS: Skills remain explicitly tracked: planning used `project-planner`, and implementation-stage React/testing skills are recorded for later execution.

## Complexity Tracking

No constitution violations or exceptional complexity adjustments were required.
