import { formatHistoryDate, formatModalDate, getPlayerHeadToHeadStats } from "../../components/history/historyUtils";

test("unknown completion dates are explicit", () => {
  expect(formatHistoryDate("")).toBe("Completion date unknown");
  expect(formatModalDate("")).toBe("Completion date unknown");
});

test("combined-history comparisons count tied top drinkers", () => {
  const result = getPlayerHeadToHeadStats([{
    id: "cloud", date: "", players: [
      { id: "a", name: "Alice", drinksTaken: 2 },
      { id: "b", name: "Bob", drinksTaken: 2 },
    ], matches: [], commonMatchId: null, playerAssignments: {}, matchesPerPlayer: 0,
  }], "Alice", "Bob");
  expect(result.player1TopDrinkerCount).toBe(1);
  expect(result.player2TopDrinkerCount).toBe(1);
});
