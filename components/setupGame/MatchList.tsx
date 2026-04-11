import React, { FC, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Match, useGameStore } from "../../store/store";
import AppIcon from "../AppIcon";
import createSetupGameStyles from "../../app/style/setupGameStyles";
import { useColors } from "../../app/style/theme";
import MatchFilter from "./MatchFilter";
import TeamSelectionRow from "./TeamSelectionRow";
import MatchItem from "./MatchItem";
import LeagueFilter from "./LeagueFilter";
import { useMatchData } from "../../hooks/useMatchData";
import { useTeamData } from "../../hooks/useTeamData";
import { filterMatchesByDateAndTime } from "../../hooks/useTeamFiltering";
import {
  normalizeMatchTeamName,
  useMatchListFilters,
} from "../../hooks/useMatchListFilters";
import { useMatchProcessing } from "../../hooks/useMatchProcessing";
import { PlatformAnimation } from "../../platform";

/**
 * @interface MatchListProps
 * Props for the MatchList component.
 *
 * @property {Match[]} matches - List of current match objects.
 * @property {string} homeTeam - Currently selected home team name.
 * @property {string} awayTeam - Currently selected away team name.
 * @property {(team: string) => void} setHomeTeam - Function to update the home team selection.
 * @property {(team: string) => void} setAwayTeam - Function to update the away team selection.
 * @property {() => void} handleAddMatch - Function to add a new match.
 * @property {(matchId: string) => void} handleRemoveMatch - Function to remove a match by ID.
 * @property {(matches: Match[]) => void} [setGlobalMatches] - Optional function to update global matches state.
 */
interface MatchListProps {
  matches: Match[];
  homeTeam: string;
  awayTeam: string;
  setHomeTeam: (team: string) => void;
  setAwayTeam: (team: string) => void;
  handleAddMatch: () => void;
  handleRemoveMatch: (matchId: string) => void;
  setGlobalMatches?: (matches: Match[]) => void;
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
 * - `useTeamFiltering`: Filters teams based on selected leagues.
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
  handleAddMatch,
  handleRemoveMatch,
  setGlobalMatches,
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

  const { startProcessing, processingState } = useMatchProcessing(
    matches,
    setHomeTeam,
    setAwayTeam,
    handleAddMatch, // This is the original handleAddMatch from props
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
    if (filteredMatches.length === 0) {
      alert("No matches found with current filters to add.");
      return;
    }

    if (!isDateFilterActive && !isTimeFilterActive) {
      alert("Please apply date or time filters before adding all.");
      return;
    }

    startProcessing(filteredMatches);
  };

  const handleAddMatchLocally = () => {
    if (homeTeam.trim() && awayTeam.trim()) {
      const newMatch: Match = {
        id: String(Date.now()),
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        homeGoals: 0,
        awayGoals: 0,
      };

      setGlobalMatches?.([...matches, newMatch]);

      setHomeTeam("");
      setAwayTeam("");
    }
  };

  const handleAddMatchAndClear = () => {
    handleAddMatchLocally();
  };

  const handleClearAllMatches = () => {
    if (matches.length === 0) {
      alert("No matches to clear.");
      return;
    }

    setGlobalMatches?.([]);
  };

  const renderMatchItem = useCallback(
    (listItem: { item: Match }) => {
      return (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(220)}
        >
          <MatchItem
            match={listItem.item}
            handleRemoveMatch={() => handleRemoveMatch(listItem.item.id)}
          />
        </Animated.View>
      );
    },
    [handleRemoveMatch],
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
      <Text style={styles.sectionTitle}>Matches</Text>

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

      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={renderMatchItem}
        ListEmptyComponent={
          <View style={styles.matchEmptyListContainer}>
            <AppIcon
              name="football-outline"
              size={48}
              color={colors.textMuted}
            />
            <Text style={styles.emptyListTitleText}>No matches added yet!</Text>
            <Text style={styles.emptyListSubtitleText}>
              Use the filters above to find matches, or the team selectors to
              add your first match.
            </Text>
          </View>
        }
        scrollEnabled={false}
        contentContainerStyle={styles.matchesGridContainer}
      />

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
  );
};

export default MatchList;
