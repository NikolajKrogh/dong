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
| M3 | Home, Preferences and Account/Auth ownership | Complete; auth forms completed in M6a |
| M4 | Game setup and match-selection ownership | Complete |
| M5 | Gameplay, rooms and football-match client ownership | Complete (M5a, M5b, M5c) |
| M6 | Shared names, import-policy coverage and final verification | Complete; browser/accessibility findings recorded below |

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

## M3 — Home, Preferences and account hooks

Home UI, calculations, styles and its room-action hook move together. Preferences UI and route implementations move together; indexStyles becomes homeStyles and userPreferencesStyles becomes preferencesStyles to name the owning feature instead of an entry filename or legacy route. Account auth/session/settings hooks and auth-route helpers belong beside accountRepository. Existing route URLs remain thin entry points. The shared onboarding screen remains temporarily at its current location pending the final shared-ownership review.

| Old path | New path | Reason |
| --- | --- | --- |
| __tests__/components/preferences/AccountSection.platform.test.tsx | __tests__/features/preferences/AccountSection.platform.test.tsx | Mirror source ownership and preserve the existing test qualifier. |
| __tests__/components/preferences/AppearanceSettings.platform.test.tsx | __tests__/features/preferences/AppearanceSettings.platform.test.tsx | Mirror source ownership and preserve the existing test qualifier. |
| __tests__/components/preferences/LeagueSettings.platform.test.tsx | __tests__/features/preferences/LeagueSettings.platform.test.tsx | Mirror source ownership and preserve the existing test qualifier. |
| __tests__/components/preferences/PreferencesHeader.accessibility.test.tsx | __tests__/features/preferences/PreferencesHeader.accessibility.test.tsx | Mirror source ownership and preserve the existing test qualifier. |
| __tests__/components/preferences/ProfileSection.platform.test.tsx | __tests__/features/preferences/ProfileSection.platform.test.tsx | Mirror source ownership and preserve the existing test qualifier. |
| __tests__/components/preferences/SelectDefaultLeaguesModal.platform.test.tsx | __tests__/features/preferences/SelectDefaultLeaguesModal.platform.test.tsx | Mirror source ownership and preserve the existing test qualifier. |
| __tests__/components/preferences/SoundNotificationSettings.platform.test.tsx | __tests__/features/preferences/SoundNotificationSettings.platform.test.tsx | Mirror source ownership and preserve the existing test qualifier. |
| components/home/CancelGameModal.tsx | features/home/CancelGameModal.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/home/CurrentGameCard.tsx | features/home/CurrentGameCard.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/home/HistoryStatsCard.tsx | features/home/HistoryStatsCard.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/home/HomeGameActions.tsx | features/home/HomeGameActions.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/home/HomeSplash.tsx | features/home/HomeSplash.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/home/JoinRoomModal.tsx | features/home/JoinRoomModal.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/home/StartGameSheet.tsx | features/home/StartGameSheet.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/preferences/AccountAvatar.tsx | features/preferences/AccountAvatar.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/preferences/AccountSection.tsx | features/preferences/AccountSection.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/preferences/AddLeagueModal.tsx | features/preferences/AddLeagueModal.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/preferences/AppearanceSettings.tsx | features/preferences/AppearanceSettings.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/preferences/LeagueSettings.tsx | features/preferences/LeagueSettings.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/preferences/ManageLeaguesModal.tsx | features/preferences/ManageLeaguesModal.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/preferences/PreferencesHeader.tsx | features/preferences/PreferencesHeader.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/preferences/ProfileSection.tsx | features/preferences/ProfileSection.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/preferences/SelectDefaultLeaguesModal.tsx | features/preferences/SelectDefaultLeaguesModal.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/preferences/SettingsMenuRow.tsx | features/preferences/SettingsMenuRow.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/preferences/SettingsPage.tsx | features/preferences/SettingsPage.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| components/preferences/SoundNotificationSettings.tsx | features/preferences/SoundNotificationSettings.tsx | Keep implementation with its owning feature; retain its descriptive role. |
| app/index.tsx | features/home/HomeScreen.tsx | Named feature implementation behind the unchanged route. |
| __tests__/app/index.platform.test.tsx | __tests__/features/home/HomeScreen.platform.test.tsx | Mirror source ownership and preserve the existing test qualifier. |
| app/userPreferences.tsx | features/preferences/PreferencesScreen.tsx | Named feature implementation behind the unchanged route. |
| __tests__/app/userPreferences.platform.test.tsx | __tests__/features/preferences/PreferencesScreen.platform.test.tsx | Mirror source ownership and preserve the existing test qualifier. |
| styles/indexStyles.ts | features/home/homeStyles.ts | Keep implementation with its owning feature; retain its descriptive role. |
| styles/userPreferencesStyles.ts | features/preferences/preferencesStyles.ts | Keep implementation with its owning feature; retain its descriptive role. |
| utils/homeStats.ts | features/home/homeStats.ts | Keep implementation with its owning feature; retain its descriptive role. |
| __tests__/utils/homeStats.test.ts | __tests__/features/home/homeStats.test.ts | Mirror source ownership and preserve the existing test qualifier. |
| hooks/useHomeRoomActions.ts | features/home/useHomeRoomActions.ts | Keep implementation with its owning feature; retain its descriptive role. |
| __tests__/hooks/useHomeRoomActions.exit.test.ts | __tests__/features/home/useHomeRoomActions.exit.test.ts | Mirror source ownership and preserve the existing test qualifier. |
| __tests__/hooks/useHomeRoomActions.guestStart.test.ts | __tests__/features/home/useHomeRoomActions.guestStart.test.ts | Mirror source ownership and preserve the existing test qualifier. |
| app/userPreferences/appearance.tsx | features/preferences/AppearanceSettingsScreen.tsx | Named feature implementation behind the unchanged route. |
| app/userPreferences/leagues.tsx | features/preferences/LeagueSettingsScreen.tsx | Named feature implementation behind the unchanged route. |
| app/userPreferences/profile.tsx | features/preferences/ProfileSettingsScreen.tsx | Named feature implementation behind the unchanged route. |
| app/userPreferences/sound.tsx | features/preferences/SoundSettingsScreen.tsx | Named feature implementation behind the unchanged route. |
| hooks/useAccountAuth.ts | features/account/useAccountAuth.ts | Keep implementation with its owning feature; retain its descriptive role. |
| hooks/useAccountSessionSync.ts | features/account/useAccountSessionSync.ts | Keep implementation with its owning feature; retain its descriptive role. |
| hooks/useAccountSettingsSync.ts | features/account/useAccountSettingsSync.ts | Keep implementation with its owning feature; retain its descriptive role. |
| __tests__/hooks/useAccountAuth.test.ts | __tests__/features/account/useAccountAuth.test.ts | Mirror source ownership and preserve the existing test qualifier. |
| utils/accountAuthRoutes.ts | features/account/accountAuthRoutes.ts | Keep implementation with its owning feature; retain its descriptive role. |
| __tests__/app/userPreferencesProfile.platform.test.tsx | __tests__/features/preferences/ProfileSettingsScreen.platform.test.tsx | Mirror source ownership and preserve the existing test qualifier. |

