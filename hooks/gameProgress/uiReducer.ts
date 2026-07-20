export type GameProgressTab = "matches" | "players";

export interface GameProgressUiState {
  activeTab: GameProgressTab;
  isAlertVisible: boolean;
  selectedMatchId: string | null;
  isQuickActionsVisible: boolean;
  refreshing: boolean;
}

export type GameProgressUiAction =
  | { type: "setActiveTab"; tab: GameProgressTab }
  | { type: "setAlertVisible"; visible: boolean }
  | { type: "openQuickActions"; matchId: string }
  | { type: "closeQuickActions" }
  | { type: "setRefreshing"; refreshing: boolean };

export const initialGameProgressUiState: GameProgressUiState = {
  activeTab: "matches",
  isAlertVisible: false,
  selectedMatchId: null,
  isQuickActionsVisible: false,
  refreshing: false,
};

export const gameProgressUiReducer = (
  state: GameProgressUiState,
  action: GameProgressUiAction,
): GameProgressUiState => {
  switch (action.type) {
    case "setActiveTab":
      return { ...state, activeTab: action.tab };
    case "setAlertVisible":
      return { ...state, isAlertVisible: action.visible };
    case "openQuickActions":
      return {
        ...state,
        selectedMatchId: action.matchId,
        isQuickActionsVisible: true,
      };
    case "closeQuickActions":
      return {
        ...state,
        selectedMatchId: null,
        isQuickActionsVisible: false,
      };
    case "setRefreshing":
      return { ...state, refreshing: action.refreshing };
    default:
      return state;
  }
};
