import React, { useState, useEffect, useMemo, FC } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "../../app/store";
import styles from "../../app/style/setupGameStyles";
import MatchFilter from "./Filter";
import TeamSelectionRow from "./TeamSelectionRow ";
import MatchItem from "./MatchItem";

/**
 * @brief Interface for the match data structure from the API.
 *
 * This interface defines the structure of match data received from the API,
 * including team names, scores, date, and time.
 */
interface MatchData {
  team1: string;
  team2: string;
  score?: {
    ft: [number, number];
  };
  date?: string;
  time?: string;
}

/**
 * @brief Interface for the API response structure.
 *
 * This interface defines the structure of the API response, which includes
 * a name and an array of matches.
 */
interface ApiResponse {
  name: string;
  matches: MatchData[];
}

/**
 * @brief Interface for a team with its league information.
 *
 * This interface defines the structure for storing team information along with
 * the league they belong to.
 */
interface TeamWithLeague {
  key: string;
  value: string;
  league: string;
}

/**
 * @brief Interface for the MatchList component props.
 *
 * This interface defines the props that the MatchList component accepts,
 * including matches, team names, and handler functions for adding/removing matches.
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
}

/**
 * @brief MatchList component for displaying and managing a list of matches.
 *
 * This component fetches match data from multiple leagues, allows filtering of teams
 * based on selected leagues, and provides functionality to add and remove matches
 * from the list.
 *
 * @param props - The props for the MatchList component.
 * @returns A React functional component.
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
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [teamsData, setTeamsData] = useState<TeamWithLeague[]>([]);
  const [apiData, setApiData] = useState<ApiResponse[]>([]);
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<MatchData[]>([]);
  const [processingMatchIndex, setProcessingMatchIndex] = useState<number>(-1);
  const [matchesToProcess, setMatchesToProcess] = useState<MatchData[]>([]);
  const [processingState, setProcessingState] = useState({
    isProcessing: false,
    matchesAdded: 0,
    matchesSkipped: 0,
    totalToProcess: 0,
  });
  const [isLeagueExpanded, setIsLeagueExpanded] = useState(false);
  // Time filter states
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [filteredTeamsData, setFilteredTeamsData] = useState<TeamWithLeague[]>(
    []
  );
  const [isTimeFilterActive, setIsTimeFilterActive] = useState(false);

  // Date state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);

  /**
   * @brief Cleans a team name by removing common prefixes and suffixes.
   *
   * This function removes common prefixes and suffixes from a team name to
   * standardize the names.
   *
   * @param teamName - The team name to clean.
   * @returns The cleaned team name.
   */
  const cleanTeamName = (teamName: string): string => {
    let cleaned = teamName.trim();

    // Remove common prefixes and suffixes using regular expressions
    cleaned = cleaned.replace(/ FC$/i, ""); // Remove " FC" suffix (case-insensitive)
    cleaned = cleaned.replace(/^(AFC|FC|1\. FSV|1\. FC|SS|SSC) /i, ""); // Remove prefixes (case-insensitive)

    return cleaned.trim();
  };

  /**
   * @brief Fetches teams from multiple leagues on component mount.
   *
   * This useEffect hook fetches team data from multiple league APIs and populates
   * the teamsData and availableLeagues state variables.
   */
  useEffect(() => {
    const fetchTeams = async () => {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage("");

      try {
        // League API URLs
        const leagueUrls = [
          // Premier League
          "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/en.1.json",
          // Championship
          "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/en.2.json",
          // Bundesliga
          "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/de.1.json",
          // La Liga
          "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/es.1.json",
          // Serie A
          "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/it.1.json",
          // Ligue 1
          "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/fr.1.json",
        ];

        const leagueNames = [
          "Premier League",
          "Championship",
          "Bundesliga",
          "La Liga",
          "Serie A",
          "Ligue 1",
        ];

        // Fetch all leagues in parallel
        const responses = await Promise.all(
          leagueUrls.map((url) => fetch(url))
        );

        // Process responses
        const allData: ApiResponse[] = [];
        const allTeams: TeamWithLeague[] = [];
        const leagueSet = new Set<string>();

        for (let i = 0; i < responses.length; i++) {
          const response = responses[i];

          if (!response.ok) {
            console.warn(
              `API for ${leagueNames[i]} responded with status: ${response.status}`
            );
            continue;
          }

          const data: ApiResponse = await response.json();
          allData.push(data);

          // Extract unique team names from matches with league info
          const leagueName = leagueNames[i];
          leagueSet.add(leagueName);

          const teamSet = new Set<string>();
          data.matches.forEach((match: MatchData) => {
            const homeTeam = match.team1 ? cleanTeamName(match.team1) : "";
            const awayTeam = match.team2 ? cleanTeamName(match.team2) : "";

            // Extract time from date if it exists
            if (match.date && !match.time) {
              if (match.date.includes("T")) {
                const timePart = match.date.split("T")[1];
                match.time = timePart.substring(0, 5); // Extract HH:MM
              }
            }

            if (homeTeam) teamSet.add(homeTeam);
            if (awayTeam) teamSet.add(awayTeam);
          });

          // Add teams with league info
          Array.from(teamSet).forEach((team) => {
            allTeams.push({
              key: `${team}-${leagueName}`,
              value: team,
              league: leagueName,
            });
          });
        }

        // Set the leagues and teams
        setApiData(allData);
        setAvailableLeagues(Array.from(leagueSet));
        setSelectedLeagues(["Premier League"]); // Default: select Premier League

        // Sort teams alphabetically
        const sortedTeams = allTeams.sort((a, b) =>
          a.value.localeCompare(b.value)
        );

        setTeamsData(sortedTeams);
        setFilteredTeamsData(sortedTeams); // Initialize filtered teams with all teams
        console.log(
          "Teams loaded:",
          sortedTeams.length,
          "from",
          leagueSet.size,
          "leagues"
        );
      } catch (error) {
        console.error(
          "Error fetching teams:",
          error instanceof Error ? error.message : String(error)
        );
        setIsError(true);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load teams"
        );

        // Fallback to static list on error
        const fallbackTeams = [
          "Arsenal",
          "Aston Villa",
          "Bournemouth",
          "Brentford",
          "Brighton & Hove Albion",
          "Chelsea",
          "Crystal Palace",
          "Everton",
          "Fulham",
          "Leicester City",
          "Liverpool",
          "Manchester City",
          "Manchester United",
          "Newcastle United",
          "Nottingham Forest",
          "Southampton",
          "Tottenham Hotspur",
          "West Ham United",
          "Wolverhampton Wanderers",
          "Ipswich Town",
        ].map((team) => ({
          key: team,
          value: cleanTeamName(team),
          league: "Premier League",
        }));

        setTeamsData(fallbackTeams);
        setFilteredTeamsData(fallbackTeams);
        setAvailableLeagues(["Premier League"]);
        setSelectedLeagues(["Premier League"]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeams();
  }, []);

  /**
   * @brief Handles a change in the selected leagues.
   *
   * This function updates the selectedLeagues state based on the user's selection.
   *
   * @param league - The league to add or remove from the selected leagues.
   */
  const handleLeagueChange = (league: string) => {
    setSelectedLeagues((prev) => {
      if (prev.includes(league)) {
        return prev.filter((l) => l !== league);
      } else {
        return [...prev, league];
      }
    });
  };

  /**
   * @brief Filters teams based on the selected leagues.
   *
   * This useEffect hook filters the teamsData based on the selectedLeagues and
   * updates the filteredTeamsData state.
   */
  useEffect(() => {
    if (teamsData.length > 0 && selectedLeagues.length > 0) {
      const filtered = teamsData.filter((team) =>
        selectedLeagues.includes(team.league)
      );
      setFilteredTeamsData(filtered);
    } else if (teamsData.length > 0) {
      // If no leagues selected, show all teams
      setFilteredTeamsData(teamsData);
    }
  }, [selectedLeagues, teamsData]);

  /**
   * @brief Converts a time string to minutes.
   *
   * This helper function converts a time string in HH:MM format to minutes.
   *
   * @param timeString - The time string to convert.
   * @returns The time in minutes, or -1 if the time string is invalid.
   */
  const convertTimeToMinutes = (timeString: string): number => {
    if (!timeString || !timeString.includes(":")) return -1;

    try {
      const [hours, minutes] = timeString.split(":").map(Number);
      if (isNaN(hours) || isNaN(minutes)) return -1;
      return hours * 60 + minutes;
    } catch (e) {
      console.error("Time conversion error:", e);
      return -1;
    }
  };

  /**
   * @brief Checks if a date is within a specified range.
   *
   * This helper function checks if a given date falls within a specified date range.
   *
   * @param dateStr - The date to check (as a string).
   * @param startDateStr - The start date of the range (as a string).
   * @param endDateStr - The end date of the range (as a string).
   * @returns True if the date is within the range, false otherwise.
   */
  const isDateInRange = (
    dateStr: string,
    startDateStr: string,
    endDateStr: string
  ): boolean => {
    if (!dateStr || !startDateStr || !endDateStr) return true;

    try {
      const date = new Date(dateStr);
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      return date >= startDate && date <= endDate;
    } catch (e) {
      console.error("Date comparison error:", e);
      return true; // Default to including the match if there's an error
    }
  };

  /**
   * @brief Handles adding all filtered matches to the list.
   *
   * This function applies the time and date filters to the available match data
   * and adds the matching matches to the list.
   */
  const handleAddAllFilteredMatches = () => {
    // Apply filters first to ensure we have up-to-date data
    if (!apiData || apiData.length === 0) {
      alert("No match data available");
      return;
    }

    // filters
    try {
      const hasTimeFilter = Boolean(startTime && endTime);
      const hasDateFilter = Boolean(startDate && endDate);

      if (!hasTimeFilter && !hasDateFilter) {
        alert("Please set date or time filters first");
        return;
      }

      // time filter
      const startMinutes = hasTimeFilter ? convertTimeToMinutes(startTime) : -1;
      const endMinutes = hasTimeFilter ? convertTimeToMinutes(endTime) : -1;

      if (hasTimeFilter && (startMinutes < 0 || endMinutes < 0)) {
        alert("Please enter valid times in HH:MM format");
        return;
      }

      // Combine matches from all leagues in apiData
      const allMatches: MatchData[] = [];
      apiData.forEach((leagueData) => {
        if (leagueData.matches) {
          allMatches.push(...leagueData.matches);
        }
      });

      // Filter for matches from the API
      const matchingMatches = allMatches.filter((match) => {
        let includeMatch = true;

        // Apply date filter if active
        if (hasDateFilter) {
          includeMatch = isDateInRange(match.date ?? "", startDate, endDate);
        }

        // Apply time filter if active
        if (includeMatch && hasTimeFilter && match.time) {
          const matchMinutes = convertTimeToMinutes(match.time);
          includeMatch =
            matchMinutes >= startMinutes && matchMinutes <= endMinutes;
        }

        return includeMatch;
      });

      // Update filtered matches state
      setFilteredMatches(matchingMatches);

      // Update team filters
      const matchingTeams = new Set<string>();
      matchingMatches.forEach((match) => {
        if (match.team1) matchingTeams.add(match.team1);
        if (match.team2) matchingTeams.add(match.team2);
      });

      const filtered = teamsData.filter((team) =>
        matchingTeams.has(team.value)
      );
      setFilteredTeamsData(filtered);
      setIsTimeFilterActive(hasTimeFilter);
      setIsDateFilterActive(hasDateFilter);

      // Check if we found any matches
      if (matchingMatches.length === 0) {
        alert("No matches found with current filters");
        return;
      }

      // Create local copies of filtered matches that contain both teams
      const validMatches = matchingMatches.filter(
        (match) => match.team1 && match.team2
      );

      if (validMatches.length === 0) {
        alert("No valid matches to add");
        return;
      }

      // Store the valid matches for processing
      setMatchesToProcess(validMatches);

      // Start processing at index 0
      setProcessingMatchIndex(0);
    } catch (error) {
      console.error("Error applying filters and adding matches:", error);
      alert("Error processing matches. Please try again.");
    }
  };

  /**
   * @brief Processes matches to be added to the list.
   *
   * This useEffect hook processes matches from the matchesToProcess array and adds
   * them to the list if they do not already exist.
   */
  useEffect(() => {
    if (
      processingMatchIndex >= 0 &&
      matchesToProcess.length > 0 &&
      processingMatchIndex < matchesToProcess.length
    ) {
      const currentMatch = matchesToProcess[processingMatchIndex];

      if (currentMatch.team1 && currentMatch.team2) {
        // Check if this match already exists in the list
        const matchExists = matches.some(
          (existingMatch) =>
            (existingMatch.homeTeam === currentMatch.team1 &&
              existingMatch.awayTeam === currentMatch.team2) ||
            (existingMatch.homeTeam === currentMatch.team2 &&
              existingMatch.awayTeam === currentMatch.team1)
        );

        if (!matchExists) {
          // Only add the match if it doesn't exist
          setHomeTeam(currentMatch.team1);
          setAwayTeam(currentMatch.team2);

          // Use setTimeout to allow state to update before adding match
          setTimeout(() => {
            handleAddMatch();
            processNextMatch();
          }, 100);
        } else {
          // Skip existing match and move to next
          processNextMatch();
        }
      } else {
        // Skip invalid match
        processNextMatch();
      }
    }
  }, [processingMatchIndex, matchesToProcess, matches]);

  /**
   * @brief Processes the next match in the queue.
   *
   * This function increments the processingMatchIndex to move to the next match
   * in the matchesToProcess array.
   */
  const processNextMatch = () => {
    setTimeout(() => {
      if (processingMatchIndex < matchesToProcess.length - 1) {
        setProcessingMatchIndex(processingMatchIndex + 1);
      } else {
        // Done processing
        setProcessingMatchIndex(-1);
        setMatchesToProcess([]); // Clear the processing queue
        setHomeTeam("");
        setAwayTeam("");

        // Provide feedback without alerts
        console.log(`Added all new matches that matched your filters`);
      }
    }, 100);
  };

  /**
   * @brief Resets all filters to their default values.
   *
   * This function resets the time, date, and team filters to their default values.
   */
  const resetAllFilters = () => {
    setStartTime("");
    setEndTime("");
    setStartDate("");
    setEndDate("");
    setFilteredTeamsData(teamsData);
    setIsTimeFilterActive(false);
    setIsDateFilterActive(false);
  };

  /**
   * @brief Adds a new home team to the list of teams.
   *
   * This function adds a new home team to the list of available teams.
   *
   * @param newTeamName - The name of the new home team.
   */
  const addNewHomeTeam = (newTeamName: string) => {
    // Default to first selected league or "Custom" if none selected
    const league = selectedLeagues.length > 0 ? selectedLeagues[0] : "Custom";
    const newTeam = { key: String(Date.now()), value: newTeamName, league };
    setTeamsData([...teamsData, newTeam]);
    setFilteredTeamsData([...filteredTeamsData, newTeam]);
  };

  /**
   * @brief Adds a new away team to the list of teams.
   *
   * This function adds a new away team to the list of available teams.
   *
   * @param newTeamName - The name of the new away team.
   */
  const addNewAwayTeam = (newTeamName: string) => {
    const league = selectedLeagues.length > 0 ? selectedLeagues[0] : "Custom";
    const newTeam = { key: String(Date.now()), value: newTeamName, league };
    setTeamsData([...teamsData, newTeam]);
    setFilteredTeamsData([...filteredTeamsData, newTeam]);
  };

  /**
   * @brief Filters the home team options, excluding already used teams.
   *
   * This useMemo hook filters the home team options, excluding teams that are
   * already used in existing matches.
   */
  const homeTeamOptions = useMemo(() => {
    // Get teams already used in existing matches
    const usedTeams = new Set<string>();
    matches.forEach((match) => {
      usedTeams.add(cleanTeamName(match.homeTeam));
      usedTeams.add(cleanTeamName(match.awayTeam));
    });

    return filteredTeamsData.filter(
      (team) =>
        team.value !== awayTeam && // Can't select same team as away
        !usedTeams.has(team.value) // Can't select teams already used in other matches
    );
  }, [filteredTeamsData, awayTeam, matches]);

  /**
   * @brief Filters the away team options, excluding already used teams.
   *
   * This useMemo hook filters the away team options, excluding teams that are
   * already used in existing matches.
   */
  const awayTeamOptions = useMemo(() => {
    // Get teams already used in existing matches
    const usedTeams = new Set<string>();
    matches.forEach((match) => {
      usedTeams.add(cleanTeamName(match.homeTeam));
      usedTeams.add(cleanTeamName(match.awayTeam));
    });

    return filteredTeamsData.filter(
      (team) =>
        team.value !== homeTeam && // Can't select same team as home
        !usedTeams.has(team.value) // Can't select teams already used in other matches
    );
  }, [filteredTeamsData, homeTeam, matches]);

  /**
   * @brief Handles adding a match and clearing the team selections.
   *
   * This function adds a match to the list and clears the home and away team selections.
   */
  const handleAddMatchAndClear = () => {
    handleAddMatch();
    setHomeTeam("");
    setAwayTeam("");
  };

  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Matches</Text>

      {/* League Filter Section */}

      <TouchableOpacity
        style={styles.expandableCard}
        onPress={() => setIsLeagueExpanded(!isLeagueExpanded)}
      >
        <View style={styles.expandableCardContent}>
          <View style={styles.expandableCardLeft}>
            <Ionicons name="funnel-outline" size={20} color="#0275d8" />
            <Text style={styles.expandableCardTitle}>League Filter</Text>
          </View>

          <View style={styles.rightContent}>
            <View style={styles.filterBadgesContainer}>
              {selectedLeagues.map((league) => (
                <View key={league} style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{league}</Text>
                </View>
              ))}
            </View>

            <View style={styles.compactIndicator}>
              <Ionicons
                name={isLeagueExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color="#777"
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {isLeagueExpanded && (
        <View style={styles.expandedCardContent}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.leagueChipsScrollContent}
          >
            {availableLeagues.map((league) => (
              <TouchableOpacity
                key={league}
                style={[
                  styles.leagueChip,
                  selectedLeagues.includes(league) && styles.selectedLeagueChip,
                ]}
                onPress={() => handleLeagueChange(league)}
              >
                <Text
                  style={[
                    styles.leagueChipText,
                    selectedLeagues.includes(league) &&
                      styles.selectedLeagueChipText,
                  ]}
                >
                  {league}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
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
          addNewHomeTeam={addNewHomeTeam} // Pass the function
          addNewAwayTeam={addNewAwayTeam} // Pass the function
        />
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
    </View>
  );
};

export default MatchList;
