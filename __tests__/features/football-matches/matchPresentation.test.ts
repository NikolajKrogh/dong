import { getMatchPresentation, formatMatchScore } from "../../../features/football-matches/matchPresentation";
import type { Match } from "../../../store/gameStore";
import type { MatchWithScore } from "../../../types/matchScores";

const match: Match = { id: "m", homeTeam: "Home", awayTeam: "Away", homeGoals: 2, awayGoals: 1 };

describe("match presentation", () => {
  it("keeps independently missing public scores distinct from accepted gameplay goals", () => {
    const live = { homeScore: 1, awayScore: null, lifecycle: "suspended" } as MatchWithScore;
    expect(getMatchPresentation(match, live)).toMatchObject({ homeScore: 1, awayScore: null, displayStatus: "Suspended", showStatus: true });
    expect(formatMatchScore(null)).toBe("—");
    expect(match).toMatchObject({ homeGoals: 2, awayGoals: 1 });
  });
  it("uses accepted manual goals but does not invent scores for unresolved catalog identities", () => {
    expect(getMatchPresentation(match)).toMatchObject({ homeScore: 2, awayScore: 1 });
    expect(getMatchPresentation({ ...match, catalogMatchId: "123" })).toMatchObject({ homeScore: null, awayScore: null });
  });
  it.each(["canceled", "abandoned"] as const)("keeps %s visible after play stops", lifecycle => {
    const live = { homeScore: 2, awayScore: 1, lifecycle, isLive: false } as MatchWithScore;
    expect(getMatchPresentation(match, live)).toMatchObject({ showStatus: true, displayStatus: lifecycle[0].toUpperCase() + lifecycle.slice(1) });
  });
});
