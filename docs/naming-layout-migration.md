# Naming and layout migration journal

Branch: `refactor/file-naming-and-layout`. Started: 2026-10-28.

## Purpose and agreed conventions

Keep related implementation together so that feature work does not require searching through root components, hooks, utils and styles folders. Give files names that describe their subject and actual responsibility. This migration changes organization and names, not application behavior or visual design.

- Feature/domain directories use kebab-case; component-owned directories may match the PascalCase component name.
- Components and class-based files use PascalCase matching the main exported component/class. Screens use the Screen suffix.
- Hooks use useCamelCase. Function modules use camelCase, with a meaningful role suffix such as Service, Repository, Client, Transport, Adapter, Strategy, Visitor, Reducer, Parser or Schemas where the implementation warrants it.
- Keep a feature flat until internal groups become useful. Keep feature-owned hooks, styles, types and helpers beside their callers.
- Reserve index files for deliberate public exports and framework/platform entry points. Other implementations get descriptive filenames.
- Tests mirror source paths and names. Preserve existing test-selection suffixes during moves.
- Preserve route URLs, platform suffixes, deployed function names, migration history, generated contracts, assets and tool-discovered configuration paths.
- Shared application state stays in store; theme/tokens stay in styles; genuinely shared UI stays in components/ui; SDK setup stays in lib; cross-runtime contracts and helpers retain shared ownership.

Consult codebase-design and naming-analyzer for each milestone: establish the owning module and interface, then choose names that describe the actual implementation. No speculative classes, strategies, service layers, or state extraction.

## Scope and worktree preservation

Existing package.json, skills-lock.json and installed/deleted skill-file changes are unrelated and remain unstaged. Existing blueprint/audit/inventory documents are left untouched. This journal is the newly requested implementation record. Commits contain only migration-owned changes, using explicit paths; never git add everything.

The older blueprint and inventory describe the pre-migration snapshot. This journal records actual changes and supersedes their placement proposals where implementation evidence leads to a more precise owner.

## Milestones

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 | Baseline checks, agreed standard and migration journal | Complete |
| M1 | PreferencesHeader, GameProgressTabs and SetupGameTabs pilot | Planned |
| M2 | History feature ownership and mirrored tests | Planned |
| M3 | Home, Preferences and Account/Auth ownership | Planned |
| M4 | Game setup and match-selection ownership | Planned |
| M5 | Gameplay, rooms and football-match client ownership | Planned |
| M6 | Shared names, import-policy coverage and final verification | Planned |

Each milestone includes a commit after its checks. Split a milestone further if dependencies or failures make a smaller passing batch preferable. Preserve errors, validation, cancellation, persisted keys, test IDs and user-visible copy.

## M0 — Baseline

- Typecheck: passed before source changes.
- Unused-code check: passed before source changes.
- Lint: passed before source changes.
- Jest: passed with the workspace cache (`npm run test:ci -- --runInBand --cacheDirectory=node_modules/.cache/naming-layout-jest`). Initial run executed zero tests because the sandbox temporary transform cache failed with EPERM on rename; no application fix was required.
- Existing unrelated changes have been inspected and remain outside the migration.

## M1 — Ambiguous UI names

| Old path | New path | Why the name fits / why it moves |
| --- | --- | --- |
| components/preferences/Header.tsx | components/preferences/PreferencesHeader.tsx | Names the preferences-styled title/back header in search results. Ownership move comes with the Preferences milestone. |
| components/gameProgress/TabNavigation.tsx | components/gameProgress/GameProgressTabs.tsx | Names progress match/player tabs with counts, refresh and swipe behavior. Ownership move comes with Gameplay. |
| components/setupGame/TabNavigation.tsx | components/setupGame/SetupGameTabs.tsx | Distinguishes setup player/match/assignment tabs from progress tabs. Ownership move comes with Game setup. |

Rename the exported symbols, prop types and mirrored test basenames together. Keep test IDs and rendered behavior unchanged. No compatibility re-export files are needed because internal consumers are updated in the same commit.

## Planned ownership decisions

History moves from components/history and its owned styles/logic into features/history, whose existing public interface is retained. Home and Preferences follow their existing screen ownership. Setup and Progress become game-setup and game-progress features. Guest joining and lobby behavior belong to rooms. Client football-match operation modules belong together, but contracts used by app and Edge stay shared. Navigation utilities are shared infrastructure, not owned by a screen merely because that screen currently uses them.

Exact path maps, dependency-driven exceptions, checks and results are appended below before each milestone commit.

## Verification strategy

Use existing Jest/component tests for behavior and import resolution, TypeScript, ESLint and Knip for static checks. Run affected tests per batch and the whole suite at completion. Use existing web Playwright journeys and axe where runtime verification is relevant and available; no new Android exploration is required for path-only changes. Run React Doctor after React changes. Existing diagnostics must be recorded separately from introduced regressions. No hosted service deployment or database migration is part of this cleanup.
