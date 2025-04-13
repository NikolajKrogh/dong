/**
 * @interface PlayerStat
 * @brief Represents a player's statistics across all game sessions.
 * @property {string} name - The name of the player.
 * @property {number} totalDrinks - The total number of drinks taken by the player.
 * @property {number} gamesPlayed - The total number of games the player has participated in.
 * @property {number} averagePerGame - The average number of drinks taken by the player per game.
 */
export interface PlayerStat {
  name: string;
  totalDrinks: number;
  gamesPlayed: number;
  averagePerGame: number;
}

/**
 * @interface Player
 * @brief Represents a player in a game session.
 * @property {string} id - The unique identifier of the player.
 * @property {string} name - The name of the player.
 * @property {number | undefined} drinksTaken - The number of drinks taken by the player in a specific game session (optional).
 */
export interface Player {
  id: string;
  name: string;
  drinksTaken?: number;
}

/**
 * @interface Match
 * @brief Represents a match between two teams in a game session.
 * @property {string} id - The unique identifier of the match.
 * @property {string} homeTeam - The name of the home team.
 * @property {string} awayTeam - The name of the away team.
 * @property {number} homeGoals - The number of goals scored by the home team.
 * @property {number} awayGoals - The number of goals scored by the away team.
 * @property {number | undefined} goals - The total number of goals scored in the match (optional).
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
 * @typedef PlayerAssignments
 * @brief Represents the assignment of players to matches in a game session.
 * @property {Object.<string, string[]>} [playerId: string] - An object where the keys are player IDs and the values are arrays of match IDs.
 */
export type PlayerAssignments = { [playerId: string]: string[] };

/**
 * @interface GameSession
 * @brief Represents a single game session.
 * @property {string} id - The unique identifier of the game session.
 * @property {string} date - The date when the game session took place.
 * @property {Player[]} players - An array of players who participated in the game session.
 * @property {Match[]} matches - An array of matches played during the game session.
 * @property {string | null} commonMatchId - The ID of the most common match in the session, or null if there isn't one.
 * @property {PlayerAssignments} playerAssignments - The assignment of players to matches in the game session.
 * @property {number} matchesPerPlayer - The number of matches played per player in the game session.
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