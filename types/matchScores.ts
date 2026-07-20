/**
 * Match state including live scoring and optional statistics.
 * @description Augments a tracked match with real‑time score, status, timing and statistics pulled from the ESPN API.
 */
export interface MatchWithScore {
  id: string;
  homeScore: number;
  awayScore: number;
  isLive: boolean;
  minutesPlayed?: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string;
  awayTeamId: string;
  status: string;
  goalScorers?: GoalScorer[];
  homeTeamStatistics?: MatchStatistics;
  awayTeamStatistics?: MatchStatistics;
}

export interface GoalScorer {
  name: string;
  time: string;
  teamId: string;
  isPenalty: boolean;
  isOwnGoal: boolean;
  goalType: string;
}

export interface MatchStatistics {
  shotsOnGoal: number;
  shotAttempts: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  cornerKicks: number;
  possession: number;
}
