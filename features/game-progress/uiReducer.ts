export interface GameProgressUiState {
  isAlertVisible: boolean;
  selectedMatchId: string | null;
  isQuickActionsVisible: boolean;
  refreshing: boolean;
}

export type GameProgressUiAction =
  | { type: "setAlertVisible"; visible: boolean }
  | { type: "openQuickActions"; matchId: string }
  | { type: "closeQuickActions" }
  | { type: "setRefreshing"; refreshing: boolean };

export const initialGameProgressUiState: GameProgressUiState = {
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
