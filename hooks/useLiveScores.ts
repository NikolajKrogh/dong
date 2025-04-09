import { useState, useEffect, useRef } from "react";
import { Match } from "../app/store";
import { formatDateForAPI } from "../utils/matchUtils";
import { Audio } from "expo-av";
import { ESPNResponse, ESPNEvent } from "../types/espn";

/**
 * @brief Interface for match state with score information.
 */
interface MatchWithScore {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  isLive: boolean;
}

/**
 * @brief Custom hook for polling live scores from the ESPN API.
 *
 * @param matches Array of matches to monitor for score updates.
 * @param updateCallback Callback function to call when a score is updated.
 * @param intervalMs Polling interval in milliseconds (default: 60000ms/1min).
 * @param autoPlaySound Whether to automatically play the goal sound on updates.
 *
 * @return An object containing:
 *  - liveMatches: Array of matches with live score information.
 *  - isPolling: Boolean indicating if the API is currently being polled.
 *  - lastUpdated: Date object of the last successful update.
 *  - startPolling: Function to start the polling.
 *  - stopPolling: Function to stop the polling.
 */
export function useLiveScores(
  matches: Match[],
  updateCallback: (matchId: string, newGoals: number) => void,
  intervalMs = 60000, // Poll every minute by default
  autoPlaySound = true
) {
  const [liveMatches, setLiveMatches] = useState<MatchWithScore[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousScoresRef = useRef<Record<string, number>>({});

  /**
   * @brief Plays the goal sound effect.
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
      }, 3000);
    } catch (error) {
      console.error("Error playing goal sound:", error);
      setIsSoundPlaying(false);
    }
  };

  /**
   * @brief Fetches current scores from the ESPN API.
   */
  const fetchCurrentScores = async () => {
    try {
      // Get today's date formatted for the API
      const today = new Date();
      const dateParam = formatDateForAPI(today.toISOString().split("T")[0]);

      // Create a map of match IDs to track which matches we're monitoring
      const matchIdsToTrack = new Set(matches.map((m) => m.id));

      // Only fetch leagues that we need based on the matches
      const leagueEndpoints = [
        { code: "eng.1", name: "Premier League" },
        { code: "eng.2", name: "Championship" },
        { code: "ger.1", name: "Bundesliga" },
        { code: "esp.1", name: "La Liga" },
        { code: "ita.1", name: "Serie A" },
        { code: "fra.1", name: "Ligue 1" },
      ];

      // Fetch all leagues in parallel
      const responses = await Promise.all(
        leagueEndpoints.map((league) =>
          fetch(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${dateParam}`
          )
        )
      );

      console.log("Fetching scores for", matches.length, "matches");
      console.log("Match IDs being tracked:", Array.from(matchIdsToTrack));

      const updatedMatches: MatchWithScore[] = [];
      const newGoals: Record<string, number> = {};

      // Process all responses
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        if (!response.ok) continue;

        const data: ESPNResponse = await response.json();

        // Look for tracked matches in the response
        for (const event of data.events) {
          if (!matchIdsToTrack.has(event.id)) continue;

          let homeScore = 0;
          let awayScore = 0;
          let isLive = false;
          let status = "scheduled";

          // Get the scores if available
          if (
            event.competitions &&
            event.competitions[0] &&
            event.competitions[0].competitors
          ) {
            for (const competitor of event.competitions[0].competitors) {
              if (competitor.homeAway === "home") {
                homeScore = parseInt(competitor.score || "0", 10);
              } else {
                awayScore = parseInt(competitor.score || "0", 10);
              }
            }

            // Check if the match is live
            const matchStatus = event.competitions[0].status?.type?.state || "";
            isLive = matchStatus === "in";
            status = matchStatus;
          }

          // Find the corresponding match in our app
          const appMatch = matches.find((m) => m.id === event.id);
          if (!appMatch) continue;

          // Calculate total goals
          const totalGoals = homeScore + awayScore;

          // Compare with previous total and our current app state
          const prevTotal = previousScoresRef.current[event.id] || 0;

          // If there are new goals in the API compared to previous API check
          if (totalGoals > prevTotal) {
            // And if the API shows more goals than our app currently has
            if (totalGoals > appMatch.goals) {
              // Update our app's goals to match the API
              newGoals[event.id] = totalGoals;
            }
          }

          // Update previous scores reference
          previousScoresRef.current[event.id] = totalGoals;

          updatedMatches.push({
            id: event.id,
            homeTeam: appMatch.homeTeam,
            awayTeam: appMatch.awayTeam,
            homeScore,
            awayScore,
            status,
            isLive,
          });
        }
      }

      console.log("Updated live matches:", updatedMatches);
      console.log("New goals detected:", newGoals);

      // Update UI with new matches
      setLiveMatches(updatedMatches);
      setLastUpdated(new Date());

      // Process any new goals
      const matchIdsWithNewGoals = Object.keys(newGoals);
      if (matchIdsWithNewGoals.length > 0) {
        // Play sound once for any goal updates
        playGoalSound();

        // Update goals for each affected match
        matchIdsWithNewGoals.forEach((matchId) => {
          updateCallback(matchId, newGoals[matchId]);
        });
      }
    } catch (error) {
      console.error("Error fetching live scores:", error);
    }
  };

  /**
   * @brief Starts polling the API for score updates.
   */
  const startPolling = () => {
    if (isPolling) return;

    setIsPolling(true);

    // Do an immediate fetch
    fetchCurrentScores();

    // Set up the interval for subsequent fetches
    pollingIntervalRef.current = setInterval(fetchCurrentScores, intervalMs);
  };

  /**
   * @brief Stops polling the API for score updates.
   */
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  };

  // Add this at the end of the hook, right before the return statement
  const startDemoMode = () => {
    if (isPolling) stopPolling();

    setIsPolling(true);
    setLastUpdated(new Date());

    // Create demo matches from actual matches
    const demoMatches: MatchWithScore[] = matches.map((match) => ({
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeScore: 0,
      awayScore: 0,
      status: "in",
      isLive: true,
    }));

    setLiveMatches(demoMatches);

    // Store current scores to track changes
    const currentScores = new Map<string, { home: number; away: number }>();
    matches.forEach((match) => {
      currentScores.set(match.id, { home: 0, away: 0 });
    });

    // Simulate a goal every 10 seconds
    let goalCounter = 0;
    pollingIntervalRef.current = setInterval(() => {
      if (goalCounter >= matches.length) {
        // Reset goal counter when all matches have had a goal
        goalCounter = 0;
      }

      const matchToUpdate = matches[goalCounter];
      if (!matchToUpdate) return;

      // Get current score for this match
      const currentScore = currentScores.get(matchToUpdate.id) || {
        home: 0,
        away: 0,
      };

      // Randomly choose home or away team to score
      const isHomeGoal = Math.random() > 0.5;

      // Update the score
      const newScore = {
        home: isHomeGoal ? currentScore.home + 1 : currentScore.home,
        away: isHomeGoal ? currentScore.away : currentScore.away + 1,
      };

      // Save the updated score
      currentScores.set(matchToUpdate.id, newScore);

      // Update liveMatches state
      setLiveMatches((prev) =>
        prev.map((m) => {
          if (m.id === matchToUpdate.id) {
            return {
              ...m,
              homeScore: newScore.home,
              awayScore: newScore.away,
            };
          }
          return m;
        })
      );

      // Calculate new total goals and call the update callback
      const newTotal = newScore.home + newScore.away;

      // This is the key line that updates the actual game state
      updateCallback(matchToUpdate.id, newTotal);

      // Log for debugging
      console.log(
        `Demo mode: Goal in ${matchToUpdate.homeTeam} vs ${matchToUpdate.awayTeam}`
      );
      console.log(
        `New score: ${newScore.home} - ${newScore.away}, Total: ${newTotal}`
      );

      // Move to next match for next goal
      goalCounter++;
    }, 10000); // Goal every 10 seconds
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    liveMatches,
    isPolling,
    lastUpdated,
    startPolling,
    stopPolling,
    startDemoMode, // Add this
  };
}
