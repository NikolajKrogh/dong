import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseAppVisibility = jest.fn(() => ({
  visibilityState: "active",
  isInteractive: true,
  snapshot: {
    state: "active",
    source: "appState",
    isInteractive: true,
    capturedAt: 0,
  },
}));

const mockUseGoalSound = jest.fn(() => ({
  isSoundPlaying: false,
  playGoalSound: jest.fn(),
  stopGoalSound: jest.fn(),
}));

jest.mock("../../platform", () => ({
  useAppVisibility: mockUseAppVisibility,
  useGoalSound: mockUseGoalSound,
}));

jest.mock("../../hooks/useLiveScores", () => ({
  useLiveScores: () => ({
    liveMatches: [],
    isPolling: false,
    lastUpdated: null,
    startPolling: jest.fn(),
    stopPolling: jest.fn(),
    fetchCurrentScores: jest.fn(),
  }),
}));

jest.mock("../../hooks/usePersistedTeamLogos", () => ({
  usePersistedTeamLogos: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock("../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#123456",
  }),
}));

jest.mock("../../app/style/gameProgressStyles", () => ({
  createGameProgressStyles: () => ({
    safeArea: {},
    container: {},
    tabContent: {},
    footerContainer: {},
  }),
}));

jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));

jest.mock("../../components/gameProgress/TabNavigation", () => {
  const ReactLocal = require("react");
  const ReactNative = require("react-native");
  return ({ children }: { children: React.ReactNode }) =>
    ReactLocal.createElement(ReactNative.View, null, children);
});

jest.mock("../../components/gameProgress/MatchesGrid", () => {
  const ReactLocal = require("react");
  const ReactNative = require("react-native");
  return () => ReactLocal.createElement(ReactNative.View, null, "MatchesGrid");
});

jest.mock("../../components/gameProgress/PlayersList", () => {
  const ReactLocal = require("react");
  const ReactNative = require("react-native");
  return () => ReactLocal.createElement(ReactNative.View, null, "PlayersList");
});

jest.mock("../../components/gameProgress/MatchQuickActionsModal", () => {
  const ReactLocal = require("react");
  const ReactNative = require("react-native");
  return () => ReactLocal.createElement(ReactNative.View, null, "QuickActions");
});

jest.mock("../../components/gameProgress/EndGameModal", () => {
  const ReactLocal = require("react");
  const ReactNative = require("react-native");
  return () => ReactLocal.createElement(ReactNative.View, null, "EndGame");
});

jest.mock("../../components/gameProgress/FooterButtons", () => {
  const ReactLocal = require("react");
  const ReactNative = require("react-native");
  return () =>
    ReactLocal.createElement(ReactNative.View, null, "FooterButtons");
});

jest.mock("../../store/store", () => ({
  useGameStore: () => ({
    players: [{ id: "p1", name: "Alice", drinksTaken: 0 }],
    matches: [
      {
        id: "m1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        homeGoals: 0,
        awayGoals: 0,
      },
    ],
    commonMatchId: null,
    playerAssignments: { p1: ["m1"] },
    setPlayers: jest.fn(),
    setMatches: jest.fn(),
    saveGameToHistory: jest.fn(),
    resetState: jest.fn(),
    soundEnabled: true,
    commonMatchNotificationsEnabled: true,
  }),
}));

describe("GameProgressScreen platform adoption", () => {
  it("uses the shared visibility and sound adapters", () => {
    const GameProgressScreen = require("../../app/gameProgress").default;

    TestRenderer.create(React.createElement(GameProgressScreen));

    expect(mockUseAppVisibility).toHaveBeenCalled();
    expect(mockUseGoalSound).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        visibilityState: "active",
      }),
    );
  });
});
