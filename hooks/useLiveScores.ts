import { useState, useEffect, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { Match } from "../app/store";
import { formatDateForAPI } from "../utils/matchUtils";
import { Audio } from "expo-av";
import { ESPNResponse } from "../types/espn"; // cspell:ignore espn

/**
 * @brief Interface for match state with score information.
 */
export interface MatchWithScore {
  id: string;
  homeScore: number;
  awayScore: number;
  isLive: boolean;
  minutesPlayed?: string; // Make sure this is defined as a string
  // Add missing properties
  homeTeam: string;
  awayTeam: string;
  status: string;
}

/**
 * @brief Custom hook for polling live scores from the ESPN API.
 * Fetches scores for specified matches at a regular interval and provides updates.
 * @param {Match[]} matches Array of matches to monitor for score updates.
 * @param {(matchId: string, team: "home" | "away", newGoals: number) => void} updateCallback Callback function to call when a score is updated.
 * @param {number} [intervalMs=60000] Polling interval in milliseconds.
 * @param {boolean} [autoPlaySound=true] Whether to automatically play the goal sound on updates.
 * @return An object containing:
 *  - liveMatches: Array of matches with live score information.
 *  - isPolling: Boolean indicating if the API is currently being polled.
 *  - lastUpdated: Date object of the last successful update.
 *  - startPolling: Function to start the polling.
 *  - stopPolling: Function to stop the polling.
 *  - fetchCurrentScores: Function to manually trigger a score fetch.
 */
export function useLiveScores(
  matches: Match[],
  updateCallback: (
    matchId: string,
    team: "home" | "away",
    newGoals: number
  ) => void, // Updated signature
  intervalMs = 60000, // Poll every minute by default
  autoPlaySound = false // Default to not auto-playing sound
) {
  const [liveMatches, setLiveMatches] = useState<MatchWithScore[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousScoresRef = useRef<Record<string, number>>({});

  /**
   * @brief Plays the goal sound effect ('dong.mp3').
   * Plays the sound if `autoPlaySound` is true and no sound is currently playing.
   * Includes a cooldown to prevent rapid overlapping sounds.
   * @async
   */
  const playGoalSound = async () => {
    if (isSoundPlaying || !autoPlaySound) return;

    setIsSoundPlaying(true);
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/sounds/dong.mp3")
      );
      await sound.playAsync();

      // Allow sound to play again after 3 seconds
      setTimeout(() => {
        setIsSoundPlaying(false);
        // Consider unloading the sound here if not needed immediately again
        // sound.unloadAsync();
      }, 3000);
    } catch (error) {
      console.error("Error playing goal sound:", error); // Log error
      setIsSoundPlaying(false);
    }
  };

  /**
   * @brief Fetches current scores from the ESPN API for the tracked matches.
   * Checks network connectivity, fetches data from multiple league endpoints,
   * processes the responses, updates the live match state, and triggers the
   * update callback and goal sound for new goals detected.
   * @async
   */
  const fetchCurrentScores = useCallback(async () => {
    // First verify network connectivity
    try {
      // Using a reliable endpoint for connectivity check
      const testResponse = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?limit=1");
      if (!testResponse.ok) {
        console.log("Network connectivity check failed.");
        return; // Skip API calls if no connectivity
      }
    } catch (error) {
      console.log("Network connectivity error:", error);
      return; // Skip API calls if connectivity check fails
    }

    try {
      // Get today's date formatted for the API
      const today = new Date();
      const dateParam = formatDateForAPI(today.toISOString().split("T")[0]);

      // Create a map of match IDs to track which matches we're monitoring
      const matchIdsToTrack = new Set(matches.map((m) => m.id));
      if (matchIdsToTrack.size === 0) return; // Don't fetch if no matches are tracked

      // Fetch data from these leagues
      const leagueEndpoints = [
        { code: "eng.1", name: "Premier League" },
        { code: "eng.2", name: "Championship" },
        { code: "ger.1", name: "Bundesliga" },
        { code: "esp.1", name: "La Liga" },
        { code: "ita.1", name: "Serie A" },
        { code: "fra.1", name: "Ligue 1" },
        // Add more leagues if needed
      ];

      // Fetch all leagues in parallel
      const responses = await Promise.all(
        leagueEndpoints.map((league) =>
          fetch(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${dateParam}`
          )
        )
      );

      const updatedMatches: MatchWithScore[] = [];
      const newGoals: Record<string, number> = {}; // Store total goals for matches with updates

      // Process all responses
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];

        // Skip failed requests
        if (!response.ok) {
           console.error(`Failed to fetch ${leagueEndpoints[i].name}: ${response.status}`);
           continue;
        }

        const data: ESPNResponse = await response.json();

        // Look for tracked matches in the response
        for (const event of data.events) {
          // Ensure the event has an ID we are tracking
          if (!event.id || !matchIdsToTrack.has(event.id)) continue;

          // Use the updated processApiMatch function
          const processedMatch = processApiMatch(event);
          if (!processedMatch) continue;

          const { id, homeScore, awayScore } = processedMatch;

          // Find the corresponding match in our app's state
          const appMatch = matches.find((m) => m.id === id);
          if (!appMatch) continue; // Should not happen if ID is tracked, but good check

          // Calculate total goals from the API data
          const totalGoals = homeScore + awayScore;

          // Compare with previous total score recorded from the API
          const prevTotal = previousScoresRef.current[id] || 0;

          // If the API shows more goals than the last time we checked the API
          if (totalGoals > prevTotal) {
            // And if the API shows more goals than our app currently has stored
            const appTotalGoals =
              (appMatch.homeGoals || 0) + (appMatch.awayGoals || 0);
            if (totalGoals > appTotalGoals) {
              // Mark this match as having new goals to process
              newGoals[id] = totalGoals; // Store the new total goal count
            }
          }

          // Update the reference for the next comparison
          previousScoresRef.current[id] = totalGoals;

          // Add the processed match data to the list for UI update
          updatedMatches.push(processedMatch);
        }
      }

      // Update UI state with the latest fetched match data
      setLiveMatches(updatedMatches);
      setLastUpdated(new Date());

      // Process any matches marked with new goals
      const matchIdsWithNewGoals = Object.keys(newGoals);
      if (matchIdsWithNewGoals.length > 0) {
        // Play sound once if any goal updates occurred
        playGoalSound();

        // Update goals for each affected match via the callback
        matchIdsWithNewGoals.forEach((matchId) => {
          // Find the latest processed data and the app's current state for this match
          const latestMatchData = updatedMatches.find((m) => m.id === matchId);
          const currentAppMatch = matches.find((m) => m.id === matchId);

          if (latestMatchData && currentAppMatch) {
            // Check if home score increased compared to app state
            if (latestMatchData.homeScore > (currentAppMatch.homeGoals || 0)) {
              updateCallback(matchId, "home", latestMatchData.homeScore);
            }
            // Check if away score increased compared to app state
            if (latestMatchData.awayScore > (currentAppMatch.awayGoals || 0)) {
              updateCallback(matchId, "away", latestMatchData.awayScore);
            }
          }
        });
      }
    } catch (error) {
      console.error("Error fetching or processing scores:", error);
      // Silently fail for the user - we'll try again next polling interval
    }
  }, [matches, updateCallback, autoPlaySound, playGoalSound]); // Added playGoalSound dependency

  /**
   * @brief Starts polling the API for score updates at the specified interval.
   * Performs an immediate fetch upon starting. Does nothing if already polling.
   */
  const startPolling = useCallback(() => {
    if (isPolling || pollingIntervalRef.current) return; // Prevent multiple intervals

    console.log("Starting live score polling...");
    setIsPolling(true);

    // Do an immediate fetch
    fetchCurrentScores();

    // Set up the interval for subsequent fetches
    pollingIntervalRef.current = setInterval(fetchCurrentScores, intervalMs);
  }, [isPolling, intervalMs, fetchCurrentScores]);

  /**
   * @brief Stops polling the API for score updates.
   * Clears the polling interval.
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log("Stopping live score polling.");
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Clean up interval on component unmount
  useEffect(() => {
    return () => {
      stopPolling(); // Ensure polling stops when the component unmounts
    };
  }, [stopPolling]);

  return {
    liveMatches,
    isPolling,
    lastUpdated,
    startPolling,
    stopPolling,
    fetchCurrentScores,
  };
}

/**
 * @brief Extracts the match ID from an ESPN API event object.
 * Safely accesses the event ID.
 * @param {any} event The ESPN API event object.
 * @returns {string | null} The match ID as a string, or null if not available or invalid.
 */
const extractMatchId = (event: any): string | null => {
  if (!event || typeof event.id !== "string" || event.id === "") {
    // Added check for empty string ID
    return null;
  }
  return event.id;
};

/**
 * @brief Processes a single match event from the ESPN API response.
 * Extracts relevant information like ID, scores, status, team names, and live status.
 * @param {any} event The ESPN API event object for a single match.
 * @returns {MatchWithScore | null} A MatchWithScore object containing processed data, or null if processing fails or data is incomplete.
 */
const processApiMatch = (event: any): MatchWithScore | null => {
  try {
    // Extract the match ID
    const id = extractMatchId(event);
    if (!id) return null; // Exit early if no valid ID

    // Navigate safely through the competition data
    const competition = event.competitions?.[0];
    if (!competition) return null;

    // Find home and away competitor data
    const homeTeamData = competition.competitors?.find(
      (c: any) => c.homeAway === "home"
    );
    const awayTeamData = competition.competitors?.find(
      (c: any) => c.homeAway === "away"
    );

    // Ensure both teams' data is found
    if (!homeTeamData || !awayTeamData) return null;

    // Safely parse scores, defaulting to 0
    const homeScore = parseInt(homeTeamData.score || "0", 10);
    const awayScore = parseInt(awayTeamData.score || "0", 10);

    // Determine live status
    const matchStatusState = event.status?.type?.state || "";
    const isLive = matchStatusState === "in"; // Match is considered live if state is 'in'

    // Determine the display string for match time/status
    let matchTimeDisplay: string;
    const shortDetail = event.status?.type?.shortDetail; // e.g., "HT", "FT", "1st", "2nd"
    const displayClock = event.status?.displayClock; // e.g., "45:00+", "90:00"

    if (shortDetail === "HT" || shortDetail === "FT") {
      matchTimeDisplay = shortDetail; // Use "HT" or "FT" directly
    } else if (isLive && displayClock) {
      // Use the display clock if live and available, removing potential trailing '+' or similar
      matchTimeDisplay = displayClock.replace(/['+]/g, "") + "'"; // Ensure apostrophe
    } else {
      // Fallback to short detail or a placeholder if not live or clock unavailable
      matchTimeDisplay = shortDetail || "?";
    }

    // Construct the result object
    return {
      id,
      homeTeam: homeTeamData.team?.displayName || "Unknown Home", // Provide fallback
      awayTeam: awayTeamData.team?.displayName || "Unknown Away", // Provide fallback
      homeScore,
      awayScore,
      status: event.status?.type?.description || "Scheduled", // Provide fallback status description
      isLive,
      minutesPlayed: matchTimeDisplay, // Use the determined display string
    };
  } catch (error) {
    console.error("Error processing API match event:", error, event); // Log the specific event data on error
    return null; // Return null on any processing error
  }
};