M3 validation: 37 affected suites / 263 tests passed; typecheck, lint and Knip passed. Account implementation imports repository/username siblings directly rather than its own public index to avoid a circular import. Cross-feature consumers use the account public interface; partial Jest mocks retain the other exports they need. Home statistics uses explicitly exported History types/calculations. Preferences exposes its route screens and the shared SettingsPage used by Friends/History. Removed obsolete hook convenience re-exports rather than retaining unused compatibility aliases. The renamed AppearanceSettingsScreen and PreferencesScreen exports now match their filenames.

React Doctor pilot review: the sandbox invocation stalled without a result and was stopped; no successful diagnostic score is claimed. A later unrestricted run will be used for final verification.

## M4 — Game setup and match selection

Setup UI, filters, player suggestions, assignment calculation and styles now live in game-setup. Match selection is reused by room configuration through the same owning module rather than a separate technical root. setupGameAssignments becomes createRandomAssignments because its only public operation constructs assignments; no Strategy class is introduced. The old root components index moves into the feature as its public interface, and empty statements are removed. The obsolete useTeamFiltering shim has no hook implementation: callers use the canonical match filter directly.

| Old path | New path | Reason |
| --- | --- | --- |
| __tests__/components/matchSelection/MatchSelectionCard.platform.test.tsx | __tests__/features/game-setup/MatchSelectionCard.platform.test.tsx | Mirror game-setup ownership. |
| __tests__/components/matchSelection/SelectableMatchList.platform.test.tsx | __tests__/features/game-setup/SelectableMatchList.platform.test.tsx | Mirror game-setup ownership. |
| __tests__/components/setupGame/AssignmentSection.platform.test.tsx | __tests__/features/game-setup/AssignmentSection.platform.test.tsx | Mirror game-setup ownership. |
| __tests__/components/setupGame/CommonMatchSelector.platform.test.tsx | __tests__/features/game-setup/CommonMatchSelector.platform.test.tsx | Mirror game-setup ownership. |
| __tests__/components/setupGame/LeagueFilter.platform.test.tsx | __tests__/features/game-setup/LeagueFilter.platform.test.tsx | Mirror game-setup ownership. |
| __tests__/components/setupGame/MatchFilter.platform.test.tsx | __tests__/features/game-setup/MatchFilter.platform.test.tsx | Mirror game-setup ownership. |
| __tests__/components/setupGame/MatchList.platform.test.tsx | __tests__/features/game-setup/MatchList.platform.test.tsx | Mirror game-setup ownership. |
| __tests__/components/setupGame/PlayerList.platform.test.tsx | __tests__/features/game-setup/PlayerList.platform.test.tsx | Mirror game-setup ownership. |
| __tests__/components/setupGame/SetupGameTabs.platform.test.tsx | __tests__/features/game-setup/SetupGameTabs.platform.test.tsx | Mirror game-setup ownership. |
| __tests__/components/setupGame/SetupWizard.platform.test.tsx | __tests__/features/game-setup/SetupWizard.platform.test.tsx | Mirror game-setup ownership. |
| __tests__/components/setupGame/TeamSelectionRow.layout.platform.test.tsx | __tests__/features/game-setup/TeamSelectionRow.layout.platform.test.tsx | Mirror game-setup ownership. |
| components/matchSelection/MatchSelectionCard.tsx | features/game-setup/MatchSelectionCard.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/matchSelection/SelectableMatchList.tsx | features/game-setup/SelectableMatchList.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/AssignmentControls.tsx | features/game-setup/AssignmentControls.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/AssignmentSection.tsx | features/game-setup/AssignmentSection.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/CommonMatchSelector.tsx | features/game-setup/CommonMatchSelector.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/LeagueFilter.tsx | features/game-setup/LeagueFilter.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/LeagueMatchSections.tsx | features/game-setup/LeagueMatchSections.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/MatchFilter.tsx | features/game-setup/MatchFilter.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/MatchList.tsx | features/game-setup/MatchList.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/PlayerList.tsx | features/game-setup/PlayerList.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/PlayerSuggestionDropdown.tsx | features/game-setup/PlayerSuggestionDropdown.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/RandomMatchesToast.tsx | features/game-setup/RandomMatchesToast.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/SetupGameTabs.tsx | features/game-setup/SetupGameTabs.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/SetupWizard.tsx | features/game-setup/SetupWizard.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/setupGame/TeamSelectionRow.tsx | features/game-setup/TeamSelectionRow.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| components/index.ts | features/game-setup/index.ts | Make the existing setup exports the owning feature public interface. |
| styles/setupGameStyles.ts | features/game-setup/setupGameStyles.ts | Collect setup implementation; preserve behavior and the /setupGame URL. |
| utils/setupGameAssignments.ts | features/game-setup/createRandomAssignments.ts | Name the exported assignment operation. |
| hooks/useMatchListFilters.ts | features/game-setup/useMatchListFilters.ts | Collect setup implementation; preserve behavior and the /setupGame URL. |
| hooks/usePlayerSuggestions.ts | features/game-setup/usePlayerSuggestions.ts | Collect setup implementation; preserve behavior and the /setupGame URL. |
| __tests__/hooks/useMatchListFilters.test.ts | __tests__/features/game-setup/useMatchListFilters.test.ts | Mirror game-setup ownership. |
| __tests__/hooks/usePlayerSuggestions.test.ts | __tests__/features/game-setup/usePlayerSuggestions.test.ts | Mirror game-setup ownership. |
| app/setupGame.tsx | features/game-setup/SetupGameScreen.tsx | Collect setup implementation; preserve behavior and the /setupGame URL. |
| __tests__/app/setupGame.platform.test.tsx | __tests__/features/game-setup/SetupGameScreen.platform.test.tsx | Mirror game-setup ownership. |

## Refactor later — findings recorded during implementation

