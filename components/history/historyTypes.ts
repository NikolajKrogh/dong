/**
 * PlayerStat
 * @description Represents a player's aggregated statistics across all recorded game sessions.
 * @property {string} name Player name.
 * @property {number} totalDrinks Total number of drinks taken across all sessions.
 * @property {number} gamesPlayed Total number of games participated in.
 * @property {number} averagePerGame Average drinks per game (totalDrinks / gamesPlayed).
 */
export interface PlayerStat {
  name: string;
  totalDrinks: number;
  gamesPlayed: number;
  averagePerGame: number;
}

/**
 * Player
 * @description Represents an individual player in a single game session.
 * @property {string} id Unique identifier.
 * @property {string} name Player display name.
 * @property {number} [drinksTaken] Drinks taken within the specific game session.
 */
export interface Player {
  id: string;
  name: string;
  drinksTaken?: number;
}

/**
 * Match
 * @description Represents a match between two teams within a game session.
 * @property {string} id Unique identifier for the match.
 * @property {string} homeTeam Home team name.
 * @property {string} awayTeam Away team name.
 * @property {number} homeGoals Home team goals.
 * @property {number} awayGoals Away team goals.
 * @property {number} [goals] Optional total goals (may be precomputed or cached).
 */
export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  goals?: number | undefined;
}

/**
 * PlayerAssignments
 * @description Mapping of player IDs to arrays of match IDs they're assigned to.
 * @typedef {Object.<string,string[]>} PlayerAssignments
 */
export type PlayerAssignments = { [playerId: string]: string[] };

/**
 * GameSession
 * @description Represents a single complete game session containing players, matches, and assignments.
 * @property {string} id Unique identifier.
 * @property {string} date ISO date string for when the session occurred.
 * @property {Player[]} players Participants in the session.
 * @property {Match[]} matches Matches played during the session.
 * @property {string|null} commonMatchId ID of the designated common match (or null).
 * @property {PlayerAssignments} playerAssignments Mapping of player -> match IDs.
 * @property {number} matchesPerPlayer Derived matches per player metric.
 */
export interface GameSession {
  id: string;
  date: string;
  players: Player[];
  matches: Match[];
  commonMatchId: string | null;
  playerAssignments: PlayerAssignments;
  matchesPerPlayer: number;
}

/**
 * HeadToHeadStats
 * @description Aggregated comparative statistics between two players including totals, efficiency, and timeline data.
 * @property {{name:string,totalDrinks:number,gamesPlayed:number,averagePerGame:number}} player1 Stats for first player.
 * @property {{name:string,totalDrinks:number,gamesPlayed:number,averagePerGame:number}} player2 Stats for second player.
 * @property {number} gamesPlayedTogether Number of games both players participated in.
 * @property {number} player1WinsCount Games where player1 drank more.
 * @property {number} player2WinsCount Games where player2 drank more.
 * @property {number} tiedGamesCount Games with equal drinks.
 * @property {number} player1MaxInAGame Highest single-game drinks for player1.
 * @property {number} player2MaxInAGame Highest single-game drinks for player2.
 * @property {number} player1CommonMatchCount Common matches participated in by player1.
 * @property {number} player2CommonMatchCount Common matches participated in by player2.
 * @property {number} player1Efficiency Efficiency metric for player1.
 * @property {number} player2Efficiency Efficiency metric for player2.
 * @property {number} player1TopDrinkerCount Times player1 was top drinker.
 * @property {number} player2TopDrinkerCount Times player2 was top drinker.
 * @property {number} player1AvgWithPlayer2 Player1 average drinks in games with player2.
 * @property {number} player1AvgWithoutPlayer2 Player1 average drinks without player2.
 * @property {number} player2AvgWithPlayer1 Player2 average drinks in games with player1.
 * @property {number} player2AvgWithoutPlayer1 Player2 average drinks without player1.
 * @property {Array<{date:string,player1Drinks:number,player2Drinks:number}>} timelineData Time-series drink counts.
 */
export interface HeadToHeadStats {
  player1: {
    name: string;
    totalDrinks: number;
    gamesPlayed: number;
    averagePerGame: number;
  };
  player2: {
    name: string;
    totalDrinks: number;
    gamesPlayed: number;
    averagePerGame: number;
  };
  gamesPlayedTogether: number;
  player1WinsCount: number;
  player2WinsCount: number;
  tiedGamesCount: number;
  player1MaxInAGame: number;
  player2MaxInAGame: number;
  player1CommonMatchCount: number;
  player2CommonMatchCount: number;
  player1Efficiency: number;
  player2Efficiency: number;
  player1TopDrinkerCount: number;
  player2TopDrinkerCount: number;
  player1AvgWithPlayer2: number;
  player1AvgWithoutPlayer2: number;
  player2AvgWithPlayer1: number;
  player2AvgWithoutPlayer1: number;
  timelineData: Array<{
    date: string;
    player1Drinks: number;
    player2Drinks: number;
  }>;
}
