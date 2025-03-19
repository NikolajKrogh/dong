import React, { useState, useEffect, useMemo, FC } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { Match } from "../../app/store";
import styles from "../../app/style/setupGameStyles";
import MatchFilter from "./Filter";
import TeamSelectionRow from "./TeamSelectionRow ";
import MatchItem from "./MatchItem";

// Define interfaces for the API data structure
interface MatchData {
  team1: string;
  team2: string;
  score?: {
    ft: [number, number];
  };
  date?: string;
  time?: string;
}

interface ApiResponse {
  name: string;
  matches: MatchData[];
}

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
  const [teamsData, setTeamsData] = useState<{ key: string; value: string }[]>(
    []
  );
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [filteredMatches, setFilteredMatches] = useState<MatchData[]>([]);
  const [processingMatchIndex, setProcessingMatchIndex] = useState<number>(-1);
  const [matchesToProcess, setMatchesToProcess] = useState<MatchData[]>([]);
  const [processingState, setProcessingState] = useState({
    isProcessing: false,
    matchesAdded: 0,
    matchesSkipped: 0,
    totalToProcess: 0,
  });

  // Time filter states
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [filteredTeamsData, setFilteredTeamsData] = useState<
    { key: string; value: string }[]
  >([]);
  const [isTimeFilterActive, setIsTimeFilterActive] = useState(false);

  // Date state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);

  const cleanTeamName = (teamName: string): string => {
    // Remove "FC" from the end of team names
    let cleaned = teamName.trim();
    if (cleaned.endsWith(" FC")) {
      cleaned = cleaned.substring(0, cleaned.length - 3).trim();
    }
    
    // Remove "AFC" from the beginning of team names
    if (cleaned.startsWith("AFC ")) {
      cleaned = cleaned.substring(4).trim();
    }
    
    return cleaned;
  };

  // Fetch Premier League teams on component mount
  useEffect(() => {
    const fetchTeams = async () => {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage("");

      try {
        // Try to fetch from API
        const response = await fetch(
          "https://raw.githubusercontent.com/openfootball/football.json/master/2024-25/en.1.json"
        );

        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }

        const data: ApiResponse = await response.json();
        setApiData(data);

        // Extract unique team names from matches
const teamSet = new Set<string>();
data.matches.forEach((match: MatchData) => {
  const homeTeam = match.team1 ? cleanTeamName(match.team1) : "";
  const awayTeam = match.team2 ? cleanTeamName(match.team2) : "";

  // Extract time from date if it exists
  if (match.date && !match.time) {
    // Example: "2023-08-11T19:00:00Z"
    if (match.date.includes("T")) {
      const timePart = match.date.split("T")[1];
      match.time = timePart.substring(0, 5); // Extract HH:MM
    }
  }

  if (homeTeam) teamSet.add(homeTeam);
  if (awayTeam) teamSet.add(awayTeam);
});

        // Convert to format needed for SelectList
        const formattedTeams = Array.from(teamSet)
          .sort()
          .map((team) => ({ key: team, value: team }));

        setTeamsData(formattedTeams);
        setFilteredTeamsData(formattedTeams); // Initialize filtered teams with all teams
        console.log("Teams loaded:", formattedTeams.length);
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
          "Arsenal FC",
          "Aston Villa FC",
          "AFC Bournemouth",
          "Brentford FC",
          "Brighton & Hove Albion FC",
          "Chelsea FC",
          "Crystal Palace FC",
          "Everton FC",
          "Fulham FC",
          "Leicester City FC",
          "Liverpool FC",
          "Manchester City FC",
          "Manchester United FC",
          "Newcastle United FC",
          "Nottingham Forest FC",
          "Southampton FC",
          "Tottenham Hotspur FC",
          "West Ham United FC",
          "Wolverhampton Wanderers FC",
          "Ipswich Town FC",
        ].map((team) => ({ key: team, value: team }));

        setTeamsData(fallbackTeams);
        setFilteredTeamsData(fallbackTeams);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeams();
  }, []);

  // Helper function to convert time string to minutes
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

  // New helper function to check if a date is within a range
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

  const handleAddAllFilteredMatches = () => {
    // Apply filters first to ensure we have up-to-date data
    if (!apiData) {
      alert("No match data available");
      return;
    }

    // Process filters directly here
    try {
      const hasTimeFilter = Boolean(startTime && endTime);
      const hasDateFilter = Boolean(startDate && endDate);

      if (!hasTimeFilter && !hasDateFilter) {
        alert("Please set date or time filters first");
        return;
      }

      // Process time filter
      const startMinutes = hasTimeFilter ? convertTimeToMinutes(startTime) : -1;
      const endMinutes = hasTimeFilter ? convertTimeToMinutes(endTime) : -1;

      if (hasTimeFilter && (startMinutes < 0 || endMinutes < 0)) {
        alert("Please enter valid times in HH:MM format");
        return;
      }

      // Filter for matches from the API
      const matchingMatches = apiData.matches.filter((match) => {
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

  // Update the useEffect to use matchesToProcess instead of filteredMatches
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

  // Update processNextMatch to use matchesToProcess
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

  // Reset filters
  const resetAllFilters = () => {
    setStartTime("");
    setEndTime("");
    setStartDate("");
    setEndDate("");
    setFilteredTeamsData(teamsData);
    setIsTimeFilterActive(false);
    setIsDateFilterActive(false);
  };

// Filter team options, excluding already used teams
const homeTeamOptions = useMemo(() => {
  // Get teams already used in existing matches
  const usedTeams = new Set<string>();
  matches.forEach(match => {
    usedTeams.add(cleanTeamName(match.homeTeam));
    usedTeams.add(cleanTeamName(match.awayTeam));
  });
  
  return filteredTeamsData.filter(team => 
    team.value !== awayTeam && // Can't select same team as away
    !usedTeams.has(team.value) // Can't select teams already used in other matches
  );
}, [filteredTeamsData, awayTeam, matches]);

const awayTeamOptions = useMemo(() => {
  // Get teams already used in existing matches
  const usedTeams = new Set<string>();
  matches.forEach(match => {
    usedTeams.add(cleanTeamName(match.homeTeam));
    usedTeams.add(cleanTeamName(match.awayTeam));
  });
  
  return filteredTeamsData.filter(team => 
    team.value !== homeTeam && // Can't select same team as home
    !usedTeams.has(team.value) // Can't select teams already used in other matches
  );
}, [filteredTeamsData, homeTeam, matches]);

  // Clear selections after adding a match
  const handleAddMatchAndClear = () => {
    handleAddMatch();
    setHomeTeam("");
    setAwayTeam("");
  };

  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Matches</Text>

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
