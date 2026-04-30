import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockStyles = {
  tabContainer: { testStyle: "tabContainer" },
  tabContainerWide: { testStyle: "tabContainerWide", maxWidth: 640 },
  tab: { testStyle: "tab" },
  tabWide: { testStyle: "tabWide", flex: 1 },
  activeTab: { testStyle: "activeTab" },
  tabText: { testStyle: "tabText" },
  activeTabText: { testStyle: "activeTabText" },
};

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    surface: "#ffffff",
    border: "#dddddd",
    primary: "#0057ff",
    textSecondary: "#333333",
    textLight: "#ffffff",
  }),
}));

jest.mock("../../../app/style/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

const renderTabNavigation = (activeTab = "players") => {
  const TabNavigation =
    require("../../../components/setupGame/TabNavigation").default;

  return TestRenderer.create(
    React.createElement(TabNavigation, {
      activeTab,
      setActiveTab: jest.fn(),
    }),
  );
};

describe("Setup TabNavigation responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("keeps the compact tab container on phone-sized viewports", () => {
    const renderer = renderTabNavigation();
    const root = renderer.root.findByProps({
      testID: "SetupTabNavigationRoot",
    });
    const tabs = renderer.root.findAllByProps({
      testID: "SetupTabNavigationTab",
    });

    expect(root.props.style).toEqual([mockStyles.tabContainer, false]);
    expect(tabs[0].props.style).toEqual([
      mockStyles.tab,
      false,
      mockStyles.activeTab,
    ]);
  });

  it("adds the wide tab container treatment on desktop-sized viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderTabNavigation("matches");
    const root = renderer.root.findByProps({
      testID: "SetupTabNavigationRoot",
    });
    const tabs = renderer.root.findAllByProps({
      testID: "SetupTabNavigationTab",
    });

    expect(root.props.style).toEqual([
      mockStyles.tabContainer,
      mockStyles.tabContainerWide,
    ]);
    expect(tabs[1].props.style).toEqual([
      mockStyles.tab,
      mockStyles.tabWide,
      mockStyles.activeTab,
    ]);
  });
});
