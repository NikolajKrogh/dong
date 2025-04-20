import {
  TEAM_ALIASES,
  TEAM_CODE_MAP,
  getFullTeamName,
} from "../../utils/teamAliases";

describe("Team Aliases and Codes", () => {
  describe("TEAM_ALIASES", () => {
    it("should map common aliases to correct official names", () => {
      // Premier League
      expect(TEAM_ALIASES["Arsenal"]).toBe("Arsenal FC");
      expect(TEAM_ALIASES["Man Utd"]).toBe("Manchester United FC");
      expect(TEAM_ALIASES["Man City"]).toBe("Manchester City FC");
      expect(TEAM_ALIASES["Spurs"]).toBe("Tottenham Hotspur FC");
      expect(TEAM_ALIASES["Wolves"]).toBe("Wolverhampton Wanderers FC");

      // Bundesliga
      expect(TEAM_ALIASES["Bayern"]).toBe("FC Bayern München");
      expect(TEAM_ALIASES["Dortmund"]).toBe("Borussia Dortmund");
      expect(TEAM_ALIASES["BVB"]).toBe("Borussia Dortmund");
      expect(TEAM_ALIASES["Leverkusen"]).toBe("Bayer 04 Leverkusen");
      expect(TEAM_ALIASES["Union Berlin"]).toBe("1. FC Union Berlin");

      // La Liga
      expect(TEAM_ALIASES["Barcelona"]).toBe("FC Barcelona");
      expect(TEAM_ALIASES["R. Madrid"]).toBe("Real Madrid CF");
      expect(TEAM_ALIASES["Betis"]).toBe("Real Betis Balompié");
      expect(TEAM_ALIASES["Sociedad"]).toBe("Real Sociedad de Fútbol");

      // Serie A
      expect(TEAM_ALIASES["Inter"]).toBe("FC Internazionale Milano");
      expect(TEAM_ALIASES["Milan"]).toBe("AC Milan");
      expect(TEAM_ALIASES["Roma"]).toBe("AS Roma");
      expect(TEAM_ALIASES["Juventus Turin [de]"]).toBe("Juventus FC"); // Example with language tag

      // Ligue 1
      expect(TEAM_ALIASES["Paris"]).toBe("Paris Saint-Germain FC");
      expect(TEAM_ALIASES["Lyon"]).toBe("Olympique Lyonnais");
      expect(TEAM_ALIASES["Marseille"]).toBe("Olympique de Marseille");
    });

    it("should not contain mappings for non-existent aliases", () => {
      expect(TEAM_ALIASES["NonExistentAlias"]).toBeUndefined();
    });
  });

  describe("TEAM_CODE_MAP", () => {
    it("should map known codes to short team names", () => {
      expect(TEAM_CODE_MAP["ARS"]).toBe("Arsenal");
      expect(TEAM_CODE_MAP["MUN"]).toBe("Manchester United");
      expect(TEAM_CODE_MAP["LIV"]).toBe("Liverpool");
      expect(TEAM_CODE_MAP["TOT"]).toBe("Tottenham Hotspur");
      expect(TEAM_CODE_MAP["IPS"]).toBe("Ipswich Town");
    });

    it("should not contain mappings for non-existent codes", () => {
      expect(TEAM_CODE_MAP["XYZ"]).toBeUndefined();
    });
  });

  describe("getFullTeamName", () => {
    it("should return full name for valid uppercase codes", () => {
      expect(getFullTeamName("ARS")).toBe("Arsenal");
      expect(getFullTeamName("MUN")).toBe("Manchester United");
    });

    it("should return full name for valid lowercase codes", () => {
      expect(getFullTeamName("liv")).toBe("Liverpool");
      expect(getFullTeamName("tot")).toBe("Tottenham Hotspur");
    });

    it("should return the original code if code is not found", () => {
      expect(getFullTeamName("XYZ")).toBe("XYZ");
      expect(getFullTeamName("abc")).toBe("abc");
    });

    it("should return the input string if it looks like a full name", () => {
      expect(getFullTeamName("Manchester City")).toBe("Manchester City");
      expect(getFullTeamName("Bayern München")).toBe("Bayern München");
      expect(getFullTeamName("Some Team Name")).toBe("Some Team Name");
    });

    it("should return an empty string for empty or null input", () => {
      expect(getFullTeamName("")).toBe("");
      // expect(getFullTeamName(null)).toBe(''); // Depends on how you handle null/undefined types
      // expect(getFullTeamName(undefined)).toBe('');
    });
  });
});