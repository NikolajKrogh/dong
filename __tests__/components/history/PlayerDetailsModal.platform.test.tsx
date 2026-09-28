import React from "react";
import { actCreate } from "../../../test-utils/render";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

jest.mock("react-native", () => ({
  Platform: { OS: "web", select: (o: Record<string, unknown>) => o.web ?? o.default },
  Modal: "Modal",
  ScrollView: "ScrollView",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    secondary: "#654321",
    textMuted: "#777777",
  }),
}));

jest.mock("../../../styles/historyStyles", () => ({
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
  ...jest.requireActual("../../../components/history/historyUtils"),
  formatModalDate: () => "Apr 24, 2026",
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const mockPlayer = {
  identityKey: JSON.stringify(["session", "g1", "participant", "p1"]),
  contextLabel: "Guest · Apr 24, 2026 · Game 1",
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
    commonMatchId: null,
    playerAssignments: {},
    matchesPerPlayer: 0,
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

    const renderer = actCreate(
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

    const renderer = actCreate(
      React.createElement(PlayerDetailsModal, {
        visible: true,
        onClose: jest.fn(),
        player: mockPlayer,
        gameHistory: mockGameHistory,
      }),
    );

    const modalView = renderer.root.findAllByType("View" as React.ElementType)[1];
    const scrollView = renderer.root.findByType("ScrollView" as React.ElementType);
    const avatar = renderer.root.findByProps({ accessibilityLabel: "Alice avatar" });
    const closeButton = renderer.root.findByProps({
      accessibilityLabel: "Close player details",
    });

    expect(modalView.props.style).toEqual([{}, { testStyle: "modalViewWide" }]);
    expect(avatar.props.accessibilityRole).toBe("image");
    expect(closeButton.props.accessibilityRole).toBe("button");
    expect(
      renderer.root.findByProps({ children: mockPlayer.contextLabel }).props.children,
    ).toBe(mockPlayer.contextLabel);
    expect(scrollView.props.contentContainerStyle).toEqual([
      {},
      { testStyle: "listContentWide" },
    ]);
  });
});
