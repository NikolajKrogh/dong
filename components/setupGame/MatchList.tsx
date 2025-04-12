import React, { useState, FC, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
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

/**
 * @brief Helper function to get today's date in YYYY-MM-DD format.
 *
 * @return A string representing today's date in YYYY-MM-DD format.
 */
const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

/**
 * @brief Interface for the props of the MatchList component.
 */
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

/**
 * @brief Functional component that renders a list of matches with filtering and team selection.
 *
 * This component fetches match data from an API, allows users to filter matches by league, date, and time,
 * and provides team selection rows for adding matches.
 *
 * @param matches Array of Match objects to display.
 * @param homeTeam The name of the home team.
 * @param awayTeam The name of the away team.
 * @param setHomeTeam Function to set the home team.
 * @param setAwayTeam Function to set the away team.
 * @param handleAddMatch Function to handle adding a match.
 * @param handleRemoveMatch Function to handle removing a match.
 * @param selectedCommonMatch The ID of the selected common match.
 * @param handleSelectCommonMatch Function to handle selecting a common match.
 * @param setGlobalMatches Function to set the global matches state.
 *
 * @return A React element, representing the match list.
 */
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
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [selectedMatchData, setSelectedMatchData] = useState<MatchData | null>(
    null
  );

  const {
    isLoading,
    isError,
    errorMessage,
    teamsData,
    apiData,
    availableLeagues,
  } = useMatchData(selectedDate);

  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([
    "Premier League",
    "Championship",
  ]);
  const [filteredMatches, setFilteredMatches] = useState<MatchData[]>([]);
  const [startTime, setStartTime] = useState("15:00");
  const [endTime, setEndTime] = useState("16:00");
  const [isTimeFilterActive, setIsTimeFilterActive] = useState(false);
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);

  const {
    filteredTeamsData,
    setFilteredTeamsData,
    homeTeamOptions,
    awayTeamOptions,
  } = useTeamFiltering(teamsData, selectedLeagues, matches, homeTeam, awayTeam);

  const { startProcessing, processingState } = useMatchProcessing(
    matches,
    setHomeTeam,
    setAwayTeam,
    handleAddMatch,
    setGlobalMatches
  );

  useEffect(() => {
    if (!apiData || apiData.length === 0) return;

    const allMatches: MatchData[] = [];
    apiData.forEach((leagueData) => {
      if (leagueData.matches) {
        allMatches.push(...leagueData.matches);
      }
    });

    const dateFilteredMatches = allMatches.filter(
      (match) => match.date === startDate
    );

    const timeFilteredMatches = filterMatchesByDateAndTime(
      dateFilteredMatches,
      startDate,
      endDate,
      startTime,
      endTime
    );

    const selectedLeagueSet = new Set(selectedLeagues);
    const teamsInSelectedLeagues = teamsData
      .filter((team) => selectedLeagueSet.has(team.league))
      .map((team) => ({
        normalizedName: normalizeTeamName(team.value),
        originalName: team.value,
        league: team.league,
      }));

    const teamNameMap = new Map();
    teamsInSelectedLeagues.forEach((team) => {
      teamNameMap.set(team.normalizedName, team);
    });

    const leagueFilteredMatches = timeFilteredMatches.filter((match) => {
      if (!match.team1 || !match.team2) return false;

      const normalizedTeam1 = normalizeTeamName(match.team1);
      const normalizedTeam2 = normalizeTeamName(match.team2);

      return (
        teamNameMap.has(normalizedTeam1) && teamNameMap.has(normalizedTeam2)
      );
    });

    setFilteredMatches(leagueFilteredMatches);

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
    setIsTimeFilterActive(true);
    setIsDateFilterActive(true);
  }, [apiData, startDate, endDate, startTime, endTime, selectedLeagues]);

  useEffect(() => {
    setSelectedDate(startDate);
  }, [startDate]);

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
    const today = getTodayDate();
    setStartTime("15:00");
    setEndTime("16:00");
    setStartDate(today);
    setEndDate(today);
    setSelectedDate(today);
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

    const allMatches: MatchData[] = [];
    apiData.forEach((leagueData) => {
      if (leagueData.matches) {
        allMatches.push(...leagueData.matches);
      }
    });

    const timeFilteredMatches = filterMatchesByDateAndTime(
      allMatches,
      startDate,
      endDate,
      startTime,
      endTime
    );

    const selectedLeagueSet = new Set(selectedLeagues);

    const teamsInSelectedLeagues = teamsData
      .filter((team) => selectedLeagueSet.has(team.league))
      .map((team) => ({
        normalizedName: normalizeTeamName(team.value),
        originalName: team.value,
        league: team.league,
      }));

    const teamNameMap = new Map();
    teamsInSelectedLeagues.forEach((team) => {
      teamNameMap.set(team.normalizedName, team);
    });

    const leagueFilteredMatches = timeFilteredMatches.filter((match) => {
      if (!match.team1 || !match.team2) return false;

      const normalizedTeam1 = normalizeTeamName(match.team1);
      const normalizedTeam2 = normalizeTeamName(match.team2);

      const team1Found = teamNameMap.has(normalizedTeam1);
      const team2Found = teamNameMap.has(normalizedTeam2);

      return team1Found && team2Found;
    });

    setFilteredMatches(leagueFilteredMatches);

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

    if (leagueFilteredMatches.length === 0) {
      alert("No matches found with current filters");
      return;
    }

    startProcessing(leagueFilteredMatches);
  };

  /**
   * @brief Normalizes team names for comparison by removing common suffixes, prefixes, and special characters.
   *
   * @param name The team name to normalize.
   * @return The normalized team name.
   */
  const normalizeTeamName = (name: string): string => {
    if (!name) return "";

    return name
      .toLowerCase()
      .replace(/\s+fc$/i, "")
      .replace(/^(fc|afc|1\.\s*fc|1\.\s*fsv)\s+/i, "")
      .replace(/&\s+/g, "")
      .replace(/[\s\-\.]+/g, "")
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

  const handleAddMatchLocally = () => {
    if (homeTeam.trim() && awayTeam.trim()) {
      const newMatch: Match = {
        id: selectedMatchData?.id || String(Date.now()),
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        homeGoals: 0,
        awayGoals: 0
      };

      // Add null check before calling
      if (setGlobalMatches) {
        setGlobalMatches([...matches, newMatch]);
      }

      setHomeTeam("");
      setAwayTeam("");
      setSelectedMatchData(null);
    }
  };

  const handleAddMatchAndClear = () => {
    handleAddMatchLocally();
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

  // When selecting a team from the dropdown, store the match data
  const selectMatchFromDropdown = (match: MatchData) => {
    setHomeTeam(match.team1);
    setAwayTeam(match.team2);
    setSelectedMatchData(match); // Store the full match data
  };

  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Matches</Text>

      <LeagueFilter
        availableLeagues={availableLeagues}
        selectedLeagues={selectedLeagues}
        handleLeagueChange={handleLeagueChange}
      />

      <MatchFilter
        startDate={startDate}
        endDate={endDate}
        startTime={startTime}
        endTime={endTime}
        setStartDate={(date) => {
          setStartDate(date);
        }}
        setEndDate={setEndDate}
        setStartTime={setStartTime}
        setEndTime={setEndTime}
        resetAllFilters={resetAllFilters}
        handleAddAllFilteredMatches={handleAddAllFilteredMatches}
        isTimeFilterActive={isTimeFilterActive}
        isDateFilterActive={isDateFilterActive}
        filteredTeamsData={filteredTeamsData}
        filteredMatches={filteredMatches}
        isLoading={isLoading}
      />

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

      {processingState.isProcessing && (
        <View style={styles.processingIndicator}>
          <Text>
            Processing matches: {processingState.matchesAdded} added,
            {processingState.matchesSkipped} skipped
          </Text>
          <ActivityIndicator size="small" color="#007bff" />
        </View>
      )}

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
