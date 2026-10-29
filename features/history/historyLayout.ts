import type { GameSession } from "./historyTypes";

export interface HistoryGameRow {
  id: string;
  heading?: string;
  games: GameSession[];
}

/** Pack within month boundaries so a heading never shares a row with another month. */
export function buildHistoryRows(games: GameSession[], columns: number, groupByMonth: boolean): HistoryGameRow[] {
  const rows: HistoryGameRow[] = [];
  let previousGroup = "";
  for (const game of games) {
    const date = new Date(game.date);
    const knownDate = Number.isFinite(date.getTime());
    const group = groupByMonth
      ? knownDate ? `${date.getFullYear()}-${date.getMonth()}` : "unknown"
      : "all";
    const startsGroup = group !== previousGroup;
    const last = rows[rows.length - 1];
    if (startsGroup || !last || last.games.length >= columns) {
      rows.push({
        id: game.id,
        heading: groupByMonth && startsGroup
          ? knownDate ? date.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "Unknown completion date"
          : undefined,
        games: [game],
      });
    } else {
      last.games.push(game);
    }
    previousGroup = group;
  }
  return rows;
}
