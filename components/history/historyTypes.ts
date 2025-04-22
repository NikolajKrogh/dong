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

/**
 * @interface HeadToHeadStats
 * @brief Represents the statistics of two players head-to-head.
 * @property {Object} player1 - Statistics for player 1.
 * @property {string} player1.name - The name of player 1.
 * @property {number} player1.totalDrinks - The total number of drinks taken by player 1.
 * @property {number} player1.gamesPlayed - The total number of games played by player 1.
 * @property {number} player1.averagePerGame - The average number of drinks taken by player 1 per game.
 * @property {Object} player2 - Statistics for player 2.
 * @property {string} player2.name - The name of player 2.
 * @property {number} player2.totalDrinks - The total number of drinks taken by player 2.
 * @property {number} player2.gamesPlayed - The total number of games played by player 2.
 * @property {number} player2.averagePerGame - The average number of drinks taken by player 2 per game.
 * @property {number} gamesPlayedTogether - The total number of games played together by both players.
 * @property {number} player1WinsCount - The number of games won by player 1.
 * @property {number} player2WinsCount - The number of games won by player 2.
 * @property {number} tiedGamesCount - The number of games that ended in a tie.
 * @property {number} player1MaxInAGame - The maximum number of drinks taken by player 1 in a single game.
 * @property {number} player2MaxInAGame - The maximum number of drinks taken by player 2 in a single game.
 * @property {number} player1CommonMatchCount - The number of common matches played by player 1.
 * @property {number} player2CommonMatchCount - The number of common matches played by player 2.
 * @property {number} player1Efficiency - The efficiency of player 1.
 * @property {number} player2Efficiency - The efficiency of player 2.
 * @property {number} player1TopDrinkerCount - The number of times player 1 was the top drinker.
 * @property {number} player2TopDrinkerCount - The number of times player 2 was the top drinker.
 * @property {number} player1AvgWithPlayer2 - The average drinks taken by player 1 when playing with player 2.
 * @property {number} player1AvgWithoutPlayer2 - The average drinks taken by player 1 when not playing with player 2.
 * @property {number} player2AvgWithPlayer1 - The average drinks taken by player 2 when playing with player 1.
 * @property {number} player2AvgWithoutPlayer1 - The average drinks taken by player 2 when not playing with player 1.
 * @property {Array.<Object>} timelineData - Timeline data of drinks taken by both players.
 * @property {string} timelineData.date - The date of the game session.
 * @property {number} timelineData.player1Drinks - The number of drinks taken by player 1 in the game session.
 * @property {number} timelineData.player2Drinks - The number of drinks taken by player 2 in the game session.
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
