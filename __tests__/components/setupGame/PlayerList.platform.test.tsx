import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

class MockAnimatedValue {
  constructor(public value: number) {}
}

const mockUsePlayerSuggestions = jest.fn(() => ({
  playerSuggestions: [],
  hasHistory: false,
}));

const mockStyles = {
  tabContent: { testStyle: "tabContent" },
  sectionTitle: { testStyle: "sectionTitle" },
  playerCount: { testStyle: "playerCount" },
  inputRow: { testStyle: "inputRow" },
  playerInputRow: { testStyle: "playerInputRow" },
  playerInputContainer: { testStyle: "playerInputContainer" },
  playerInputContainerFocused: { testStyle: "playerInputContainerFocused" },
  playerInputStack: { testStyle: "playerInputStack" },
  playerInputStackActive: { testStyle: "playerInputStackActive" },
  playerInputIcon: { testStyle: "playerInputIcon" },
  playerTextInput: { testStyle: "playerTextInput" },
  playerAddButton: { testStyle: "playerAddButton" },
  playerAddButtonDisabled: { testStyle: "playerAddButtonDisabled" },
  playerItemContainer: { testStyle: "playerItemContainer" },
  playerItemWide: { testStyle: "playerItemWide", flex: 1 },
  playerItemEven: { testStyle: "playerItemEven" },
  playerItemOdd: { testStyle: "playerItemOdd" },
  playerAvatar: { testStyle: "playerAvatar" },
  playerAvatarText: { testStyle: "playerAvatarText" },
  playerNameText: { testStyle: "playerNameText" },
  playerRemoveButton: { testStyle: "playerRemoveButton" },
  playerEmptyListContainer: { testStyle: "playerEmptyListContainer" },
  emptyListTitleText: { testStyle: "emptyListTitleText" },
  emptyListSubtitleText: { testStyle: "emptyListSubtitleText" },
  playersListContent: { testStyle: "playersListContent" },
  playersListWideRow: {
    testStyle: "playersListWideRow",
    justifyContent: "space-between",
  },
  playerClearAllButton: { testStyle: "playerClearAllButton" },
  playerClearAllButtonText: { testStyle: "playerClearAllButtonText" },
};

jest.mock("react-native", () => ({
  Platform: { OS: "web", select: (o: Record<string, unknown>) => o.web ?? o.default },
  View: "View",
  Text: "Text",
  FlatList: "FlatList",
  TouchableOpacity: "TouchableOpacity",
  TextInput: "TextInput",
  Animated: {
    View: "View",
    Value: MockAnimatedValue,
    timing: () => ({ start: (callback?: () => void) => callback?.() }),
    parallel: () => ({ start: (callback?: () => void) => callback?.() }),
  },
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

jest.mock("../../../hooks/usePlayerSuggestions", () => ({
  usePlayerSuggestions: (searchQuery: string) =>
    mockUsePlayerSuggestions(searchQuery),
}));

jest.mock("../../../components/setupGame/PlayerSuggestionDropdown", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "PlayerSuggestionDropdown",
      ...props,
    });
});

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    textSecondary: "#333333",
    textPlaceholder: "#999999",
    white: "#ffffff",
    error: "#cc0000",
    neutralGray: "#999999",
  }),
}));

jest.mock("../../../styles/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

const renderPlayerList = () => {
  const PlayerList =
    require("../../../components/setupGame/PlayerList").default;

  return actCreate(
    React.createElement(PlayerList, {
      players: [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
      ],
      newPlayerName: "",
      setNewPlayerName: jest.fn(),
      handleAddPlayer: jest.fn(),
      handleAddPlayerByName: jest.fn(),
      handleRemovePlayer: jest.fn(),
    }),
  );
};

describe("PlayerList responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePlayerSuggestions.mockReturnValue({
      playerSuggestions: [],
      hasHistory: false,
    });
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("keeps the players list in one column on phone-sized viewports", () => {
    const renderer = renderPlayerList();
    const list = renderer.root.findByType("FlatList");

    expect(list.props.numColumns).toBe(1);
    expect(list.props.columnWrapperStyle).toBeUndefined();
  });

  it("switches the players list to two columns on desktop-sized viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderPlayerList();
    const list = renderer.root.findByType("FlatList");

    expect(list.props.numColumns).toBe(2);
    expect(list.props.columnWrapperStyle).toEqual(
      mockStyles.playersListWideRow,
    );
  });

  it("keeps recent player suggestions hidden on focus until the user types on phone-sized viewports", () => {
    mockUsePlayerSuggestions.mockReturnValue({
      playerSuggestions: [
        {
          name: "Charlie",
          gamesPlayed: 3,
          totalDrinks: 4,
          lastPlayed: "2026-05-01T19:00:00.000Z",
          averageDrinksPerGame: 1.5,
        },
      ],
      hasHistory: true,
    });

    const renderer = renderPlayerList();
    const input = renderer.root.findByType("TextInput");
    const dropdown = () =>
      renderer.root.findByProps({ testID: "PlayerSuggestionDropdown" });

    expect(dropdown().props.visible).toBe(false);

    TestRenderer.act(() => {
      input.props.onFocus();
    });

    expect(dropdown().props.visible).toBe(false);

    TestRenderer.act(() => {
      input.props.onChangeText("A");
    });

    expect(dropdown().props.visible).toBe(true);
  });
});
