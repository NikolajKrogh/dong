# Implementation Plan: Responsive Core Screens

**Branch**: `[124-us14-migrate-core-screens-to-responsive-tamagui-layouts]` | **Date**: 2026-04-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-responsive-core-screens/spec.md`

## Summary

Migrate the setup, gameplay, and history routes to responsive Tamagui-backed layouts that remain usable on phone-sized and desktop web viewports while preserving the current setup, play, and history flows. The implementation should reuse the existing Expo SDK 52 / React Native 0.76.9 / Expo Router 4 / Tamagui / Zustand foundation already in the repo, keep the current state and navigation logic intact, and expand only the presentation layer plus any screen-local child components or modals that need layout-aware behavior.

The responsive strategy is intentionally narrow in scope: wide layouts may reorganize into screen-specific multi-column or split-pane arrangements where that improves readability, but the core flow order and interaction model must remain recognizable. Phone-sized and desktop-wide viewports are the acceptance targets for validation.

## Technical Context

**Language/Version**: TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace with React 18.3.1  
**Primary Dependencies**: Expo Router 4, Tamagui 1.141.5, `@tamagui/babel-plugin` 1.141.5, Zustand 5, AsyncStorage, `react-native-safe-area-context`, `react-native-toast-message`, `react-native-gesture-handler`, `react-native-reanimated`, and the existing `platform/` adapters  
**Storage**: Existing Zustand + AsyncStorage persistence remains canonical; no schema or migration work is planned  
**Testing**: Jest-Expo regression coverage for the migrated route screens and screen-local responsive helpers, plus Playwright BDD web coverage for phone-sized and desktop-wide journeys  
**Applicable Skills**: `project-planner`, `react-doctor`, `react-native-testing`  
**Target Platform**: Expo native (iOS/Android) and web  
**Project Type**: Mobile app with web support  
**Performance Goals**: Preserve current launch responsiveness, avoid clipped or overlapping content at supported viewport sizes, and keep interactive flows stable during layout changes  
**Constraints**: Preserve the existing setup/game/history flows, keep state ownership in the current store, avoid introducing new persistence or migration work, and keep the responsive work focused on presentation and layout rather than gameplay rules  
**Scale/Scope**: Three primary route screens (`app/setupGame.tsx`, `app/gameProgress.tsx`, `app/history.tsx`) plus their screen-local child components, modal shells, shared UI primitives, and targeted tests

## Constitution Check

_GATE: Must pass before Phase 0 implementation. Re-check after the responsive layout design is finalized._

- PASS: Cross-platform behavior is defined for native and web, with explicit phone-sized and desktop-wide acceptance targets.
- PASS: Shared-state ownership remains unchanged; the current store continues to hold setup, gameplay, and history data.
- PASS: No new data model, migration, backfill, or security scope is introduced.
- PASS: The work is split into independently deliverable screen slices with Gherkin-style acceptance criteria already captured in the spec.
- PASS: The test strategy includes unit coverage for each migrated screen and end-to-end coverage for the substantial UI changes.
- PASS: Repository and domain skills were identified before planning: `project-planner` for plan structuring, `react-doctor` for React regression checks, and `react-native-testing` for component-level test guidance.

## Project Structure

### Documentation (this feature)

```text
specs/004-responsive-core-screens/
├── spec.md              # Feature specification and clarified requirements
├── plan.md              # This file
├── research.md          # Next-phase design notes
├── data-model.md        # Next-phase conceptual model
├── quickstart.md        # Next-phase validation guide
├── contracts/           # Next-phase interface/behavior contracts
└── tasks.md             # Generated after the plan is accepted
```

### Source Code (repository root)

```text
app/
├── setupGame.tsx
├── gameProgress.tsx
├── history.tsx
└── style/

components/
├── setupGame/
├── gameProgress/
├── history/
└── ui/

