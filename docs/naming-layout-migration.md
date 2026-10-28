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
| M3 | Home, Preferences and Account/Auth ownership | Complete for Home/Preferences/account hooks; auth forms remain for M6 |
| M4 | Game setup and match-selection ownership | Complete |
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
| store/store.ts | 573 lines combine persisted game state, preferences, history and normalization. Features depend on this shared owner. | Identify cohesive internal modules while retaining one persistence/state interface; do not split stores mechanically. |
| utils/supabaseClient.ts | 740 lines expose room/gameplay/guest operations and transport/error handling. | Group internal operations behind the existing client interface and retain validation/idempotency semantics. |
| features/history/HistoryScreen.tsx (formerly app/history.tsx) | 757 lines combine route state, filtering, cloud status, layout and multiple UI subviews. | Extract cohesive internal screen modules only where the interface gets simpler, retaining the existing tested flow. |
| features/game-setup/createRandomAssignments.ts (formerly utils/setupGameAssignments.ts) | shuffle sorts with a random comparator, which is biased; pair allocation and validation share one module. | Review uniform shuffling and deterministic random-source testing in a separate behavior change. |
| features/game-setup/useMatchListFilters.ts and utils/matchUtils.ts | Team-name cleanup and date/time filtering responsibilities are spread across hook and pure utility modules. | Review one canonical normalization/filtering owner, with edge-case tests before changing matching behavior. |

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
