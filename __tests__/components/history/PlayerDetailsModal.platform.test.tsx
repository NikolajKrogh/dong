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
  formatModalDate: () => "Apr 24, 2026",
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const mockPlayer = {
  playerId: "p1",
  name: "Alice",
  totalDrinks: 6,
  gamesPlayed: 2,
  averagePerGame: 3,
};

const mockGameHistory = [
  {
    id: "g1",
    date: "2026-04-24T19:00:00.000Z",
    players: [{ id: "p1", name: "Alice", drinksTaken: 3 }],
    matches: [],
  },
];

describe("PlayerDetailsModal responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("returns null when no player is selected", () => {
    const PlayerDetailsModal =
      require("../../../components/history/PlayerDetailsModal").default;

    const renderer = TestRenderer.create(
      React.createElement(PlayerDetailsModal, {
        visible: true,
        onClose: jest.fn(),
        player: null,
        gameHistory: mockGameHistory,
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

    const PlayerDetailsModal =
      require("../../../components/history/PlayerDetailsModal").default;

    const renderer = TestRenderer.create(
      React.createElement(PlayerDetailsModal, {
        visible: true,
        onClose: jest.fn(),
        player: mockPlayer,
        gameHistory: mockGameHistory,
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