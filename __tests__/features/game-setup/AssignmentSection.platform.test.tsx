import React from "react";
import TestRenderer from "react-test-renderer";

import { actCreate } from "../../../test-utils/render";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockStyles = {
  tabContent: { testStyle: "tabContent" },
  assignmentSection: { testStyle: "assignmentSection" },
  sectionHeader: { testStyle: "sectionHeader" },
  sectionTitle: { testStyle: "sectionTitle" },
  headerActionsRow: { testStyle: "headerActionsRow" },
  layoutToggleButton: { testStyle: "layoutToggleButton" },
  centeredView: { testStyle: "centeredView" },
  modalView: { testStyle: "modalView" },
  modalText: { testStyle: "modalText" },
  button: { testStyle: "button" },
  buttonCancel: { testStyle: "buttonCancel" },
  textStyle: { testStyle: "textStyle" },
  assignmentPlayersGrid: { testStyle: "assignmentPlayersGrid" },
  assignmentPlayersGridWide: {
    testStyle: "assignmentPlayersGridWide",
    flexDirection: "row",
  },
  assignmentContainer: { testStyle: "assignmentContainer" },
  playerContainer: { testStyle: "playerContainer" },
  assignmentPlayerCardWide: {
    testStyle: "assignmentPlayerCardWide",
    width: "48%",
  },
  playerHeader: { testStyle: "playerHeader" },
  playerHeaderLeft: { testStyle: "playerHeaderLeft" },
  playerAssignmentName: { testStyle: "playerAssignmentName" },
  playerBadge: { testStyle: "playerBadge" },
  playerBadgeText: { testStyle: "playerBadgeText" },
  chevronIcon: { testStyle: "chevronIcon" },
  randomizeContainer: { testStyle: "randomizeContainer" },
  matchCounterContainer: { testStyle: "matchCounterContainer" },
  matchCountLabel: { testStyle: "matchCountLabel" },
  counter: { testStyle: "counter" },
  counterButton: { testStyle: "counterButton" },
  counterValue: { testStyle: "counterValue" },
  randomizeButton: { testStyle: "randomizeButton" },
  randomizeButtonText: { testStyle: "randomizeButtonText" },
};

jest.mock("react-native", () => ({
  Platform: { OS: "web", select: (o: Record<string, unknown>) => o.web ?? o.default },
  View: "View",
  Text: "Text",
  FlatList: "FlatList",
  TouchableOpacity: "TouchableOpacity",
  Modal: "Modal",
  Image: "Image",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children, ...props }: any) => {
    const ReactLocal = require("react");
    const ReactNativeLocal = require("react-native");

    return ReactLocal.createElement(
      ReactNativeLocal.View,
      { testID: "LinearGradient", ...props },
      children,
    );
  },
}));

jest.mock("../../../features/football-matches/teamLogos", () => ({
  getTeamLogoWithFallback: jest.fn(() => null),
}));

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    primaryLight: "#345678",
    primaryLighter: "#eef2ff",
    surface: "#ffffff",
    border: "#cccccc",
  }),
}));

jest.mock("../../../features/game-setup/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

const renderAssignmentSection = (
  overrides: Record<string, unknown> = {},
) => {
  const AssignmentSection =
    require("../../../features/game-setup/AssignmentSection").default;

  return actCreate(
    React.createElement(AssignmentSection, {
      players: [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
      ],
      matches: [
        {
          id: "m1",
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          homeGoals: 0,
          awayGoals: 0,
        },
        {
          id: "m2",
          homeTeam: "Liverpool",
          awayTeam: "Spurs",
          homeGoals: 0,
          awayGoals: 0,
        },
      ],
      commonMatchId: "m1",
      playerAssignments: { p1: ["m2"], p2: [] },
      toggleMatchAssignment: jest.fn(),
      matchesPerPlayer: 1,
      setMatchesPerPlayer: jest.fn(),
      handleRandomAssignment: jest.fn(),
      ...overrides,
    }),
  );
};

describe("AssignmentSection responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("keeps player assignment cards stacked on phone-sized viewports", () => {
    const renderer = renderAssignmentSection();
    const grid = renderer.root.findByProps({ testID: "AssignmentPlayersGrid" });
    const cards = renderer.root.findAllByProps({
      testID: "AssignmentPlayerCard",
    });

    expect(grid.props.style).toEqual(
      expect.arrayContaining([mockStyles.assignmentPlayersGrid]),
    );
    expect(grid.props.style).not.toEqual(
      expect.arrayContaining([mockStyles.assignmentPlayersGridWide]),
    );
    cards.forEach((card) => {
      expect(card.props.style).not.toEqual(
        expect.arrayContaining([mockStyles.assignmentPlayerCardWide]),
      );
    });
  });

  it("wraps player assignment cards into a wide grid on desktop-sized viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderAssignmentSection();
    const grid = renderer.root.findByProps({ testID: "AssignmentPlayersGrid" });
    const cards = renderer.root.findAllByProps({
      testID: "AssignmentPlayerCard",
    });

    expect(grid.props.style).toEqual(
      expect.arrayContaining([
        mockStyles.assignmentPlayersGrid,
        mockStyles.assignmentPlayersGridWide,
      ]),
    );
    cards.forEach((card) => {
      expect(card.props.style).toEqual(
        expect.arrayContaining([
          mockStyles.assignmentContainer,
          mockStyles.playerContainer,
          mockStyles.assignmentPlayerCardWide,
        ]),
      );
    });
  });
});

