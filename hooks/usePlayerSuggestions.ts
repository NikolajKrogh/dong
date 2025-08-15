import { useMemo } from "react";
import { useGameStore } from "../store/store";

/**
 * Represents a player suggestion with calculated statistics.
 */
export interface PlayerSuggestion {
  /** The name of the player. */
  name: string;
  /** The total number of games the player has participated in. */
  gamesPlayed: number;
  /** The total number of drinks consumed by the player across all games. */
  totalDrinks: number;
  /** The date of the last game the player participated in (ISO string). */
  lastPlayed: string;
  /** The average number of drinks the player consumes per game. */
  averageDrinksPerGame: number;
}

/**
 * A custom hook that provides player suggestions based on game history.
 * It calculates player statistics and filters them based on a search query.
 *
 * @param searchQuery The current search input from the user.
 * @returns An object containing filtered player suggestions and a flag indicating if game history exists.
 */
export function usePlayerSuggestions(searchQuery: string) {
  const { history } = useGameStore();

  /**
   * Calculates and memoizes player statistics from the game history.
   */
  const playerStats = useMemo(() => {
    if (history.length === 0) return [];

    const statsMap = new Map<
      string,
      {
        gamesPlayed: number;
        totalDrinks: number;
        lastPlayed: string;
        dates: string[];
      }
    >();

    // Collect player data from all games
    history.forEach((game) => {
      game.players.forEach((player) => {
        const existing = statsMap.get(player.name) || {
          gamesPlayed: 0,
          totalDrinks: 0,
          lastPlayed: game.date,
          dates: [],
        };

        existing.gamesPlayed += 1;
        existing.totalDrinks += player.drinksTaken || 0;
        existing.dates.push(game.date);

        // Keep the most recent date
        if (new Date(game.date) > new Date(existing.lastPlayed)) {
          existing.lastPlayed = game.date;
        }

        statsMap.set(player.name, existing);
      });
    });

    // Convert to PlayerSuggestion format and calculate average drinks
    return Array.from(statsMap.entries())
      .map(([name, stats]) => {
        const averageDrinksPerGame =
          stats.gamesPlayed > 0 ? stats.totalDrinks / stats.gamesPlayed : 0;

        return {
          name,
          gamesPlayed: stats.gamesPlayed,
          totalDrinks: stats.totalDrinks,
          lastPlayed: stats.lastPlayed,
          averageDrinksPerGame,
        };
      })
      .sort((a, b) => {
        // Sort by average drinks first, then by recency
        if (Math.abs(a.averageDrinksPerGame - b.averageDrinksPerGame) < 0.1) {
          return (
            new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime()
          );
        }
        return b.averageDrinksPerGame - a.averageDrinksPerGame;
      });
  }, [history]);

  /**
   * Filters the calculated player stats based on the search query.
   */
  const playerSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return playerStats.slice(0, 6);

    return playerStats
      .filter((player) =>
        player.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 6);
  }, [playerStats, searchQuery]);

  return {
    playerSuggestions,
    hasHistory: history.length > 0,
  };
}
