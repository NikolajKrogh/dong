import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockStyles = {
  gridContainer: { testStyle: "gridContainer" },
  gridContainerWide: { testStyle: "gridContainerWide" },
  gridRow: { testStyle: "gridRow" },
};

jest.mock("react-native", () => ({
  FlatList: "FlatList",
  View: "View",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    textMuted: "#666666",
  }),
}));

jest.mock("../../../app/style/gameProgressStyles", () => ({
  createGameProgressStyles: () => mockStyles,
}));

jest.mock("../../../components/gameProgress/MatchesGrid/MatchesHeader", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "MatchesHeader",
      ...props,
    });
});

jest.mock("../../../components/gameProgress/MatchesGrid/SortModal", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "SortModal",
      ...props,
    });
});

jest.mock("../../../components/gameProgress/MatchesGrid/MatchGridItem", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "MatchGridItem",
      ...props,
    });
});

jest.mock("../../../components/gameProgress/MatchesGrid/MatchListItem", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "MatchListItem",
      ...props,
    });
});

jest.mock("../../../components/gameProgress/MatchesGrid/LastUpdatedFooter", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "LastUpdatedFooter",
      ...props,
    });
});

const buildProps = () => ({
  matches: [
    {
      id: "m1",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      homeGoals: 0,
      awayGoals: 0,
    },
    {
      id: "m2",
      homeTeam: "Liverpool",
      awayTeam: "Everton",
      homeGoals: 1,
      awayGoals: 1,
    },
    {
      id: "m3",
      homeTeam: "Barcelona",
      awayTeam: "Real Madrid",
      homeGoals: 2,
      awayGoals: 1,
    },
  ],
  players: [
    { id: "p1", name: "Alice", drinksTaken: 0 },
    { id: "p2", name: "Bob", drinksTaken: 0 },
  ],
  commonMatchId: "m1",
  playerAssignments: { p1: ["m1", "m2"], p2: ["m3"] },
  openQuickActions: jest.fn(),
  liveMatches: [],
  refreshControl: undefined,
  onRefresh: jest.fn(),
  refreshing: false,
  lastUpdated: null,
  isPolling: false,
});

const renderMatchesGridContainer = () => {
  const MatchesGridContainer =
    require("../../../components/gameProgress/MatchesGrid/MatchesGridContainer")
      .default;

  return TestRenderer.create(
    React.createElement(MatchesGridContainer, buildProps()),
  );
};

describe("MatchesGridContainer responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("keeps the compact single-column layout on phone-sized viewports", () => {
    const renderer = renderMatchesGridContainer();
    const list = renderer.root.findByType("FlatList");

    expect(list.props.numColumns).toBe(1);
    expect(list.props.contentContainerStyle).toEqual([
      mockStyles.gridContainer,
      false,
    ]);
  });

  it("defaults to a wide multi-column grid on desktop-sized viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderMatchesGridContainer();
    const list = renderer.root.findByType("FlatList");

    expect(list.props.numColumns).toBe(3);
    expect(list.props.columnWrapperStyle).toEqual(mockStyles.gridRow);
    expect(list.props.contentContainerStyle).toEqual([
      mockStyles.gridContainer,
      mockStyles.gridContainerWide,
    ]);
  });
});