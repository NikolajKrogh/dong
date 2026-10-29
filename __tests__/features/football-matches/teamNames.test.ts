import { cleanTeamName, formatTeamOptionName, normalizeMatchTeamName } from "../../../features/football-matches/teamNames";

describe("team name policies", () => {
  it.each([
    ["FC København", "kobenhavn"], ["VfL München", "munchen"],
    ["CD Málaga", "malaga"], ["Paris-Saint. Germain FC", "parissaintgermain"],
    ["FC Manchester & ", "manchester"], ["OGC Nice", "nice"],
  ])("keeps the characterized lookup key for %s", (name, expected) => {
    expect(normalizeMatchTeamName(name)).toBe(expected);
  });
  it("keeps display text and legacy logo affixes distinct from lookup keys", () => {
    expect(formatTeamOptionName("FC København")).toBe("København");
    expect(cleanTeamName("BK Team 1909")).toBe("Team");
    expect(formatTeamOptionName("BK Team 1909")).toBe("BK Team 1909");
    expect(normalizeMatchTeamName("")).toBe("");
  });
});
