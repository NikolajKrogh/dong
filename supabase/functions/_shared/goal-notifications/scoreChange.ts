export type GoalScoreChange = {
  homeName: string;
  awayName: string;
  previousHomeScore: number;
  previousAwayScore: number;
  homeScore: number;
  awayScore: number;
};

export function goalScoreMessage(change: GoalScoreChange): { title: string; body: string } | null {
  const { previousHomeScore, previousAwayScore, homeScore, awayScore } = change;
  if (![previousHomeScore, previousAwayScore, homeScore, awayScore].every(score =>
    Number.isInteger(score) && score >= 0 && score <= 999)) return null;

  const homeIncrease = homeScore - previousHomeScore;
  const awayIncrease = awayScore - previousAwayScore;
  if (homeIncrease < 0 || awayIncrease < 0 || homeIncrease + awayIncrease === 0) return null;
  const home = change.homeName.trim().slice(0, 75);
  const away = change.awayName.trim().slice(0, 75);
  const scorer = homeIncrease === 1 && awayIncrease === 0 ? home
    : awayIncrease === 1 && homeIncrease === 0 ? away : null;
  return {
    title: scorer ? 'Goal for ' + scorer : 'Score update',
    body: home + ' ' + homeScore + '–' + awayScore + ' ' + away,
  };
}
