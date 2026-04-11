import React from "react";
import TestRenderer from "react-test-renderer";

const mockPlatformDatePicker = jest.fn(() => null);
const mockPlatformTimePicker = jest.fn(() => null);

jest.mock("../../../platform", () => ({
  PlatformDatePicker: mockPlatformDatePicker,
  PlatformTimePicker: mockPlatformTimePicker,
  formatDateIsoValue: jest.requireActual(
    "../../../platform/date-input/normalizeValue",
  ).formatDateIsoValue,
  parseDateIsoValue: jest.requireActual(
    "../../../platform/date-input/normalizeValue",
  ).parseDateIsoValue,
  parseTimeIsoValue: jest.requireActual(
    "../../../platform/date-input/normalizeValue",
  ).parseTimeIsoValue,
}));

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    primaryFocus: "#123456",
    textSecondary: "#333333",
    textMuted: "#666666",
    backgroundSubtle: "#fafafa",
    backgroundLight: "#ffffff",
    surface: "#ffffff",
    borderLight: "#cccccc",
    borderSubtle: "#dddddd",
    textPrimary: "#111111",
    white: "#ffffff",
  }),
}));

jest.mock("../../../app/style/setupGameStyles", () => ({
  __esModule: true,
  default: () => ({
    filterCard: {},
    filterCardHeader: {},
    filterCardContent: {},
    filterTitleContainer: {},
    filterTitle: {},
    filterBadgesSection: {},
    filterBadgesContainer: {},
    filterBadge: {},
    filterBadgeText: {},
    noFiltersText: {},
    indicatorContainer: {},
    expandedContent: {},
    filterSection: {},
    sectionTitle: {},
    filterInput: {},
    activeInput: {},
    inputIcon: {},
    inputText: {},
    activeInputText: {},
    timeInputRow: {},
    timeInput: {},
    timeSeparator: {},
    resultsSummary: {},
    matchCountContainer: {},
    matchCount: {},
    filterActionButton: {},
    disabledButton: {},
    filterActionButtonText: {},
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

describe("MatchFilter platform adoption", () => {
  it("uses the shared date and time picker adapters", () => {
    const MatchFilter =
      require("../../../components/setupGame/MatchFilter").default;

    const renderer = TestRenderer.create(
      React.createElement(MatchFilter, {
        selectedDate: "2026-04-11",
        startTime: "15:00",
        endTime: "22:00",
        setSelectedDate: jest.fn(),
        setStartTime: jest.fn(),
        setEndTime: jest.fn(),
        handleAddAllFilteredMatches: jest.fn(),
        isTimeFilterActive: true,
        isDateFilterActive: true,
        filteredMatches: [],
        isLoading: false,
      }),
    );

    const buttons = renderer.root.findAll(
      (node) => node.props?.onPress && typeof node.props.onPress === "function",
    );

    TestRenderer.act(() => {
      buttons[0].props.onPress();
    });

    expect(mockPlatformDatePicker).toHaveBeenCalledTimes(1);
    expect(mockPlatformTimePicker).toHaveBeenCalledTimes(2);
  });
});
