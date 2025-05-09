import React, { useState, FC, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import LottieView from "lottie-react-native"; 
import { Match } from "../../store/store";
import styles from "../../app/style/setupGameStyles";
import MatchFilter from "./MatchFilter";
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
    if (!apiData || apiData.length === 0) {
      setFilteredMatches([]);
      return;
    }

    const allMatches: MatchData[] = [];
    apiData.forEach((leagueData) => {
      if (leagueData.matches) {
        allMatches.push(...leagueData.matches);
      }
    });

    const dateTimeFilteredMatches = filterMatchesByDateAndTime(
      allMatches,
      selectedDate,
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

    const leagueFilteredMatches = dateTimeFilteredMatches.filter((match) => {
      if (!match.team1 || !match.team2) return false;

      const normalizedTeam1 = normalizeTeamName(match.team1);
      const normalizedTeam2 = normalizeTeamName(match.team2);

      return (
        teamNameMap.has(normalizedTeam1) && teamNameMap.has(normalizedTeam2)
      );
    });

    setFilteredMatches(leagueFilteredMatches);

    setIsDateFilterActive(Boolean(selectedDate));
    setIsTimeFilterActive(Boolean(startTime && endTime));

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

    if (selectedLeagues.length > 0) {
      setFilteredTeamsData(filteredTeams);
    } else {
      setFilteredTeamsData(teamsData);
    }
  }, [
    apiData,
    selectedDate,
    startTime,
    endTime,
    selectedLeagues,
    teamsData,
    setFilteredTeamsData,
  ]);

  const handleLeagueChange = (league: string) => {
    setSelectedLeagues((prev) => {
      const newSelection = prev.includes(league)
        ? prev.filter((l) => l !== league)
        : [...prev, league];

      if (newSelection.length === 0) {
        setFilteredTeamsData(teamsData);
      }
      return newSelection;
    });
  };

  const resetAllFilters = () => {
    const today = getTodayDate();
    setStartTime("15:00");
    setEndTime("16:00");
    setSelectedDate(today);
    setSelectedLeagues(["Premier League", "Championship"]);
    setFilteredTeamsData(teamsData);
    setIsTimeFilterActive(false);
    setIsDateFilterActive(true);
    setFilteredMatches([]);
  };

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
      .replace(
        /^(fc|afc|1\.\s*fc|1\.\s*fsv|as|ss|ssc|rc|cd|ogc|vfl|vfb|tsg|sc)\s+/i,
        ""
      )
      .replace(/&\s+/g, "")
      .replace(/[\s\-\.]+/g, "")
      .replace(/ø/g, "o")
      .replace(/ü/g, "u")
      .replace(/é/g, "e")
      .replace(/á/g, "a")
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
        awayGoals: 0,
      };

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
    setSelectedMatchData(null);
  };

  const handleClearAllMatches = () => {
    if (matches.length === 0) {
      alert("No matches to clear.");
      return;
    }
    setGlobalMatches && setGlobalMatches([]);
  };

  const selectMatchFromDropdown = (match: MatchData) => {
    setHomeTeam(match.team1);
    setAwayTeam(match.team2);
    setSelectedMatchData(match);
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
        selectedDate={selectedDate}
        startTime={startTime}
        endTime={endTime}
        setSelectedDate={setSelectedDate}
        setStartTime={setStartTime}
        setEndTime={setEndTime}
        handleAddAllFilteredMatches={handleAddAllFilteredMatches}
        isTimeFilterActive={isTimeFilterActive}
        isDateFilterActive={isDateFilterActive}
        filteredTeamsData={filteredTeamsData}
        filteredMatches={filteredMatches}
        isLoading={isLoading}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <LottieView
            source={require("../../assets/lottie/football_loading.json")}
            autoPlay
            loop
            style={styles.lottieAnimation}
          />
          <Text style={styles.loadingText}>Loading matches...</Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {errorMessage || "Error loading matches. Using fallback data."}
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
