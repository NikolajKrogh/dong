import { describe, expect, it } from "@jest/globals";

import {
  gameProgressUiReducer,
  initialGameProgressUiState,
  type GameProgressUiState,
} from "../../../hooks/gameProgress/uiReducer";

describe("gameProgressUiReducer", () => {
  it("setActiveTab switches the active tab", () => {
    const next = gameProgressUiReducer(initialGameProgressUiState, {
      type: "setActiveTab",
      tab: "players",
    });

    expect(next.activeTab).toBe("players");
  });

  it("setAlertVisible toggles the alert flag", () => {
    const next = gameProgressUiReducer(initialGameProgressUiState, {
      type: "setAlertVisible",
      visible: true,
    });

    expect(next.isAlertVisible).toBe(true);
  });

  it("openQuickActions sets the selected match and shows the modal", () => {
    const next = gameProgressUiReducer(initialGameProgressUiState, {
      type: "openQuickActions",
      matchId: "match-1",
    });

    expect(next.selectedMatchId).toBe("match-1");
    expect(next.isQuickActionsVisible).toBe(true);
  });

  it("closeQuickActions clears the selected match and hides the modal", () => {
    const openState: GameProgressUiState = {
      ...initialGameProgressUiState,
      selectedMatchId: "match-1",
      isQuickActionsVisible: true,
    };

    const next = gameProgressUiReducer(openState, {
      type: "closeQuickActions",
    });

    expect(next.selectedMatchId).toBeNull();
    expect(next.isQuickActionsVisible).toBe(false);
  });

  it("setRefreshing toggles the refreshing flag", () => {
    const next = gameProgressUiReducer(initialGameProgressUiState, {
      type: "setRefreshing",
      refreshing: true,
    });

    expect(next.refreshing).toBe(true);
  });

  it("returns the same state reference for an unknown action", () => {
    const next = gameProgressUiReducer(
      initialGameProgressUiState,
      { type: "noop" } as any,
    );

    expect(next).toBe(initialGameProgressUiState);
  });
});
