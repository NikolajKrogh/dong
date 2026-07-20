import { Match } from "../../store/store";

export const migrateLegacyMatch = (match: Match): Match => {
  if (
    match.goals !== undefined &&
    (match.homeGoals === undefined || match.awayGoals === undefined)
  ) {
    return {
      ...match,
      homeGoals: Math.floor(match.goals / 2),
      awayGoals: Math.ceil(match.goals / 2),
    };
  }

  return {
    ...match,
    homeGoals: match.homeGoals || 0,
    awayGoals: match.awayGoals || 0,
  };
};
