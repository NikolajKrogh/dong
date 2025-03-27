/**
 * Utility functions for match processing
 */

/**
 * Cleans a team name by removing common prefixes and suffixes.
 */
export const cleanTeamName = (teamName: string): string => {
  let cleaned = teamName.trim();
  cleaned = cleaned.replace(/ FC$/i, ""); // Remove " FC" suffix
  cleaned = cleaned.replace(/^(AFC|FC|1\. FSV|1\. FC|SS|SSC) /i, ""); // Remove prefixes
  return cleaned.trim();
};

/**
 * Converts a time string to minutes.
 */
export const convertTimeToMinutes = (timeString: string): number => {
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
 * Checks if a date is within a specified range.
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
    console.error("Date comparison error:", e);
    return true; // Default to including the match if there's an error
  }
};

export interface MatchData {
  team1: string;
  team2: string;
  score?: {
    ft: [number, number];
  };
  date?: string;
  time?: string;
}

export interface ApiResponse {
  name: string;
  matches: MatchData[];
}

export interface TeamWithLeague {
  key: string;
  value: string;
  league: string;
}