These are follow-up candidates, not changes to be bundled into this migration. Preserve existing behavior until their own requirements and tests are agreed.

| Current file | Evidence / maintenance problem | Suggested follow-up |
| --- | --- | --- |
| store/gameStore.ts (formerly store/store.ts) | 573 lines combine persisted game state, preferences, history and normalization. Features depend on this shared owner. | Identify cohesive internal modules while retaining one persistence/state interface; do not split stores mechanically. |
| features/rooms/roomRpcClient.ts (formerly utils/supabaseClient.ts) | 740 lines expose room/gameplay/guest operations and transport/error handling. | Group internal operations behind the existing client interface and retain validation/idempotency semantics. |
| features/history/HistoryScreen.tsx (formerly app/history.tsx) | 757 lines combine route state, filtering, cloud status, layout and multiple UI subviews. | Extract cohesive internal screen modules only where the interface gets simpler, retaining the existing tested flow. |
| features/game-setup/createRandomAssignments.ts (formerly utils/setupGameAssignments.ts) | shuffle sorts with a random comparator, which is biased; pair allocation and validation share one module. | Review uniform shuffling and deterministic random-source testing in a separate behavior change. |
| features/game-setup/useMatchListFilters.ts and features/football-matches/matchFilters.ts | Team-name cleanup and date/time filtering responsibilities are spread across hook and pure utility modules. | Review one canonical normalization/filtering owner, with edge-case tests before changing matching behavior. |

The old root components/index.ts also contained empty statements and only setup exports; those statements were removed when the file became features/game-setup/index.ts. The obsolete useTeamFiltering shim and its fake hook mock were removed as part of M4 path maintenance.

React Doctor unrestricted review after M3: 100/100, 128 changed files scanned, no issues reported. The sandbox browser run stalled during worker launch and was stopped; an unrestricted run is now pending, so browser success is not yet claimed.

M4 validation: 17 affected suites / 112 tests passed; typecheck, lint and Knip passed. Removed hooks/useTeamFiltering.ts after its sole production consumer and fixture moved to the canonical filter. No assignment algorithm behavior was changed; its random-sort issue is recorded for later review.

## M5a — Football-match client ownership

Discovery, saved-match operations, solo tracking, filters/time formatting, and team/league presentation resources now live in football-matches. FootballMatchError is class-based and uses the agreed PascalCase. soloTracking becomes soloTrackingService because it coordinates tracking grant lifecycle and failures; matchUtils becomes matchFilters for its date/time/team filtering role. Cross-runtime match contracts remain in types/footballMatch.ts and Edge handlers retain their deployment paths. Shared commandApiClient stays outside the feature: it combines Java command delivery/idempotency with a match-discovery facade and needs a separately reviewed split before it can have one owner.

| Old path | New path | Reason |
| --- | --- | --- |
| hooks/useMatchData.ts | features/football-matches/useMatchData.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| __tests__/hooks/useMatchData.test.tsx | __tests__/features/football-matches/useMatchData.test.tsx | Mirror the football-match implementation and preserve test behavior. |
| hooks/useTeamData.ts | features/football-matches/useTeamData.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| hooks/useLiveScores.ts | features/football-matches/useLiveScores.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| __tests__/hooks/useLiveScores.test.tsx | __tests__/features/football-matches/useLiveScores.test.tsx | Mirror the football-match implementation and preserve test behavior. |
| hooks/useLeagueLogo.ts | features/football-matches/useLeagueLogo.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| __tests__/hooks/useLeagueLogo.test.ts | __tests__/features/football-matches/useLeagueLogo.test.ts | Mirror the football-match implementation and preserve test behavior. |
| hooks/useTeamLogo.ts | features/football-matches/useTeamLogo.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| __tests__/hooks/useTeamLogo.test.ts | __tests__/features/football-matches/useTeamLogo.test.ts | Mirror the football-match implementation and preserve test behavior. |
| hooks/usePersistedTeamLogos.ts | features/football-matches/usePersistedTeamLogos.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| __tests__/hooks/usePersistedTeamLogos.test.ts | __tests__/features/football-matches/usePersistedTeamLogos.test.ts | Mirror the football-match implementation and preserve test behavior. |
| utils/footballMatchService.ts | features/football-matches/footballMatchService.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| __tests__/utils/footballMatchService.test.ts | __tests__/features/football-matches/footballMatchService.test.ts | Mirror the football-match implementation and preserve test behavior. |
| utils/footballMatchSchemas.ts | features/football-matches/footballMatchSchemas.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| utils/footballMatchTransport.ts | features/football-matches/footballMatchTransport.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| utils/footballMatchError.ts | features/football-matches/FootballMatchError.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| utils/soloTracking.ts | features/football-matches/soloTrackingService.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| utils/matchTime.ts | features/football-matches/matchTime.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| __tests__/utils/matchTime.test.ts | __tests__/features/football-matches/matchTime.test.ts | Mirror the football-match implementation and preserve test behavior. |
| utils/matchUtils.ts | features/football-matches/matchFilters.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| __tests__/utils/matchUtils.test.ts | __tests__/features/football-matches/matchFilters.test.ts | Mirror the football-match implementation and preserve test behavior. |
| utils/teamLogos.ts | features/football-matches/teamLogos.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| __tests__/utils/teamLogos.test.ts | __tests__/features/football-matches/teamLogos.test.ts | Mirror the football-match implementation and preserve test behavior. |
| utils/teamAliases.ts | features/football-matches/teamAliases.ts | Colocate football-match implementation and resources; apply the responsibility/class naming rule. |
| __tests__/utils/teamAliases.test.ts | __tests__/features/football-matches/teamAliases.test.ts | Mirror the football-match implementation and preserve test behavior. |

Refactor later: utils/commandApiClient.ts mixes a match-discovery facade, Java command HTTP handling and shared idempotency keys. Separate those existing responsibilities behind their actual interfaces before moving the shared command/idempotency portion into lib; avoid making infrastructure depend on a feature public index.

M5a validation: typecheck, lint and Knip passed; affected football/setup/history tests passed (details below). Existing phone-sized Home Playwright journeys: 2 passed in 24.7 seconds after the Home/Preferences/setup moves.

## M5b — Rooms and guest lifecycle

