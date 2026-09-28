import React from "react";
import { act } from "react-test-renderer";
import { ScrollView } from "react-native";
import { actCreate } from "../../../test-utils/render";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

jest.mock("react-native", () => ({
  Platform: {
    OS: "web",
    select: (o: Record<string, unknown>) => o.web ?? o.default,
  },
  Image: "Image",
  Modal: "Modal",
  ScrollView: "ScrollView",
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
  },
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    primaryLight: "#e3f2fd",
    backgroundModalOverlay: "rgba(0,0,0,.5)",
    backgroundLight: "#f8f9fa",
    surface: "#fff",
    borderSubtle: "#ddd",
    black: "#000",
    white: "#fff",
    textPrimary: "#222",
    textSecondary: "#333",
    textMuted: "#777777",
    secondary: "#654321",
  }),
}));

jest.mock("../../../components/history/HistoryTeamBadge", () => ({
  __esModule: true,
  default: () => null,
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
  it("shows unknown completion dates and empty sections", () => {
    const GameDetailsModal =
      require("../../../components/history/GameDetailsModal").default;
    const renderer = actCreate(
      <GameDetailsModal
        visible
        onClose={jest.fn()}
        game={{ ...mockGame, date: "", players: [], matches: [] }}
      />,
    );
    const content = JSON.stringify(renderer.toJSON());
    expect(content).toContain("Completion date unknown");
    expect(content).toContain("No players recorded");
    expect(content).toContain("No matches recorded");
  });
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

    const renderer = actCreate(
      React.createElement(GameDetailsModal, {
        visible: true,
        onClose: jest.fn(),
        game: null,
      }),
    );

    expect(renderer.toJSON()).toBeNull();
  });

  it("shows preserved early leavers and their final assignments", () => {
    const GameDetailsModal =
      require("../../../components/history/GameDetailsModal").default;
    const renderer = actCreate(
      React.createElement(GameDetailsModal, {
        visible: true,
        onClose: jest.fn(),
        game: {
          ...mockGame,
          players: [{ ...mockGame.players[0], leftAt: "2026-04-24T20:00:00Z" }],
          playerAssignments: { p1: ["m1"] },
        },
      }),
    );
    const content = JSON.stringify(renderer.toJSON());
    expect(content).toContain("Left early");
    expect(content).toContain("Arsenal vs Chelsea");
  });

  it("uses a wider modal on desktop-sized viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const GameDetailsModal =
      require("../../../components/history/GameDetailsModal").default;

    const renderer = actCreate(
      React.createElement(GameDetailsModal, {
        visible: true,
        onClose: jest.fn(),
        game: mockGame,
      }),
    );

    const modalView = renderer.root.find(
      (node) =>
        node.type === ("View" as React.ElementType) &&
        node.props.testID === "GameDetailsModalView",
    );
    const scrollView = renderer.root.findByType(ScrollView);

    expect(modalView.props.style.width).toBe(960);
    expect(modalView.props.style.maxHeight).toBe(836);
    expect(scrollView.props.contentContainerStyle.padding).toBe(18);
  });

  it.each([
    [759, 1, "column", "48.5%"],
    [760, 1, "row", "23.5%"],
    [359, 1, "column", "100%"],
    [800, 1.5, "column", "100%"],
  ])(
    "uses measured width %s and font scale %s",
    (width, fontScale, direction, statWidth) => {
      mockUseWindowDimensions.mockReturnValue({
        width: 1280,
        height: 900,
        scale: 1,
        fontScale: Number(fontScale),
      });
      const GameDetailsModal =
        require("../../../components/history/GameDetailsModal").default;
      const renderer = actCreate(
        <GameDetailsModal visible onClose={jest.fn()} game={mockGame} />,
      );
      act(() =>
        renderer.root
          .findByProps({ testID: "HistoryModalContent" })
          .props.onLayout({ nativeEvent: { layout: { width } } }),
      );
      expect(
        renderer.root.findByProps({ testID: "GameDetailsSections" }).props.style
          .flexDirection,
      ).toBe(direction);
      const stats = renderer.root.findAll(
        (node) =>
          node.type === ("View" as React.ElementType) &&
          node.props.style?.minHeight === 68,
      );
      expect(stats).toHaveLength(4);
      expect(stats[0].props.style.width).toBe(statWidth);
      expect(renderer.root.findAllByType(ScrollView)).toHaveLength(1);
    },
  );

  it("keeps twelve full names and wrapping assignments and wires both dismissal actions", () => {
    const GameDetailsModal =
      require("../../../components/history/GameDetailsModal").default;
    const onClose = jest.fn();
    const players = Array.from({ length: 12 }, (_, index) => ({
      id: `p${index}`,
      name: `Long participant name ${index}`,
      drinksTaken: 0,
    }));
    const renderer = actCreate(
      <GameDetailsModal
        visible
        onClose={onClose}
        game={{ ...mockGame, players, playerAssignments: { p0: ["m1"] } }}
      />,
    );
    const content = JSON.stringify(renderer.toJSON());
    players.forEach((player) => expect(content).toContain(player.name));
    expect(content).toContain("No assignments");
    expect(content).toContain("Arsenal vs Chelsea");
    act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: "Close game details" })
        .props.onPress(),
    );
    act(() =>
      renderer.root
        .findByType("Modal" as React.ElementType)
        .props.onRequestClose(),
    );
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
