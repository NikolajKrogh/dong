import React from "react";
import TestRenderer from "react-test-renderer";

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

jest.mock("../../../utils/teamLogos", () => ({
  getTeamLogoWithFallback: jest.fn(() => null),
}));

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    primaryLight: "#345678",
    primaryLighter: "#eef2ff",
    surface: "#ffffff",
    border: "#cccccc",
  }),
}));

jest.mock("../../../app/style/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

const renderAssignmentSection = () => {
  const AssignmentSection =
    require("../../../components/setupGame/AssignmentSection").default;

  return TestRenderer.create(
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
