import { GameSession, Match, Player, PlayerStat } from "./historyTypes";

/**
 * @brief Calculates the total goals (home + away) for a list of matches.
 * Sums both home and away goals for each match in the provided array.
 * @param matches An array of Match objects.
 * @return The total number of goals.
 */
export const calculateTotalGoals = (matches: Match[]): number => {
  return matches.reduce(
    (sum, match) => sum + ((match.homeGoals || 0) + (match.awayGoals || 0)),
    0
  );
};

/**
 * @brief Calculates the total drinks taken by a list of players.
 * Sums the drinks taken by each player, treating undefined values as zero.
 * @param players An array of Player objects.
 * @return The total number of drinks.
 */
export const calculateTotalDrinks = (players: Player[]): number => {
  return players.reduce((sum, player) => sum + (player.drinksTaken || 0), 0);
};

/**
 * @brief Finds the player with the most drinks in a game session.
 * Returns the player who consumed the highest amount of drinks.
 * @param players An array of Player objects.
 * @return The Player object with the most drinks, or null if there are no players.
 */
export const findTopDrinker = (players: Player[]): Player | null => {
  if (players.length === 0) return null;
  return [...players].sort(
    (a, b) => (b.drinksTaken || 0) - (a.drinksTaken || 0)
  )[0];
};

/**
 * @brief Formats a date string into a readable format for history items.
 * Creates a concise date representation for display in history list items.
 * @param dateString The date string to format.
 * @return The formatted date string with short weekday, month, day, year, and time.
 */
export const formatHistoryDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * @brief Formats a date string for the modal title with more detail.
 * Creates a more comprehensive date representation for the modal view.
 * @param dateString The date string to format.
 * @return The formatted date string with full weekday, month, day, year, and time.
 */
export const formatModalDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * @brief Calculates lifetime player statistics from game history.
 * Aggregates player data across multiple game sessions to produce lifetime stats.
 * Players are identified by name, and their drinks and game participations are totaled.
 * @param history An array of GameSession objects.
 * @return An array of PlayerStat objects, sorted by total drinks in descending order.
 */
export const calculateLifetimePlayerStats = (
  history: GameSession[]
): PlayerStat[] => {
  if (history.length === 0) return [];

  const playerMap = new Map<string, PlayerStat>();

  history.forEach((game) => {
    game.players.forEach((player) => {
      const name = player.name;
      const drinks = player.drinksTaken || 0;

      if (playerMap.has(name)) {
        const existing = playerMap.get(name)!;
        playerMap.set(name, {
          ...existing,
          totalDrinks: existing.totalDrinks + drinks,
          gamesPlayed: existing.gamesPlayed + 1,
        });
      } else {
        playerMap.set(name, {
          name,
          totalDrinks: drinks,
          gamesPlayed: 1,
          averagePerGame: 0, // Temporary value, calculated below
        });
      }
    });
  });

  const statsArray = Array.from(playerMap.values()).map((stat) => ({
    ...stat,
    averagePerGame:
      stat.gamesPlayed > 0 ? stat.totalDrinks / stat.gamesPlayed : 0,
  }));

  statsArray.sort((a, b) => b.totalDrinks - a.totalDrinks);
  return statsArray;
};