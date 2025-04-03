import React, { useState, FC } from "react";
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { Match } from "../../app/store";
import styles from "../../app/style/setupGameStyles";
import MatchFilter from "./Filter";
import TeamSelectionRow from "./TeamSelectionRow ";
import MatchItem from "./MatchItem";
import LeagueFilter from "./LeagueFilter";
import { useMatchData } from "../../hooks/useMatchData";
import {
  useTeamFiltering,
  filterMatchesByDateAndTime,
} from "../../hooks/useTeamFiltering";
import { useMatchProcessing } from "../../hooks/useMatchProcessing";
import { MatchData, TeamWithLeague } from "../../utils/matchUtils";

interface MatchListProps {
  matches: Match[];
  homeTeam: string;
  awayTeam: string;
  setHomeTeam: (team: string) => void;
  setAwayTeam: (team: string) => void;
  handleAddMatch: () => void;
  handleRemoveMatch: (matchId: string) => void;
  selectedCommonMatch: string | null;
  handleSelectCommonMatch: (matchId: string) => void;
  setGlobalMatches?: (matches: Match[]) => void;
}

const MatchList: FC<MatchListProps> = ({
  matches,
  homeTeam,
  awayTeam,
  setHomeTeam,
  setAwayTeam,
  handleAddMatch,
  handleRemoveMatch,
  selectedCommonMatch,
  handleSelectCommonMatch,
  setGlobalMatches,
}) => {
  // Get match data from API
  const {
    isLoading,
    isError,
    errorMessage,
    teamsData,
    apiData,
    availableLeagues,
  } = useMatchData();

  // State for filtering
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([
    "Premier League",
  ]);
  const [filteredMatches, setFilteredMatches] = useState<MatchData[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isTimeFilterActive, setIsTimeFilterActive] = useState(false);
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);

  // Team filtering
  const {
    filteredTeamsData,
    setFilteredTeamsData,
    homeTeamOptions,
    awayTeamOptions,
  } = useTeamFiltering(teamsData, selectedLeagues, matches, homeTeam, awayTeam);

  // Match processing
  const { startProcessing, processingState } = useMatchProcessing(
    matches,
    setHomeTeam,
    setAwayTeam,
    handleAddMatch,
    setGlobalMatches
  );

  // Handler functions
  const handleLeagueChange = (league: string) => {
    setSelectedLeagues((prev) => {
      if (prev.includes(league)) {
        return prev.filter((l) => l !== league);
      } else {
        return [...prev, league];
      }
    });
  };

  const resetAllFilters = () => {
    setStartTime("");
    setEndTime("");
    setStartDate("");
    setEndDate("");
    setFilteredTeamsData(teamsData);
    setIsTimeFilterActive(false);
    setIsDateFilterActive(false);
  };

  const handleAddAllFilteredMatches = () => {
    if (!apiData || apiData.length === 0) {
      alert("No match data available");
      return;
    }

    const hasTimeFilter = Boolean(startTime && endTime);
    const hasDateFilter = Boolean(startDate && endDate);

    if (!hasTimeFilter && !hasDateFilter) {
      alert("Please set date or time filters first");
      return;
    }

    // Combine all matches from API data regardless of league first
    const allMatches: MatchData[] = [];
    apiData.forEach((leagueData) => {
      if (leagueData.matches) {
        allMatches.push(...leagueData.matches);
      }
    });

    // Filter matches by date and time first
    const timeFilteredMatches = filterMatchesByDateAndTime(
      allMatches,
      startDate,
      endDate,
      startTime,
      endTime
    );

    // Now filter by league using the team data which has league information
    const selectedLeagueSet = new Set(selectedLeagues);

    // Get teams that belong to selected leagues with normalized names for comparison
    const teamsInSelectedLeagues = teamsData
      .filter((team) => selectedLeagueSet.has(team.league))
      .map((team) => ({
        normalizedName: normalizeTeamName(team.value),
        originalName: team.value,
        league: team.league,
      }));

    // Create a lookup map for faster team matching
    const teamNameMap = new Map();
    teamsInSelectedLeagues.forEach((team) => {
      teamNameMap.set(team.normalizedName, team);
    });

    // Filter matches to only include those with both teams in selected leagues
    const leagueFilteredMatches = timeFilteredMatches.filter((match) => {
      if (!match.team1 || !match.team2) return false;

      const normalizedTeam1 = normalizeTeamName(match.team1);
      const normalizedTeam2 = normalizeTeamName(match.team2);

      const team1Found = teamNameMap.has(normalizedTeam1);
      const team2Found = teamNameMap.has(normalizedTeam2);

      return team1Found && team2Found;
    });

    // Update filtered matches state
    setFilteredMatches(leagueFilteredMatches);

    // Update team filters with the teams from filtered matches
    const matchingTeams = new Set<string>();
    leagueFilteredMatches.forEach((match) => {
      if (match.team1) matchingTeams.add(match.team1);
      if (match.team2) matchingTeams.add(match.team2);
    });

    const filteredTeams = teamsData.filter(
      (team) =>
        matchingTeams.has(team.value) ||
        matchingTeams.has(normalizeTeamName(team.value))
    );

    setFilteredTeamsData(filteredTeams);
    setIsTimeFilterActive(hasTimeFilter);
    setIsDateFilterActive(hasDateFilter);

    // Check if we found any matches
    if (leagueFilteredMatches.length === 0) {
      alert("No matches found with current filters");
      return;
    }

    // Start processing matches
    startProcessing(leagueFilteredMatches);
  };

  // Helper function to normalize team names for comparison
  const normalizeTeamName = (name: string): string => {
    if (!name) return "";

    return name
      .toLowerCase()
      .replace(/\s+fc$/i, "") // Remove FC suffix
      .replace(/^(fc|afc|1\.\s*fc|1\.\s*fsv)\s+/i, "") // Remove common prefixes
      .replace(/&\s+/g, "") // Remove & and spaces
      .replace(/[\s\-\.]+/g, "") // Remove spaces, hyphens, periods
      .trim();
  };

  const addNewHomeTeam = (newTeamName: string) => {
    const league = selectedLeagues.length > 0 ? selectedLeagues[0] : "Custom";
    const newTeam = { key: String(Date.now()), value: newTeamName, league };
    setFilteredTeamsData([...filteredTeamsData, newTeam]);
  };

  const addNewAwayTeam = (newTeamName: string) => {
    const league = selectedLeagues.length > 0 ? selectedLeagues[0] : "Custom";
    const newTeam = { key: String(Date.now()), value: newTeamName, league };
    setFilteredTeamsData([...filteredTeamsData, newTeam]);
  };

  const handleAddMatchAndClear = () => {
    handleAddMatch();
    setHomeTeam("");
    setAwayTeam("");
  };

  const handleClearAllMatches = () => {
    if (matches.length === 0) {
      alert("No matches to clear.");
      return;
    }
    setGlobalMatches && setGlobalMatches([]);
  };

  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Matches</Text>

      {/* League Filter */}
      <LeagueFilter
        availableLeagues={availableLeagues}
        selectedLeagues={selectedLeagues}
        handleLeagueChange={handleLeagueChange}
      />

      {/* Filter Component */}
      <MatchFilter
        startDate={startDate}
        endDate={endDate}
        startTime={startTime}
        endTime={endTime}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        setStartTime={setStartTime}
        setEndTime={setEndTime}
        resetAllFilters={resetAllFilters}
        handleAddAllFilteredMatches={handleAddAllFilteredMatches}
        isTimeFilterActive={isTimeFilterActive}
        isDateFilterActive={isDateFilterActive}
        filteredTeamsData={filteredTeamsData}
        filteredMatches={filteredMatches}
      />

      {/* Handling loading and error states */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading teams...</Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {errorMessage || "Error loading teams. Using fallback data."}
          </Text>
        </View>
      ) : (
        <TeamSelectionRow
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          setHomeTeam={setHomeTeam}
          setAwayTeam={setAwayTeam}
          homeTeamOptions={homeTeamOptions}
          awayTeamOptions={awayTeamOptions}
          handleAddMatchAndClear={handleAddMatchAndClear}
          addNewHomeTeam={addNewHomeTeam}
          addNewAwayTeam={addNewAwayTeam}
        />
      )}

      {/* Display processing state if applicable */}
      {processingState.isProcessing && (
        <View style={styles.processingIndicator}>
          <Text>
            Processing matches: {processingState.matchesAdded} added,
            {processingState.matchesSkipped} skipped
          </Text>
          <ActivityIndicator size="small" color="#007bff" />
        </View>
      )}

      {/* Match List */}
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MatchItem
            match={item}
            selectedCommonMatch={selectedCommonMatch}
            handleSelectCommonMatch={handleSelectCommonMatch}
            handleRemoveMatch={handleRemoveMatch}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyListText}>No matches added yet</Text>
        }
        scrollEnabled={false}
        contentContainerStyle={styles.matchesGridContainer}
      />

      {/* Clear All Matches Button */}
      {matches.length > 0 && (
        <TouchableOpacity
          style={styles.clearAllButton}
          onPress={handleClearAllMatches}
        >
          <Text style={styles.clearAllButtonText}>Clear All Matches</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default MatchList;
