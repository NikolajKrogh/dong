import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockPlatformAnimation = jest.fn(() => null);
const mockMatchTeamsData: unknown[] = [];
const mockApiData: unknown[] = [];
const mockAvailableLeagues: unknown[] = [];
const mockAllTeamsData: unknown[] = [];
const mockFilteredTeamsData: unknown[] = [];
const mockSetFilteredTeamsData = jest.fn();
const mockMatchDataState = {
  isLoading: true,
  isError: false,
  errorMessage: "",
  teamsData: mockMatchTeamsData,
  apiData: mockApiData,
  availableLeagues: mockAvailableLeagues,
};
const mockStyles = {
  tabContent: { testStyle: "tabContent" },
  matchListLayout: { testStyle: "matchListLayout" },
  matchListWideLayout: {
    testStyle: "matchListWideLayout",
    flexDirection: "row",
  },
  matchListControls: { testStyle: "matchListControls" },
  matchListControlsWide: {
    testStyle: "matchListControlsWide",
    width: 360,
  },
  matchListResults: { testStyle: "matchListResults" },
  matchListResultsWide: {
    testStyle: "matchListResultsWide",
    flex: 1,
  },
  loadingContainer: { testStyle: "loadingContainer" },
  lottieAnimation: { testStyle: "lottieAnimation" },
  loadingText: { testStyle: "loadingText" },
  errorContainer: { testStyle: "errorContainer" },
  errorText: { testStyle: "errorText" },
  processingIndicator: { testStyle: "processingIndicator" },
  matchEmptyListContainer: { testStyle: "matchEmptyListContainer" },
  emptyListTitleText: { testStyle: "emptyListTitleText" },
  emptyListSubtitleText: { testStyle: "emptyListSubtitleText" },
  matchesGridContainer: { testStyle: "matchesGridContainer" },
  clearAllButton: { testStyle: "clearAllButton" },
  clearAllButtonText: { testStyle: "clearAllButtonText" },
  sectionTitle: { testStyle: "sectionTitle" },
};

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  FlatList: "FlatList",
  ActivityIndicator: "ActivityIndicator",
  TouchableOpacity: "TouchableOpacity",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    View: "View",
  },
  FadeIn: {
    duration: () => ({}),
  },
  FadeOut: {
    duration: () => ({}),
  },
}));

jest.mock("../../../platform", () => ({
  PlatformAnimation: mockPlatformAnimation,
  formatDateIsoValue: jest.requireActual(
    "../../../platform/date-input/normalizeValue",
  ).formatDateIsoValue,
}));

jest.mock("../../../store/store", () => ({
  useGameStore: () => ({
    defaultSelectedLeagues: [],
    theme: "light",
  }),
}));

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    textLight: "#ffffff",
    textMuted: "#888888",
  }),
}));

jest.mock("../../../app/style/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

jest.mock("../../../hooks/useMatchData", () => ({
  useMatchData: () => mockMatchDataState,
}));

jest.mock("../../../hooks/useTeamData", () => ({
  useTeamData: () => ({
    isLoading: false,
    isError: false,
    errorMessage: "",
    teamsData: mockAllTeamsData,
  }),
}));

jest.mock("../../../hooks/useTeamFiltering", () => ({
  useTeamFiltering: () => ({
    filteredTeamsData: mockFilteredTeamsData,
    setFilteredTeamsData: mockSetFilteredTeamsData,
  }),
  filterMatchesByDateAndTime: jest.fn((matches) => matches),
}));

jest.mock("../../../hooks/useMatchProcessing", () => ({
  useMatchProcessing: () => ({
    startProcessing: jest.fn(),
    processingState: {
      isProcessing: false,
      matchesAdded: 0,
      matchesSkipped: 0,
    },
  }),
}));

jest.mock("../../../components/setupGame/MatchFilter", () => ({
  __esModule: true,
  default: (props: any) => {
    const ReactLocal = require("react");
    const ReactNativeLocal = require("react-native");

    return ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "MatchFilter",
      ...props,
    });
  },
}));

jest.mock("../../../components/setupGame/TeamSelectionRow", () => ({
  __esModule: true,
  default: (props: any) => {
    const ReactLocal = require("react");
    const ReactNativeLocal = require("react-native");

    return ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "TeamSelectionRow",
      ...props,
    });
  },
}));

jest.mock("../../../components/setupGame/MatchItem", () => ({
  __esModule: true,
  default: (props: any) => {
    const ReactLocal = require("react");
    const ReactNativeLocal = require("react-native");

    return ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "MatchItem",
      ...props,
    });
  },
}));

jest.mock("../../../components/setupGame/LeagueFilter", () => ({
  __esModule: true,
  default: (props: any) => {
    const ReactLocal = require("react");
    const ReactNativeLocal = require("react-native");

    return ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "LeagueFilter",
      ...props,
    });
  },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const renderMatchList = () => {
  const MatchList = require("../../../components/setupGame/MatchList").default;

  return TestRenderer.create(
    React.createElement(MatchList, {
      matches: [
        {
          id: "m1",
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          homeGoals: 0,
          awayGoals: 0,
        },
      ],
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      setHomeTeam: jest.fn(),
      setAwayTeam: jest.fn(),
      handleAddMatch: jest.fn(),
      handleRemoveMatch: jest.fn(),
      setGlobalMatches: jest.fn(),
    }),
  );
};

describe("MatchList platform adoption", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
    mockMatchDataState.isLoading = true;
  });

  it("uses the shared animation adapter for loading feedback", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      renderer = renderMatchList();
    });

    expect(mockPlatformAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "loading" }),
      {},
    );

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("keeps a single-column layout on phone-sized viewports", () => {
    mockMatchDataState.isLoading = false;

    const renderer = renderMatchList();
    const layout = renderer.root.findByProps({ testID: "MatchListLayout" });
    const controls = renderer.root.findByProps({ testID: "MatchListControls" });
    const results = renderer.root.findByProps({ testID: "MatchListResults" });

    expect(layout.props.style).toEqual(
      expect.arrayContaining([mockStyles.matchListLayout]),
    );
    expect(layout.props.style).not.toEqual(
      expect.arrayContaining([mockStyles.matchListWideLayout]),
    );
    expect(controls.props.style).not.toEqual(
      expect.arrayContaining([mockStyles.matchListControlsWide]),
    );
    expect(results.props.style).not.toEqual(
      expect.arrayContaining([mockStyles.matchListResultsWide]),
    );
  });

  it("switches to a split controls and results layout on desktop-wide viewports", () => {
    mockMatchDataState.isLoading = false;
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderMatchList();
    const layout = renderer.root.findByProps({ testID: "MatchListLayout" });
    const controls = renderer.root.findByProps({ testID: "MatchListControls" });
    const results = renderer.root.findByProps({ testID: "MatchListResults" });

    expect(layout.props.style).toEqual(
      expect.arrayContaining([
        mockStyles.matchListLayout,
        mockStyles.matchListWideLayout,
      ]),
    );
    expect(controls.props.style).toEqual(
      expect.arrayContaining([
        mockStyles.matchListControls,
        mockStyles.matchListControlsWide,
      ]),
    );
    expect(results.props.style).toEqual(
      expect.arrayContaining([
        mockStyles.matchListResults,
        mockStyles.matchListResultsWide,
      ]),
    );
  });
});
