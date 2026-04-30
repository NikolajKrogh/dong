import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

jest.mock("react-native", () => ({
  View: "View",
  RefreshControl: "RefreshControl",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

const controllerState = {
  colors: { primary: "#123456" },
  styles: {
    safeArea: {},
    container: {},
    tabContent: {},
    footerContainer: {},
  },
  activeTab: "matches",
  isAlertVisible: false,
  selectedMatchId: null,
  isQuickActionsVisible: false,
  refreshing: false,
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
  commonMatchId: "",
  playerAssignments: { p1: ["m1"] },
  liveMatches: [],
  isPolling: false,
  lastUpdated: null,
  setActiveTab: jest.fn(),
  openQuickActions: jest.fn(),
  closeQuickActions: jest.fn(),
  onRefresh: jest.fn(),
  handleDrinkIncrement: jest.fn(),
  handleDrinkDecrement: jest.fn(),
  handleBackToSetup: jest.fn(),
  handleEndGame: jest.fn(),
  handleGoalIncrement: jest.fn(),
  handleGoalDecrement: jest.fn(),
  cancelEndGame: jest.fn(),
  confirmEndGame: jest.fn(),
};

const mockUseGameProgressController = jest.fn(() => controllerState);

jest.mock("../../hooks/useGameProgressController", () => ({
  __esModule: true,
  default: () => mockUseGameProgressController(),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("../../components/ui", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return {
    ShellScreen: ({ children, ...props }: any) =>
      ReactLocal.createElement(
        ReactNativeLocal.View,
        { testID: "ShellScreen", ...props },
        children,
      ),
  };
});

jest.mock("../../components/gameProgress/TabNavigation", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return ({ children, ...props }: any) =>
    ReactLocal.createElement(
      ReactNativeLocal.View,
      { testID: "TabNavigation", ...props },
      children,
    );
});

jest.mock("../../components/gameProgress/MatchesGrid/", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "MatchesGrid",
      ...props,
    });
});

jest.mock("../../components/gameProgress/PlayersList", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "PlayersList",
      ...props,
    });
});

jest.mock("../../components/gameProgress/MatchQuickActionsModal", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "MatchQuickActionsModal",
      ...props,
    });
});

jest.mock("../../components/gameProgress/EndGameModal", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "EndGameModal",
      ...props,
    });
});

jest.mock("../../components/gameProgress/FooterButtons", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "FooterButtons",
      ...props,
    });
});

const renderGameProgressScreen = () => {
  const GameProgressScreen = require("../../app/gameProgress").default;

  return TestRenderer.create(React.createElement(GameProgressScreen));
};

describe("GameProgressScreen responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("wires controller data into the route layout", () => {
    const renderer = renderGameProgressScreen();
    const tabNavigation = renderer.root.findByProps({
      testID: "TabNavigation",
    });
    const footerButtons = renderer.root.findByProps({
      testID: "FooterButtons",
    });

    expect(mockUseGameProgressController).toHaveBeenCalled();
    expect(tabNavigation.props.matchesCount).toBe(1);
    expect(tabNavigation.props.playersCount).toBe(1);
    expect(footerButtons.props.onBackToSetup).toBe(
      controllerState.handleBackToSetup,
    );
    expect(footerButtons.props.onEndGame).toBe(controllerState.handleEndGame);
  });

  it("keeps the shared shell unconstrained on phone-sized viewports", () => {
    const renderer = renderGameProgressScreen();
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(false);
    expect(shell.props.contentMaxWidth).toBeUndefined();
  });

  it("centers the shared shell on desktop-wide viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderGameProgressScreen();
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(true);
    expect(shell.props.contentMaxWidth).toBe(1280);
  });
});