Lobby/guest UI, room synchronization and configuration hooks, credential/session lifecycle and the room RPC client now share the rooms owner. guestRoom becomes guestRoomService because it implements session grant and access lifecycle, distinguishing it from the shared guestRoom contract. roomSnapshot becomes roomSnapshotAdapter because its exported operations translate server snapshots into application rosters/state. supabaseClient becomes roomRpcClient: lib/supabase.ts still owns SDK setup, while this module owns room-specific RPC operations. RoomLobbyScreen names the existing screen implementation; all three original route paths remain entry points. The platform-specific room-ended exit hook stays in platform because it integrates accessibility/back-handler behavior.

| Old path | New path | Reason |
| --- | --- | --- |
| __tests__/components/guestJoin/GuestJoinForm.platform.test.tsx | __tests__/features/rooms/GuestJoinForm.platform.test.tsx | Mirror the room implementation and retain the existing test scope. |
| __tests__/components/guestJoin/GuestJoinLobby.platform.test.tsx | __tests__/features/rooms/GuestJoinLobby.platform.test.tsx | Mirror the room implementation and retain the existing test scope. |
| __tests__/components/lobby/PlayerPickPanel.platform.test.tsx | __tests__/features/rooms/PlayerPickPanel.platform.test.tsx | Mirror the room implementation and retain the existing test scope. |
| components/guestJoin/GuestJoinForm.tsx | features/rooms/GuestJoinForm.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| components/guestJoin/GuestJoinLobby.tsx | features/rooms/GuestJoinLobby.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| components/guestJoin/GuestJoinModal.tsx | features/rooms/GuestJoinModal.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| components/lobby/AssignmentModeSelector.tsx | features/rooms/AssignmentModeSelector.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| components/lobby/AssignmentSettingsPanel.tsx | features/rooms/AssignmentSettingsPanel.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| components/lobby/ParticipantList.tsx | features/rooms/ParticipantList.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| components/lobby/PlayerPickPanel.tsx | features/rooms/PlayerPickPanel.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| components/lobby/RoomAssignmentPlayers.tsx | features/rooms/RoomAssignmentPlayers.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| components/lobby/RoomEndedNotice.tsx | features/rooms/RoomEndedNotice.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| components/lobby/RoomIdentityPanel.tsx | features/rooms/RoomIdentityPanel.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| components/lobby/StartGameWarnings.tsx | features/rooms/StartGameWarnings.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| components/lobby/SuccessorChooserModal.tsx | features/rooms/SuccessorChooserModal.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| hooks/useActiveGameRoomSync.ts | features/rooms/useActiveGameRoomSync.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/hooks/useActiveGameRoomSync.test.ts | __tests__/features/rooms/useActiveGameRoomSync.test.ts | Mirror the room implementation and retain the existing test scope. |
| hooks/useGuestRoomEndedNavigation.ts | features/rooms/useGuestRoomEndedNavigation.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/hooks/useGuestRoomEndedNavigation.test.ts | __tests__/features/rooms/useGuestRoomEndedNavigation.test.ts | Mirror the room implementation and retain the existing test scope. |
| hooks/useGuestRoomJoin.ts | features/rooms/useGuestRoomJoin.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/hooks/useGuestRoomJoin.test.ts | __tests__/features/rooms/useGuestRoomJoin.test.ts | Mirror the room implementation and retain the existing test scope. |
| hooks/useGuestRoomSession.ts | features/rooms/useGuestRoomSession.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/hooks/useGuestRoomSession.test.ts | __tests__/features/rooms/useGuestRoomSession.test.ts | Mirror the room implementation and retain the existing test scope. |
| hooks/useHostRoomCreate.ts | features/rooms/useHostRoomCreate.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/hooks/useHostRoomCreate.test.ts | __tests__/features/rooms/useHostRoomCreate.test.ts | Mirror the room implementation and retain the existing test scope. |
| hooks/useMyActiveRoom.ts | features/rooms/useMyActiveRoom.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/hooks/useMyActiveRoom.test.ts | __tests__/features/rooms/useMyActiveRoom.test.ts | Mirror the room implementation and retain the existing test scope. |
| hooks/useRegisteredRoomJoin.ts | features/rooms/useRegisteredRoomJoin.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/hooks/useRegisteredRoomJoin.test.ts | __tests__/features/rooms/useRegisteredRoomJoin.test.ts | Mirror the room implementation and retain the existing test scope. |
| hooks/useRoomConfigure.ts | features/rooms/useRoomConfigure.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/hooks/useRoomConfigure.test.ts | __tests__/features/rooms/useRoomConfigure.test.ts | Mirror the room implementation and retain the existing test scope. |
| hooks/useRoomExit.ts | features/rooms/useRoomExit.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/hooks/useRoomExit.test.ts | __tests__/features/rooms/useRoomExit.test.ts | Mirror the room implementation and retain the existing test scope. |
| hooks/useRoomLobby.ts | features/rooms/useRoomLobby.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/hooks/useRoomLobby.test.ts | __tests__/features/rooms/useRoomLobby.test.ts | Mirror the room implementation and retain the existing test scope. |
| hooks/useRoomMatchPool.ts | features/rooms/useRoomMatchPool.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/hooks/useRoomMatchPool.test.ts | __tests__/features/rooms/useRoomMatchPool.test.ts | Mirror the room implementation and retain the existing test scope. |
| hooks/useRunningGameDraft.ts | features/rooms/useRunningGameDraft.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/hooks/useRunningGameDraft.test.ts | __tests__/features/rooms/useRunningGameDraft.test.ts | Mirror the room implementation and retain the existing test scope. |
| utils/guestRoom.ts | features/rooms/guestRoomService.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/utils/guestRoom.storage.test.ts | __tests__/features/rooms/guestRoomService.storage.test.ts | Mirror the room implementation and retain the existing test scope. |
| utils/guestRoomTermination.ts | features/rooms/guestRoomTermination.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/utils/guestRoomTermination.test.ts | __tests__/features/rooms/guestRoomTermination.test.ts | Mirror the room implementation and retain the existing test scope. |
| utils/roomSnapshot.ts | features/rooms/roomSnapshotAdapter.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/utils/roomSnapshot.test.ts | __tests__/features/rooms/roomSnapshotAdapter.test.ts | Mirror the room implementation and retain the existing test scope. |
| utils/supabaseClient.ts | features/rooms/roomRpcClient.ts | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/utils/supabaseClient.gameplay.test.ts | __tests__/features/rooms/roomRpcClient.gameplay.test.ts | Mirror the room implementation and retain the existing test scope. |
| __tests__/utils/supabaseClient.guestAccess.test.ts | __tests__/features/rooms/roomRpcClient.guestAccess.test.ts | Mirror the room implementation and retain the existing test scope. |
| __tests__/utils/supabaseClient.processing.test.ts | __tests__/features/rooms/roomRpcClient.processing.test.ts | Mirror the room implementation and retain the existing test scope. |
| __tests__/utils/supabaseClient.reassign.test.ts | __tests__/features/rooms/roomRpcClient.reassign.test.ts | Mirror the room implementation and retain the existing test scope. |
| app/lobby/[sessionId].tsx | features/rooms/RoomLobbyScreen.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| app/editGame.tsx | features/rooms/EditGameScreen.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| app/roomEnded.tsx | features/rooms/RoomEndedScreen.tsx | Collect room-owned implementation and name the role; preserve route/security/lifecycle behavior. |
| __tests__/app/lobby/lobbyInProgress.platform.test.tsx | __tests__/features/rooms/RoomLobbyScreen.inProgress.platform.test.tsx | Mirror the room implementation and retain the existing test scope. |
| __tests__/app/lobby/lobbyWizard.platform.test.tsx | __tests__/features/rooms/RoomLobbyScreen.wizard.platform.test.tsx | Mirror the room implementation and retain the existing test scope. |

