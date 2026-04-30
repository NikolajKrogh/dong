import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

class MockAnimatedValue {
  constructor(public value: number) {}
}

const mockStyles = {
  tabContent: { testStyle: "tabContent" },
  sectionTitle: { testStyle: "sectionTitle" },
  playerCount: { testStyle: "playerCount" },
  inputRow: { testStyle: "inputRow" },
  playerInputContainer: { testStyle: "playerInputContainer" },
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
  usePlayerSuggestions: () => ({
    playerSuggestions: [],
    hasHistory: false,
  }),
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

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    textSecondary: "#333333",
    textPlaceholder: "#999999",
    white: "#ffffff",
    error: "#cc0000",
    neutralGray: "#999999",
  }),
}));

jest.mock("../../../app/style/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

const renderPlayerList = () => {
  const PlayerList =
    require("../../../components/setupGame/PlayerList").default;

  return TestRenderer.create(
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
});
