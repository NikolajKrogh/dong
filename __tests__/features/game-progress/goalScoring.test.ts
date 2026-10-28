import { describe, expect, it } from "@jest/globals";

import {
  applyAwayGoalUpdate,
  applyHomeGoalUpdate,
  calculateToastScoreDisplay,
  updateMatchForGoal,
} from "../../../features/game-progress/goalScoring";
import type { Match } from "../../../store/store";

const buildMatch = (overrides: Partial<Match> = {}): Match => ({
  id: "match-1",
  homeTeam: "Arsenal FC",
  awayTeam: "Chelsea FC",
  homeGoals: 1,
  awayGoals: 0,
  ...overrides,
});

describe("calculateToastScoreDisplay", () => {
  it.each([
    { name: "live home goal", team: "home", live: true, newTotal: 3, other: 2, home: 1, away: 0, expected: [3, 2] },
    { name: "live away goal", team: "away", live: true, newTotal: 3, other: 2, home: 1, away: 0, expected: [2, 3] },
    { name: "first home goal while behind", team: "home", live: true, newTotal: 1, other: 3, home: 0, away: 3, expected: [1, 3] },
    { name: "first away goal while behind", team: "away", live: true, newTotal: 1, other: 3, home: 3, away: 0, expected: [3, 1] },
    { name: "zero home live totals", team: "home", live: true, newTotal: 0, other: 0, home: 1, away: 2, expected: [0, 0] },
    { name: "zero away live totals", team: "away", live: true, newTotal: 0, other: 0, home: 1, away: 2, expected: [0, 0] },
    { name: "manual goal already applied", team: "home", live: false, newTotal: undefined, other: undefined, home: 4, away: 1, expected: [4, 1] },
    { name: "live totals missing", team: "home", live: true, newTotal: undefined, other: undefined, home: 2, away: 2, expected: [2, 2] },
    { name: "other live total missing", team: "home", live: true, newTotal: 3, other: undefined, home: 1, away: 2, expected: [1, 2] },
    { name: "scoring live total missing", team: "away", live: true, newTotal: undefined, other: 5, home: 1, away: 2, expected: [1, 2] },
    { name: "missing stored goals", team: "home", live: false, newTotal: undefined, other: undefined, home: undefined, away: undefined, expected: [0, 0] },
  ] as const)("uses canonical display scores for $name", ({ team, live, newTotal, other, home, away, expected }) => {
    expect(calculateToastScoreDisplay(buildMatch({ homeGoals: home, awayGoals: away }), team, live, newTotal, other))
      .toEqual({ homeScore: expected[0], awayScore: expected[1] });
  });
});

describe("applyHomeGoalUpdate", () => {
  it("manual increment (no newTotal) bumps homeGoals by one and reports a goal", () => {
    const result = applyHomeGoalUpdate(buildMatch({ homeGoals: 1 }));

    expect(result.updatedMatch.homeGoals).toBe(2);
    expect(result.goalScored).toBe(true);
    expect(result.scoringTeamTotal).toBeUndefined();
  });

  it("live update with a higher newTotal counts as a goal and carries the other team's score", () => {
    const result = applyHomeGoalUpdate(
      buildMatch({ homeGoals: 1, awayGoals: 3 }),
      2,
    );

    expect(result.updatedMatch.homeGoals).toBe(2);
    expect(result.goalScored).toBe(true);
    expect(result.scoringTeamTotal).toBe(2);
    expect(result.otherTeamScore).toBe(3);
  });

  it("live update with an unchanged newTotal reports no goal", () => {
    const result = applyHomeGoalUpdate(buildMatch({ homeGoals: 2 }), 2);

    expect(result.updatedMatch.homeGoals).toBe(2);
    expect(result.goalScored).toBe(false);
  });

  it("live update with a lower newTotal (correction) applies it without a goal", () => {
    const result = applyHomeGoalUpdate(buildMatch({ homeGoals: 3 }), 1);

    expect(result.updatedMatch.homeGoals).toBe(1);
    expect(result.goalScored).toBe(false);
  });
});

describe("applyAwayGoalUpdate", () => {
  it("manual increment bumps awayGoals by one and reports a goal", () => {
    const result = applyAwayGoalUpdate(buildMatch({ awayGoals: 0 }));

    expect(result.updatedMatch.awayGoals).toBe(1);
    expect(result.goalScored).toBe(true);
  });

  it("live update with a higher newTotal carries the home team's score as otherTeamScore", () => {
    const result = applyAwayGoalUpdate(
      buildMatch({ homeGoals: 5, awayGoals: 0 }),
      1,
    );

    expect(result.updatedMatch.awayGoals).toBe(1);
    expect(result.goalScored).toBe(true);
    expect(result.otherTeamScore).toBe(5);
  });
});

describe("updateMatchForGoal", () => {
  it("produces goalInfo with a timestamp when a home goal is scored manually", () => {
    const before = Date.now();
    const { updatedMatch, goalInfo } = updateMatchForGoal(
      buildMatch({ homeGoals: 1 }),
      "home",
    );

    expect(updatedMatch.homeGoals).toBe(2);
    expect(goalInfo).not.toBeNull();
    expect(goalInfo?.team).toBe("home");
    expect(goalInfo?.isLiveUpdate).toBe(false);
    expect(goalInfo?.timestamp).toBeGreaterThanOrEqual(before);
  });

  it("produces goalInfo for a live away goal with newTotal/otherTeamScore populated", () => {
    const { goalInfo } = updateMatchForGoal(
      buildMatch({ homeGoals: 1, awayGoals: 0 }),
      "away",
      1,
    );

    expect(goalInfo?.isLiveUpdate).toBe(true);
    expect(goalInfo?.newTotal).toBe(1);
    expect(goalInfo?.otherTeamScore).toBe(1);
  });

  it("returns null goalInfo when the update is a correction, not a goal", () => {
    const { updatedMatch, goalInfo } = updateMatchForGoal(
      buildMatch({ homeGoals: 3 }),
      "home",
      3,
    );

    expect(updatedMatch.homeGoals).toBe(3);
    expect(goalInfo).toBeNull();
  });
});
