export interface HomeStatsPlayer {
  name: string;
  drinksTaken?: number;
}

export interface HomeStatsGameSession {
  players: HomeStatsPlayer[];
}

export interface TopDrinkerInfo {
  name: string;
  drinks: number;
}

export const getTotalDrinks = (gameHistory: HomeStatsGameSession[]) => {
  return gameHistory.reduce(
    (sum, game) =>
      sum +
      game.players.reduce(
        (gameSum: number, player: HomeStatsPlayer) =>
          gameSum + (player.drinksTaken || 0),
        0,
      ),
    0,
  );
};

export const getTopDrinker = (
  gameHistory: HomeStatsGameSession[],
): TopDrinkerInfo | null => {
  const playerDrinks = new Map<string, number>();

  gameHistory.forEach((game) => {
    game.players.forEach((player) => {
      const current = playerDrinks.get(player.name) || 0;
      playerDrinks.set(player.name, current + (player.drinksTaken || 0));
    });
  });

  let topPlayer = "";
  let maxDrinks = 0;

  playerDrinks.forEach((drinks, name) => {
    if (drinks > maxDrinks) {
      maxDrinks = drinks;
      topPlayer = name;
    }
  });

  return topPlayer ? { name: topPlayer, drinks: maxDrinks } : null;
};
