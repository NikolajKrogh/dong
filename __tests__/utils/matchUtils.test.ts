import {
  formatDateForAPI,
  cleanTeamName,
  convertTimeToMinutes,
  extractTeamsFromESPNEvent,
} from "../../utils/matchUtils";

// Helper function to get today's date in YYYYMMDD format
const getTodayYYYYMMDD = () => {
  return new Date().toISOString().split("T")[0].replace(/-/g, "");
};

describe("Match Utilities", () => {
  describe("formatDateForAPI", () => {
    it("should format YYYY-MM-DD to YYYYMMDD", () => {
      expect(formatDateForAPI("2025-04-20")).toBe("20250420");
      expect(formatDateForAPI("2024-01-01")).toBe("20240101");
    });

    it("should return today's date in YYYYMMDD if no date is provided", () => {
      const today = getTodayYYYYMMDD();
      expect(formatDateForAPI()).toBe(today);
    });

    it("should return today's date in YYYYMMDD for invalid date formats", () => {
      const today = getTodayYYYYMMDD();
      // Mock console.warn to check if it's called for invalid input
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

      expect(formatDateForAPI("20-04-2025")).toBe(today);
      expect(formatDateForAPI("2025/04/20")).toBe(today);
      expect(formatDateForAPI("invalid-date")).toBe(today);
      expect(formatDateForAPI("20250420")).toBe(today); // Does not match YYYY-MM-DD

      // Check if console.warn was called for each invalid case
      expect(consoleWarnSpy).toHaveBeenCalledTimes(4);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid date format provided to formatDateForAPI: "20-04-2025"'
        )
      );

      consoleWarnSpy.mockRestore(); // Clean up the spy
    });
  });

  describe("cleanTeamName", () => {
    it("should remove ' FC' suffix (case-insensitive)", () => {
      expect(cleanTeamName("Arsenal FC")).toBe("Arsenal");
      expect(cleanTeamName("Chelsea fc")).toBe("Chelsea");
      expect(cleanTeamName("TeamName FC")).toBe("TeamName");
    });

    it("should remove specified prefixes (case-insensitive)", () => {
      expect(cleanTeamName("FC Bayern München")).toBe("Bayern München");
      expect(cleanTeamName("AFC Bournemouth")).toBe("Bournemouth");
      expect(cleanTeamName("1. FSV Mainz 05")).toBe("Mainz 05");
      expect(cleanTeamName("1. FC Union Berlin")).toBe("Union Berlin");
      expect(cleanTeamName("SS Lazio")).toBe("Lazio");
      expect(cleanTeamName("SSC Napoli")).toBe("Napoli");
      expect(cleanTeamName("fc Barcelona")).toBe("Barcelona"); // Lowercase prefix
    });

    it("should trim leading/trailing whitespace", () => {
      expect(cleanTeamName("  Arsenal FC  ")).toBe("Arsenal");
      expect(cleanTeamName("  Team Name ")).toBe("Team Name");
    });

    it("should not change names without specified prefixes/suffixes", () => {
      expect(cleanTeamName("Liverpool")).toBe("Liverpool");
      expect(cleanTeamName("Borussia Dortmund")).toBe("Borussia Dortmund");
    });

    it("should handle multiple cleanings", () => {
      expect(cleanTeamName("  FC Awesome Team FC  ")).toBe("Awesome Team");
    });
  });

  describe("convertTimeToMinutes", () => {
    it("should convert valid HH:MM strings to minutes", () => {
      expect(convertTimeToMinutes("00:00")).toBe(0);
      expect(convertTimeToMinutes("01:00")).toBe(60);
      expect(convertTimeToMinutes("12:30")).toBe(750);
      expect(convertTimeToMinutes("23:59")).toBe(1439);
    });

    it("should return -1 for invalid formats or values", () => {
      expect(convertTimeToMinutes("1230")).toBe(-1);
      expect(convertTimeToMinutes("12:aa")).toBe(-1);
      expect(convertTimeToMinutes("12:60")).toBe(-1);
      expect(convertTimeToMinutes("")).toBe(-1);
      expect(convertTimeToMinutes(":")).toBe(-1);
      expect(convertTimeToMinutes("invalid")).toBe(-1);
    });
  });

  describe("extractTeamsFromESPNEvent", () => {
    it("should extract teams from competitors array", () => {
      const event = {
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { displayName: "Home Team FC" } },
              { homeAway: "away", team: { name: "Away Team AFC" } },
            ],
          },
        ],
      };
      expect(extractTeamsFromESPNEvent(event)).toEqual({
        homeTeam: "Home Team FC",
        awayTeam: "Away Team AFC",
      });
    });

    it("should extract teams using fallback team name properties", () => {
      const event = {
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { name: "Home Team Name" } },
              { homeAway: "away", team: { shortDisplayName: "AwayTeam" } }, // Fallback if displayName/name missing
            ],
          },
        ],
      };
      // Note: The current implementation only checks displayName then name.
      // It won't find shortDisplayName unless the function is modified.
      expect(extractTeamsFromESPNEvent(event)).toEqual({
        homeTeam: "Home Team Name",
        awayTeam: "", // Because shortDisplayName isn't checked
      });
    });

    it("should extract teams from event name ('Away at Home')", () => {
      const event = {
        name: "Team B at Team A",
      };
      expect(extractTeamsFromESPNEvent(event)).toEqual({
        homeTeam: "Team A",
        awayTeam: "Team B",
      });
    });

    it("should extract teams from event shortName ('Away @ Home')", () => {
      const event = {
        shortName: "TB @ TA",
      };
      expect(extractTeamsFromESPNEvent(event)).toEqual({
        homeTeam: "TA",
        awayTeam: "TB",
      });
    });

    it("should prioritize competitors array over name/shortName", () => {
      const event = {
        name: "Wrong Away at Wrong Home",
        shortName: "WA @ WH",
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { displayName: "Correct Home" } },
              { homeAway: "away", team: { displayName: "Correct Away" } },
            ],
          },
        ],
      };
      expect(extractTeamsFromESPNEvent(event)).toEqual({
        homeTeam: "Correct Home",
        awayTeam: "Correct Away",
      });
    });

    it("should return empty strings if no team info found", () => {
      const event = {
        someOtherProperty: "value",
      };
      expect(extractTeamsFromESPNEvent(event)).toEqual({
        homeTeam: "",
        awayTeam: "",
      });
    });

    it("should handle missing team objects within competitors", () => {
      const event = {
        competitions: [
          {
            competitors: [
              { homeAway: "home" /* missing team */ },
              { homeAway: "away", team: { displayName: "Away Team" } },
            ],
          },
        ],
      };
      expect(extractTeamsFromESPNEvent(event)).toEqual({
        homeTeam: "",
        awayTeam: "Away Team",
      });
    });
  });
});
