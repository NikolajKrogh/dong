/**
 * @file Utility functions for match processing.
 */

/**
 * Format date for ESPN API.
 * @description Converts YYYY-MM-DD (or today if invalid/missing) to compact YYYYMMDD.
 * @param {string} [dateString] Input date.
 * @returns {string} Formatted date.
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
 * Normalize team name.
 * @description Strips common prefixes/suffixes and trims whitespace.
 * @param {string} teamName Raw name.
 * @returns {string} Cleaned name.
 */
export const cleanTeamName = (teamName: string): string => {
  if (!teamName) return "";

  // Define common affixes (escape special regex characters like '.')
  const prefixes = [
    "FC",
    "AFC",
    "CF",
    "IF",
    "FF",
    "BK",
    "SCO",
    "OSC",
    "HSC",
    "BC",
    "CFC",
    "AC",
    "AS",
    "SS",
    "SSC",
    "US",
    "ACF",
    "OGC",
    "VfL",
    "VfB",
    "TSG",
    "SC",
    "RB",
    "SV",
    "RCD",
    "CA",
    "CD",
    "UD",
    "RC",
    "AJ",
    "1\\.\\s*FC",
    "1\\.\\s*FSV", // Escaped '.' and handled potential space
  ];
  const suffixes = [
    "FC",
    "AFC",
    "CF",
    "IF",
    "FF",
    "BK",
    "SCO",
    "OSC",
    "HSC",
    "BC",
    "CFC",
    "AC",
    "AS",
    "SS",
    "SSC",
    "1909",
    "1913",
    "1846",
    "1848",
    "1910",
    "1901",
    "29",
  ];

  // Match suffix preceded by one or more spaces, at the end of the string ($)
  const suffixRegex = new RegExp(`\\s+(${suffixes.join("|")})$`, "i");
  // Match prefix at the start of the string (^), followed by one or more spaces
  const prefixRegex = new RegExp(`^(${prefixes.join("|")})\\s+`, "i");

  let cleaned = teamName.trim();

  // Remove suffix first, then prefix
  cleaned = cleaned.replace(suffixRegex, "");
  cleaned = cleaned.replace(prefixRegex, "");

  // Trim again in case removing prefix/suffix left whitespace or if nothing was removed
  return cleaned.trim();
};

/**
 * Convert HH:MM to minutes.
 * @description Returns -1 for invalid input.
 * @param {string} timeString Time string.
 * @returns {number} Minutes since midnight or -1.
 */
export const convertTimeToMinutes = (timeString: string): number => {
  if (!timeString || !timeString.includes(":")) return -1;

  try {
    const parts = timeString.split(":");
    // Ensure split resulted in exactly two non-empty parts
    if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
      return -1;
    }
    const [hours, minutes] = parts.map(Number);
    if (isNaN(hours) || isNaN(minutes)) return -1;

    // Ensure hours and minutes are within valid ranges
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return -1;
    }

    return hours * 60 + minutes;
  } catch (e) {
    return -1;
  }
};

/** Match data shape. */
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

/** API response subset. */
export interface ApiResponse {
  name: string;
  matches: MatchData[];
}

/** Team with league metadata. */
export interface TeamWithLeague {
  key: string;
  value: string;
  league: string;
}

/**
 * Extract home/away team names.
 * @description Parses ESPN event competitors or falls back to name/shortName heuristics.
 * @param {any} event ESPN event.
 * @returns {{homeTeam:string;awayTeam:string}} Extracted names.
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