platform/
test-utils/
__tests__/
e2e/
tamagui.config.ts
babel.config.js
playwright.config.ts
```

**Structure Decision**: This remains a single Expo application. Responsive layout work should be centered in the route-level screens and their local child components, while shared width, spacing, and container behavior should live in `components/ui/` and the existing style helpers under `app/style/`. The plan does not introduce new app packages or a parallel screen architecture.

## Milestones

| #   | Milestone                               | Target  | Success Criteria                                                                                               |
| --- | --------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Responsive layout audit complete        | Phase 0 | The screen-by-screen layout boundaries, viewport targets, and wide-screen strategy are documented and agreed   |
| 2   | Shared responsive primitives stabilized | Phase 1 | Common width, spacing, and content-container behavior is reusable across setup, gameplay, and history          |
| 3   | Setup screen migrated                   | Phase 2 | Setup remains usable on phone-sized and desktop-wide viewports without clipping, overlap, or broken flow order |
| 4   | Gameplay screen migrated                | Phase 3 | Gameplay, quick actions, and end-game flows remain usable across the target viewport classes                   |
| 5   | History screen migrated                 | Phase 4 | History tabs, sorting, and detail views remain readable and usable across the target viewport classes          |
| 6   | Regression suite passes                 | Phase 5 | Targeted Jest and Playwright checks pass for the migrated screens and responsive edge cases                    |

## Phase 0: Layout Audit & Responsive Decisions

**Goal**: Lock the responsive strategy before making screen changes so each route uses the same width and spacing rules where appropriate.

| Task                                                                                                    | Effort | Owner    | Depends On         | Done Criteria                                                                                                                |
| ------------------------------------------------------------------------------------------------------- | ------ | -------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Inventory the setup, gameplay, and history route containers plus their layout-critical child components | S      | Engineer | -                  | The layout-critical surfaces and modal shells are identified for all three screens                                           |
| Define the phone-sized and desktop-wide behavior for each screen                                        | S      | Engineer | Inventory          | Each route has a clear decision on whether it remains single-column or may use multi-column/split-pane layout at wide widths |
| Confirm which child components and modals need screen-specific responsive changes                       | S      | Engineer | Inventory          | The migration scope is bounded to the components that directly affect screen usability                                       |
| Reconfirm test targets and viewport classes                                                             | S      | Engineer | Behavior decisions | Phone-sized and desktop-wide validation targets are explicit and reflected in the plan                                       |

**Deliverable**: A stable responsive layout decision set that can guide the shared primitive work and the three route migrations.

## Phase 1: Shared Responsive Primitives & Layout Rules

**Goal**: Establish reusable layout wrappers and width/spacing rules so the screen migrations do not each solve the same problem differently.

| Task                                                                                                      | Effort | Owner    | Depends On   | Done Criteria                                                                                      |
| --------------------------------------------------------------------------------------------------------- | ------ | -------- | ------------ | -------------------------------------------------------------------------------------------------- |
| Review the current Tamagui shell primitives and style helpers for reuse opportunities                     | S      | Engineer | Phase 0      | The reusable container, card, and action-button surfaces are identified                            |
| Add or adjust shared responsive wrappers for centered content, max-width constraints, and section spacing | M      | Engineer | Phase 0      | A consistent shell for wide screens is available to the route screens                              |
| Confirm the shared responsive rules work with the existing theme tokens and colors                        | S      | Engineer | Layout rules | The shared wrappers preserve the current design language and do not fight the palette/theme bridge |
| Keep route state and navigation logic untouched while the presentation layer is refactored                | S      | Engineer | Layout rules | No screen logic changes are introduced by the shared primitive work                                |

**Deliverable**: Shared layout behavior that can be reused by all three route migrations.

## Phase 2: Setup Screen Migration

**Goal**: Move the setup flow to the responsive Tamagui layout model while keeping the current wizard flow and game-start behavior intact.

| Task                                                                                                                              | Effort | Owner    | Depends On            | Done Criteria                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| Migrate `app/setupGame.tsx` to use the new responsive shell/container pattern                                                     | M      | Engineer | Phase 1               | The route renders correctly at the target viewport classes                                     |
| Update `components/setupGame/SetupWizard.tsx` and adjacent setup components to support the wide-screen layout rules               | M      | Engineer | Phase 1               | Step navigation, content order, and primary actions remain usable on phone and desktop widths  |
| Apply responsive adjustments to the setup lists, selectors, and assignment section where they affect readability or touch targets | M      | Engineer | Setup route migration | The input and selection surfaces remain readable and usable when the viewport grows or shrinks |
| Preserve the existing setup flow logic, including validation, random assignment, and start-game transitions                       | S      | Engineer | Setup route migration | No behavior regression is introduced in the underlying flow                                    |

**Deliverable**: Setup works on the target viewport classes and still behaves like the current app flow.

## Phase 3: Gameplay Screen Migration

**Goal**: Move the in-game experience to the responsive Tamagui layout model without disturbing match review, tab switching, quick actions, or end-game behavior.

| Task                                                                                                                                      | Effort | Owner    | Depends On               | Done Criteria                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------------------------ | ------------------------------------------------------------------------------------ |
| Migrate `app/gameProgress.tsx` to the new responsive shell/container pattern                                                              | M      | Engineer | Phase 1                  | The gameplay screen renders cleanly on phone-sized and desktop-wide viewports        |
| Update `components/gameProgress/TabNavigation.tsx`, `MatchesGrid`, `PlayersList`, and footer controls for the chosen wide-screen behavior | L      | Engineer | Phase 1                  | The active-game tabs and main content remain usable across both validation viewports |
| Reconcile the quick-action modal and end-game modal shells with the new layout rules                                                      | M      | Engineer | Gameplay route migration | Modals remain centered, readable, and usable even when the viewport changes          |
| Preserve refresh, live-score, and gameplay controller behavior while changing presentation                                                | S      | Engineer | Gameplay route migration | The data and interaction model stays consistent with the pre-migration app           |

**Deliverable**: Gameplay is responsive without losing access to the primary in-session controls.

## Phase 4: History Screen Migration

**Goal**: Move the history screen to the responsive Tamagui layout model while keeping session browsing, sorting, tabs, and detail views intact.

| Task                                                                                                                                                    | Effort | Owner    | Depends On              | Done Criteria                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| Migrate `app/history.tsx` to the new responsive shell/container pattern                                                                                 | M      | Engineer | Phase 1                 | The route renders correctly on phone-sized and desktop-wide viewports                      |
| Update `components/history/HistoryHeader.tsx`, the tabbed history surface, and the history list/stat surfaces to respect the selected wide-screen rules | L      | Engineer | Phase 1                 | Tabs, sorting, and the main content remain readable and reachable at both viewport classes |
| Rework any history modal shells or detail views that need layout-aware behavior                                                                         | M      | Engineer | History route migration | Detail views remain usable and do not clip when the viewport changes                       |
| Keep history calculations, sorting, and selection logic unchanged while the layout is refactored                                                        | S      | Engineer | History route migration | The browsing and summary behavior matches the current app                                  |

**Deliverable**: History works across the target viewport classes without regressions in browsing or detail interactions.

## Phase 5: Regression Hardening & Validation

**Goal**: Prove the migrated screens are usable on the target viewport classes and that the layout changes did not introduce web or native regressions.

| Task                                                                                           | Effort | Owner    | Depends On       | Done Criteria                                                                  |
| ---------------------------------------------------------------------------------------------- | ------ | -------- | ---------------- | ------------------------------------------------------------------------------ |
| Add or update Jest coverage for each migrated screen and the responsive helper surfaces        | M      | Engineer | Phases 2-4       | The route-level and component-level responsive behavior is covered by tests    |
| Add or update Playwright BDD coverage for phone-sized and desktop-wide web journeys            | M      | Engineer | Phases 2-4       | The primary setup, gameplay, and history journeys are validated in the browser |
| Run lint, unit tests, and browser tests; fix any clipped, overlapping, or unreachable controls | M      | Engineer | All prior phases | Validation passes on the migrated feature set                                  |
| Update any developer notes or quickstart guidance needed for the new responsive behavior       | S      | Engineer | Validation       | The feature is ready for handoff to task generation or implementation          |

**Deliverable**: A green validation pass for the responsive screen migration.

## Dependencies Map

```text
Layout Audit ──> Shared Responsive Primitives ──> Setup Migration ──> Gameplay Migration ──> History Migration ──> Regression Hardening
                       └───────────────────────────────────────────────────────────────────────────────┘
