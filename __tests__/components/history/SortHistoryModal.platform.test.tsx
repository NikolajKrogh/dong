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
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    backgroundModalOverlay: "rgba(0,0,0,0.4)",
    surface: "#ffffff",
    black: "#000000",
    textPrimary: "#111111",
    textSecondary: "#222222",
    borderLighter: "#cccccc",
    primary: "#123456",
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

describe("SortHistoryModal responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("calls onSortChange when a sort option is pressed", () => {
    const onSortChange = jest.fn();
    const SortHistoryModal =
      require("../../../components/history/SortHistoryModal").default;

    const renderer = TestRenderer.create(
      React.createElement(SortHistoryModal, {
        visible: true,
        sortField: "date",
        sortDirection: "desc",
        onClose: jest.fn(),
        onSortChange,
      }),
    );

    const playersOption = renderer.root.findByProps({
      testID: "HistorySortOption-players",
    });

    TestRenderer.act(() => {
      playersOption.props.onPress();
    });

    expect(onSortChange).toHaveBeenCalledWith("players");
  });

  it("uses the wide modal width on desktop-sized viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const SortHistoryModal =
      require("../../../components/history/SortHistoryModal").default;

    const renderer = TestRenderer.create(
      React.createElement(SortHistoryModal, {
        visible: true,
        sortField: "date",
        sortDirection: "desc",
        onClose: jest.fn(),
        onSortChange: jest.fn(),
      }),
    );

    const modalContent = renderer.root.findByProps({
      testID: "HistorySortModalContent",
    });

    expect(modalContent.props.style.width).toBe(520);
  });
});