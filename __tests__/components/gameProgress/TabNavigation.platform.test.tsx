import React from "react";
import TestRenderer from "react-test-renderer";
import { TouchableOpacity, View } from "react-native";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockPlatformSwipeTabs = jest.fn(
  ({ children }: { children: React.ReactNode }) => {
    const ReactLocal = require("react");
    return ReactLocal.createElement(View, null, children);
  },
);

jest.mock("../../../platform", () => ({
  PlatformSwipeTabs: mockPlatformSwipeTabs,
}));

jest.mock("react-native", () => ({
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
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
  createGameProgressStyles: () => ({
    tabNavContainer: {},
    tabBarContainer: {},
    tabBarContainerWide: { testStyle: "tabBarContainerWide" },
    tabBar: {},
    tabBarWide: { testStyle: "tabBarWide" },
    tabButton: {},
    tabButtonWide: { testStyle: "tabButtonWide" },
    activeTabButton: {},
    tabButtonText: {},
    activeTabButtonText: {},
    tabBadge: {},
    tabBadgeText: {},
    tabNavContentContainer: {},
    tabPage: {},
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

describe("TabNavigation platform adoption", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("keeps visible tab buttons available alongside the shared swipe adapter", () => {
    const setActiveTab = jest.fn();
    const TabNavigation =
      require("../../../components/gameProgress/TabNavigation").default;

    const renderer = TestRenderer.create(
      React.createElement(TabNavigation, {
        activeTab: "matches",
        setActiveTab,
        matchesCount: 2,
        playersCount: 4,
        children: [
          React.createElement(View, { key: "matches" }),
          React.createElement(View, { key: "players" }),
        ],
      }),
    );

    expect(mockPlatformSwipeTabs).toHaveBeenCalledWith(
      expect.objectContaining({ activeIndex: 0 }),
      {},
    );

    const buttons = renderer.root.findAllByType(TouchableOpacity);

    TestRenderer.act(() => {
      buttons[1].props.onPress();
    });

    expect(setActiveTab).toHaveBeenCalledWith("players");
    renderer.unmount();
  });

  it("adds explicit wide-layout treatment for desktop-width tabs", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const setActiveTab = jest.fn();
    const TabNavigation =
      require("../../../components/gameProgress/TabNavigation").default;

    const renderer = TestRenderer.create(
      React.createElement(TabNavigation, {
        activeTab: "matches",
        setActiveTab,
        matchesCount: 2,
        playersCount: 4,
        children: [
          React.createElement(View, { key: "matches" }),
          React.createElement(View, { key: "players" }),
        ],
      }),
    );

    const tabBarContainer = renderer.root.findByProps({
      testID: "GameProgressTabBarContainer",
    });
    const tabs = renderer.root.findAllByProps({
      testID: "GameProgressTabButton",
    });

    expect(tabBarContainer.props.style).toEqual([
      {},
      { testStyle: "tabBarContainerWide" },
    ]);
    expect(tabs[0].props.style).toEqual([
      {},
      { testStyle: "tabButtonWide" },
      {},
    ]);
  });
});
