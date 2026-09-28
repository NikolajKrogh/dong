import { buildHistoryRows } from "../../components/history/historyLayout";
import type { GameSession } from "../../components/history/historyTypes";

const game = (id: string, date: string): GameSession => ({ id, date, players: [], matches: [], commonMatchId: null, playerAssignments: {}, matchesPerPlayer: 0 });

describe("history month rows", () => {
  const games = [game("a", "2026-09-27"), game("b", "2026-09-20"), game("c", "2026-08-01"), game("d", "")];
  it("packs two columns without crossing month boundaries", () => {
    const rows = buildHistoryRows(games, 2, true);
    expect(rows.map(row => row.games.map(item => item.id))).toEqual([["a", "b"], ["c"], ["d"]]);
    expect(rows.map(row => row.heading)).toEqual(["September 2026", "August 2026", "Unknown completion date"]);
  });
  it("keeps mobile reading order and prints each heading once", () => {
    expect(buildHistoryRows(games, 1, true).map(row => row.heading)).toEqual(["September 2026", undefined, "August 2026", "Unknown completion date"]);
  });
  it("omits grouping for non-date sorting", () => {
    const rows = buildHistoryRows(games, 2, false);
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.heading === undefined)).toBe(true);
  });
  it("handles invalid dates and empty histories", () => {
    expect(buildHistoryRows([game("bad", "bad")], 1, true)[0].heading).toBe("Unknown completion date");
    expect(buildHistoryRows([], 2, true)).toEqual([]);
  });
});
