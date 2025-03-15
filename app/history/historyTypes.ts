export interface PlayerStat {
  name: string;
  totalDrinks: number;
  gamesPlayed: number;
  averagePerGame: number;
}

export interface Player {
  id: string;
  name: string;
  drinksTaken?: number;
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  goals: number;
}

export type PlayerAssignments = { [playerId: string]: string[] };

export interface GameSession {
  id: string;
  date: string;
  players: Player[];
  matches: Match[];
  commonMatchId: string | null;
  playerAssignments: PlayerAssignments;
}