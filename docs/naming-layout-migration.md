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
| M1 | PreferencesHeader, GameProgressTabs and SetupGameTabs pilot | Complete |
| M2 | History feature ownership and mirrored tests | Complete |
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

Applied all three source renames and the corresponding three test renames using git mv. Updated SettingsPage, the progress route and its test mock. Validation: four affected suites / 12 tests passed, typecheck passed, lint passed. The baseline suite contains 160 suites / 1,043 tests, all passing. React Doctor is running as an additional review; its results will be recorded before the next milestone.

## Planned ownership decisions

History moves from components/history and its owned styles/logic into features/history, whose existing public interface is retained. Home and Preferences follow their existing screen ownership. Setup and Progress become game-setup and game-progress features. Guest joining and lobby behavior belong to rooms. Client football-match operation modules belong together, but contracts used by app and Edge stay shared. Navigation utilities are shared infrastructure, not owned by a screen merely because that screen currently uses them.

Exact path maps, dependency-driven exceptions, checks and results are appended below before each milestone commit.

## Verification strategy

Use existing Jest/component tests for behavior and import resolution, TypeScript, ESLint and Knip for static checks. Run affected tests per batch and the whole suite at completion. Use existing web Playwright journeys and axe where runtime verification is relevant and available; no new Android exploration is required for path-only changes. Run React Doctor after React changes. Existing diagnostics must be recorded separately from introduced regressions. No hosted service deployment or database migration is part of this cleanup.

## M2 — History ownership

History screens, modal UI, formatting/statistics, layout/types and styles now share the existing History module. The /history entry remains at app/history.tsx and forwards to the named HistoryScreen implementation; it is a framework route entry, not a temporary compatibility shim. Existing filenames already describe their responsibilities, so they retain their names during relocation. Tests follow their implementations, including history utility and hook tests previously filed under technical roots.

| Old path | New path | Reason |
| --- | --- | --- |
| __tests__/components/history/GameDetailsModal.platform.test.tsx | __tests__/features/history/GameDetailsModal.platform.test.tsx | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/components/history/GameHistoryItem.test.tsx | __tests__/features/history/GameHistoryItem.test.tsx | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/components/history/HistoryHeader.platform.test.tsx | __tests__/features/history/HistoryHeader.platform.test.tsx | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/components/history/HistoryModalWeb.test.tsx | __tests__/features/history/HistoryModalWeb.test.tsx | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/components/history/HistoryPlayersStats.platform.test.tsx | __tests__/features/history/HistoryPlayersStats.platform.test.tsx | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/components/history/HistoryStatistics.platform.test.tsx | __tests__/features/history/HistoryStatistics.platform.test.tsx | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/components/history/HistoryTeamBadge.test.tsx | __tests__/features/history/HistoryTeamBadge.test.tsx | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/components/history/PlayerComparisonModal.platform.test.tsx | __tests__/features/history/PlayerComparisonModal.platform.test.tsx | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/components/history/PlayerDetailsModal.platform.test.tsx | __tests__/features/history/PlayerDetailsModal.platform.test.tsx | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/components/history/SharedHistoryNavigation.platform.test.tsx | __tests__/features/history/SharedHistoryNavigation.platform.test.tsx | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/components/history/SharedHistoryScreen.platform.test.tsx | __tests__/features/history/SharedHistoryScreen.platform.test.tsx | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/components/history/SortHistoryModal.platform.test.tsx | __tests__/features/history/SortHistoryModal.platform.test.tsx | Mirror the History implementation and retain the existing suite behavior. |
| components/history/GameDetailsModal.tsx | features/history/GameDetailsModal.tsx | Collect History-owned implementation behind the existing feature interface. |
| components/history/GameHistoryItem.tsx | features/history/GameHistoryItem.tsx | Collect History-owned implementation behind the existing feature interface. |
| components/history/HistoryHeader.tsx | features/history/HistoryHeader.tsx | Collect History-owned implementation behind the existing feature interface. |
| components/history/HistoryModalFrame.tsx | features/history/HistoryModalFrame.tsx | Collect History-owned implementation behind the existing feature interface. |
| components/history/HistoryTeamBadge.tsx | features/history/HistoryTeamBadge.tsx | Collect History-owned implementation behind the existing feature interface. |
| components/history/MatchCard.tsx | features/history/MatchCard.tsx | Collect History-owned implementation behind the existing feature interface. |
| components/history/OverallStats.tsx | features/history/OverallStats.tsx | Collect History-owned implementation behind the existing feature interface. |
| components/history/PlayerComparisonModal.tsx | features/history/PlayerComparisonModal.tsx | Collect History-owned implementation behind the existing feature interface. |
| components/history/PlayerDetailsModal.tsx | features/history/PlayerDetailsModal.tsx | Collect History-owned implementation behind the existing feature interface. |
| components/history/PlayerStatsList.tsx | features/history/PlayerStatsList.tsx | Collect History-owned implementation behind the existing feature interface. |
| components/history/SortHistoryModal.tsx | features/history/SortHistoryModal.tsx | Collect History-owned implementation behind the existing feature interface. |
| components/history/TooltipModal.tsx | features/history/TooltipModal.tsx | Collect History-owned implementation behind the existing feature interface. |
| components/history/historyLayout.ts | features/history/historyLayout.ts | Collect History-owned implementation behind the existing feature interface. |
| components/history/historyTypes.ts | features/history/historyTypes.ts | Collect History-owned implementation behind the existing feature interface. |
| components/history/historyUtils.ts | features/history/historyUtils.ts | Collect History-owned implementation behind the existing feature interface. |
| styles/historyStyles.ts | features/history/historyStyles.ts | Collect History-owned implementation behind the existing feature interface. |
| __tests__/utils/historyLayout.test.ts | __tests__/features/history/historyLayout.test.ts | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/utils/historyUtils.test.ts | __tests__/features/history/historyUtils.test.ts | Mirror the History implementation and retain the existing suite behavior. |
| __tests__/hooks/useHistory.test.ts | __tests__/features/history/useHistory.test.ts | Mirror the History implementation and retain the existing suite behavior. |
| app/history.tsx | features/history/HistoryScreen.tsx | Make the route entry thin while preserving its URL. |
| __tests__/app/history.platform.test.tsx | __tests__/features/history/HistoryScreen.platform.test.tsx | Mirror the History implementation and retain the existing suite behavior. |

M2 validation: the full 160-suite / 1,043-test Jest suite passed after relocation, as did typecheck, lint and Knip. The initially supplied plural Jest filter was not recognized by Jest 29, so the run covered the full suite; subsequent focused runs use --testPathPattern.
