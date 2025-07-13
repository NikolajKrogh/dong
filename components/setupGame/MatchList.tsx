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
import styles from "../../app/style/setupGameStyles";
import { colors } from "../../app/style/palette";
import MatchFilter from "./MatchFilter";
import TeamSelectionRow from "./TeamSelectionRow";
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
import { LeagueEndpoint } from "../../constants/leagues";
import { useGameStore } from "../../store/store";

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
 * @interface MatchListProps
 * @brief Props for the MatchList component.
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
  const { defaultSelectedLeagues: storedDefaultLeagues } = useGameStore(); // Get from store
  /**
   * @brief State for the selected date for match filtering. Initializes to today's date.
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [selectedDate, setSelectedDate] = useState(getTodayDate());

  /**
   * @brief State for the currently selected match data, used to pre-fill team selection.
   * @type {[MatchData | null, React.Dispatch<React.SetStateAction<MatchData | null>>]}
   */
  const [selectedMatchData, setSelectedMatchData] = useState<MatchData | null>(
    null
  );

  /**
   * @brief Custom hook for fetching and managing match data.
   * Provides loading states, error states, team data extracted from matches,
   * raw API data, and available leagues based on the `selectedDate`.
   */
  const {
    isLoading: isMatchLoading,
    isError: isMatchError,
    errorMessage: matchErrorMessage,
    teamsData: matchTeamsData, // Teams extracted from API match data
    apiData, // Raw API response
    availableLeagues, // Leagues available from the API
  } = useMatchData(selectedDate);

  /**
   * @brief Custom hook for fetching and managing team data from local/static sources.
   * Provides loading states, error states, and comprehensive team data from league JSON files.
   */
  const {
    isLoading: isTeamLoading,
    isError: isTeamError,
    errorMessage: teamErrorMessage,
    teamsData: allTeamsData, // All teams from local JSON files
  } = useTeamData();

  /**
   * @brief State for the currently selected leagues for filtering.
   * Initializes with user's default selected leagues from store, or hardcoded defaults.
   * This state is updated by user interactions in the `LeagueFilter` component
   * and synchronized with `availableLeagues` from the API to ensure correct league codes.
   * @type {[LeagueEndpoint[], React.Dispatch<React.SetStateAction<LeagueEndpoint[]>>]}
   */
  const [selectedLeagues, setSelectedLeagues] = useState<LeagueEndpoint[]>(
    () => {
      // Ensure storedDefaultLeagues is an array and has items before using it.
      if (
        Array.isArray(storedDefaultLeagues) &&
        storedDefaultLeagues.length > 0
      ) {
        return storedDefaultLeagues;
      }
      // Fallback if no defaults are stored or they are empty
      return [
        { name: "Premier League", code: "eng.1" }, // Default initial selection
        { name: "Championship", code: "eng.2" },
      ];
    }
  );

  /**
   * @brief State for filtered matches based on league, date, and time criteria.
   * @type {[MatchData[], React.Dispatch<React.SetStateAction<MatchData[]>>]}
   */
  const [filteredMatches, setFilteredMatches] = useState<MatchData[]>([]);

  /**
   * @brief State for the start time used in time filtering. Defaults to "15:00".
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [startTime, setStartTime] = useState("15:00");

  /**
   * @brief State for the end time used in time filtering. Defaults to "16:00".
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [endTime, setEndTime] = useState("16:00"); // Default was 22:00, changed to 16:00 for testing

  /**
   * @brief State indicating whether time filtering is currently active.
   * @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]}
   */
  const [isTimeFilterActive, setIsTimeFilterActive] = useState(false);

  /**
   * @brief State indicating whether date filtering is currently active.
   * @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]}
   */
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);

  /**
   * @brief Custom hook for filtering teams based on selected leagues and current match/team selections.
   * Provides `filteredTeamsData` (teams available for selection dropdowns) and `setFilteredTeamsData`.
   */
  const { filteredTeamsData, setFilteredTeamsData } = useTeamFiltering(
    matchTeamsData, // Use teams from API matches for filtering context
    selectedLeagues,
    matches, // Current list of added matches
    homeTeam, // Currently selected home team
    awayTeam // Currently selected away team
  );

  /**
   * @brief Prepares home team options for the selection dropdown with normalized display names.
   * Maps `allTeamsData` (from local JSON) to include:
   * - Unique key for React rendering.
   * - Original team value for data storage.
   * - Normalized display name without common prefixes/suffixes (e.g., "FC").
   * - League information for potential filtering or display.
   * @type {{key: string, value: string, displayName: string, league: string}[]}
   */
  const homeTeamOptions = allTeamsData.map((team) => {
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
      value: team.value,
      displayName: displayName,
      league: team.league,
    };
  });

  /**
   * @brief Prepares away team options for the selection dropdown with normalized display names.
   * Similar to `homeTeamOptions` but with unique keys prefixed for away teams.
   * @type {{key: string, value: string, displayName: string, league: string}[]}
   */
  const awayTeamOptions = allTeamsData.map((team) => {
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
      value: team.value,
      displayName: displayName,
      league: team.league,
    };
  });

  /**
   * @brief Custom hook for batch processing of matches (e.g., adding multiple filtered matches).
   * Provides `startProcessing` function and `processingState` (isProcessing, matchesAdded, matchesSkipped).
   */
  const { startProcessing, processingState } = useMatchProcessing(
    matches,
    setHomeTeam,
    setAwayTeam,
    handleAddMatch, // This is the original handleAddMatch from props
    setGlobalMatches
  );

  /**
   * @brief Effect hook to filter matches based on date, time, and league criteria.
   *
   * This effect performs several steps:
   * 1. Extracts all matches from the raw `apiData`.
   * 2. Filters these matches by the selected date and time range using `filterMatchesByDateAndTime`.
   * 3. Further filters the matches by selected leagues:
   *    - It creates a set of selected league names.
   *    - It identifies teams from `matchTeamsData` (API teams) that belong to these selected leagues.
   *    - It normalizes team names for robust matching.
   *    - It filters `dateTimeFilteredMatches` to include only matches where both teams are in the `teamNameMap`.
   * 4. Updates the `filteredMatches` state with the result.
   * 5. Updates `isDateFilterActive` and `isTimeFilterActive` states based on current selections.
   * 6. Updates `filteredTeamsData` (for dropdowns) based on the teams present in the `leagueFilteredMatches`.
   *    If no leagues are selected, it defaults to all `matchTeamsData`.
   *
   * Dependencies: `apiData`, `selectedDate`, `startTime`, `endTime`, `selectedLeagues`, `matchTeamsData`, `setFilteredTeamsData`.
   * The effect re-runs whenever any of these dependencies change.
   */
  useEffect(() => {
    if (!apiData || apiData.length === 0) {
      setFilteredMatches([]);
      return;
    }

    const allMatches: MatchData[] = [];
    apiData.forEach((leagueData) => {
      if (leagueData && leagueData.matches) {
        // Added null check for leagueData
        allMatches.push(...leagueData.matches);
      }
    });

    const dateTimeFilteredMatches = filterMatchesByDateAndTime(
      allMatches,
      selectedDate,
      startTime,
      endTime
    );

    const selectedLeagueCodes = new Set( // Changed to use codes for consistency
      selectedLeagues.map((league) => league.code)
    );

    // Filter teams from API data that belong to the selected leagues
    const teamsInSelectedLeagues = matchTeamsData
      .filter((team) => {
        // Find the league in availableLeagues to get its code if only name is present in team.league
        const apiLeague = availableLeagues.find(
          (al) => al.name === team.league
        );
        return apiLeague && selectedLeagueCodes.has(apiLeague.code);
      })
      .map((team) => ({
        key: team.key || `${team.value}-${team.league}`, // Ensure a key exists
        value: team.value, // This is the original team name
        normalizedName: normalizeTeamName(team.value),
        originalName: team.value,
        league: team.league,
      }));

    const teamNameMap = new Map<string, TeamWithLeague>();
    teamsInSelectedLeagues.forEach((teamWithMeta) => {
      // Construct the TeamWithLeague object correctly
      const teamToAdd: TeamWithLeague = {
        key: teamWithMeta.key,
        value: teamWithMeta.value,
        league: teamWithMeta.league,
      };
      teamNameMap.set(teamWithMeta.normalizedName, teamToAdd);
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

    // Update filteredTeamsData for dropdowns based on teams in leagueFilteredMatches
    const teamsFromFilteredMatches = new Set<string>();
    leagueFilteredMatches.forEach((match) => {
      if (match.team1)
        teamsFromFilteredMatches.add(normalizeTeamName(match.team1));
      if (match.team2)
        teamsFromFilteredMatches.add(normalizeTeamName(match.team2));
    });

    const finalFilteredTeams = matchTeamsData.filter((team) =>
      teamsFromFilteredMatches.has(normalizeTeamName(team.value))
    );

    if (selectedLeagues.length > 0) {
      setFilteredTeamsData(
        finalFilteredTeams.length > 0 ? finalFilteredTeams : []
      ); // Ensure it's not undefined
    } else {
      // If no leagues are selected, show all teams from API match data
      setFilteredTeamsData(matchTeamsData);
    }
  }, [
    apiData,
    selectedDate,
    startTime,
    endTime,
    selectedLeagues,
    matchTeamsData,
    availableLeagues, // Added availableLeagues as dependency
    setFilteredTeamsData, // setFilteredTeamsData from useTeamFiltering hook
  ]);

  /**
   * @brief Effect hook to synchronize initial `selectedLeagues` with codes from `availableLeagues`.
   * When `availableLeagues` (from API) are loaded, this effect checks if the initially
   * selected leagues (by name) exist in `availableLeagues`. If so, it updates
   * `selectedLeagues` state with the versions from `availableLeagues` which include the correct API codes.
   * This ensures that league selection highlighting and filtering work correctly.
   *
   * Dependencies: `availableLeagues`. Re-runs when `availableLeagues` changes.
   * Note: This effect relies on the initial `selectedLeagues` state having correct names.
   */
  useEffect(() => {
    if (
      availableLeagues &&
      availableLeagues.length > 0 &&
      selectedLeagues.length > 0
    ) {
      const currentSelectedLeagueNames = new Set(
        selectedLeagues.map((league) => league.name)
      );

      const updatedSelectedLeagues = availableLeagues.filter((apiLeague) =>
        currentSelectedLeagueNames.has(apiLeague.name)
      );

      // Only update if there's a change to avoid infinite loops if selectedLeagues was a dependency
      if (
        updatedSelectedLeagues.length > 0 &&
        JSON.stringify(updatedSelectedLeagues) !==
          JSON.stringify(
            selectedLeagues.filter((sl) =>
              currentSelectedLeagueNames.has(sl.name)
            )
          )
      ) {
        setSelectedLeagues(updatedSelectedLeagues);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableLeagues]); // Intentionally not including selectedLeagues to run only when API leagues update

  /**
   * @brief Handles toggling a league in the `selectedLeagues` state.
   * If the league (identified by its code) is already selected, it's removed.
   * If not, it's added to the selection.
   *
   * @param {LeagueEndpoint} league - The league object to toggle.
   */
  const handleLeagueChange = (league: LeagueEndpoint) => {
    setSelectedLeagues((prev) => {
      const isSelected = prev.some((l) => l.code === league.code);
      if (isSelected) {
        return prev.filter((l) => l.code !== league.code);
      } else {
        return [...prev, league];
      }
    });
  };

  /**
   * @brief Handles adding all currently `filteredMatches` to the game.
   *
   * Validates that:
   * 1. There are matches in `filteredMatches` to add.
   * 2. At least one filter (date or time) is active.
   *
   * If validation passes, it calls `startProcessing` (from `useMatchProcessing` hook)
   * with the `filteredMatches`.
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
   * @brief Normalizes team names for robust comparison and matching.
   *
   * Transformations include:
   * - Converting to lowercase.
   * - Removing common suffixes like "FC".
   * - Removing common prefixes (e.g., "FC", "AFC", "1. FC").
   * - Removing ampersands and multiple spaces/hyphens/dots.
   * - Normalizing common accented characters (ø to o, ü to u, etc.).
   * - Trimming whitespace.
   *
   * @param {string} name - The team name to normalize.
   * @return {string} The normalized team name. Returns an empty string if input is falsy.
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
      .replace(/&\s+/g, "") // Remove ampersand followed by spaces
      .replace(/[\s\-\.]+/g, "") // Replace spaces, hyphens, dots with nothing
      .replace(/ø/g, "o")
      .replace(/ü/g, "u")
      .replace(/é/g, "e")
      .replace(/á/g, "a")
      .trim();
  };

  /**
   * @brief Adds a new custom home team to the `filteredTeamsData` state.
   * This allows users to add teams not present in the fetched data.
   * The team's league is set to the first selected league or "Custom" if no league is selected.
   *
   * @param {string} newTeamName - The name of the new home team to add.
   */
  const addNewHomeTeam = (newTeamName: string) => {
    const league =
      selectedLeagues.length > 0 ? selectedLeagues[0].name : "Custom";
    const newTeam: TeamWithLeague = {
      key: `home-${String(newTeamName)
        .toLowerCase()
        .replace(/\s+/g, "-")}-${Date.now()}`, // Ensure unique key
      value: newTeamName,
      league,
    };
    setFilteredTeamsData([...filteredTeamsData, newTeam]);
  };

  /**
   * @brief Adds a new custom away team to the `filteredTeamsData` state.
   * Similar to `addNewHomeTeam` but for away teams.
   *
   * @param {string} newTeamName - The name of the new away team to add.
   */
  const addNewAwayTeam = (newTeamName: string) => {
    const league =
      selectedLeagues.length > 0 ? selectedLeagues[0].name : "Custom";
    const newTeam: TeamWithLeague = {
      key: `away-${String(newTeamName)
        .toLowerCase()
        .replace(/\s+/g, "-")}-${Date.now()}`, // Ensure unique key
      value: newTeamName,
      league,
    };
    setFilteredTeamsData([...filteredTeamsData, newTeam]);
  };

  /**
   * @brief Adds the currently selected home and away teams as a new match to the global `matches` list.
   * This function is typically called when adding a single, manually configured match.
   * It uses `selectedMatchData` for the match ID and start time if available, otherwise generates a new ID.
   * After adding, it clears the team selections and `selectedMatchData`.
   */
  const handleAddMatchLocally = () => {
    if (homeTeam.trim() && awayTeam.trim()) {
      const newMatch: Match = {
        id: selectedMatchData?.id || String(Date.now()),
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        homeGoals: 0,
        awayGoals: 0,
        startTime: selectedMatchData?.time, // Use time from selected API match if available
      };

      if (setGlobalMatches) {
        setGlobalMatches([...matches, newMatch]);
      }

      setHomeTeam("");
      setAwayTeam("");
      setSelectedMatchData(null); // Clear selected match data from API
    }
  };

  /**
   * @brief Convenience function that adds the current match (via `handleAddMatchLocally`)
   * and then clears the team selection fields.
   */
  const handleAddMatchAndClear = () => {
    handleAddMatchLocally();
  };

  /**
   * @brief Clears all matches from the global matches list with a fade-out animation.
   * Validates that there are matches to clear first.
   * It animates all existing match items to fade out before updating the global state.
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
      setGlobalMatches && setGlobalMatches([]);
      fadeAnims.current = {}; // Clear animation refs
      return;
    }

    Animated.parallel(animations).start(() => {
      setGlobalMatches && setGlobalMatches([]);
      fadeAnims.current = {}; // Clear animation refs after animation
    });
  };

  /**
   * @brief Ref to store Animated.Value instances for each match item, enabling fade-out animations.
   * The keys are match IDs.
   * @type {React.MutableRefObject<{[key: string]: Animated.Value}>}
   */
  const fadeAnims = useRef<{ [key: string]: Animated.Value }>({});

  /**
   * @brief Effect hook to ensure `fadeAnims` ref has an Animated.Value for each match.
   * When the `matches` list changes (e.g., a match is added), this effect ensures
   * that new matches get an animation value initialized to 1 (fully opaque).
   *
   * Dependencies: `matches`.
   */
  useEffect(() => {
    matches.forEach((match) => {
      if (!fadeAnims.current[match.id]) {
        fadeAnims.current[match.id] = new Animated.Value(1);
      }
    });
    // Clean up animation values for matches that no longer exist
    const currentMatchIds = new Set(matches.map((m) => m.id));
    Object.keys(fadeAnims.current).forEach((matchId) => {
      if (!currentMatchIds.has(matchId)) {
        delete fadeAnims.current[matchId];
      }
    });
  }, [matches]);

  /**
   * @brief Removes a specific match by its ID with a fade-out animation.
   * It triggers an animation for the specified match item. On animation completion,
   * it calls the `handleRemoveMatch` prop (from parent) to update the global state
   * and then removes the animation value from the `fadeAnims` ref.
   * If no animation value exists for the match, it removes it immediately.
   *
   * @param {string} matchId - The ID of the match to remove.
   */
  const handleRemoveWithAnimation = (matchId: string) => {
    const anim = fadeAnims.current[matchId];
    if (!anim) {
      handleRemoveMatch(matchId); // Prop from parent
      return;
    }

    Animated.timing(anim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      handleRemoveMatch(matchId); // Prop from parent
    });
  };

  /**
   * @brief Combined loading state indicating if either match data or team data is loading.
   * @type {boolean}
   */
  const isLoading = isMatchLoading || isTeamLoading;
  /**
   * @brief Combined error state indicating if an error occurred while fetching match or team data.
   * @type {boolean}
   */
  const isError = isMatchError || isTeamError;
  /**
   * @brief Combined error message from match or team data fetching errors.
   * @type {string}
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
        filteredTeamsData={filteredTeamsData} // Teams for dropdowns within MatchFilter if needed
        filteredMatches={filteredMatches} // Matches found by filters
        isLoading={isLoading} // Pass combined loading state
        availableLeagues={availableLeagues} // Pass availableLeagues for potential use in MatchFilter
        selectedLeagues={selectedLeagues} // Pass selectedLeagues for potential use in MatchFilter
        handleLeagueChange={handleLeagueChange} // Pass handleLeagueChange for potential use in MatchFilter
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
          homeTeamOptions={homeTeamOptions} // All teams for home dropdown
          awayTeamOptions={awayTeamOptions} // All teams for away dropdown
          handleAddMatchAndClear={handleAddMatchAndClear}
          addNewHomeTeam={addNewHomeTeam}
          addNewAwayTeam={addNewAwayTeam}
        />
      )}

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
        renderItem={({ item }) => {
          // Ensure animation value exists, default to 1 if not (e.g., for newly added items before useEffect runs)
          const fadeAnim = fadeAnims.current[item.id] || new Animated.Value(1);
          if (!fadeAnims.current[item.id]) {
            // Ensure it's stored if newly created
            fadeAnims.current[item.id] = fadeAnim;
          }

          return (
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ scale: fadeAnim }],
              }}
            >
              <MatchItem
                match={item}
                handleRemoveMatch={() => handleRemoveWithAnimation(item.id)}
              />
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.matchEmptyListContainer}>
            <Ionicons
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
        contentContainerStyle={styles.matchesGridContainer} // If using a grid layout
      />

      {matches.length > 0 && (
        <TouchableOpacity
          style={styles.clearAllButton}
          onPress={handleClearAllMatches}
        >
          <Ionicons
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
