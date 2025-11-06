import React from "react";
import { useGameStore } from "../store/store";
import type {
  GameSession,
  PlayerStat,
} from "../components/history/historyTypes";
import {
  calculateLifetimePlayerStats,
  calculateTotalDrinks,
  calculateTotalGoals,
} from "../components/history/historyUtils";
import type {
  HistorySortField,
  SortDirection,
} from "../components/history/SortHistoryModal";

/**
 * API exposed by the history screen logic hook, supplying derived data and UI handlers.
 */
export interface HistoryScreenHookResult {
  history: GameSession[];
  playerStats: PlayerStat[];
  sortedHistory: GameSession[];
  selectedGame: GameSession | null;
  isDetailVisible: boolean;
  activeTabIndex: number;
  sortField: HistorySortField;
  sortDirection: SortDirection;
  sortModalVisible: boolean;
  hasGames: boolean;
  hasPlayers: boolean;
  loading: boolean;
  error: string | null;
  switchTab: (tabIndex: number) => void;
  viewGameDetails: (game: GameSession) => void;
  closeDetails: () => void;
  handleSortChange: (field: HistorySortField) => void;
  openSortModal: () => void;
  closeSortModal: () => void;
}

/**
 * Encapsulates sorting, tab selection, and derived history statistics for the history screen.
 * @returns {HistoryScreenHookResult} Aggregated state, derived collections, and event handlers.
 */
const useHistoryScreenLogic = (): HistoryScreenHookResult => {
  const { history } = useGameStore();

  const [selectedGame, setSelectedGame] = React.useState<GameSession | null>(
    null
  );
  const [isDetailVisible, setIsDetailVisible] = React.useState(false);
  const [playerStats, setPlayerStats] = React.useState<PlayerStat[]>([]);
  const [activeTabIndex, setActiveTabIndex] = React.useState(0);
  const [error] = React.useState<string | null>(null);
  const [loading] = React.useState(false);
  const [sortField, setSortField] = React.useState<HistorySortField>("date");
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>("desc");
  const [sortModalVisible, setSortModalVisible] = React.useState(false);

  // Recompute lifetime player statistics when history changes
  React.useEffect(() => {
    if (history.length > 0) {
      setPlayerStats(calculateLifetimePlayerStats(history));
    } else {
      setPlayerStats([]);
    }
  }, [history]);

  const switchTab = React.useCallback((tabIndex: number) => {
    setActiveTabIndex(tabIndex);
  }, []);

  const viewGameDetails = React.useCallback((game: GameSession) => {
    if (!game) {
      console.warn("Attempted to open details for null game");
      return;
    }
    setSelectedGame(game);
    setIsDetailVisible(true);
  }, []);

  const closeDetails = React.useCallback(() => {
    setIsDetailVisible(false);
    setSelectedGame(null);
  }, []);

  const handleSortChange = React.useCallback(
    (field: HistorySortField) => {
      setSortModalVisible(false);
      if (field === sortField) {
        setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
        return;
      }
      setSortField(field);
      setSortDirection("desc");
    },
    [sortField]
  );

  const sortedHistory = React.useMemo(() => {
    return [...history].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison = new Date(b.date).getTime() - new Date(a.date).getTime();
          break;
        case "players":
          comparison = b.players.length - a.players.length;
          break;
        case "drinks":
          comparison =
            calculateTotalDrinks(b.players) - calculateTotalDrinks(a.players);
          break;
        case "goals":
          comparison =
            calculateTotalGoals(b.matches) - calculateTotalGoals(a.matches);
          break;
        case "matches":
          comparison = b.matches.length - a.matches.length;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === "desc" ? comparison : -comparison;
    });
  }, [history, sortField, sortDirection]);

  const hasGames = history.length > 0;
  const hasPlayers = playerStats.length > 0;

  const openSortModal = React.useCallback(() => {
    setSortModalVisible(true);
  }, []);

  const closeSortModal = React.useCallback(() => {
    setSortModalVisible(false);
  }, []);

  return {
    history,
    playerStats,
    sortedHistory,
    selectedGame,
    isDetailVisible,
    activeTabIndex,
    sortField,
    sortDirection,
    sortModalVisible,
    hasGames,
    hasPlayers,
    loading,
    error,
    switchTab,
    viewGameDetails,
    closeDetails,
    handleSortChange,
    openSortModal,
    closeSortModal,
  };
};

export default useHistoryScreenLogic;
