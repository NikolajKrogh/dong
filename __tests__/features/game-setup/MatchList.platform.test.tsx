import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockPlatformAnimation = jest.fn(() => null);
const mockStartProcessing = jest.fn();
const mockMatchTeamsData: unknown[] = [];
const mockApiData: unknown[] = [];
let mockConfiguredLeagues = [{ code: "eng.1", name: "Premier League" }, { code: "eng.2", name: "Championship" }];
let mockRouteFocused = true;
let mockTeamLoading = false;
const mockAllTeamsData: unknown[] = [];
const mockRetryMatchDiscovery = jest.fn();
const mockMatchDataState = {
  isInitialLoading: true,
  isUpdating: false,
  leagueStates: [] as { leagueCode: string; status: string; message: string | null; retryAt: number | null }[],
  retry: mockRetryMatchDiscovery,
  teamsData: mockMatchTeamsData,
  apiData: mockApiData,
};
const mockStyles = {
  tabContent: { testStyle: "tabContent" },
  matchListLayout: { testStyle: "matchListLayout" },
  matchListControls: { testStyle: "matchListControls" },
  matchListResults: { testStyle: "matchListResults" },
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
  NativeModules: jest.requireActual("react-native").NativeModules,
  Animated: jest.requireActual("react-native").Animated,
  Platform: { OS: "web", select: (o: Record<string, unknown>) => o.web ?? o.default },
  View: "View",
  Text: "Text",
  FlatList: "FlatList",
  ActivityIndicator: "ActivityIndicator",
  Image: "Image",
  StyleSheet: { create: (styles: unknown) => styles },
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

jest.mock("expo-router", () => ({ useIsFocused: () => mockRouteFocused }));

jest.mock("../../../store/gameStore", () => ({
  useGameStore: (selector?: (state: unknown) => unknown) => {
    const state = { defaultSelectedLeagues: [], configuredLeagues: mockConfiguredLeagues, theme: "light" };
    return selector ? selector(state) : state;
  },
}));

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    textLight: "#ffffff",
    textMuted: "#888888",
  }),
}));

