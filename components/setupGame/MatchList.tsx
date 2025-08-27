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
import createSetupGameStyles from "../../app/style/setupGameStyles";
import { useColors } from "../../app/style/theme";
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
 * Get today's date (YYYY-MM-DD).
 * @description Returns ISO date portion for current day.
 * @returns {string} Date string.
 */
const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

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
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const { defaultSelectedLeagues: storedDefaultLeagues } = useGameStore(); // Get from store
  // Selected date (init to today)
  const [selectedDate, setSelectedDate] = useState(getTodayDate());

  // Selected match details (for prefill)
  const [selectedMatchData, setSelectedMatchData] = useState<MatchData | null>(
    null
  );

  // Match data hook (api + teams + leagues)
  const {
    isLoading: isMatchLoading,
    isError: isMatchError,
    errorMessage: matchErrorMessage,
    teamsData: matchTeamsData, // Teams extracted from API match data
    apiData, // Raw API response
    availableLeagues, // Leagues available from the API
  } = useMatchData(selectedDate);

  // Local/static team data hook
  const {
    isLoading: isTeamLoading,
    isError: isTeamError,
    errorMessage: teamErrorMessage,
    teamsData: allTeamsData, // All teams from local JSON files
  } = useTeamData();

  /**
   * Selected leagues used for filtering.
   * @description Initialized from stored defaults (if any) otherwise a fallback set. Updated via user interactions in `LeagueFilter` and aligned with `availableLeagues` to ensure codes are present.
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
   * Matches after applying league, date and time filters.
   */
  const [filteredMatches, setFilteredMatches] = useState<MatchData[]>([]);

  /**
   * Start time boundary for time filtering (HH:MM, 24h).
   */
  const [startTime, setStartTime] = useState("15:00");

  /**
   * End time boundary for time filtering (HH:MM, 24h).
   */
  const [endTime, setEndTime] = useState("16:00");

  /**
   * Whether a time range filter is active.
   */
  const [isTimeFilterActive, setIsTimeFilterActive] = useState(false);

  /**
   * Whether a date filter is active.
   */
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);

  /**
   * Filter teams based on selected leagues & current selections (hook output).
   * @description Supplies `filteredTeamsData` for dropdowns plus a setter.
   */
  const { filteredTeamsData, setFilteredTeamsData } = useTeamFiltering(
    matchTeamsData, // Use teams from API matches for filtering context
    selectedLeagues,
    matches, // Current list of added matches
    homeTeam, // Currently selected home team
    awayTeam // Currently selected away team
  );

  /**
   * Home team dropdown options with normalized display names.
   * @description Derived from `allTeamsData` with cleaned display names and stable keys.
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
   * Away team dropdown options (structure mirrors `homeTeamOptions`).
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
   * Batch match processing utilities from hook.
   * @description Exposes `startProcessing` plus progress state (added/skipped counts).
   */
  const { startProcessing, processingState } = useMatchProcessing(
    matches,
    setHomeTeam,
    setAwayTeam,
    handleAddMatch, // This is the original handleAddMatch from props
    setGlobalMatches
  );

  /**
   * Effect hook to filter matches based on date, time, and league criteria.
   *
   * @description This effect performs several steps:
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
   * Effect hook to synchronize initial `selectedLeagues` with codes from `availableLeagues`.
   * @description When `availableLeagues` (from API) are loaded, this effect checks if the initially
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
   * Toggle a league's inclusion in selection.
   * @param league League to toggle.
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
   * Handles adding all currently `filteredMatches` to the game.
   *
   * @description Validates that:
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
   * Normalize a team name for comparison (lowercase, strip prefixes/suffixes, punctuation, accents).
   * @param name Raw team name.
   * @returns Normalized string (empty if falsy input).
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
   * Add a custom home team entry to selection dataset.
   * @param newTeamName Team name to add.
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
   * Add a custom away team entry to selection dataset.
   * @param newTeamName Team name to add.
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
   * Add currently selected teams as a new match (uses selected API match metadata if present).
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
   * Wrapper to add current match then clear selections.
   */
  const handleAddMatchAndClear = () => {
    handleAddMatchLocally();
  };

  /**
   * Clear all matches with a fade-out animation (no-op if list empty).
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
   * Ref map of matchId -> Animated.Value for fade animations.
   */
  const fadeAnims = useRef<{ [key: string]: Animated.Value }>({});

  /**
   * Ensure each match has an animation value; prune removed matches.
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
   * Remove a match with fade-out animation fallback.
   * @param matchId Match identifier.
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

  /** Combined loading state (match or team fetch). */
  const isLoading = isMatchLoading || isTeamLoading;
  /** Combined error state (match or team fetch). */
  const isError = isMatchError || isTeamError;
  /** Combined error message (match or team fetch). */
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