Refactor later: features/rooms/RoomLobbyScreen.tsx (formerly app/lobby/[sessionId].tsx) has roughly 1,400 lines combining host/member eligibility, wizard state, assignments and rendering. features/rooms/useActiveGameRoomSync.ts exceeds 1,300 lines combining identity fencing, polling, optimistic mutation replay and completion. Review internal modules behind their existing interfaces, preserving the concurrency and guest-access tests, instead of splitting them merely by line count. The room RPC refactor candidate above now lives at features/rooms/roomRpcClient.ts.

M5b validation: 31 affected suites / 274 tests passed, with typecheck, lint and Knip passing. The route wrapper is RoomLobbyScreen and its existing internal authenticated-content implementation is RoomLobbyContent, avoiding a name collision without changing membership gating. M5a affected run comprised 26 suites / 196 tests, all passing.

## M5c — Gameplay implementation

Progress UI, goal scoring/toast logic, reducers, synchronization controller and progress styles now share game-progress ownership. Component-owned subdirectories retain their PascalCase names. MatchQuickActionsModal/index.tsx becomes MatchQuickActionsModal/MatchQuickActionsModal.tsx so editor tabs identify the implementation; incoming imports point to the named file, with no temporary index shim. useMatchProcessing inserts selected matches into a configured game, so it and selectGameplayMatches belong to game-setup rather than a generic hooks/utils folder.

