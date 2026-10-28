import React, { FC, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Toast from "react-native-toast-message";

import createSetupGameStyles from "./setupGameStyles";
import { useColors } from "../../styles/theme";
import { useMatchData } from "../football-matches/useMatchData";
import {
  normalizeMatchTeamName,
  useMatchListFilters,
} from "./useMatchListFilters";
import { useMatchProcessing } from "../../hooks/useMatchProcessing";
import { useTeamData } from "../football-matches/useTeamData";
import { filterMatchesByDateAndTime } from "../football-matches/matchFilters";
import { PlatformAnimation } from "../../platform";
import { Match, useGameStore } from "../../store/store";
import AppIcon from "../../components/AppIcon";
import LeagueMatchSections from "./LeagueMatchSections";
import LeagueFilter from "./LeagueFilter";
import MatchFilter from "./MatchFilter";
import TeamSelectionRow from "./TeamSelectionRow";

/**
 * @interface MatchListProps
 * Props for the MatchList component.
 *
 * @property {Match[]} matches - The current pool of selected matches.
 * @property {string} homeTeam - Currently selected home team name.
 * @property {string} awayTeam - Currently selected away team name.
 * @property {(team: string) => void} setHomeTeam - Function to update the home team selection.
 * @property {(team: string) => void} setAwayTeam - Function to update the away team selection.
 * @property {(matchId: string) => void} handleRemoveMatch - Removes a match from the pool.
 * @property {(matches: Match[]) => void} setGlobalMatches - Commits a new pool. Called
 *   three ways: with the pool plus one appended match (manual entry), with the pool plus a
 *   batch (bulk add), and with `[]` to clear. Required, because every write this component
 *   makes goes through it.
 * @property {boolean} [showSectionTitle] - Renders the "Matches" heading. Off for callers
 *   that supply their own screen title, so the two do not stack.
 * @property {boolean} [disableSelection] - Makes the pool inert while a write is in flight.
 *   Matters where removal is a server round-trip: a second tap must not race the first.
 */
interface MatchListProps {
  matches: Match[];
  homeTeam: string;
  awayTeam: string;
  setHomeTeam: (team: string) => void;
  setAwayTeam: (team: string) => void;
  handleRemoveMatch: (matchId: string) => void;
  setGlobalMatches: (matches: Match[]) => void;
  showSectionTitle?: boolean;
  disableSelection?: boolean;
  fixedMatchIds?: string[];
}

interface MatchListViewProps {
  fixedMatchIds: string[];
  matches: Match[];
  poolMatchIds: string[];
  disableSelection: boolean;
  showSectionTitle: boolean;
  manualEntry: React.ReactNode;
  loadingFeedback: React.ReactNode;
  processingState: ReturnType<typeof useMatchProcessing>["processingState"];
  leagueFilterProps: React.ComponentProps<typeof LeagueFilter>;
  matchFilterProps: React.ComponentProps<typeof MatchFilter>;
  onToggleMatch: (matchId: string) => void;
  onClearAll: () => void;
  styles: ReturnType<typeof createSetupGameStyles>;
  colors: ReturnType<typeof useColors>;
}

const MatchListView = ({
  fixedMatchIds,
  matches,
  poolMatchIds,
  disableSelection,
  showSectionTitle,
  manualEntry,
  processingState,
  loadingFeedback,
  leagueFilterProps,
  matchFilterProps,
  onToggleMatch,
  onClearAll,
  styles,
  colors,
}: MatchListViewProps) => {
  const fixedIds = new Set(fixedMatchIds);
  return (
  <View style={styles.tabContent}>
    {showSectionTitle ? <Text style={styles.sectionTitle}>Matches</Text> : null}

    <View testID="MatchListLayout" style={styles.matchListLayout}>
      <View testID="MatchListControls" style={styles.matchListControls}>
        <LeagueFilter {...leagueFilterProps} />
        <MatchFilter {...matchFilterProps} />
        {loadingFeedback}

        {processingState.isProcessing && (
          <View style={styles.processingIndicator}>
            <Text>
              Processing matches: {processingState.matchesAdded} added, {" "}
              {processingState.matchesSkipped} skipped
            </Text>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </View>

      <View testID="MatchListResults" style={styles.matchListResults}>
        {/* The shared list keeps solo and multiplayer match cards visually aligned. */}
        {matches.length === 0 ? (
          <View
            testID="MatchListEmptyState"
            style={styles.matchEmptyListContainer}
          >
            <AppIcon name="football-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyListTitleText}>No matches added yet!</Text>
            <Text style={styles.emptyListSubtitleText}>
              Use the filters above to find matches, or add a match manually below.
            </Text>
          </View>
        ) : (
          <LeagueMatchSections
            matches={matches}
            selectedMatchIds={poolMatchIds}
            disabled={disableSelection}
            disabledMatchIds={fixedMatchIds.length ? fixedMatchIds : undefined}
            onToggleMatch={onToggleMatch}
          />
        )}

        {matches.some(match => !fixedIds.has(match.id)) && (
          <TouchableOpacity style={styles.clearAllButton} onPress={onClearAll}>
            <AppIcon
              name="trash-outline"
              size={16}
              color={colors.textLight}
              style={{ marginRight: 5 }}
            />
            <Text style={styles.clearAllButtonText}>Clear All Matches</Text>
          </TouchableOpacity>
        )}
      </View>
      {manualEntry}
    </View>
  </View>
  );
};

/**
 * Functional component that renders a list of matches with filtering and team selection.
 *
 * @description This component fetches match data from an API and team data from league JSON files.
 * It provides:
 * - League filtering to narrow down matches and teams
 * - Date and time filtering for matches
 * - Team selection dropdowns with normalized display names
 * - Match list with add/remove functionality
 *
 * The component uses several custom hooks for data fetching and processing:
 * - `useMatchData`: Fetches match data for a given date.
 * - `useTeamData`: Fetches team data from league JSON files.
 * - `useMatchListFilters`: Filters teams and matches based on selected leagues/date/time.
 * - `useMatchProcessing`: Handles batch processing of matches.
 *
 * @param {MatchListProps} props - The props for the MatchList component.
 * @return {JSX.Element} A React functional component.
 */
const MatchList: FC<MatchListProps> = ({
  matches,
  homeTeam,
  awayTeam,
  setHomeTeam,
  setAwayTeam,
  handleRemoveMatch,
  setGlobalMatches,
  showSectionTitle = true,
  disableSelection = false,
  fixedMatchIds = [],
}) => {
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  const { defaultSelectedLeagues: storedDefaultLeagues } = useGameStore();
  const {
    isLoading: isTeamLoading,
    teamsData: allTeamsData,
  } = useTeamData();
  const {
    selectedDate,
    selectedLeagues,
    startTime,
    endTime,
    homeTeamOptions,
    awayTeamOptions,
    isDateFilterActive,
    isTimeFilterActive,
    setSelectedDate,
    setStartTime,
    setEndTime,
    syncSelectedLeagues,
    handleLeagueChange,
    addCustomHomeTeam,
    addCustomAwayTeam,
  } = useMatchListFilters({
    storedDefaultLeagues,
    allTeamsData,
  });

  const {
    isLoading: isMatchLoading,
    errorMessage: matchErrorMessage,
    availabilityMessage,
    retry: retryMatchDiscovery,
    teamsData: matchTeamsData,
    apiData,
    availableLeagues,
  } = useMatchData(selectedDate);

  /**
   * Appends a hand-typed fixture to the pool and clears the two fields.
   *
   * Declared here, above `useMatchProcessing`, because that hook takes it as its
   * sequential-fallback handler â€” a `const` referenced before its initialiser
   * would be a TDZ error. It replaces what used to be a `handleAddMatch` prop,
   * which every caller had to supply and none of them ever saw invoked: both pass
   * `setGlobalMatches`, so the hook always took its batch path.
   */
  const handleAddMatchLocally = () => {
    if (homeTeam.trim() && awayTeam.trim()) {
      const newMatch: Match = {
        id: String(Date.now()),
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        homeGoals: 0,
        awayGoals: 0,
      };

      setGlobalMatches([...matches, newMatch]);

      setHomeTeam("");
      setAwayTeam("");
    }
  };

  const { startProcessing, processingState } = useMatchProcessing(
    matches,
    setHomeTeam,
    setAwayTeam,
    handleAddMatchLocally,
    setGlobalMatches,
  );

  useEffect(() => {
    if (availableLeagues.length === 0 || selectedLeagues.length === 0) {
      return;
    }

    const selectedLeagueNames = new Set(
      selectedLeagues.map((league) => league.name),
    );
    const updatedSelectedLeagues = availableLeagues.filter((league) =>
      selectedLeagueNames.has(league.name),
    );

    if (
      updatedSelectedLeagues.length > 0 &&
      JSON.stringify(updatedSelectedLeagues) !== JSON.stringify(selectedLeagues)
    ) {
      syncSelectedLeagues(updatedSelectedLeagues);
    }
  }, [availableLeagues, selectedLeagues, syncSelectedLeagues]);

  const filteredMatches = useMemo(() => {
    if (!apiData || apiData.length === 0 || selectedLeagues.length === 0) {
      return [];
    }

    const allMatches = apiData.flatMap(
      (leagueData) => leagueData?.matches ?? [],
    );
    const dateTimeFilteredMatches = filterMatchesByDateAndTime(
      allMatches,
      selectedDate,
      startTime,
      endTime,
    );
    const selectedLeagueCodes = new Set(
      selectedLeagues.map((league) => league.code),
    );
    const allowedTeams = new Set(
      matchTeamsData
        .filter((team) => {
          const availableLeague = availableLeagues.find(
            (league) => league.name === team.league,
          );

          return availableLeague
            ? selectedLeagueCodes.has(availableLeague.code)
            : false;
        })
        .map((team) => normalizeMatchTeamName(team.value)),
    );

    return dateTimeFilteredMatches.filter((match) => {
      if (!match.team1 || !match.team2) {
        return false;
      }

      return (
        allowedTeams.has(normalizeMatchTeamName(match.team1)) &&
        allowedTeams.has(normalizeMatchTeamName(match.team2))
      );
    });
  }, [
    apiData,
    availableLeagues,
    matchTeamsData,
    selectedDate,
    selectedLeagues,
    startTime,
    endTime,
  ]);

  const handleAddAllFilteredMatches = () => {
    // The date/time guard that used to sit here was unreachable: the filter hook
    // seeds selectedDate to today and both times to a default range, so
    // isDateFilterActive was never false. An empty result is the only real case.
    if (filteredMatches.length === 0) {
      Toast.show({
        type: "themedWarning",
        text1: "No Matches Found",
        text2: "No matches match the current filters. Try another date or league.",
        position: "bottom",
      });
      return;
    }

    startProcessing(filteredMatches);
  };

  const handleClearAllMatches = () => {
    if (matches.length === 0) {
      Toast.show({
        type: "themedWarning",
        text1: "Nothing to Clear",
        text2: "There are no matches selected yet.",
        position: "bottom",
      });
      return;
    }

    const fixedIds = new Set(fixedMatchIds);
    setGlobalMatches(matches.filter(match => fixedIds.has(match.id)));
  };

  /**
   * Every match in the pool reads as selected, which is what makes tapping one
   * the release gesture. `SelectableMatchList` owns no selection state, so what
   * "selected" means is entirely this caller's choice â€” here it is "in the pool",
   * where on the lobby's pick panel the same component means "one of my picks".
   */
  const poolMatchIds = useMemo(
    () => matches.map((match) => match.id),
    [matches],
  );

  const isLoading = isMatchLoading || isTeamLoading;
  const teamSelection = (
    <View>
      <TouchableOpacity testID="SetupManualMatchToggle" accessibilityRole="button"
        accessibilityState={{ expanded: manualEntryOpen }} onPress={() => setManualEntryOpen(!manualEntryOpen)}
        style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <AppIcon name="add" size={20} color={colors.primary} />
        <Text style={{ color: colors.primary }}>Add a match manually</Text>
        <AppIcon name={manualEntryOpen ? "arrow-up" : "chevron-down"} size={18} color={colors.primary} />
      </TouchableOpacity>
      {manualEntryOpen ? (
        <TeamSelectionRow
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          setHomeTeam={setHomeTeam}
          setAwayTeam={setAwayTeam}
          homeTeamOptions={homeTeamOptions}
          awayTeamOptions={awayTeamOptions}
          handleAddMatchAndClear={handleAddMatchLocally}
          addNewHomeTeam={addCustomHomeTeam}
          addNewAwayTeam={addCustomAwayTeam}
        />
      ) : null}
    </View>
  );

  let loadingFeedback: React.ReactNode = null;
  if (isLoading) {
    loadingFeedback = (
      <View style={styles.loadingContainer}>
        <PlatformAnimation
          kind="loading"
          source={require("../../assets/lottie/football_loading.json")}
          autoPlay
          loop
          style={styles.lottieAnimation}
          fallback={
            <AppIcon name="football-outline" size={48} color={colors.primary} />
          }
        />
        <Text style={styles.loadingText}>Loading matches and teams...</Text>
      </View>
    );
  }

  const discoveryMessage = matchErrorMessage || availabilityMessage;
  const discoveryFeedback = <>
    {loadingFeedback}
    {discoveryMessage ? (
      <View style={styles.errorContainer}>
        <Text accessibilityRole="alert" style={styles.errorText}>{discoveryMessage}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry loading matches"
          disabled={isMatchLoading} accessibilityState={{ disabled: isMatchLoading }}
          onPress={() => { void retryMatchDiscovery(); }} style={{ minHeight: 48, justifyContent: "center" }}>
          <Text style={{ color: colors.primary }}>Retry</Text>
        </TouchableOpacity>
      </View>
    ) : null}
  </>;

  return (
    <MatchListView
      matches={matches}
      fixedMatchIds={fixedMatchIds}
      poolMatchIds={poolMatchIds}
      disableSelection={disableSelection}
      showSectionTitle={showSectionTitle}
      manualEntry={teamSelection}
      processingState={processingState}
      loadingFeedback={discoveryFeedback}
      leagueFilterProps={{
        availableLeagues,
        selectedLeagues,
        handleLeagueChange,
      }}
      matchFilterProps={{
        selectedDate,
        startTime,
        endTime,
        setSelectedDate,
        setStartTime,
        setEndTime,
        handleAddAllFilteredMatches,
        isTimeFilterActive,
        isDateFilterActive,
        filteredMatches,
        isLoading,
      }}
      onToggleMatch={handleRemoveMatch}
      onClearAll={handleClearAllMatches}
      styles={styles}
      colors={colors}
    />
  );
};

export default MatchList;
