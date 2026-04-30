import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

jest.mock("react-native", () => ({
  Modal: "Modal",
  ScrollView: "ScrollView",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    secondary: "#654321",
    textMuted: "#777777",
    textSecondary: "#222222",
    surface: "#ffffff",
    black: "#000000",
    backgroundLight: "#f5f5f5",
  }),
}));

jest.mock("../../../app/style/historyStyles", () => ({
  createHistoryStyles: () =>
    new Proxy(
      {
        modalView: {},
        modalViewWide: { testStyle: "modalViewWide" },
        listContent: {},
        listContentWide: { testStyle: "listContentWide" },
      },
      {
        get: (target, property) => target[property as keyof typeof target] ?? {},
      },
    ),
}));

jest.mock("../../../components/history/historyUtils", () => ({
  getPlayerHeadToHeadStats: () => ({
    player1: { gamesPlayed: 2, totalDrinks: 6, averagePerGame: 3 },
    player2: { gamesPlayed: 2, totalDrinks: 4, averagePerGame: 2 },
    gamesPlayedTogether: 2,
    player1WinsCount: 1,
    tiedGamesCount: 0,
    player2WinsCount: 1,
    player1MaxInAGame: 4,
    player2MaxInAGame: 3,
    player1Efficiency: 1.5,
    player2Efficiency: 1,
    player1TopDrinkerCount: 1,
    player2TopDrinkerCount: 1,
    player1AvgWithPlayer2: 3,
    player1AvgWithoutPlayer2: 2,
    player2AvgWithPlayer1: 2,
    player2AvgWithoutPlayer1: 1,
  }),
}));

jest.mock("../../../components/history/TooltipModal", () => () => null);

jest.mock("@expo/vector-icons", () => ({
  Ionicons: Object.assign(() => null, { glyphMap: {} }),
}));

const mockPlayerOne = {
  playerId: "p1",
  name: "Alice",
  totalDrinks: 6,
  gamesPlayed: 2,
  averagePerGame: 3,
};

const mockPlayerTwo = {
  playerId: "p2",
  name: "Morgan",
  totalDrinks: 4,
  gamesPlayed: 2,
  averagePerGame: 2,
};

describe("PlayerComparisonModal responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("returns null when either comparison player is missing", () => {
    const PlayerComparisonModal =
      require("../../../components/history/PlayerComparisonModal").default;

    const renderer = TestRenderer.create(
      React.createElement(PlayerComparisonModal, {
        visible: true,
        onClose: jest.fn(),
        player1: mockPlayerOne,
        player2: null,
        gameHistory: [],
      }),
    );

    expect(renderer.toJSON()).toBeNull();
  });

  it("applies the wide modal treatment on desktop-sized viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const PlayerComparisonModal =
      require("../../../components/history/PlayerComparisonModal").default;

    const renderer = TestRenderer.create(
      React.createElement(PlayerComparisonModal, {
        visible: true,
        onClose: jest.fn(),
        player1: mockPlayerOne,
        player2: mockPlayerTwo,
        gameHistory: [],
      }),
    );

    const modalView = renderer.root.findAllByType("View")[1];
    const scrollView = renderer.root.findByType("ScrollView");

    expect(modalView.props.style).toEqual([{}, { testStyle: "modalViewWide" }]);
    expect(scrollView.props.contentContainerStyle).toEqual([
      {},
      { testStyle: "listContentWide" },
    ]);
  });
});