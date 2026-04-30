import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

jest.mock("react-native", () => ({
  Image: "Image",
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
    textMuted: "#777777",
    secondary: "#654321",
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
        modalPlayerIcon: { marginRight: 8 },
      },
      {
        get: (target, property) => target[property as keyof typeof target] ?? {},
      },
    ),
}));

jest.mock("../../../hooks/useTeamLogo", () => ({
  useTeamLogo: () => ({ uri: "logo" }),
}));

jest.mock("../../../components/history/historyUtils", () => ({
  formatModalDate: () => "Apr 24, 2026",
  calculateTotalGoals: () => 3,
  calculateTotalDrinks: () => 4,
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const mockGame = {
  id: "g1",
  date: "2026-04-24T19:00:00.000Z",
  players: [{ id: "p1", name: "Alice", drinksTaken: 4 }],
  matches: [
    {
      id: "m1",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      homeGoals: 2,
      awayGoals: 1,
    },
  ],
  commonMatchId: "m1",
};

describe("GameDetailsModal responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("returns null when no game is selected", () => {
    const GameDetailsModal =
      require("../../../components/history/GameDetailsModal").default;

    const renderer = TestRenderer.create(
      React.createElement(GameDetailsModal, {
        visible: true,
        onClose: jest.fn(),
        game: null,
      }),
    );

    expect(renderer.toJSON()).toBeNull();
  });

  it("adds the wide modal treatment on desktop-sized viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const GameDetailsModal =
      require("../../../components/history/GameDetailsModal").default;

    const renderer = TestRenderer.create(
      React.createElement(GameDetailsModal, {
        visible: true,
        onClose: jest.fn(),
        game: mockGame,
      }),
    );

    const modalView = renderer.root.findByProps({
      testID: "GameDetailsModalView",
    });
    const scrollView = renderer.root.findByType("ScrollView");

    expect(modalView.props.style).toEqual([{}, { testStyle: "modalViewWide" }]);
    expect(scrollView.props.contentContainerStyle).toEqual([
      {},
      { testStyle: "listContentWide" },
    ]);
  });
});