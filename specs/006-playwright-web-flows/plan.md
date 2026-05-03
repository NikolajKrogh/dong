# Implementation Plan: Web Flow Browser Coverage

**Branch**: `006-playwright-web-flows` | **Date**: 2026-05-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `spec.md`

## Summary

Establish a stable browser test suite for the Expo web app that covers the home smoke path and the setup-to-start-game journey through shared steps and a single repeatable entrypoint. Consolidate overlapping browser checks so the canonical web-flow coverage lives in one place, and keep standalone specs only for any non-overlapping regression checks that cannot be expressed cleanly in the shared flow.

## Technical Context

**Language/Version**: TypeScript 5.3.3  
**Primary Dependencies**: Expo SDK 52, React Native 0.76.9, React 18.3.1, Expo Router 4, `playwright-bdd` 8.5.0, `@playwright/test` 1.59.1, `react-native-safe-area-context`, `react-native-toast-message`, Zustand 5  
**Storage**: N/A; this feature does not change persisted app data  
**Testing**: Playwright BDD browser-flow coverage plus unit tests for any new test-support helpers or fixtures introduced by the suite  
**Applicable Skills**: systematic-debugging  
**Target Platform**: Expo web  
**Project Type**: Mobile app with web end-to-end automation  
**Performance Goals**: Fast, repeatable local and CI runs that fail on real app readiness issues rather than loading shells  
**Constraints**: Expo hydration can lag, onboarding may appear before home content, tests must avoid false positives from stale state, and `bddgen` must run before `playwright test`  
**Scale/Scope**: One canonical browser feature file, one shared step file, and at most one standalone regression spec if it proves unique value

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Cross-platform behavior is defined for the web app, and native behavior is unchanged.
- No shared-state, persistence, or backend mutation changes are required.
- No data-model, migration, or backfill work is involved.
- The work is sliced into independently deliverable user stories with Gherkin acceptance criteria.
- The test plan includes unit coverage for any new helpers and end-to-end coverage for the primary browser flows.
- Applicable skills are identified before implementation begins.

## Test Strategy

- Use `e2e/features/app-shell.feature` as the canonical browser-flow spec for the home smoke path and the setup-to-start-game journey.
- Keep shared startup and readiness logic in the step definitions so the tests wait for actual app content instead of page load events.
- Parameterize setup data so player counts, match selection, and starting state can vary without rewriting the flow.
- Move duplicate smoke-only browser checks into the BDD flow or retire them once the BDD scenarios cover the same behavior.
- Keep `e2e/playwright/home-shell-flow.spec.ts` only if it preserves unique regression coverage that cannot be represented cleanly in the shared browser-flow suite.
- Keep `playwright.home.config.ts` only if a standalone browser spec remains necessary; otherwise run everything through `playwright.config.ts`.
- Split setup-specific helpers into a focused step file only if `app-shell.steps.ts` becomes too dense, while preserving a single shared startup path.

## Project Structure

### Documentation (this feature)

```text
specs/006-playwright-web-flows/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
e2e/
├── features/
│   └── app-shell.feature
├── steps/
│   ├── app-shell.steps.ts
│   └── fixtures.ts
└── playwright/
    ├── home-shell-flow.spec.ts
    ├── shell-launch.spec.ts
    └── shell-theme-switch.spec.ts

playwright.config.ts
playwright.home.config.ts
package.json
```

**Structure Decision**: Canonical browser coverage should live in `e2e/features/` and `e2e/steps/`. Move the smoke-only coverage from `shell-launch.spec.ts` and `shell-theme-switch.spec.ts` into the BDD flow, and only keep `home-shell-flow.spec.ts` or `playwright.home.config.ts` if they provide a unique regression that cannot be expressed cleanly in the shared browser-flow suite. If they do not, remove the standalone home config and keep one browser test entrypoint.

## Complexity Tracking

No constitution violations require justification.