```

**Critical Path**: Layout audit -> shared responsive primitives -> setup migration -> gameplay migration -> history migration -> validation. The wide-screen rules should be stabilized before the route migrations so the screen implementations do not diverge.

## Risks & Mitigation

| Risk                                                                                         | Impact | Probability | Mitigation                                                                                                                     |
| -------------------------------------------------------------------------------------------- | ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Wide layouts stretch lists, cards, or tabs too far on desktop web                            | High   | Medium      | Constrain content width, center the main column where needed, and verify with browser checks at the desktop-wide viewport      |
| Screen-local modals or child components keep mobile-only assumptions                         | High   | Medium      | Include the visible child components and modal shells in the migration scope and test them at both viewport classes            |
| Gameplay refresh, quick actions, or live state interactions regress while the layout changes | High   | Medium      | Keep controller/state logic intact and limit the work to presentation changes unless a clear layout bug requires a small fix   |
| History sorting or detail views become awkward in a wide layout                              | Medium | Medium      | Validate the history screen after each layout change and keep the content hierarchy readable with width caps and spacing rules |
| Web-only clipping or scroll regressions are not caught by unit tests alone                   | High   | High        | Use Playwright BDD scenarios for the phone-sized and desktop-wide browser journeys                                             |

## Resource Allocation

| Role                 | Effort    | Key Responsibilities                                                                           |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| Primary engineer     | Full-time | Layout decisions, screen migrations, shared responsive primitives, and regression fixes        |
| QA/verification pass | Part-time | Browser validation, viewport checks, and sanity-testing the setup, gameplay, and history flows |

## Validation Strategy

- Use focused screen tests to verify the responsive layout behavior of setup, gameplay, and history at the two required viewport classes.
- Use browser automation to confirm the primary journeys still work on the web after each route migration.
- Run lint and targeted Jest tests after each screen lands so layout regressions are isolated early.
- Keep the state and data logic unchanged unless a layout bug exposes a small, local defect.

## Complexity Tracking

No constitution violations require justification at this time.
