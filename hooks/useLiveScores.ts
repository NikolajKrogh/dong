import { useCallback, useEffect, useRef, useState } from "react";
import { Match, useGameStore } from "../store/store";
import { ESPNResponse } from "../types/espn";
import type { MatchWithScore } from "../types/matchScores";
import { formatDateForAPI } from "../utils/matchUtils";
import { processApiMatch } from "../utils/espnParsing";

// Re-exported for backward compatibility; new code should import from
// types/matchScores and utils/espnParsing directly.
export type { MatchWithScore, GoalScorer, MatchStatistics } from "../types/matchScores";
export { extractMatchId, parseStatistics, processApiMatch } from "../utils/espnParsing";

/**
 * Polls the ESPN API for live score updates.
 * @description Maintains a list of live match snapshots; invokes updateCallback when new goals are detected,
 *  and exposes controls to start/stop or manually fetch.
 * @param matches Matches to monitor.
 * @param updateCallback Invoked when a team's goal tally increases (matchId, side, newGoals).
 * @param intervalMs Poll interval in ms (default 60000).
 * @returns Control and data object (liveMatches, isPolling, lastUpdated, startPolling, stopPolling, fetchCurrentScores).
 */
export function useLiveScores(
  matches: Match[],
  updateCallback: (
    matchId: string,
    team: "home" | "away",
    newGoals: number,
  ) => void, // Updated signature
  intervalMs = 60000, // Poll every minute by default
) {
  const [liveMatches, setLiveMatches] = useState<MatchWithScore[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousScoresRef = useRef<Record<string, number>>({});
  const configuredLeagues = useGameStore((state) => state.configuredLeagues);

  /**
   * Fetch and process current scores for tracked matches.
   * @description Performs a connectivity check, queries each configured league, derives match state,
   * detects new goals and updates state; silent on failures.
   */
  const fetchCurrentScores = useCallback(async () => {
    // First verify network connectivity
    try {
      // Using a reliable endpoint for connectivity check
      const testResponse = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?limit=1",
      );
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

      // Use the user-configured leagues
      const leagueEndpoints = configuredLeagues;

      // Fetch all leagues in parallel
      const responses = await Promise.all(
        leagueEndpoints.map((league) =>
          fetch(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${dateParam}`,
          ),
        ),
      );

      const updatedMatches: MatchWithScore[] = [];
      const newGoals: Record<string, number> = {}; // Store total goals for matches with updates

      // Process all responses
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];

        // Skip failed requests
        if (!response.ok) {
          console.error(
            `Failed to fetch ${leagueEndpoints[i].name}: ${response.status}`,
          );
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
  }, [matches, updateCallback, configuredLeagues]);

  const fetchCurrentScoresRef = useRef(fetchCurrentScores);

  useEffect(() => {
    fetchCurrentScoresRef.current = fetchCurrentScores;
  }, [fetchCurrentScores]);

  /**
   * Start polling if not already active (immediate fetch + interval).
   * @description No effect when already polling.
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    console.log("Starting live score polling...");
    setIsPolling(true);

    // Do an immediate fetch
    void fetchCurrentScoresRef.current();

    // Set up the interval for subsequent fetches
    pollingIntervalRef.current = setInterval(() => {
      void fetchCurrentScoresRef.current();
    }, intervalMs);
  }, [intervalMs]);

  /**
   * Stop polling and clear the interval.
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
