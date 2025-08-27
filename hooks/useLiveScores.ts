import { useState, useEffect, useRef, useCallback } from "react";
import { Match, useGameStore } from "../store/store";
import { formatDateForAPI } from "../utils/matchUtils";
import {
  ESPNResponse,
  ESPNCompetitor,
  ESPNCompetitionDetail,
} from "../types/espn";
import { cacheTeamLogo } from "../utils/teamLogos";

/**
 * Match state including live scoring and optional statistics.
 * @description Augments a tracked match with real‑time score, status, timing and statistics pulled from the ESPN API.
 */
export interface MatchWithScore {
  id: string;
  homeScore: number;
  awayScore: number;
  isLive: boolean;
  minutesPlayed?: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string;
  awayTeamId: string;
  status: string;
  goalScorers?: GoalScorer[];
  homeTeamStatistics?: MatchStatistics;
  awayTeamStatistics?: MatchStatistics;
}

export interface GoalScorer {
  name: string;
  time: string;
  teamId: string;
  isPenalty: boolean;
  isOwnGoal: boolean;
  goalType: string;
}

export interface MatchStatistics {
  shotsOnGoal: number;
  shotAttempts: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  cornerKicks: number;
  possession: number;
}

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
    newGoals: number
  ) => void, // Updated signature
  intervalMs = 60000 // Poll every minute by default
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
        "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?limit=1"
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
          console.error(
            `Failed to fetch ${leagueEndpoints[i].name}: ${response.status}`
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

  /**
   * Start polling if not already active (immediate fetch + interval).
   * @description No effect when already polling.
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

/**
 * Safely extract a match id from an event.
 * @description Returns null when event.id is missing or empty.
 * @param event Raw ESPN event.
 * @returns Id string or null.
 */
const extractMatchId = (event: any): string | null => {
  if (!event || typeof event.id !== "string" || event.id === "") {
    // Added check for empty string ID
    return null;
  }
  return event.id;
};

/**
 * Parse subset of competitor statistics.
 * @description Normalises numeric values, ignoring missing stats.
 * @param competitor ESPN competitor.
 * @returns Parsed statistics.
 */
function parseStatistics(competitor: ESPNCompetitor): MatchStatistics {
  const stats = competitor.statistics || [];

  // Helper function to safely get statistics by name
  const getStat = (name: string): number => {
    const stat = stats.find(
      (s) => s.name?.toLowerCase() === name.toLowerCase()
    );
    if (!stat) return 0;

    // Prefer the numeric `value` field when present
    if (typeof stat.value === "number" && !Number.isNaN(stat.value)) {
      return stat.value;
    }

    if (typeof stat.displayValue === "string") {
      // Strip non-digit / decimal chars (keeps "45.7" from "45.7%")
      const numeric = parseFloat(stat.displayValue.replace(/[^\d.]/g, ""));
      return Number.isNaN(numeric) ? 0 : numeric;
    }
    return 0;
  };

  return {
    shotAttempts: getStat("totalShots"),
    shotsOnGoal: getStat("shotsOnTarget"),
    fouls: getStat("foulsCommitted"),
    yellowCards: 0, // Will be counted from event details
    redCards: 0, // Will be counted from event details
    cornerKicks: getStat("wonCorners"),
    possession: parseFloat(getStat("possessionPct").toString()) || 0,
  };
}

/**
 * Transform a raw ESPN event into MatchWithScore data.
 * @description Extracts id, teams, score, status, time display, goal scorers
 * and statistics; returns null on invalid/incomplete data.
 * @param event Raw ESPN event.
 * @returns MatchWithScore or null.
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

    // Cache team logos if available in the API response
    if (homeTeamData.team?.logo && homeTeamData.team?.displayName) {
      cacheTeamLogo(homeTeamData.team.displayName, homeTeamData.team.logo);
    }

    if (awayTeamData.team?.logo && awayTeamData.team?.displayName) {
      cacheTeamLogo(awayTeamData.team.displayName, awayTeamData.team.logo);
    }

    // Safely parse scores, defaulting to 0
    const homeScore = parseInt(homeTeamData.score || "0", 10);
    const awayScore = parseInt(awayTeamData.score || "0", 10);

    // Determine live status
    const matchStatusState = event.status?.type?.state || "";
    const isLive = matchStatusState === "in"; // Match is considered live if state is 'in'

    // Determine the display string for match time/status
    let matchTimeDisplay: string;
    const shortDetail = event.status?.type?.shortDetail; // e.g., "HT", "FT", "1st", "2nd"
    const displayClock = event.status?.displayClock; // e.g., "90'+4'", "45'+2'"

    if (shortDetail === "HT" || shortDetail === "FT") {
      matchTimeDisplay = shortDetail; // Use "HT" or "FT" directly
    } else if (isLive && displayClock) {
      // Use the display clock directly as provided by the API
      matchTimeDisplay = displayClock;
    } else {
      // Fallback to short detail or a placeholder if not live or clock unavailable
      matchTimeDisplay = shortDetail || "?";
    }

    // Extract goal scorers from the details array
    const goalScorers: GoalScorer[] = [];

    // Check if details array exists and has scoring plays
    if (event.competitions?.[0]?.details) {
      const details = event.competitions[0].details;

      // Process each detail to find goals
      for (const detail of details) {
        // Check if it's a scoring play
        if (detail.scoringPlay && detail.team?.id) {
          // Get the athlete information if available
          const athlete = detail.athletesInvolved?.[0];
          const name =
            athlete?.displayName || athlete?.shortName || "Unknown Player";

          goalScorers.push({
            name: name,
            time: detail.clock?.displayValue || "?",
            teamId: detail.team.id,
            isPenalty: detail.penaltyKick || false,
            isOwnGoal: detail.ownGoal || false,
            goalType: detail.type?.text || "Goal",
          });
        }
      }
    }

    // Parse statistics for home and away teams
    const homeStatistics = { ...parseStatistics(homeTeamData) };
    const awayStatistics = { ...parseStatistics(awayTeamData) };

    // Count cards from match details
    const details = competition.details || [];
    details.forEach((detail: ESPNCompetitionDetail) => {
      if (detail.yellowCard) {
        if (detail.team?.id === homeTeamData.team?.id) {
          homeStatistics.yellowCards++;
        } else if (detail.team?.id === awayTeamData.team?.id) {
          awayStatistics.yellowCards++;
        }
      }
      if (detail.redCard) {
        if (detail.team?.id === homeTeamData.team?.id) {
          homeStatistics.redCards++;
        } else if (detail.team?.id === awayTeamData.team?.id) {
          awayStatistics.redCards++;
        }
      }
    });

    // Construct the result object
    return {
      id,
      homeTeam: homeTeamData.team?.displayName || "Unknown Home", // Provide fallback
      awayTeam: awayTeamData.team?.displayName || "Unknown Away", // Provide fallback
      homeTeamId: homeTeamData.team?.id || "Unknown Home ID",
      awayTeamId: awayTeamData.team?.id || "Unknown Away ID",
      homeScore,
      awayScore,
      status: event.status?.type?.description || "Scheduled", // Provide fallback status description
      isLive,
      minutesPlayed: matchTimeDisplay, // Use the determined display string
      goalScorers: goalScorers.length > 0 ? goalScorers : undefined,
      homeTeamStatistics: homeStatistics,
      awayTeamStatistics: awayStatistics,
    };
  } catch (error) {
    console.error("Error processing API match event:", error, event); // Log the specific event data on error
    return null; // Return null on any processing error
  }
};
