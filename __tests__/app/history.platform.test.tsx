import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockGoBack = jest.fn();

const mockHistoryStore = {
  history: [
    {
      id: "g1",
      date: "2026-04-24T19:00:00.000Z",
      players: [{ id: "p1", name: "Alice", drinksTaken: 2 }],
      matches: [
        {
          id: "m1",
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          homeGoals: 1,
          awayGoals: 0,
        },
      ],
    },
  ],
};

const mockPlayerStats = [
  { playerId: "p1", playerName: "Alice", totalDrinks: 2, gamesPlayed: 1 },
];

const mockHistoryStyles = new Proxy(
  {
    tabsContainer: { testStyle: "tabsContainer" },
    tabsContainerWide: { testStyle: "tabsContainerWide" },
    listContent: { testStyle: "listContent" },
    listContentWide: { testStyle: "listContentWide" },
  },
  {
    get(target, prop) {
      if (typeof prop === "string" && prop in target) {
        return target[prop as keyof typeof target];
      }

      return {};
    },
  },
);

const mockCreateHistoryStyles = jest.fn(() => mockHistoryStyles);

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  FlatList: "FlatList",
  TouchableOpacity: "TouchableOpacity",
  ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock("../../store/store", () => ({
  useGameStore: () => mockHistoryStore,
}));

jest.mock("../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    textPrimary: "#111111",
    textMuted: "#777777",
    neutralGray: "#999999",
  }),
}));

jest.mock("../../app/style/historyStyles", () => ({
  createHistoryStyles: (...args: unknown[]) => mockCreateHistoryStyles(...args),
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

jest.mock("../../components/AppIcon", () => () => null);

jest.mock("../../components/history/GameHistoryItem", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "GameHistoryItem",
      ...props,
    });
});

jest.mock("../../components/history/GameDetailsModal", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "GameDetailsModal",
      ...props,
    });
});

jest.mock("../../components/history/PlayerStatsList", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "PlayerStatsList",
      ...props,
    });
});

jest.mock("../../components/history/OverallStats", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "OverallStats",
      ...props,
    });
});

jest.mock("../../components/history/SortHistoryModal", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  const SortHistoryModal = (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "SortHistoryModal",
      ...props,
    });

  return {
    __esModule: true,
    default: SortHistoryModal,
  };
});

jest.mock("../../components/history/historyUtils", () => ({
  calculateLifetimePlayerStats: () => mockPlayerStats,
  calculateTotalDrinks: () => 2,
  calculateTotalGoals: () => 1,
}));

const renderHistoryScreen = () => {
  const HistoryScreen = require("../../app/history").default;

  return TestRenderer.create(React.createElement(HistoryScreen));
};

describe("HistoryScreen responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("wires the history route state into the screen layout", () => {
    const renderer = renderHistoryScreen();
    const sortModal = renderer.root.findByProps({ testID: "SortHistoryModal" });
    const gamesList = renderer.root.findByType("FlatList");

    expect(sortModal.props.visible).toBe(false);
    expect(sortModal.props.sortField).toBe("date");
    expect(sortModal.props.sortDirection).toBe("desc");
    expect(gamesList.props.data).toHaveLength(1);
    expect(gamesList.props.data[0].id).toBe("g1");
  });

  it("only applies wide history container styles on desktop-wide viewports", () => {
    let renderer = renderHistoryScreen();
    let tabsContainer = renderer.root
      .findAllByType("View")
      .find(
        (node) =>
          Array.isArray(node.props.style) &&
          node.props.style.includes(mockHistoryStyles.tabsContainer),
      );
    let gamesList = renderer.root.findByType("FlatList");

    expect(tabsContainer?.props.style).toContain(
      mockHistoryStyles.tabsContainer,
    );
    expect(tabsContainer?.props.style).not.toContain(
      mockHistoryStyles.tabsContainerWide,
    );
    expect(gamesList.props.contentContainerStyle).toContain(
      mockHistoryStyles.listContent,
    );
    expect(gamesList.props.contentContainerStyle).not.toContain(
      mockHistoryStyles.listContentWide,
    );

    renderer.unmount();

    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    renderer = renderHistoryScreen();
    tabsContainer = renderer.root
      .findAllByType("View")
      .find(
        (node) =>
          Array.isArray(node.props.style) &&
          node.props.style.includes(mockHistoryStyles.tabsContainer),
      );
    gamesList = renderer.root.findByType("FlatList");

    expect(tabsContainer?.props.style).toContain(
      mockHistoryStyles.tabsContainer,
    );
    expect(tabsContainer?.props.style).toContain(
      mockHistoryStyles.tabsContainerWide,
    );
    expect(gamesList.props.contentContainerStyle).toContain(
      mockHistoryStyles.listContent,
    );
    expect(gamesList.props.contentContainerStyle).toContain(
      mockHistoryStyles.listContentWide,
    );
  });

  it("keeps the shared shell unconstrained on phone-sized viewports", () => {
    const renderer = renderHistoryScreen();
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

    const renderer = renderHistoryScreen();
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(true);
    expect(shell.props.contentMaxWidth).toBe(1120);
  });
});
