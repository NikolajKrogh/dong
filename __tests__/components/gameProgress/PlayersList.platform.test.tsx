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
  playerCard: { testStyle: "playerCard" },
  playerCardWide: { testStyle: "playerCardWide" },
  cardHeader: {},
  playerName: {},
  statusBadge: {},
  completedBadge: {},
  pendingBadge: {},
  statusText: {},
  completedText: {},
  pendingText: {},
  progressContainer: {},
  progressBackground: {},
  progressFill: {},
  progressCompleted: {},
  progressWarning: {},
  progressDanger: {},
  statsContainer: {},
  statBlock: {},
  requiredValue: {},
  requiredLabel: {},
  controlsContainer: {},
  controlButton: {},
  actionButton: {},
  valueContainer: {},
  controlValue: {},
  controlLabel: {},
  listContainer: { testStyle: "listContainer" },
  playersListContentWide: { testStyle: "playersListContentWide" },
  playersListRow: { testStyle: "playersListRow" },
};

const mockDrinkIncrement = jest.fn();
const mockDrinkDecrement = jest.fn();

jest.mock("react-native", () => ({
  Platform: { OS: "web", select: (o: Record<string, unknown>) => o.web ?? o.default },
  FlatList: "FlatList",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    View: "View",
  },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: number) => ({ value }),
  withSequence: (...values: unknown[]) => values[0],
  withTiming: (value: number) => value,
}));

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    textLight: "#ffffff",
  }),
}));

jest.mock("../../../styles/gameProgressStyles", () => ({
  createGameProgressStyles: () => mockStyles,
}));

jest.mock("../../../components/AppIcon", () => () => null);

const renderPlayersList = (disabled = false) => {
  const PlayersList =
    require("../../../components/gameProgress/PlayersList").default;

  return actCreate(
    React.createElement(PlayersList, {
      players: [
        { id: "p1", name: "Alice", drinksTaken: 1 },
        { id: "p2", name: "Bob", drinksTaken: 0 },
      ],
      matches: [
        {
          id: "m1",
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          homeGoals: 1,
          awayGoals: 0,
        },
      ],
      commonMatchId: "m1",
      playerAssignments: { p1: ["m1"], p2: ["m1"] },
      handleDrinkIncrement: mockDrinkIncrement,
      handleDrinkDecrement: mockDrinkDecrement,
      disabled,
    }),
  );
};

describe("PlayersList responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("keeps the single-column player list on phone-sized viewports", () => {
    const renderer = renderPlayersList();
    const list = renderer.root.findByType("FlatList");

    expect(list.props.numColumns).toBe(1);
    expect(list.props.contentContainerStyle).toEqual([
      mockStyles.listContainer,
      false,
    ]);
  });

  it("uses a two-column player layout on desktop-sized viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderPlayersList();
    const list = renderer.root.findByType("FlatList");

    expect(list.props.numColumns).toBe(2);
    expect(list.props.columnWrapperStyle).toEqual(mockStyles.playersListRow);
    expect(list.props.contentContainerStyle).toEqual([
      mockStyles.listContainer,
      mockStyles.playersListContentWide,
    ]);
  });

  it("disables drink handlers and animations when editing is unavailable", () => {
    const renderer = renderPlayersList(true);
    const list = renderer.root.findByType("FlatList");
    const card = actCreate(
      list.props.renderItem({
        item: { id: "p1", name: "Alice", drinksTaken: 1 },
      }),
    );
    const increment = card.root.findByProps({ testID: "DrinkIncrement-p1" });
    const decrement = card.root.findByProps({ testID: "DrinkDecrement-p1" });

    expect(increment.props.disabled).toBe(true);
    expect(decrement.props.disabled).toBe(true);
    TestRenderer.act(() => {
      increment.props.onPress();
      decrement.props.onPress();
    });
    expect(mockDrinkIncrement).not.toHaveBeenCalled();
    expect(mockDrinkDecrement).not.toHaveBeenCalled();
  });
});
