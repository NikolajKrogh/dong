import React from "react";
import TestRenderer from "react-test-renderer";
import { StyleSheet } from "react-native";

import { actCreate } from "../../../test-utils/render";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";
jest.mock("../../../components/ui/ShellActionButton", () => ({
  ShellActionButton: ({ label, ...props }: { label?: string; accessibilityLabel?: string }) => require("react").createElement("TouchableOpacity",
    { ...props, accessibilityRole: "button", accessibilityLabel: props.accessibilityLabel ?? label }, require("react").createElement("Text", null, label)),
}));

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

jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  Object.defineProperty(actual, "useWindowDimensions", { configurable: true, value: () => mockUseWindowDimensions() });
  return actual;
});

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
  getHardcodedTeamLogoOnly: jest.fn(() => null),
  getTeamLogo: jest.fn().mockResolvedValue(null),
}));

jest.mock("../../../styles/theme", () => ({
  ...jest.requireActual("../../../styles/theme"),
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
    React.createElement(TamaguiTestProvider, null, React.createElement(AssignmentSection, {
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
    })),
  );
};

it("edits an individual count and clears its explicit zero override", () => {
  const setPlayerMatchCount = jest.fn();
  const renderer = renderAssignmentSection({ playerMatchCounts: { p1: 0 }, setPlayerMatchCount });
  const collapse = renderer.root.findAllByProps({ testID: "AssignmentPlayerCard" })
    .find(node => typeof node.props.onToggleCollapsed === "function");
  expect(collapse!.props.collapsed).toBe(true);
  const increase = renderer.root.findAllByProps({ accessibilityLabel: "Increase alice's additional matches" })[0];
  TestRenderer.act(() => increase.props.onPress());
  expect(setPlayerMatchCount).toHaveBeenCalledWith("p1", 1);
  expect(collapse!.props.collapsed).toBe(true);
  const reset = renderer.root.findAllByProps({ accessibilityLabel: "Use default count for Alice" })[0];
  TestRenderer.act(() => reset.props.onPress());
  expect(setPlayerMatchCount).toHaveBeenCalledWith("p1", null);
});

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
      expect(StyleSheet.flatten(card.props.style)).toMatchObject({ width: "48%" });
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

  it("shows how many picks are missing or excessive against each target", () => {
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

    const statuses = renderer.root.findAllByType("Text" as never).map(node => node.props.accessibilityLabel);
    expect(statuses).toEqual(expect.arrayContaining(["1 too many", "1 left"]));
  });
});


describe("shared solo and room assignment controls", () => {
  it("preserves both server settings when either shared counter changes", () => {
    const { AssignmentSettingsPanel } = require("../../../features/rooms/AssignmentSettingsPanel");
    const onChange = jest.fn();
    const tree = actCreate(React.createElement(TamaguiTestProvider, null, React.createElement(AssignmentSettingsPanel, {
      plan: { matchesPerPlayer: 2, sharedMatchesPerPair: 1 }, mode: "automatic", isBusy: false, onChange,
    })));
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
    const tree = actCreate(React.createElement(TamaguiTestProvider, null, React.createElement(RoomAssignmentPlayers, {
      participants: [{ id: "p1", displayName: "Alice" }],
      matches: [{ id: "m2", homeTeam: "Liverpool", awayTeam: "Spurs" }],
      matchesPerPlayer: 2, selectedMatchIdsFor: () => ["m2"], isBusy: true, onToggleAllocation,
    })));
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
