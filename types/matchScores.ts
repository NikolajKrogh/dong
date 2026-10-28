/**
 * Match state including live scoring and optional statistics.
 * @description Augments a tracked match with real‑time score, status, timing and statistics pulled from the ESPN API.
 */
export interface MatchWithScore {
  id: string;
  homeScore: number | null;
  awayScore: number | null;
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
  goalsAvailability?: import("./footballMatch").MatchAvailability;
  hasMoreGoals?: boolean;
  freshness?: import("./footballMatch").SavedMatch["freshness"];
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
  shotsOnGoal: number | null;
  shotAttempts: number | null;
  fouls: number | null;
  yellowCards: number | null;
  redCards: number | null;
  cornerKicks: number | null;
  possession: number | null;
}
