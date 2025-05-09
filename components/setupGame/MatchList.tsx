import React, { useState, FC, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from "react-native";
import LottieView from "lottie-react-native";
import { Match } from "../../store/store";
import styles, { colors } from "../../app/style/setupGameStyles";
import MatchFilter from "./MatchFilter";
import TeamSelectionRow from "./TeamSelectionRow ";
import MatchItem from "./MatchItem";
import LeagueFilter from "./LeagueFilter";
import { useMatchData } from "../../hooks/useMatchData";
import { useTeamData } from "../../hooks/useTeamData";
import {
  useTeamFiltering,
  filterMatchesByDateAndTime,
} from "../../hooks/useTeamFiltering";
import { useMatchProcessing } from "../../hooks/useMatchProcessing";
import { MatchData, TeamWithLeague } from "../../utils/matchUtils";
import { Ionicons } from "@expo/vector-icons";

/**
 * @brief Helper function to get today's date in YYYY-MM-DD format.
 *
 * Creates a new Date object for the current date and converts it to
 * the ISO string format, then extracts just the date portion.
 *
 * @return A string representing today's date in YYYY-MM-DD format.
 */
const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

/**
 * @brief Interface for the props of the MatchList component.
 *
 * @property matches List of current match objects.
 * @property homeTeam Currently selected home team name.
 * @property awayTeam Currently selected away team name.
 * @property setHomeTeam Function to update the home team selection.
 * @property setAwayTeam Function to update the away team selection.
 * @property handleAddMatch Function to add a new match.
 * @property handleRemoveMatch Function to remove a match by ID.
 * @property selectedCommonMatch Currently selected common match ID.
 * @property handleSelectCommonMatch Function to select a common match.
 * @property setGlobalMatches Optional function to update global matches state.
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
 * This component fetches match data from an API and team data from league JSON files.
 * It provides:
 * - League filtering to narrow down matches and teams
 * - Date and time filtering for matches
 * - Team selection dropdowns with normalized display names
 * - Match list with add/remove functionality
 *
 * The component uses several custom hooks for data fetching and processing:
 * - useMatchData: Fetches match data for a given date
 * - useTeamData: Fetches team data from league JSON files
 * - useTeamFiltering: Filters teams based on selected leagues
 * - useMatchProcessing: Handles batch processing of matches
 *
 * @param props The props for the MatchList component.
 * @return A React functional component.
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
  /**
   * @brief State for the selected date for match filtering.
   */
  const [selectedDate, setSelectedDate] = useState(getTodayDate());

  /**
   * @brief State for the currently selected match data.
   */
  const [selectedMatchData, setSelectedMatchData] = useState<MatchData | null>(
    null
  );

  /**
   * @brief Custom hook for fetching and managing match data.
   *
   * Provides loading states, error states, team data extracted from matches,
   * raw API data, and available leagues.
   */
  const {
    isLoading: isMatchLoading,
    isError: isMatchError,
    errorMessage: matchErrorMessage,
    teamsData: matchTeamsData,
    apiData,
    availableLeagues,
  } = useMatchData(selectedDate);

  /**
   * @brief Custom hook for fetching and managing team data.
   *
   * Provides loading states, error states, and team data from league JSON files.
   */
  const {
    isLoading: isTeamLoading,
    isError: isTeamError,
    errorMessage: teamErrorMessage,
    teamsData: allTeamsData,
  } = useTeamData();

  /**
   * @brief State for the currently selected leagues for filtering.
   */
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([
    "Premier League",
    "Championship",
  ]);
  /**
   * @brief State for filtered matches based on league, date, and time criteria.
   */
  const [filteredMatches, setFilteredMatches] = useState<MatchData[]>([]);

  /**
   * @brief State for the start time used in time filtering.
   */
  const [startTime, setStartTime] = useState("15:00");

  /**
   * @brief State for the end time used in time filtering.
   */
  const [endTime, setEndTime] = useState("16:00");

  /**
   * @brief State indicating whether time filtering is currently active.
   */
  const [isTimeFilterActive, setIsTimeFilterActive] = useState(false);

  /**
   * @brief State indicating whether date filtering is currently active.
   */
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);

  /**
   * @brief Custom hook for filtering teams based on selected leagues.
   *
   * Provides filtered team data and a function to update it.
   */
  const { filteredTeamsData, setFilteredTeamsData } = useTeamFiltering(
    matchTeamsData,
    selectedLeagues,
    matches,
    homeTeam,
    awayTeam
  );

  /**
   * @brief Prepares home team options with normalized display names.
   *
   * Maps team data to include:
   * - Unique key for React rendering
   * - Original team value for data storage
   * - Normalized display name without prefixes/suffixes
   * - League information for filtering
   */
  const homeTeamOptions = allTeamsData.map((team) => {
    // Generate a normalized display name without prefixes and suffixes
    const displayName = team.value
      .replace(/\s+fc$/i, "")
      .replace(
        /^(fc|afc|1\.\s*fc|1\.\s*fsv|as|ss|ssc|rc|cd|ogc|vfl|vfb|tsg|sc)\s+/i,
        ""
      )
      .trim();

    return {
      key:
        team.key ||
        `home-${String(team.value).toLowerCase().replace(/\s+/g, "-")}`,
      value: team.value, // Keep original value for data
      displayName: displayName, // Use normalized name for display
      league: team.league,
    };
  });

  /**
   * @brief Prepares away team options with normalized display names.
   *
   * Similar to homeTeamOptions but with unique keys for away teams.
   */
  const awayTeamOptions = allTeamsData.map((team) => {
    // Generate a normalized display name without prefixes and suffixes
    const displayName = team.value
      .replace(/\s+fc$/i, "")
      .replace(
        /^(fc|afc|1\.\s*fc|1\.\s*fsv|as|ss|ssc|rc|cd|ogc|vfl|vfb|tsg|sc)\s+/i,
        ""
      )
      .trim();

    return {
      key:
        team.key ||
        `away-${String(team.value).toLowerCase().replace(/\s+/g, "-")}`,
      value: team.value, // Keep original value for data
      displayName: displayName, // Use normalized name for display
      league: team.league,
    };
  });

  /**
   * @brief Custom hook for batch processing of matches.
   *
   * Provides a function to start processing and state about the processing.
   */
  const { startProcessing, processingState } = useMatchProcessing(
    matches,
    setHomeTeam,
    setAwayTeam,
    handleAddMatch,
    setGlobalMatches
  );

  /**
   * @brief Effect hook to filter matches based on date, time, and league criteria.
   *
   * This complex effect:
   * 1. Extracts all matches from API data
   * 2. Filters matches by date and time
   * 3. Filters matches by leagues
   * 4. Updates filter states
   * 5. Updates filtered teams data
   *
   * Dependencies are updated whenever filtering criteria change.
   */
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
    const teamsInSelectedLeagues = matchTeamsData
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

    const filteredTeams = matchTeamsData.filter(
      (team) =>
        matchingTeams.has(team.value) ||
        matchingTeams.has(normalizeTeamName(team.value))
    );

    if (selectedLeagues.length > 0) {
      setFilteredTeamsData(filteredTeams);
    } else {
      setFilteredTeamsData(matchTeamsData);
    }
  }, [
    apiData,
    selectedDate,
    startTime,
    endTime,
    selectedLeagues,
    matchTeamsData,
    setFilteredTeamsData,
  ]);

  /**
   * @brief Handles toggling a league in the selection.
   *
   * If the league is already selected, it's removed.
   * If not, it's added to the selection.
   *
   * @param league The league to toggle in the selection.
   */
  const handleLeagueChange = (league: string) => {
    setSelectedLeagues((prev) => {
      const newSelection = prev.includes(league)
        ? prev.filter((l) => l !== league)
        : [...prev, league];

      return newSelection;
    });
  };

  /**
   * @brief Handles adding all currently filtered matches.
   *
   * Validates that:
   * 1. There are matches to add
   * 2. At least one filter is active
   *
   * Then starts batch processing of the filtered matches.
   */
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
   * Transformations include:
   * - Converting to lowercase
   * - Removing FC suffix
   * - Removing common prefixes (FC, AFC, etc.)
   * - Removing special characters and spaces
   * - Normalizing accented characters
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

  /**
   * @brief Adds a new home team to the filtered teams data.
   *
   * Creates a new team object with:
   * - Unique key
   * - Team name
   * - League based on current selection or "Custom"
   *
   * @param newTeamName The name of the new home team to add.
   */
  const addNewHomeTeam = (newTeamName: string) => {
    const league = selectedLeagues.length > 0 ? selectedLeagues[0] : "Custom";
    const newTeam = {
      key: `home-${String(newTeamName)
        .toLowerCase()
        .replace(/\s+/g, "-")}-${Date.now()}`,
      value: newTeamName,
      league,
    };
    setFilteredTeamsData([...filteredTeamsData, newTeam]);
  };

  /**
   * @brief Adds a new away team to the filtered teams data.
   *
   * Similar to addNewHomeTeam but for away teams.
   *
   * @param newTeamName The name of the new away team to add.
   */
  const addNewAwayTeam = (newTeamName: string) => {
    const league = selectedLeagues.length > 0 ? selectedLeagues[0] : "Custom";
    const newTeam = {
      key: `away-${String(newTeamName)
        .toLowerCase()
        .replace(/\s+/g, "-")}-${Date.now()}`,
      value: newTeamName,
      league,
    };
    setFilteredTeamsData([...filteredTeamsData, newTeam]);
  };

  /**
   * @brief Adds the currently selected home and away teams as a new match.
   *
   * Creates a new match object with:
   * - ID from selected match data or current timestamp
   * - Home and away team names
   * - Initial score of 0-0
   *
   * Then adds it to the global matches list.
   */
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

  /**
   * @brief Clears all matches from the global matches list.
   *
   * Validates that there are matches to clear first.
   */
  const handleAddMatchAndClear = () => {
    handleAddMatchLocally();
    setHomeTeam("");
    setAwayTeam("");
    setSelectedMatchData(null);
  };

  /**
   * @brief Selects a match from the dropdown and fills in home and away teams.
   *
   * @param match The match data to select.
   */
  const handleClearAllMatches = () => {
    if (matches.length === 0) {
      alert("No matches to clear.");
      return;
    }

    const animations = Object.values(fadeAnims.current).map((anim) =>
      Animated.timing(anim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    );

    if (animations.length === 0) {
      // If no animations exist, clear immediately
      setGlobalMatches && setGlobalMatches([]);
      return;
    }

    Animated.parallel(animations).start(() => {
      setGlobalMatches && setGlobalMatches([]);
      fadeAnims.current = {};
    });
  };

  /**
   * @brief Animated values for each match to enable fade-out animations.
   */
  const fadeAnims = useRef<{ [key: string]: Animated.Value }>({});

  /**
   * @brief Updates the animation references when matches change.
   */
  useEffect(() => {
    matches.forEach((match) => {
      if (!fadeAnims.current[match.id]) {
        fadeAnims.current[match.id] = new Animated.Value(1);
      }
    });
  }, [matches]);

  /**
   * @brief Removes a match with a fade-out animation.
   *
   * Animates the match fading out before removing it from the list.
   *
   * @param matchId The ID of the match to remove.
   */
  const handleRemoveWithAnimation = (matchId: string) => {
    const anim = fadeAnims.current[matchId];
    if (!anim) {
      // If no animation exists, remove immediately
      handleRemoveMatch(matchId);
      return;
    }

    Animated.timing(anim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      handleRemoveMatch(matchId);
      delete fadeAnims.current[matchId];
    });
  };

  /**
   * @brief Combined loading state from match and team data loading.
   */
  const isLoading = isMatchLoading || isTeamLoading;

  /**
   * @brief Combined error state from match and team data errors.
   */
  const isError = isMatchError || isTeamError;

  /**
   * @brief Combined error message from match and team data errors.
   */
  const errorMessage = matchErrorMessage || teamErrorMessage;

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
          <Text style={styles.loadingText}>Loading matches and teams...</Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {errorMessage || "Error loading data."}
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
        renderItem={({ item }) => {
          const fadeAnim = fadeAnims.current[item.id] || new Animated.Value(1);
          fadeAnims.current[item.id] = fadeAnim;

          return (
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ scale: fadeAnim }],
              }}
            >
              <MatchItem
                match={item}
                selectedCommonMatch={selectedCommonMatch}
                handleSelectCommonMatch={handleSelectCommonMatch}
                handleRemoveMatch={handleRemoveWithAnimation}
              />
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.matchEmptyListContainer}>
            <Ionicons name="football-outline" size={48} color="#ccc" />
            <Text style={styles.emptyListTitleText}>No matches added yet!</Text>
            <Text style={styles.emptyListSubtitleText}>
              Use the two dropdowns to automatically find matches, or the team
              selectors above to add your first match.
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
          <Ionicons
            name="trash-outline"
            size={16}
            color="#fff"
            style={{ marginRight: 5 }}
          />
          <Text style={styles.clearAllButtonText}>Clear All Matches</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default MatchList;
