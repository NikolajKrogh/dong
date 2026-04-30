import React from "react";
import TestRenderer from "react-test-renderer";
import { TouchableOpacity, View } from "react-native";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
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
    textPrimary: "#111111",
    textSecondary: "#222222",
    borderLighter: "#cccccc",
    surface: "#ffffff",
  }),
}));

jest.mock("../../../app/style/historyStyles", () => ({
  createHistoryStyles: () => ({
    pageHeader: {},
    pageHeaderWide: { testStyle: "pageHeaderWide" },
    headerBackButton: {},
    headerTitle: {},
    headerSortButton: { testStyle: "headerSortButton" },
    rightPlaceholder: { testStyle: "rightPlaceholder" },
  }),
}));

jest.mock("../../../components/AppIcon", () => () => null);

describe("HistoryHeader responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("renders the back and sort actions for the games tab", () => {
    const onBack = jest.fn();
    const onOpenSortModal = jest.fn();
    const HistoryHeader =
      require("../../../components/history/HistoryHeader").default;

    const renderer = TestRenderer.create(
      React.createElement(HistoryHeader, {
        title: "Game History",
        onBack,
        showSortButton: true,
        sortDirection: "desc",
        onOpenSortModal,
      }),
    );

    const backButton = renderer.root.findByProps({
      testID: "HistoryHeaderBackButton",
    });
    const sortButton = renderer.root.findByProps({
      testID: "HistoryHeaderSortButton",
    });

    TestRenderer.act(() => {
      backButton.props.onPress();
      sortButton.props.onPress();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onOpenSortModal).toHaveBeenCalledTimes(1);
  });

  it("adds the wide header treatment on desktop-sized viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const HistoryHeader =
      require("../../../components/history/HistoryHeader").default;

    const renderer = TestRenderer.create(
      React.createElement(HistoryHeader, {
        title: "Game History",
        onBack: jest.fn(),
        showSortButton: false,
        sortDirection: "asc",
        onOpenSortModal: jest.fn(),
      }),
    );

    const container = renderer.root.findByProps({
      testID: "HistoryHeaderContainer",
    });
    const placeholder = renderer.root.findByProps({
      testID: "HistoryHeaderPlaceholder",
    });

    expect(container.props.style).toEqual([{}, { testStyle: "pageHeaderWide" }]);
    expect(placeholder.props.style).toEqual({ testStyle: "rightPlaceholder" });
  });
});