describe("AssignmentSection progress badge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  // The badge shell moved into components/matchSelection/MatchSelectionCard,
  // which is shared with the player-picked surfaces. Those count against the
  // per-player CAP while this flow counts against the POOL, so the denominator
  // is a prop -- and nothing else in this suite pins it. The fixture below
  // deliberately makes pool size (3) differ from matchesPerPlayer (1) so a
  // swapped denominator cannot pass (specs/022-player-picked-mode research.md R15).
  it("counts each player's assignments against the non-common pool size, not matchesPerPlayer", () => {
    const renderer = renderAssignmentSection({
      matches: [
        { id: "m1", homeTeam: "Arsenal", awayTeam: "Chelsea", homeGoals: 0, awayGoals: 0 },
        { id: "m2", homeTeam: "Liverpool", awayTeam: "Spurs", homeGoals: 0, awayGoals: 0 },
        { id: "m3", homeTeam: "Leeds", awayTeam: "Villa", homeGoals: 0, awayGoals: 0 },
        { id: "m4", homeTeam: "Brighton", awayTeam: "Wolves", homeGoals: 0, awayGoals: 0 },
      ],
      commonMatchId: "m1",
      playerAssignments: { p1: ["m2", "m3"], p2: [] },
      matchesPerPlayer: 1,
    });

    const badges = renderer.root
      .findAllByProps({ style: mockStyles.playerBadgeText })
      .map((node) => node.props.children.join(""));

    expect(badges).toEqual(expect.arrayContaining(["2/3", "0/3"]));
  });
});


describe("shared solo and room assignment controls", () => {
  it("preserves both server settings when either shared counter changes", () => {
    const { AssignmentSettingsPanel } = require("../../../features/rooms/AssignmentSettingsPanel");
    const onChange = jest.fn();
    const tree = actCreate(React.createElement(AssignmentSettingsPanel, {
      plan: { matchesPerPlayer: 2, sharedMatchesPerPair: 1 }, mode: "automatic", isBusy: false, onChange,
    }));
    TestRenderer.act(() => tree.root.findByProps({ testID: "lobby-matches-per-player-increment" }).props.onPress());
    expect(onChange).toHaveBeenLastCalledWith({ matchesPerPlayer: 3, sharedMatchesPerPair: 1 });
    expect(tree.root.findAllByProps({ testID: "lobby-shared-matches-per-pair-decrement" })).toHaveLength(0);
    TestRenderer.act(() => tree.root.findByProps({ testID: "lobby-shared-matches-toggle" }).props.onPress());
    TestRenderer.act(() => tree.root.findByProps({ testID: "lobby-shared-matches-per-pair-decrement" }).props.onPress());
    expect(onChange).toHaveBeenLastCalledWith({ matchesPerPlayer: 2, sharedMatchesPerPair: 0 });
  });

  it("uses the solo card and match list for host allocation with busy-write protection", () => {
    const { RoomAssignmentPlayers } = require("../../../features/rooms/RoomAssignmentPlayers");
    const { MatchSelectionCard } = require("../../../features/game-setup/MatchSelectionCard");
    const { SelectableMatchList } = require("../../../features/game-setup/SelectableMatchList");
    const onToggleAllocation = jest.fn();
    const tree = actCreate(React.createElement(RoomAssignmentPlayers, {
      participants: [{ id: "p1", displayName: "Alice" }],
      matches: [{ id: "m2", homeTeam: "Liverpool", awayTeam: "Spurs" }],
      matchesPerPlayer: 2, selectedMatchIdsFor: () => ["m2"], isBusy: true, onToggleAllocation,
    }));
    const card = tree.root.findByType(MatchSelectionCard);
    expect(card.props.selectedCount).toBe(1);
    expect(card.props.totalCount).toBe(2);
    TestRenderer.act(() => card.props.onToggleCollapsed());
    const list = tree.root.findByType(SelectableMatchList);
    expect(list.props.selectedMatchIds).toEqual(["m2"]);
    expect(list.props.disabledMatchIds).toEqual(["m2"]);
    // Verify the adapter preserves both ids; disabled interaction is owned by the shared list.
    list.props.onToggleMatch("m2");
    expect(onToggleAllocation).toHaveBeenCalledWith("p1", "m2");
  });
});