| Old path | New path | Reason |
| --- | --- | --- |
| __tests__/components/gameProgress/FooterButtons.platform.test.tsx | __tests__/features/game-progress/FooterButtons.platform.test.tsx | Mirror the source implementation. |
| __tests__/components/gameProgress/GameActionsSheet.platform.test.tsx | __tests__/features/game-progress/GameActionsSheet.platform.test.tsx | Mirror the source implementation. |
| __tests__/components/gameProgress/GameProgressTabs.platform.test.tsx | __tests__/features/game-progress/GameProgressTabs.platform.test.tsx | Mirror the source implementation. |
| __tests__/components/gameProgress/GoalToast.accessibility.test.tsx | __tests__/features/game-progress/GoalToast.accessibility.test.tsx | Mirror the source implementation. |
| __tests__/components/gameProgress/GoalToast.test.tsx | __tests__/features/game-progress/GoalToast.test.tsx | Mirror the source implementation. |
| __tests__/components/gameProgress/MatchCatalogDetails.platform.test.tsx | __tests__/features/game-progress/MatchCatalogDetails.platform.test.tsx | Mirror the source implementation. |
| __tests__/components/gameProgress/MatchesGridContainer.platform.test.tsx | __tests__/features/game-progress/MatchesGridContainer.platform.test.tsx | Mirror the source implementation. |
| __tests__/components/gameProgress/ModalWrappers.platform.test.tsx | __tests__/features/game-progress/ModalWrappers.platform.test.tsx | Mirror the source implementation. |
| __tests__/components/gameProgress/PlayersList.platform.test.tsx | __tests__/features/game-progress/PlayersList.platform.test.tsx | Mirror the source implementation. |
| __tests__/components/gameProgress/RoomStatusModal.platform.test.tsx | __tests__/features/game-progress/RoomStatusModal.platform.test.tsx | Mirror the source implementation. |
| __tests__/components/gameProgress/ScoreControls.disabled.test.tsx | __tests__/features/game-progress/ScoreControls.disabled.test.tsx | Mirror the source implementation. |
| __tests__/hooks/gameProgress/goalScoring.test.ts | __tests__/features/game-progress/goalScoring.test.ts | Mirror the source implementation. |
| __tests__/hooks/gameProgress/matchMigration.test.ts | __tests__/features/game-progress/matchMigration.test.ts | Mirror the source implementation. |
| __tests__/hooks/gameProgress/sourceStatus.test.ts | __tests__/features/game-progress/sourceStatus.test.ts | Mirror the source implementation. |
| __tests__/hooks/gameProgress/toastQueueReducer.test.ts | __tests__/features/game-progress/toastQueueReducer.test.ts | Mirror the source implementation. |
| __tests__/hooks/gameProgress/uiReducer.test.ts | __tests__/features/game-progress/uiReducer.test.ts | Mirror the source implementation. |
| components/gameProgress/EndGameModal.tsx | features/game-progress/EndGameModal.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/FooterButtons.tsx | features/game-progress/FooterButtons.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/GameActionsSheet.tsx | features/game-progress/GameActionsSheet.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/GameProgressTabs.tsx | features/game-progress/GameProgressTabs.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/GoalToast.tsx | features/game-progress/GoalToast.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchQuickActionsModal/GoalScorersSection.tsx | features/game-progress/MatchQuickActionsModal/GoalScorersSection.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchQuickActionsModal/MatchHeader.tsx | features/game-progress/MatchQuickActionsModal/MatchHeader.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchQuickActionsModal/ModalTabBar.tsx | features/game-progress/MatchQuickActionsModal/ModalTabBar.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchQuickActionsModal/PlayersSection.tsx | features/game-progress/MatchQuickActionsModal/PlayersSection.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchQuickActionsModal/PossessionCircle.tsx | features/game-progress/MatchQuickActionsModal/PossessionCircle.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchQuickActionsModal/ScoreControls.tsx | features/game-progress/MatchQuickActionsModal/ScoreControls.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchQuickActionsModal/StatProgressBar.tsx | features/game-progress/MatchQuickActionsModal/StatProgressBar.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchQuickActionsModal/StatisticsSection.tsx | features/game-progress/MatchQuickActionsModal/StatisticsSection.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchQuickActionsModal/index.tsx | features/game-progress/MatchQuickActionsModal/MatchQuickActionsModal.tsx | Expose the modal implementation by name. |
| components/gameProgress/MatchQuickActionsModal/styles.ts | features/game-progress/MatchQuickActionsModal/styles.ts | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchQuickActionsModal/types.ts | features/game-progress/MatchQuickActionsModal/types.ts | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchesGrid/LastUpdatedFooter.tsx | features/game-progress/MatchesGrid/LastUpdatedFooter.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchesGrid/MatchGridItem.tsx | features/game-progress/MatchesGrid/MatchGridItem.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchesGrid/MatchListItem.tsx | features/game-progress/MatchesGrid/MatchListItem.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchesGrid/MatchesGridContainer.tsx | features/game-progress/MatchesGrid/MatchesGridContainer.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchesGrid/MatchesHeader.tsx | features/game-progress/MatchesGrid/MatchesHeader.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchesGrid/SortModal.tsx | features/game-progress/MatchesGrid/SortModal.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchesGrid/index.ts | features/game-progress/MatchesGrid/index.ts | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MatchesGrid/types.ts | features/game-progress/MatchesGrid/types.ts | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/MultiplayerGameStatus.tsx | features/game-progress/MultiplayerGameStatus.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/PlayersList.tsx | features/game-progress/PlayersList.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| components/gameProgress/RoomStatusModal.tsx | features/game-progress/RoomStatusModal.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| hooks/gameProgress/goalScoring.ts | features/game-progress/goalScoring.ts | Collect feature implementation while preserving gameplay and route behavior. |
| hooks/gameProgress/matchMigration.ts | features/game-progress/matchMigration.ts | Collect feature implementation while preserving gameplay and route behavior. |
| hooks/gameProgress/sourceStatus.ts | features/game-progress/sourceStatus.ts | Collect feature implementation while preserving gameplay and route behavior. |
| hooks/gameProgress/toastQueueReducer.ts | features/game-progress/toastQueueReducer.ts | Collect feature implementation while preserving gameplay and route behavior. |
| hooks/gameProgress/uiReducer.ts | features/game-progress/uiReducer.ts | Collect feature implementation while preserving gameplay and route behavior. |
| hooks/useGameProgressController.ts | features/game-progress/useGameProgressController.ts | Collect feature implementation while preserving gameplay and route behavior. |
| __tests__/hooks/useGameProgressController.multiplayer.test.ts | __tests__/features/game-progress/useGameProgressController.multiplayer.test.ts | Mirror the source implementation. |
| __tests__/hooks/useGameProgressController.test.ts | __tests__/features/game-progress/useGameProgressController.test.ts | Mirror the source implementation. |
| hooks/useGoalToastQueue.ts | features/game-progress/useGoalToastQueue.ts | Collect feature implementation while preserving gameplay and route behavior. |
| __tests__/hooks/useGoalToastQueue.test.ts | __tests__/features/game-progress/useGoalToastQueue.test.ts | Mirror the source implementation. |
| hooks/useMatchQuickActionsAnimations.ts | features/game-progress/useMatchQuickActionsAnimations.ts | Collect feature implementation while preserving gameplay and route behavior. |
| styles/gameProgressStyles.ts | features/game-progress/gameProgressStyles.ts | Collect feature implementation while preserving gameplay and route behavior. |
| app/gameProgress.tsx | features/game-progress/GameProgressScreen.tsx | Collect feature implementation while preserving gameplay and route behavior. |
| __tests__/app/gameProgress.platform.test.tsx | __tests__/features/game-progress/GameProgressScreen.platform.test.tsx | Mirror the source implementation. |
| hooks/useMatchProcessing.ts | features/game-setup/useMatchProcessing.ts | Collect feature implementation while preserving gameplay and route behavior. |
| __tests__/hooks/useMatchProcessing.test.ts | __tests__/features/game-setup/useMatchProcessing.test.ts | Mirror the source implementation. |
| utils/selectGameplayMatches.ts | features/game-setup/selectGameplayMatches.ts | Collect feature implementation while preserving gameplay and route behavior. |
| __tests__/utils/selectGameplayMatches.test.ts | __tests__/features/game-setup/selectGameplayMatches.test.ts | Mirror the source implementation. |

M5c validation: 60 affected suites / 424 tests passed, with typecheck, lint and Knip passing. Existing test IDs and gameplay logic remain unchanged.

## M6a — Shared placement, authentication and final names

AppIcon is reusable UI and joins components/ui. First-run onboarding has its own small feature, separate from account username onboarding. Account forms and their route implementations join the account module. Their identical code-exchange SDK calls are extracted unchanged into exchangeAccountAuthCode so screens retain a feature-owned operation rather than importing raw SDK setup; existing component tests still verify the same code exchange and error handling. No auth protocol or validation changes.

store/store becomes store/gameStore to identify the persisted state owner; the hydration hook becomes useGameStoreHydration and joins it. Navigation helpers join the existing platform/navigation owner and viewState becomes routeState because it parses/constructs route parameters. guestCredential becomes guest-credential as the domain directory standard requires; all platform variants move together. svgArc has one production consumer in the quick-actions modal and joins that component rather than another shared bucket.

