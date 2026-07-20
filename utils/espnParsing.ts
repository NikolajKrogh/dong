import { ESPNCompetitionDetail, ESPNCompetitor, ESPNEvent } from "../types/espn";
import { GoalScorer, MatchStatistics, MatchWithScore } from "../types/matchScores";
import { cacheTeamLogo } from "./teamLogos";

/**
 * Safely extract a match id from an event.
 * @description Returns null when event.id is missing or empty.
 * @param event Raw ESPN event.
 * @returns Id string or null.
 */
export const extractMatchId = (
  event: ESPNEvent | null | undefined,
): string | null => {
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
export function parseStatistics(competitor: ESPNCompetitor): MatchStatistics {
  const stats = competitor.statistics || [];

  // Helper function to safely get statistics by name
  const getStat = (name: string): number => {
    const stat = stats.find(
      (s) => s.name?.toLowerCase() === name.toLowerCase(),
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
export const processApiMatch = (
  event: ESPNEvent | null | undefined,
): MatchWithScore | null => {
  try {
    // Extract the match ID
    const id = extractMatchId(event);
    if (!id || !event) return null; // Exit early if no valid ID

    // Navigate safely through the competition data
    const competition = event.competitions?.[0];
    if (!competition) return null;

    // Find home and away competitor data
    const homeTeamData = competition.competitors?.find(
      (c) => c.homeAway === "home",
    );
    const awayTeamData = competition.competitors?.find(
      (c) => c.homeAway === "away",
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
