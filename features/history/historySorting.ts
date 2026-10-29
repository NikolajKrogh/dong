import { calculateTotalDrinks, calculateTotalGoals } from "./historyCalculations";
import { getHistoryTimestamp } from "./historyDate";
import { GameSession } from "./historyTypes";
import {
  HistorySortField,
  SortDirection,
} from "./SortHistoryModal";

export function sortHistory(
  history: GameSession[],
  sortField: HistorySortField,
  sortDirection: SortDirection,
): GameSession[] {
  return [...history].sort((a, b) => {
    let comparison: number;
    switch (sortField) {
      case "date": {
        const aDate = getHistoryTimestamp(a.date);
        const bDate = getHistoryTimestamp(b.date);
        if (aDate === null || bDate === null) {
          return Number(aDate === null) - Number(bDate === null) || a.id.localeCompare(b.id);
        }
        comparison = bDate - aDate;
        break;
      }
      case "players":
        comparison = b.players.length - a.players.length;
        break;
      case "drinks":
        comparison = calculateTotalDrinks(b.players) - calculateTotalDrinks(a.players);
        break;
      case "goals":
        comparison = calculateTotalGoals(b.matches) - calculateTotalGoals(a.matches);
        break;
      case "matches":
        comparison = b.matches.length - a.matches.length;
        break;
      default:
        comparison = 0;
    }
    return (sortDirection === "desc" ? comparison : -comparison) || a.id.localeCompare(b.id);
  });
}