| Old path | New path | Reason |
| --- | --- | --- |
| __tests__/components/auth/AuthForm.platform.test.tsx | __tests__/features/account/AuthForm.platform.test.tsx | Mirror the source location and name. |
| __tests__/components/auth/PasswordResetForm.platform.test.tsx | __tests__/features/account/PasswordResetForm.platform.test.tsx | Mirror the source location and name. |
| __tests__/components/auth/UsernameOnboardingForm.platform.test.tsx | __tests__/features/account/UsernameOnboardingForm.platform.test.tsx | Mirror the source location and name. |
| components/auth/AuthForm.tsx | features/account/AuthForm.tsx | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| components/auth/AuthHeader.tsx | features/account/AuthHeader.tsx | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| components/auth/ChangePasswordForm.tsx | features/account/ChangePasswordForm.tsx | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| components/auth/PasswordResetForm.tsx | features/account/PasswordResetForm.tsx | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| components/auth/UsernameOnboardingForm.tsx | features/account/UsernameOnboardingForm.tsx | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| platform/guestCredential/index.native.ts | platform/guest-credential/index.native.ts | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| platform/guestCredential/index.ts | platform/guest-credential/index.ts | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| platform/guestCredential/index.web.ts | platform/guest-credential/index.web.ts | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| platform/guestCredential/types.ts | platform/guest-credential/types.ts | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| components/AppIcon.tsx | components/ui/AppIcon.tsx | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| __tests__/components/AppIcon.test.tsx | __tests__/components/ui/AppIcon.test.tsx | Mirror the source location and name. |
| components/OnboardingScreen.tsx | features/onboarding/OnboardingScreen.tsx | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| __tests__/components/OnboardingScreen.platform.test.tsx | __tests__/features/onboarding/OnboardingScreen.platform.test.tsx | Mirror the source location and name. |
| store/store.ts | store/gameStore.ts | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| utils/navigation/useStoreHydration.ts | store/useGameStoreHydration.ts | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| utils/navigation/useNavigationReady.ts | platform/navigation/useNavigationReady.ts | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| utils/navigation/viewState.ts | platform/navigation/routeState.ts | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| __tests__/utils/navigation/viewState.test.ts | __tests__/platform/navigation/routeState.test.ts | Mirror the source location and name. |
| __tests__/utils/navigation/detailEntry.test.ts | __tests__/platform/navigation/detailEntry.test.ts | Mirror the source location and name. |
| utils/svgArc.ts | features/game-progress/MatchQuickActionsModal/svgArc.ts | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| __tests__/utils/svgArc.test.ts | __tests__/features/game-progress/MatchQuickActionsModal/svgArc.test.ts | Mirror the source location and name. |
| app/auth/index.tsx | features/account/AuthScreen.tsx | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| app/auth/onboarding.tsx | features/account/AccountOnboardingScreen.tsx | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| app/auth/reset-password.tsx | features/account/PasswordResetScreen.tsx | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| app/auth/change-password.tsx | features/account/ChangePasswordScreen.tsx | Apply the ownership/name decision described above; preserve behavior and route URLs. |
| __tests__/app/changePasswordSettings.platform.test.tsx | __tests__/features/account/ChangePasswordScreen.platform.test.tsx | Mirror the source location and name. |
| __tests__/platform/guestCredential.native.test.ts | __tests__/platform/guest-credential/index.native.test.ts | Mirror the source location and name. |
| __tests__/platform/guestCredential.web.test.ts | __tests__/platform/guest-credential/index.web.test.ts | Mirror the source location and name. |

Refactor later: features/account/AuthForm.tsx exceeds 700 lines and combines sign-in/sign-up mode, confirmation links, input handling and feedback UI. Review cohesive form/confirmation operations separately from this relocation. Existing state/RPC follow-up paths are now store/gameStore.ts and features/rooms/roomRpcClient.ts.

M6a validation: the complete 160-suite / 1,043-test Jest suite passed, as did typecheck, lint and Knip. The remaining Knip hint is its obsolete hooks glob after migration; M6b updates configuration coverage. The two existing auth form tests still cover code exchange and failures through the extracted one-operation module.

## M6b — Public entry points and configuration

Account, Friends, History and Preferences retain focused public indexes. The newly organized rooms, football-matches, game-progress and onboarding modules expose narrow named entry files (for example useRoomExit, footballMatchService, useTeamLogo and OnboardingScreen); private support remains with its implementation. Do not add a feature-wide barrel solely for uniformity: an experiment made a logo import initialize unrelated score-tracking/native modules and broke isolated component environments. That experiment was removed after verifying all affected changes were import/export-only. The existing game-setup index remains its intentional shared setup-UI interface. This evidence-based decision supersedes the blueprint proposal to route every cross-feature import through one index.

ESLint now checks feature-to-route imports for every feature TypeScript directory, preserves the focused-index rules for Account/Friends/History/Preferences (including nested/alias paths), and follows the renamed roomRpcClient when rejecting raw transport imports from screens. Named public entry files in the new modules remain allowed; there is no claim of universal private-file enforcement. Knip drops the now-empty root hooks glob and includes shared runtime helpers explicitly.

M6b validation: full Jest suite 160/160 suites and 1,043/1,043 tests; typecheck, lint and Knip passed. An assertion-based ESLint check verified rejection of private Account imports and acceptance of its public interface for TS, TSX and nested callers. Focused route-helper mocks retain the real helper exports. The three broader failing browser journeys currently concern a missing Arsenal fixture, missing Room Lobby text, and a Home Friends-link expectation. The first archived-baseline attempt failed to hydrate, so it does not establish equivalence; baseline comparison remains pending. Do not interpret the failed baseline run as proof that the current failures predate this migration.

## M6c — Remaining test ownership

The last technical-root tests now follow their actual implementation: the room-ended platform hook, server guest ingress, and football-match discovery contract. Shared color/theme tests stay under styles because they verify the shared theme, despite mentioning a feature.

| Old path | New path | Reason |
| --- | --- | --- |
| __tests__/hooks/useRoomEndedExit.test.ts | __tests__/platform/navigation/useRoomEndedExit.test.ts | Match the implementation owner without changing assertions or suite selection. |
| __tests__/utils/guestIngress.test.ts | __tests__/supabase/guestIngress.test.ts | Match the implementation owner without changing assertions or suite selection. |
| __tests__/utils/matchDiscoveryCatalog.test.ts | __tests__/features/football-matches/matchDiscoveryCatalog.test.ts | Match the implementation owner without changing assertions or suite selection. |

M6c validation: three relocated suites passed without changing their assertions. Final web axe run: all 12 route/viewport combinations loaded with zero page errors but failed the zero-violations assertion. Baseline accessibility comparison remains pending; the initial baseline failed readiness before axe ran.

## Final verification — 2026-10-28

