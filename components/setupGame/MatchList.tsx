import React, { FC, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Toast from "react-native-toast-message";

import createSetupGameStyles from "../../styles/setupGameStyles";
import { useColors } from "../../styles/theme";
import { useMatchData } from "../../hooks/useMatchData";
import {
  normalizeMatchTeamName,
  useMatchListFilters,
} from "../../hooks/useMatchListFilters";
import { useMatchProcessing } from "../../hooks/useMatchProcessing";
import { useTeamData } from "../../hooks/useTeamData";
import { filterMatchesByDateAndTime } from "../../hooks/useTeamFiltering";
import { PlatformAnimation } from "../../platform";
import { Match, useGameStore } from "../../store/store";
import AppIcon from "../AppIcon";
import { SelectableMatchList } from "../matchSelection/SelectableMatchList";
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
}

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
}) => {
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  const { defaultSelectedLeagues: storedDefaultLeagues } = useGameStore();
  const {
    isLoading: isTeamLoading,
    isError: isTeamError,
    errorMessage: teamErrorMessage,
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
    isError: isMatchError,
    errorMessage: matchErrorMessage,
    teamsData: matchTeamsData,
    apiData,
    availableLeagues,
  } = useMatchData(selectedDate);

  /**
   * Appends a hand-typed fixture to the pool and clears the two fields.
   *
   * Declared here, above `useMatchProcessing`, because that hook takes it as its
   * sequential-fallback handler — a `const` referenced before its initialiser
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

  const handleAddMatchAndClear = () => {
    handleAddMatchLocally();
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

    setGlobalMatches([]);
  };

  /**
   * Every match in the pool reads as selected, which is what makes tapping one
   * the release gesture. `SelectableMatchList` owns no selection state, so what
   * "selected" means is entirely this caller's choice — here it is "in the pool",
   * where on the lobby's pick panel the same component means "one of my picks".
   */
  const poolMatchIds = useMemo(
    () => matches.map((match) => match.id),
    [matches],
  );

  const isLoading = isMatchLoading || isTeamLoading;
  const isError = isMatchError || isTeamError;
  const errorMessage = matchErrorMessage || teamErrorMessage;
  let content = (
    <TeamSelectionRow
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      setHomeTeam={setHomeTeam}
      setAwayTeam={setAwayTeam}
      homeTeamOptions={homeTeamOptions}
      awayTeamOptions={awayTeamOptions}
      handleAddMatchAndClear={handleAddMatchAndClear}
      addNewHomeTeam={addCustomHomeTeam}
      addNewAwayTeam={addCustomAwayTeam}
    />
  );

  if (isLoading) {
    content = (
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
  } else if (isError) {
    content = (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          {errorMessage || "Error loading data."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {showSectionTitle ? (
        <Text style={styles.sectionTitle}>Matches</Text>
      ) : null}

      <View testID="MatchListLayout" style={styles.matchListLayout}>
        <View testID="MatchListControls" style={styles.matchListControls}>
          <LeagueFilter
            availableLeagues={availableLeagues}
            selectedLeagues={selectedLeagues}
            handleLeagueChange={handleLeagueChange}
          />

          <MatchFilter
            selectedDate={selectedDate}
            startTime={startTime}
            endTime={endTime}
            setSelectedDate={setSelectedDate}
            setStartTime={setStartTime}
            setEndTime={setEndTime}
            handleAddAllFilteredMatches={handleAddAllFilteredMatches}
            isTimeFilterActive={isTimeFilterActive}
            isDateFilterActive={isDateFilterActive}
            filteredMatches={filteredMatches}
            isLoading={isLoading}
          />

          {content}

          {processingState.isProcessing && (
            <View style={styles.processingIndicator}>
              <Text>
                Processing matches: {processingState.matchesAdded} added,{" "}
                {processingState.matchesSkipped} skipped
              </Text>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </View>

        <View testID="MatchListResults" style={styles.matchListResults}>
          {/*
            The pool renders through the app's shared match-card component, the
            same one the lobby's pick panel and the wizard's assign step use, so a
            match looks identical everywhere it appears. Its own list has no
            empty-state slot, hence the branch rather than a `ListEmptyComponent`.
          */}
          {matches.length === 0 ? (
            <View
              testID="MatchListEmptyState"
              style={styles.matchEmptyListContainer}
            >
              <AppIcon
                name="football-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={styles.emptyListTitleText}>
                No matches added yet!
              </Text>
              <Text style={styles.emptyListSubtitleText}>
                Use the filters above to find matches, or the team selectors to
                add your first match.
              </Text>
            </View>
          ) : (
            <SelectableMatchList
              matches={matches}
              selectedMatchIds={poolMatchIds}
              onToggleMatch={handleRemoveMatch}
              disabledMatchIds={disableSelection ? poolMatchIds : undefined}
              testIDPrefix="SetupPoolMatch"
            />
          )}

          {matches.length > 0 && (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={handleClearAllMatches}
            >
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
      </View>
    </View>
  );
};

export default MatchList;
