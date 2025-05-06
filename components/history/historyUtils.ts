import {
  GameSession,
  Match,
  Player,
  PlayerStat,
  HeadToHeadStats,
} from "./historyTypes";

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
 * @return The formatted date string with short month, day, and year.
 */
export const formatHistoryDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
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

/**
 * @brief Calculates comprehensive head-to-head statistics for two players.
 * @param history An array of GameSession objects.
 * @param player1Name Name of the first player.
 * @param player2Name Name of the second player.
 * @return A HeadToHeadStats object with comparison metrics.
 */
export const getPlayerHeadToHeadStats = (
  history: GameSession[],
  player1Name: string,
  player2Name: string
): HeadToHeadStats => {
  // Initialize the stats object with default values
  const stats: HeadToHeadStats = {
    player1: {
      name: player1Name,
      gamesPlayed: 0,
      totalDrinks: 0,
      averagePerGame: 0,
    },
    player2: {
      name: player2Name,
      gamesPlayed: 0,
      totalDrinks: 0,
      averagePerGame: 0,
    },
    gamesPlayedTogether: 0,
    player1WinsCount: 0,
    player2WinsCount: 0,
    tiedGamesCount: 0,
    player1MaxInAGame: 0,
    player2MaxInAGame: 0,
    player1CommonMatchCount: 0,
    player2CommonMatchCount: 0,
    player1Efficiency: 0,
    player2Efficiency: 0,
    player1TopDrinkerCount: 0,
    player2TopDrinkerCount: 0,
    player1AvgWithPlayer2: 0,
    player1AvgWithoutPlayer2: 0,
    player2AvgWithPlayer1: 0,
    player2AvgWithoutPlayer1: 0,
    timelineData: [],
  };

  // Games where each player participated
  const player1Games = history.filter((game) =>
    game.players.some((p) => p.name === player1Name)
  );

  const player2Games = history.filter((game) =>
    game.players.some((p) => p.name === player2Name)
  );

  // Games where both players participated
  const gamesPlayedTogether = history.filter(
    (game) =>
      game.players.some((p) => p.name === player1Name) &&
      game.players.some((p) => p.name === player2Name)
  );

  // Basic stats
  stats.player1.gamesPlayed = player1Games.length;
  stats.player2.gamesPlayed = player2Games.length;
  stats.gamesPlayedTogether = gamesPlayedTogether.length;

  // Calculate total drinks
  stats.player1.totalDrinks = player1Games.reduce((total, game) => {
    const player = game.players.find((p) => p.name === player1Name);
    return total + (player?.drinksTaken || 0);
  }, 0);

  stats.player2.totalDrinks = player2Games.reduce((total, game) => {
    const player = game.players.find((p) => p.name === player2Name);
    return total + (player?.drinksTaken || 0);
  }, 0);

  // Calculate averages
  stats.player1.averagePerGame =
    stats.player1.gamesPlayed > 0
      ? stats.player1.totalDrinks / stats.player1.gamesPlayed
      : 0;

  stats.player2.averagePerGame =
    stats.player2.gamesPlayed > 0
      ? stats.player2.totalDrinks / stats.player2.gamesPlayed
      : 0;

  // Head-to-head analysis in games played together
  gamesPlayedTogether.forEach((game) => {
    const player1 = game.players.find((p) => p.name === player1Name);
    const player2 = game.players.find((p) => p.name === player2Name);

    const player1Drinks = player1?.drinksTaken || 0;
    const player2Drinks = player2?.drinksTaken || 0;

    // Update max drinks in a game
    stats.player1MaxInAGame = Math.max(stats.player1MaxInAGame, player1Drinks);
    stats.player2MaxInAGame = Math.max(stats.player2MaxInAGame, player2Drinks);

    // Track who drank more in each game
    if (player1Drinks > player2Drinks) {
      stats.player1WinsCount++;
    } else if (player2Drinks > player1Drinks) {
      stats.player2WinsCount++;
    } else {
      stats.tiedGamesCount++;
    }

    // Add timeline data for trend visualization
    stats.timelineData.push({
      date: game.date,
      player1Drinks: player1Drinks,
      player2Drinks: player2Drinks,
    });
  });

  // Sort timeline data by date
  stats.timelineData.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Common match participation
  player1Games.forEach((game) => {
    if (
      game.players.some((p) => p.name === player1Name) &&
      game.matches.some((m) => m.id === game.commonMatchId)
    ) {
      stats.player1CommonMatchCount++;
    }
  });

  player2Games.forEach((game) => {
    if (
      game.players.some((p) => p.name === player2Name) &&
      game.matches.some((m) => m.id === game.commonMatchId)
    ) {
      stats.player2CommonMatchCount++;
    }
  });

  // Calculate efficiency (drinks per match)
  const player1TotalMatches = player1Games.reduce(
    (total, game) => total + game.matches.length,
    0
  );

  const player2TotalMatches = player2Games.reduce(
    (total, game) => total + game.matches.length,
    0
  );

  stats.player1Efficiency =
    player1TotalMatches > 0
      ? stats.player1.totalDrinks / player1TotalMatches
      : 0;

  stats.player2Efficiency =
    player2TotalMatches > 0
      ? stats.player2.totalDrinks / player2TotalMatches
      : 0;

  // Top drinker frequency
  player1Games.forEach((game) => {
    const topDrinker = findTopDrinker(game.players);
    if (topDrinker && topDrinker.name === player1Name) {
      stats.player1TopDrinkerCount++;
    }
  });

  player2Games.forEach((game) => {
    const topDrinker = findTopDrinker(game.players);
    if (topDrinker && topDrinker.name === player2Name) {
      stats.player2TopDrinkerCount++;
    }
  });

  // Calculate drinking influence - player1 with vs without player2
  if (stats.gamesPlayedTogether > 0) {
    const player1DrinksWithPlayer2 = gamesPlayedTogether.reduce(
      (total, game) => {
        const player = game.players.find((p) => p.name === player1Name);
        return total + (player?.drinksTaken || 0);
      },
      0
    );

    stats.player1AvgWithPlayer2 =
      player1DrinksWithPlayer2 / stats.gamesPlayedTogether;
  }

  const player1GamesWithoutPlayer2 = player1Games.filter(
    (game) => !game.players.some((p) => p.name === player2Name)
  );

  if (player1GamesWithoutPlayer2.length > 0) {
    const player1DrinksWithoutPlayer2 = player1GamesWithoutPlayer2.reduce(
      (total, game) => {
        const player = game.players.find((p) => p.name === player1Name);
        return total + (player?.drinksTaken || 0);
      },
      0
    );

    stats.player1AvgWithoutPlayer2 =
      player1DrinksWithoutPlayer2 / player1GamesWithoutPlayer2.length;
  }

  // Calculate drinking influence - player2 with vs without player1
  if (stats.gamesPlayedTogether > 0) {
    const player2DrinksWithPlayer1 = gamesPlayedTogether.reduce(
      (total, game) => {
        const player = game.players.find((p) => p.name === player2Name);
        return total + (player?.drinksTaken || 0);
      },
      0
    );

    stats.player2AvgWithPlayer1 =
      player2DrinksWithPlayer1 / stats.gamesPlayedTogether;
  }

  const player2GamesWithoutPlayer1 = player2Games.filter(
    (game) => !game.players.some((p) => p.name === player1Name)
  );

  if (player2GamesWithoutPlayer1.length > 0) {
    const player2DrinksWithoutPlayer1 = player2GamesWithoutPlayer1.reduce(
      (total, game) => {
        const player = game.players.find((p) => p.name === player2Name);
        return total + (player?.drinksTaken || 0);
      },
      0
    );

    stats.player2AvgWithoutPlayer1 =
      player2DrinksWithoutPlayer1 / player2GamesWithoutPlayer1.length;
  }

  return stats;
};
