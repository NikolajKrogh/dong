import React from "react";
import TestRenderer from "react-test-renderer";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { actCreate } from "../../test-utils/render";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockGoBack = jest.fn();
const mockRefresh = jest.fn();
const mockCloudState = { accountId: "account-a" as string | null, loading: false, error: null as string | null };

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

const mockCreateHistoryStyles = jest.fn((..._args: unknown[]) => mockHistoryStyles);

jest.mock("react-native", () => ({
  Platform: { OS: "web", select: (o: Record<string, unknown>) => o.web ?? o.default },
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

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockGoBack }),
  useFocusEffect: (callback: () => void) => require("react").useEffect(callback, [callback]),
}));

jest.mock("../../hooks/useHistory", () => ({
  useHistory: () => ({ ...mockHistoryStore, ...mockCloudState, refresh: mockRefresh }),
}));

jest.mock("../../styles/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    textPrimary: "#111111",
    textMuted: "#777777",
    neutralGray: "#999999",
  }),
}));

jest.mock("../../styles/historyStyles", () => ({
  createHistoryStyles: (...args: unknown[]) => mockCreateHistoryStyles(...args),
}));

jest.mock("../../components/ui", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return {
    ShellActionButton: (props: any) => ReactLocal.createElement(ReactNativeLocal.TouchableOpacity, props,
      ReactLocal.createElement(ReactNativeLocal.Text, null, props.label)),
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

  return actCreate(React.createElement(HistoryScreen));
};

describe("HistoryScreen responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockCloudState, { accountId: "account-a", loading: false, error: null });
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
    const gamesList = renderer.root.findByType(FlatList);

    expect(sortModal.props.visible).toBe(false);
    expect(sortModal.props.sortField).toBe("date");
    expect(sortModal.props.sortDirection).toBe("desc");
    expect(gamesList.props.data).toHaveLength(1);
    expect(gamesList.props.data[0].id).toBe("g1");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("keeps history visible during loading and exposes retry on failure", () => {
    mockCloudState.loading = true;
    const renderer = renderHistoryScreen();
    expect(renderer.root.findByType(FlatList).props.data).toHaveLength(1);
    mockCloudState.loading = false;
    mockCloudState.error = "Could not load cloud history";
    TestRenderer.act(() => renderer.update(React.createElement(require("../../app/history").default)));
    // Locate the reusable action, not the tab or sorting buttons.
    const action = renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.label === "Retry cloud history")!;
    TestRenderer.act(() => action.props.onPress());
    expect(mockRefresh).toHaveBeenCalledTimes(2);
    expect(renderer.root.findByType(FlatList).props.data).toHaveLength(1);
  });

  it("clears an open result immediately when the account changes", () => {
    const renderer = renderHistoryScreen();
    const item = renderer.root.findByType(FlatList).props.renderItem({ item: mockHistoryStore.history[0] });
    TestRenderer.act(() => item.props.onDetailsPress(mockHistoryStore.history[0]));
    expect(renderer.root.findAllByProps({ testID: "GameDetailsModal" })).toHaveLength(1);
    mockCloudState.accountId = "account-b";
    TestRenderer.act(() => renderer.update(React.createElement(require("../../app/history").default)));
    expect(renderer.root.findAllByProps({ testID: "GameDetailsModal" })).toHaveLength(0);
  });

  it("passes the same history to player and overall statistics", () => {
    const renderer = renderHistoryScreen();
    const pressText = (label: string) => {
      const text = renderer.root.findAllByType(Text).find((node) => node.props.children === label)!;
      TestRenderer.act(() => text.parent!.parent!.props.onPress());
    };
    pressText("Players");
    expect(renderer.root.findByProps({ testID: "PlayerStatsList" }).props.history).toBe(mockHistoryStore.history);
    pressText("Stats");
    expect(renderer.root.findByProps({ testID: "OverallStats" }).props.history).toBe(mockHistoryStore.history);
  });

  it("places unknown completion dates last in both date sort directions", () => {
    const original = mockHistoryStore.history;
    mockHistoryStore.history = [{ ...original[0], id: "unknown", date: "" }, ...original];
    try {
      const renderer = renderHistoryScreen();
      expect(renderer.root.findByType(FlatList).props.data.map((game: { id: string }) => game.id)).toEqual(["g1", "unknown"]);
      TestRenderer.act(() => renderer.root.findByProps({ testID: "SortHistoryModal" }).props.onSortChange("date"));
      expect(renderer.root.findByType(FlatList).props.data.map((game: { id: string }) => game.id)).toEqual(["g1", "unknown"]);
    } finally {
      mockHistoryStore.history = original;
    }
  });

  it("only applies wide history container styles on desktop-wide viewports", () => {
    let renderer = renderHistoryScreen();
    let tabsContainer = renderer.root
      .findAllByType(View)
      .find(
        (node) =>
          Array.isArray(node.props.style) &&
          node.props.style.includes(mockHistoryStyles.tabsContainer),
      );
    let gamesList = renderer.root.findByType(FlatList);

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

    TestRenderer.act(() => {
      renderer.unmount();
    });

    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    renderer = renderHistoryScreen();
    tabsContainer = renderer.root
      .findAllByType(View)
      .find(
        (node) =>
          Array.isArray(node.props.style) &&
          node.props.style.includes(mockHistoryStyles.tabsContainer),
      );
    gamesList = renderer.root.findByType(FlatList);

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
    expect(shell.props.contentProps.alignSelf).toBe("center");
    expect(renderer.root.findAllByType(TouchableOpacity).some(
      (node) => node.props.label === "Refresh history",
    )).toBe(false);
  });
});