- All 296 recorded move steps resolve to existing final files, including intermediate pilot renames; all 16 migrated route entry files still exist and forward to their named implementations. The original app route set is preserved.
- An AST-based comparison checked 280 pre-migration production modules against their final owners. After normalizing imports/re-exports/comments, CRLF/LF, the agreed identifier renames, rebased asset requires and the identical auth-code call extraction, no implementation-body differences remained. The deliberately removed useTeamFiltering re-export shim is the explicit exception. This supports behavior preservation; it is not hosted/device acceptance.
- Full Jest run: 160 suites / 1,043 tests passed. After the final three test-only relocations, all three relocated suites / 21 tests passed. Typecheck, lint and Knip passed after those relocations.
- Final React Doctor: 100/100, 339 changed files scanned, no issues reported.
- Existing Home phone-layout Playwright run: 2 passed. Representative BDD run: 3 passed (Home hydration, Preferences menu, phone setup), 3 failed as detailed below.
- Temporary Playwright/axe audit: Home, Preferences, Appearance, History, Setup and Auth each loaded on phone and desktop with no page errors (12 route/viewport combinations). All 12 zero-violation assertions failed on the accessibility findings below.
- An archived baseline could not reliably serve its entry bundle (404/500); its attempted browser/axe runs are invalid for regression comparison. The scratch source snapshot was archived under ignored node_modules cache, and its temporary dependency junction was removed. No baseline-equivalence claim is made for the browser findings.
- Java, database schemas/migrations, deployed endpoints, generated contracts, assets and original contributor Markdown documents were not changed. Existing package/skill work and older untracked audit/blueprint files remain outside the commits. No push or PR was performed.

### Browser and accessibility follow-up

These findings need their own behavior/accessibility work; changing their UI or replacing their acceptance expectations is outside this naming/layout migration. Their source bodies are unchanged under the comparison above, but a live baseline comparison was not achieved.

| Area | Observed finding | Next investigation |
| --- | --- | --- |
| Host configure/start BDD | Arsenal fixture never appears; screen shows transport_unavailable | Reconcile discovery mocks with the maintained Edge discovery path before changing application behavior. |
| Guest roster/history BDD | Expected Room Lobby text never appears | Reconcile the scenario state and current lobby UI, then verify host/guest transition expectations. |
| Browser keyboard navigation BDD | Home expects a Friends link; observed Home shows Game Stats and Settings | Update the journey only after confirming the intended navigation contract; retain real keyboard/browser-Back coverage. |
| Home (phone/desktop) | color-contrast: 1 node; label-content-name-mismatch: 1 node | Inspect rendered action/card names and text colors against their backgrounds. |
| Preferences (phone/desktop) | label-content-name-mismatch: 2 nodes | Ensure accessible names contain the actual visible labels, accounting for icon text. |
| Appearance (phone/desktop) | label: 1 critical node | Give the rendered setting input an associated accessible label. |
| History (phone/desktop) | aria-required-parent: 3 critical nodes; color-contrast: 2 nodes | Check tab/tablist semantics and the relevant text/background colors. |
| Setup (phone/desktop) | color-contrast: 1 node | Inspect the flagged text/background pair. |
| Auth (phone/desktop) | color-contrast: 1 node | Inspect the flagged text/background pair. |

Reproduce the representative BDD run with npm run bdd:gen, then npx playwright test --config=playwright.config.ts --project=chromium-phone --workers=1 --grep "Shell launches after hydration|Preferences screen shows|Setup flow stays usable|A host selects matches|Host and guest refresh|Home links support". The axe audit used a temporary ignored test harness and a temporary axe-core installation, without adding an application dependency.

### Final layout and intentional exceptions

Features now include account, friends, history, home, preferences, game-setup, game-progress, rooms, football-matches and onboarding. Reusable UI lives in components/ui; platform adapters stay in platform; state/hydration in store; global theme/tokens in styles; SDK/query setup in lib; cross-runtime contracts/helpers in types/shared. utils/commandApiClient.ts intentionally remains shared until its mixed command/discovery responsibilities are separately reviewed. Framework route names, generated types, historical migrations, component-owned support names and existing test-selection qualifiers are preserved exceptions. No speculative Service/Strategy/Visitor abstractions were introduced.

The journal is the current migration record. The older untracked blueprint/audit/inventory are pre-migration snapshots and were not rewritten. The refactor-later ledger above records the larger modules, random-sort concern, normalization duplication and mixed client responsibilities for a future scoped change.

## M7 — Java football-match vocabulary

The Java package com.dong.commandapi.match becomes com.dong.commandapi.footballmatch, including its dto subpackage and matching test package. This aligns the football-match domain name with TypeScript features/football-matches while retaining Java lowercase package syntax and existing PascalCase class/record names. Package declarations and imports change; the /v1/matches endpoint and DTO wire values remain unchanged. This explicitly extends the earlier client-only migration; the previous Java exclusion applied through M6.

| Old path | New path | Reason |
| --- | --- | --- |
| command-api/src/main/java/com/dong/commandapi/match/MatchCatalogClient.java | command-api/src/main/java/com/dong/commandapi/footballmatch/MatchCatalogClient.java | Use the same explicit football-match domain vocabulary across Java and TypeScript. |
| command-api/src/main/java/com/dong/commandapi/match/MatchDiscoveryController.java | command-api/src/main/java/com/dong/commandapi/footballmatch/MatchDiscoveryController.java | Use the same explicit football-match domain vocabulary across Java and TypeScript. |
| command-api/src/main/java/com/dong/commandapi/match/MatchDiscoveryService.java | command-api/src/main/java/com/dong/commandapi/footballmatch/MatchDiscoveryService.java | Use the same explicit football-match domain vocabulary across Java and TypeScript. |
| command-api/src/main/java/com/dong/commandapi/match/MatchQuery.java | command-api/src/main/java/com/dong/commandapi/footballmatch/MatchQuery.java | Use the same explicit football-match domain vocabulary across Java and TypeScript. |
| command-api/src/main/java/com/dong/commandapi/match/dto/NormalizedMatch.java | command-api/src/main/java/com/dong/commandapi/footballmatch/dto/NormalizedMatch.java | Use the same explicit football-match domain vocabulary across Java and TypeScript. |
| command-api/src/test/java/com/dong/commandapi/match/MatchCatalogClientTest.java | command-api/src/test/java/com/dong/commandapi/footballmatch/MatchCatalogClientTest.java | Use the same explicit football-match domain vocabulary across Java and TypeScript. |
| command-api/src/test/java/com/dong/commandapi/match/MatchDiscoveryControllerTest.java | command-api/src/test/java/com/dong/commandapi/footballmatch/MatchDiscoveryControllerTest.java | Use the same explicit football-match domain vocabulary across Java and TypeScript. |
| command-api/src/test/java/com/dong/commandapi/match/MatchDiscoveryServiceTest.java | command-api/src/test/java/com/dong/commandapi/footballmatch/MatchDiscoveryServiceTest.java | Use the same explicit football-match domain vocabulary across Java and TypeScript. |

All eight files were mechanically checked to differ only by the package/import namespace. Full Maven clean verify passed: 92 tests, zero failures/errors; JaCoCo coverage checks passed. The old compiled match package is absent after the clean build. Unrelated package/skill work remains excluded.
