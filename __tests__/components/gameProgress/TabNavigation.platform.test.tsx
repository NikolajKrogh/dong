import React from "react";
import TestRenderer from "react-test-renderer";
import { TouchableOpacity, View } from "react-native";

const mockPlatformSwipeTabs = jest.fn(
  ({ children }: { children: React.ReactNode }) => {
    const ReactLocal = require("react");
    return ReactLocal.createElement(View, null, children);
  },
);

jest.mock("../../../platform", () => ({
  PlatformSwipeTabs: mockPlatformSwipeTabs,
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
    tabBar: {},
    tabButton: {},
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
});
