/**
 * @file Utility functions for match processing.
 */

/**
 * @brief Formats a date string as YYYYMMDD for the ESPN API.
 *
 * If no date string is provided or it's invalid (not YYYY-MM-DD),
 * it returns today's date in the YYYYMMDD format.
 *
 * @param dateString (optional) The date string to format (expected YYYY-MM-DD).
 * @return The formatted date string (YYYYMMDD).
 */
export const formatDateForAPI = (dateString?: string): string => {
  // Ensure dateString is optional
  // Regex to validate YYYY-MM-DD format
  const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (dateString && dateFormatRegex.test(dateString)) {
    return dateString.replace(/-/g, "");
  } else {
    // Log a warning if an invalid format is provided (optional)
    if (dateString) {
      console.warn(
        `Invalid date format provided to formatDateForAPI: "${dateString}". Defaulting to today.`
      );
    }
    const today = new Date();
    return today.toISOString().split("T")[0].replace(/-/g, "");
  }
};

/**
 * @brief Cleans a team name by removing common prefixes and suffixes.
 *
 * @param teamName The team name to clean.
 * @return The cleaned team name.
 */
export const cleanTeamName = (teamName: string): string => {
  let cleaned = teamName.trim();
  cleaned = cleaned.replace(/ FC$/i, "");
  cleaned = cleaned.replace(/^(AFC|FC|1\. FSV|1\. FC|SS|SSC) /i, "");
  return cleaned.trim();
};

/**
 * @brief Converts a time string to minutes since midnight.
 *
 * @param timeString The time string to convert (HH:MM).
 * @return The number of minutes since midnight, or -1 if the time string is invalid.
 */
export const convertTimeToMinutes = (timeString: string): number => {
  if (!timeString || !timeString.includes(":")) return -1;

  try {
    const [hours, minutes] = timeString.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return -1;
    return hours * 60 + minutes;
  } catch (e) {
    return -1;
  }
};

/**
 * @brief Checks if a date is within a specified range.
 *
 * @param dateStr The date string to check (YYYY-MM-DD).
 * @param startDateStr The start date string of the range (YYYY-MM-DD).
 * @param endDateStr The end date string of the range (YYYY-MM-DD).
 * @return True if the date is within the range (inclusive), false otherwise.
 */
export const isDateInRange = (
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
    return true;
  }
};

/**
 * @brief Interface for match data.
 */
export interface MatchData {
  id: string;
  team1: string;
  team2: string;
  score?: {
    ft: [number, number];
  };
  date?: string;
  time?: string;
}

/**
 * @brief Interface for API response data.
 */
export interface ApiResponse {
  name: string;
  matches: MatchData[];
}

/**
 * @brief Interface for team data with league information.
 */
export interface TeamWithLeague {
  key: string;
  value: string;
  league: string;
}

/**
 * @brief Extracts team names from ESPN event data.
 *
 * This function attempts to extract home and away team names from various
 * properties of the ESPN event object. It prioritizes the `competitors` array
 * if available, then falls back to parsing the `name` or `shortName` properties.
 *
 * @param event The ESPN event object.
 * @return An object containing the extracted home and away team names.
 */
export function extractTeamsFromESPNEvent(event: any): {
  homeTeam: string;
  awayTeam: string;
} {
  const result = { homeTeam: "", awayTeam: "" };

  if (
    event.competitions &&
    event.competitions[0] &&
    event.competitions[0].competitors
  ) {
    const competitors = event.competitions[0].competitors;
    competitors.forEach((team: any) => {
      if (team.homeAway === "home") {
        result.homeTeam = team.team?.displayName || team.team?.name || "";
      } else if (team.homeAway === "away") {
        result.awayTeam = team.team?.displayName || team.team?.name || "";
      }
    });
  } else if (event.name && event.name.includes(" at ")) {
    const parts = event.name.split(" at ");
    result.awayTeam = parts[0].trim();
    result.homeTeam = parts[1].trim();
  } else if (event.shortName && event.shortName.includes(" @ ")) {
    const parts = event.shortName.split(" @ ");
    result.awayTeam = parts[0].trim();
    result.homeTeam = parts[1].trim();
  }

  return result;
}
