import { Match } from "../../store/store";

export interface LastGoalInfo {
  match: Match;
  matchId: string;
  team: "home" | "away";
  isLiveUpdate: boolean;
  newTotal?: number;
  otherTeamScore?: number;
  timestamp: number;
}

export interface GoalScoreUpdateResult {
  updatedMatch: Match;
  goalScored: boolean;
  scoringTeamTotal?: number;
  otherTeamScore?: number;
}

export const calculateToastScoreDisplay = (
  match: Match,
  team: "home" | "away",
  isLiveUpdate: boolean,
  newTotal?: number,
  otherTeamScore?: number,
) => {
  if (
    isLiveUpdate &&
    typeof newTotal === "number" &&
    typeof otherTeamScore === "number"
  ) {
    return team === "home"
      ? { homeScore: newTotal, awayScore: otherTeamScore }
      : { homeScore: otherTeamScore, awayScore: newTotal };
  }

  return {
    homeScore: match.homeGoals || 0,
    awayScore: match.awayGoals || 0,
  };
};

export const applyHomeGoalUpdate = (
  match: Match,
  newTotal?: number,
): GoalScoreUpdateResult => {
  const currentHomeGoals = match.homeGoals || 0;
  const updatedMatch = { ...match };

  if (typeof newTotal === "number") {
    if (newTotal > currentHomeGoals) {
      updatedMatch.homeGoals = newTotal;

      return {
        updatedMatch,
        goalScored: true,
        scoringTeamTotal: newTotal,
        otherTeamScore: match.awayGoals || 0,
      };
    }

    if (newTotal !== currentHomeGoals) {
      updatedMatch.homeGoals = newTotal;
    }

    return { updatedMatch, goalScored: false };
  }

  updatedMatch.homeGoals = currentHomeGoals + 1;

  return {
    updatedMatch,
    goalScored: true,
  };
};

export const applyAwayGoalUpdate = (
  match: Match,
  newTotal?: number,
): GoalScoreUpdateResult => {
  const currentAwayGoals = match.awayGoals || 0;
  const updatedMatch = { ...match };

  if (typeof newTotal === "number") {
    if (newTotal > currentAwayGoals) {
      updatedMatch.awayGoals = newTotal;

      return {
        updatedMatch,
        goalScored: true,
        scoringTeamTotal: newTotal,
        otherTeamScore: match.homeGoals || 0,
      };
    }

    if (newTotal !== currentAwayGoals) {
      updatedMatch.awayGoals = newTotal;
    }

    return { updatedMatch, goalScored: false };
  }

  updatedMatch.awayGoals = currentAwayGoals + 1;

  return {
    updatedMatch,
    goalScored: true,
  };
};

export const updateMatchForGoal = (
  match: Match,
  team: "home" | "away",
  newTotal?: number,
) => {
  const isLiveUpdate = typeof newTotal === "number";
  const updateResult =
    team === "home"
      ? applyHomeGoalUpdate(match, newTotal)
      : applyAwayGoalUpdate(match, newTotal);

  return {
    updatedMatch: updateResult.updatedMatch,
    goalInfo: updateResult.goalScored
      ? {
          match: updateResult.updatedMatch,
          matchId: match.id,
          team,
          isLiveUpdate,
          newTotal: updateResult.scoringTeamTotal,
          otherTeamScore: updateResult.otherTeamScore,
          timestamp: Date.now(),
        }
      : null,
  };
};
