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


const stripTeamOptionAffixes = (value: string) => {
  return value
    .replace(/\s+fc$/i, "")
    .replace(
      /^(fc|afc|1\.\s*fc|1\.\s*fsv|as|ss|ssc|rc|cd|ogc|vfl|vfb|tsg|sc)\s+/i,
      "",
    );
};

export const formatTeamOptionName = (value: string) => stripTeamOptionAffixes(value).trim();

export const normalizeMatchTeamName = (name: string): string => {
  if (!name) return "";

  return stripTeamOptionAffixes(name.toLowerCase())
    .replaceAll(/&\s+/g, "")
    .replaceAll(/[\s.-]+/g, "")
    .replaceAll("ø", "o")
    .replaceAll("ü", "u")
    .replaceAll("é", "e")
    .replaceAll("á", "a")
    .trim();
};