jest.mock("../../../features/game-setup/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

jest.mock("../../../features/football-matches/useLeagueLogo", () => ({
  useLeagueLogo: () => ({ logoSource: { uri: "league-logo" }, isLoading: false }),
}));

const mockUseMatchData = jest.fn((_selection: unknown) => mockMatchDataState);
jest.mock("../../../features/football-matches/useMatchData", () => ({
  useMatchData: (selection: unknown) => mockUseMatchData(selection),
}));

jest.mock("../../../features/football-matches/useTeamDirectory", () => ({
  useTeamDirectory: () => ({
    isLoading: mockTeamLoading,
    isError: false,
    errorMessage: "",
    teamsData: mockAllTeamsData,
  }),
}));

jest.mock("../../../features/football-matches/matchFilters", () => ({
  ...jest.requireActual("../../../features/football-matches/matchFilters"),
  filterMatchesByDateAndTime: jest.fn((matches) => matches),
}));

jest.mock("../../../features/game-setup/useMatchBatchInsertion", () => ({
  useMatchBatchInsertion: () => ({
    startProcessing: mockStartProcessing,
    processingState: {
      isProcessing: false,
      matchesAdded: 0,
      matchesSkipped: 0,
    },
  }),
}));

jest.mock("../../../features/game-setup/MatchFilter", () => ({
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

jest.mock("../../../features/game-setup/TeamSelectionRow", () => ({
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

// Named export, not default -- the pool now renders through the app's shared
// match-card component rather than the wizard's own retired MatchItem.
// MatchList now reports empty-filter and nothing-to-clear through the app's toast
// rather than a system alert().
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

jest.mock("../../../features/game-setup/SelectableMatchList", () => ({
  SelectableMatchList: (props: any) => {
    const ReactLocal = require("react");
    const ReactNativeLocal = require("react-native");

    return ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "SelectableMatchList",
      ...props,
    });
  },
}));

jest.mock("../../../features/game-setup/LeagueFilter", () => ({
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

const renderMatchList = (overrides: Record<string, unknown> = {}) => {
  const MatchList = require("../../../features/game-setup/MatchList").default;

  return actCreate(
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
      handleRemoveMatch: jest.fn(),
      setGlobalMatches: jest.fn(),
      ...overrides,
    }),
  );
};

describe("MatchList platform adoption", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchTeamsData.splice(0, mockMatchTeamsData.length);
    mockApiData.splice(0, mockApiData.length);
    mockConfiguredLeagues = [{ code: "eng.1", name: "Premier League" }, { code: "eng.2", name: "Championship" }];
    mockRouteFocused = true;
    mockTeamLoading = false;
    mockAllTeamsData.splice(0, mockAllTeamsData.length);
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
    mockMatchDataState.isInitialLoading = true;
    mockMatchDataState.isUpdating = false;
    mockMatchDataState.leagueStates = [];
  });

  it("uses the shared animation adapter for loading feedback", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      renderer = renderMatchList();
    });

    expect(mockPlatformAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "loading" }),
      undefined,
    );
    expect(renderer!.root.findAllByProps({ accessibilityLabel: "Loading matches" })).toHaveLength(1);
    expect(renderer!.root.findAllByProps({ children: "Loading matches and teams" })).toHaveLength(0);

    TestRenderer.act(() => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });

  it.each(["loading", "failed"])("allows manual matches while backend data is %s", (status) => {
    mockMatchDataState.isInitialLoading = status === "loading";
    mockMatchDataState.leagueStates = status === "failed" ? [{ leagueCode: "eng.1", status: "error", message: "Match discovery is unavailable.", retryAt: null }] : [];
    const setGlobalMatches = jest.fn();
    const setHomeTeam = jest.fn();
    const setAwayTeam = jest.fn();
    const renderer = renderMatchList({ matches: [], setGlobalMatches, setHomeTeam, setAwayTeam });

    if (status === "failed") {
      const retry = renderer.root.findByProps({ accessibilityLabel: "Retry loading matches" });
      expect(retry.props.disabled).toBe(false);
      TestRenderer.act(() => retry.props.onPress());
      expect(mockRetryMatchDiscovery).toHaveBeenCalledTimes(1);
    }

    expect(renderer.root.findAllByProps({ testID: "TeamSelectionRow" })).toHaveLength(0);
    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: "SetupManualMatchToggle" }).props.onPress();
    });
    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: "TeamSelectionRow" }).props.handleAddMatchAndClear();
    });

    expect(setGlobalMatches).toHaveBeenCalledWith([
      expect.objectContaining({ homeTeam: "Arsenal", awayTeam: "Chelsea", homeGoals: 0, awayGoals: 0 }),
    ]);
    expect(setHomeTeam).toHaveBeenCalledWith("");
    expect(setAwayTeam).toHaveBeenCalledWith("");
    TestRenderer.act(() => renderer.unmount());
  });

  it("requests only selected eligible leagues, keeps every configured choice and treats time edits locally", () => {
    mockConfiguredLeagues = require("../../../constants/leagues").AVAILABLE_LEAGUES.slice(0,7);
    const renderer = renderMatchList();
    const chooser = renderer.root.findByProps({ testID: "LeagueFilter" });
    expect(chooser.props.availableLeagues).toHaveLength(7);
    expect(mockUseMatchData).toHaveBeenLastCalledWith(expect.objectContaining({ leagueCodes: ["eng.1","eng.2"], active: true }));
    const filter = renderer.root.findByProps({ testID: "MatchFilter" });
    const demand = mockUseMatchData.mock.calls[mockUseMatchData.mock.calls.length-1][0];
    TestRenderer.act(() => filter.props.setStartTime("23:30"));
    TestRenderer.act(() => filter.props.setEndTime("00:30"));
    expect(mockUseMatchData).toHaveBeenLastCalledWith(demand);
    for (const league of chooser.props.selectedLeagues) {
      TestRenderer.act(() => chooser.props.handleLeagueChange(league));
    }
    expect(mockUseMatchData).toHaveBeenLastCalledWith(expect.objectContaining({ leagueCodes: [] }));
    expect(renderer.root.findByProps({ testID: "LeagueFilter" }).props.availableLeagues).toHaveLength(7);
    expect(renderer.root.findAllByProps({ children: "Select a league to find fixtures." })).toHaveLength(1);
  });

  it.each(["updating", "error", "offline", "pending"])("keeps fixture actions and the game pool usable during %s and unfinished team suggestions", status => {
    mockMatchDataState.isInitialLoading = false;
    mockMatchDataState.isUpdating = status === "updating";
    mockMatchDataState.leagueStates = [{ leagueCode: "eng.2", status, message: "Fixtures need another check.", retryAt: null }];
    mockTeamLoading = true;
    mockMatchTeamsData.push({ key: "home", value: "Arsenal", league: "Premier League" }, { key: "away", value: "Chelsea", league: "Premier League" });
    mockApiData.push({ name: "Premier League", matches: [{ id: "fixture", team1: "Arsenal", team2: "Chelsea" }] });
    const renderer = renderMatchList({ fixedMatchIds: ["m1"] });
    const filter = renderer.root.findByProps({ testID: "MatchFilter" });
    expect(filter.props.isLoading).toBe(false);
    expect(filter.props.filteredMatches).toHaveLength(1);
    TestRenderer.act(() => filter.props.handleAddAllFilteredMatches());
    expect(mockStartProcessing).toHaveBeenCalledWith(filter.props.filteredMatches);
    expect(renderer.root.findByProps({ testID: "SelectableMatchList" }).props.disabledMatchIds).toEqual(["m1"]);
    expect(renderer.root.findAllByProps({ accessibilityLabel: "Loading matches" })).toHaveLength(0);
  });

  it("reconciles configured options and route activity without changing pooled selections", () => {
    const setGlobalMatches = jest.fn();
    const renderer = renderMatchList({ setGlobalMatches });
    mockConfiguredLeagues = [{ code: "eng.2", name: "Championship" }];
    mockRouteFocused = false;
    const MatchList = require("../../../features/game-setup/MatchList").default;
    const props = renderer.root.findByType(MatchList).props;
    TestRenderer.act(() => renderer.update(React.createElement(MatchList, props)));
    expect(mockUseMatchData).toHaveBeenLastCalledWith(expect.objectContaining({ leagueCodes: ["eng.2"], active: false }));
    expect(renderer.root.findByProps({ testID: "LeagueFilter" }).props.availableLeagues).toMatchObject(mockConfiguredLeagues);
    expect(renderer.root.findByProps({ testID: "SelectableMatchList" }).props.selectedMatchIds).toEqual(["m1"]);
    expect(setGlobalMatches).not.toHaveBeenCalled();
  });

  it("keeps a single-column layout on phone-sized viewports", () => {
    mockMatchDataState.isInitialLoading = false;

    const renderer = renderMatchList();
    const layout = renderer.root.findByProps({ testID: "MatchListLayout" });
    const controls = renderer.root.findByProps({ testID: "MatchListControls" });
    const results = renderer.root.findByProps({ testID: "MatchListResults" });

    expect(layout.props.style).toEqual(mockStyles.matchListLayout);
    expect(controls.props.style).toEqual(mockStyles.matchListControls);
    expect(results.props.style).toEqual(mockStyles.matchListResults);
  });

  it("keeps added matches below the controls on desktop-wide viewports", () => {
    mockMatchDataState.isInitialLoading = false;
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

    expect(layout.props.style).toEqual(mockStyles.matchListLayout);
    expect(controls.props.style).toEqual(mockStyles.matchListControls);
    expect(results.props.style).toEqual(mockStyles.matchListResults);
  });

  it("keeps the empty state below the controls on desktop-wide viewports before matches are added", () => {
    mockMatchDataState.isInitialLoading = false;
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderMatchList({
      matches: [],
      homeTeam: "",
      awayTeam: "",
    });
    const layout = renderer.root.findByProps({ testID: "MatchListLayout" });
    const controls = renderer.root.findByProps({ testID: "MatchListControls" });
    const results = renderer.root.findByProps({ testID: "MatchListResults" });

    expect(layout.props.style).toEqual(mockStyles.matchListLayout);
    expect(controls.props.style).toEqual(mockStyles.matchListControls);
    expect(results.props.style).toEqual(mockStyles.matchListResults);
  });

  it("passes backend-backed grouped matches through the existing MatchFilter consumer shape", () => {
    mockMatchDataState.isInitialLoading = false;
    mockMatchTeamsData.push(
      {
        key: "Arsenal-Premier League",
        value: "Arsenal",
        league: "Premier League",
      },
      {
        key: "Chelsea-Premier League",
        value: "Chelsea",
        league: "Premier League",
      },
    );
    mockApiData.push({
      name: "Premier League",
      matches: [
        {
          id: "backend-1",
          team1: "Arsenal",
          team2: "Chelsea",
          date: "2026-05-24",
          time: "19:00",
          venue: "Emirates Stadium",
        },
      ],
    });

    const renderer = renderMatchList();
    const matchFilter = renderer.root.findByProps({ testID: "MatchFilter" });

    expect(matchFilter.props.filteredMatches).toEqual([
      {
        id: "backend-1",
        team1: "Arsenal",
        team2: "Chelsea",
        date: "2026-05-24",
        time: "19:00",
        venue: "Emirates Stadium",
      },
    ]);
  });
  it("groups added matches, removes tapped cards, and clears the list even when fixtures are available", () => {
    mockMatchDataState.isInitialLoading = false;
    const fixtures = [
      { id: "pl", team1: "Liverpool", team2: "Brighton", leagueCode: "eng.1", time: "15:00" },
      { id: "ch", team1: "Leeds", team2: "Norwich", leagueCode: "eng.2", time: "15:30" },
    ];
    for (const [index, league] of [{ code: "eng.1", name: "Premier League" }, { code: "eng.2", name: "Championship" }].entries()) {
      mockApiData.push({ name: league.name, matches: [fixtures[index]] });
      for (const value of [fixtures[index].team1, fixtures[index].team2]) {
        mockMatchTeamsData.push({ key: value, value, league: league.name });
      }
    }
    const matches = fixtures.map(match => ({
      id: match.id, homeTeam: match.team1, awayTeam: match.team2,
      sourceLeagueCode: match.leagueCode, homeGoals: 0, awayGoals: 0,
    }));
    const handleRemoveMatch = jest.fn();
    const setGlobalMatches = jest.fn();
    const renderer = renderMatchList({ matches, handleRemoveMatch, setGlobalMatches });
    expect(renderer.root.findAllByProps({ children: "Premier League" }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ children: "Championship" }).length).toBeGreaterThan(0);
    const lists = renderer.root.findAllByProps({ testID: "SelectableMatchList" });
    expect(lists).toHaveLength(2);
    expect(lists[0].props.matches[0]).toMatchObject({ id: "pl", homeTeam: "Liverpool", sourceLeagueCode: "eng.1" });
    TestRenderer.act(() => lists[0].props.onToggleMatch("pl"));
    expect(lists[0].props.selectedMatchIds).toEqual(["pl", "ch"]);
    expect(handleRemoveMatch).toHaveBeenCalledWith("pl");
    expect(mockStartProcessing).not.toHaveBeenCalled();
    TestRenderer.act(() => {
      renderer.root.findByProps({ style: mockStyles.clearAllButton }).props.onPress();
    });
    expect(setGlobalMatches).toHaveBeenCalledWith([]);
    const MatchList = require("../../../features/game-setup/MatchList").default;
    const props = renderer.root.findByType(MatchList).props;
    TestRenderer.act(() => renderer.update(React.createElement(MatchList, { ...props, matches: [] })));
    expect(renderer.root.findAllByProps({ testID: "SelectableMatchList" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: "MatchListEmptyState" })).toHaveLength(1);
    TestRenderer.act(() => renderer.unmount());
  });

  /**
   * The pool renders through the app's shared match-card component, so a match
   * looks the same in the wizard, the room, and the lobby's pick panel. Selection
   * here means "in the pool", which is what makes a tap the release gesture.
   */
  describe("pool rendering", () => {
    it("marks every pooled match as selected", () => {
      const renderer = renderMatchList({
        matches: [
          { id: "m1", homeTeam: "Arsenal", awayTeam: "Chelsea", homeGoals: 0, awayGoals: 0 },
          { id: "m2", homeTeam: "Leeds", awayTeam: "Villa", homeGoals: 0, awayGoals: 0 },
        ],
      });

      const list = renderer.root.findByProps({ testID: "SelectableMatchList" });
      expect(list.props.selectedMatchIds).toEqual(["m1", "m2"]);
    });

    it("routes a tap to handleRemoveMatch", () => {
      const handleRemoveMatch = jest.fn();
      const renderer = renderMatchList({ handleRemoveMatch });

      renderer.root
        .findByProps({ testID: "SelectableMatchList" })
        .props.onToggleMatch("m1");

      expect(handleRemoveMatch).toHaveBeenCalledWith("m1");
    });

    // Removal is a server round-trip on the room surface; a second tap must not
    // race the first.
    it("makes the pool inert while a write is in flight", () => {
      const renderer = renderMatchList({ disableSelection: true });

      expect(
        renderer.root.findByProps({ testID: "SelectableMatchList" }).props
          .disabledMatchIds,
      ).toEqual(["m1"]);
    });

    it("leaves the pool tappable by default", () => {
      expect(
        renderMatchList().root.findByProps({ testID: "SelectableMatchList" })
          .props.disabledMatchIds,
      ).toBeUndefined();
    });

    // The shared component has no empty-state slot, so the branch is ours.
    it("shows the empty state instead of the list when the pool is empty", () => {
      const renderer = renderMatchList({ matches: [] });

      expect(
        renderer.root.findAllByProps({ testID: "MatchListEmptyState" }).length,
      ).toBeGreaterThan(0);
      expect(
        renderer.root.findAllByProps({ testID: "SelectableMatchList" }),
      ).toHaveLength(0);
    });
  });

  // Callers with their own screen title suppress this one so the two don't stack.
  describe("section title", () => {
    const titles = (renderer: ReturnType<typeof renderMatchList>) =>
      renderer.root.findAllByProps({ children: "Matches" });

    it("renders by default", () => {
      expect(titles(renderMatchList()).length).toBeGreaterThan(0);
    });

    it("is suppressed by showSectionTitle={false}", () => {
      expect(titles(renderMatchList({ showSectionTitle: false }))).toHaveLength(0);
    });
  });
});
