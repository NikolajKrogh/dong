import type { GameSession, Player } from "../components/history/historyTypes";
import {
  calculateLifetimePlayerStats,
  type PlayerStatsSession,
} from "../components/history/historyUtils";

export type HomeStatsPlayer = Player;

export type HomeStatsGameSession = PlayerStatsSession;

export interface TopDrinkerInfo {
  identityKey: string;
  contextLabel: string | null;
  name: string;
  drinks: number;
}

export const getTotalDrinks = (
  gameHistory: readonly Pick<GameSession, "players">[],
): number =>
  gameHistory.reduce(
    (sum, game) =>
      sum +
      game.players.reduce(
        (gameSum, player) => gameSum + (player.drinksTaken ?? 0),
        0,
      ),
    0,
  );

export const getTopDrinker = (
  gameHistory: readonly HomeStatsGameSession[],
): TopDrinkerInfo | null => {
  const topPlayer = calculateLifetimePlayerStats(gameHistory)[0];
  if (!topPlayer || topPlayer.totalDrinks <= 0) return null;

  return {
    identityKey: topPlayer.identityKey,
    contextLabel: topPlayer.contextLabel,
    name: topPlayer.name,
    drinks: topPlayer.totalDrinks,
  };
};
