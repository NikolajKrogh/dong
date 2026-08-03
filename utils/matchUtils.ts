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
        `Invalid date format provided to formatDateForAPI: "${dateString}". Defaulting to today.`,
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
  } catch {
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
  /**
   * The provider's kickoff instant, verbatim ISO-8601.
   *
   * `date` and `time` above are for display and filtering, and are lossy: `date` is
   * the UTC calendar day while `time` is the *local* clock time, so recombining them
   * is wrong for any fixture near a day boundary. Anything that needs a real
   * timestamp — persisting a fixture to a multiplayer room, for instance — must use
   * this field rather than reassembling the two.
   */
  startDateTime?: string;
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
 * Filter matches by date and optional time range.
 * @description Returns only matches on selectedDate and within the inclusive time window when both start/end provided;
 * original list when no filters active.
 * @param apiData Input matches.
 * @param selectedDate YYYY-MM-DD date.
 * @param startTime Start time HH:MM.
 * @param endTime End time HH:MM.
 * @returns Filtered matches array.
 */
export function filterMatchesByDateAndTime(
  apiData: MatchData[],
  selectedDate: string,
  startTime: string,
  endTime: string,
): MatchData[] {
  const hasTimeFilter = Boolean(startTime && endTime);
  const hasDateFilter = Boolean(selectedDate);

  // Return original data if no filters are applied or if apiData is empty
  if ((!hasTimeFilter && !hasDateFilter) || !apiData || apiData.length === 0) {
    return apiData;
  }

  // Filter the data based on active filters
  return apiData.filter((match) => {
    let includeMatch = true;

    // Apply date filter if active
    if (hasDateFilter) {
      includeMatch = match.date === selectedDate;
    }

    // Apply time filter only if the date filter passed (or wasn't active) and time filter is active
    if (includeMatch && hasTimeFilter) {
      if (match.time) {
        // Ensure match has a time to compare
        const matchMinutes = convertTimeToMinutes(match.time);
        const startMinutes = convertTimeToMinutes(startTime);
        const endMinutes = convertTimeToMinutes(endTime);

        // Check if match time falls within the specified range
        // Also handles cases where time conversion might fail (returns -1)
        if (matchMinutes !== -1 && startMinutes !== -1 && endMinutes !== -1) {
          includeMatch =
            matchMinutes >= startMinutes && matchMinutes <= endMinutes;
        } else {
          // If any time conversion failed, exclude the match for safety or log an error
          includeMatch = false;
        }
      } else {
        // If time filter is active but match has no time, exclude it
        includeMatch = false;
      }
    }
    return includeMatch;
  });
}

