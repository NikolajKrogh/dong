import { describe, expect, it } from "@jest/globals";

import {
  applyAwayGoalUpdate,
  applyHomeGoalUpdate,
  calculateToastScoreDisplay,
  updateMatchForGoal,
} from "../../../hooks/gameProgress/goalScoring";
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
  it("uses the live newTotal/otherTeamScore pairing for the home team", () => {
    const result = calculateToastScoreDisplay(
      buildMatch(),
      "home",
      true,
      3,
      2,
    );

    expect(result).toEqual({ homeScore: 3, awayScore: 2 });
  });

  it("uses the live newTotal/otherTeamScore pairing for the away team", () => {
    const result = calculateToastScoreDisplay(
      buildMatch(),
      "away",
      true,
      3,
      2,
    );

    expect(result).toEqual({ homeScore: 2, awayScore: 3 });
  });

  it("falls back to the match's own goal counts when not a live update", () => {
    const result = calculateToastScoreDisplay(
      buildMatch({ homeGoals: 4, awayGoals: 1 }),
      "home",
      false,
    );

    expect(result).toEqual({ homeScore: 4, awayScore: 1 });
  });

  it("falls back to the match's own goal counts when live totals are missing", () => {
    const result = calculateToastScoreDisplay(
      buildMatch({ homeGoals: 2, awayGoals: 2 }),
      "home",
      true,
    );

    expect(result).toEqual({ homeScore: 2, awayScore: 2 });
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
