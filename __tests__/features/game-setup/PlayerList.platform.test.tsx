import type { PlayerSuggestion } from "../../../features/game-setup/usePlayerSuggestions";
import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

let mockReducedMotion = false;
const mockTiming = jest.fn(() => ({ start: (callback?: () => void) => callback?.() }));
jest.mock("../../../platform/animation/useReducedMotion", () => ({ useReducedMotion: () => mockReducedMotion }));

class MockAnimatedValue {
  constructor(public value: number) {}
}

const mockUsePlayerSuggestions = jest.fn(() => ({
  playerSuggestions: [] as PlayerSuggestion[],
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
    timing: (...args: any[]) => (mockTiming as any)(...args),
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

jest.mock("../../../features/game-setup/usePlayerSuggestions", () => ({
  usePlayerSuggestions: (searchQuery: string) =>
    mockUsePlayerSuggestions(),
}));

jest.mock("../../../features/game-setup/PlayerSuggestionDropdown", () => {
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

jest.mock("../../../features/game-setup/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

const renderPlayerList = (handleRemovePlayer = jest.fn()) => {
  const PlayerList =
    require("../../../features/game-setup/PlayerList").default;

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
      handleRemovePlayer,
    }),
  );
};

describe("PlayerList responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReducedMotion = false;
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

  it.each([
    { viewport: "phone", width: 390, height: 844, columns: 1, rowStyle: undefined },
    { viewport: "desktop", width: 1280, height: 900, columns: 2, rowStyle: mockStyles.playersListWideRow },
  ])("lays out players for a $viewport viewport", ({ width, height, columns, rowStyle }) => {
    mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
    const renderer = renderPlayerList();
    const list = renderer.root.find((node) => String(node.type) === "FlatList");

    expect(list.props.numColumns).toBe(columns);
    expect(list.props.columnWrapperStyle).toEqual(rowStyle);
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
    const input = renderer.root.find((node) => String(node.type) === "TextInput");
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


it('names player input and each removal action with its target', () => {
  const renderer = renderPlayerList();
  const list = renderer.root.find((node) => String(node.type) === 'FlatList');
  const item = list.props.renderItem({ item: { id: 'p1', name: 'Alice' }, index: 0 });
  const row = actCreate(item);
  const remove = row.root.find((node) => String(node.type) === 'TouchableOpacity');
  expect(remove.props.accessibilityRole).toBe('button');
  expect(remove.props.accessibilityLabel).toBe('Remove Alice');
  expect(renderer.root.find((node) => String(node.type) === 'TextInput').props.accessibilityLabel).toBe('Player name');
  TestRenderer.act(() => { row.unmount(); renderer.unmount(); });
});

it.each([false, true])("uses the reduced-motion policy for individual and bulk player removal (%s)", (reduced) => {
  mockReducedMotion = reduced;
  mockTiming.mockClear();
  const removePlayer = jest.fn();
  const tree = renderPlayerList(removePlayer);
  const list = tree.root.find(node => String(node.type) === "FlatList");
  const row = actCreate(list.props.renderItem({ item: { id: "p1", name: "Alice" }, index: 0 }));
  TestRenderer.act(() => row.root.findByProps({ accessibilityLabel: "Remove Alice" }).props.onPress());
  expect(removePlayer).toHaveBeenCalledWith("p1");
  TestRenderer.act(() => tree.root.findByProps({ accessibilityLabel: "Clear all players" }).props.onPress());
  expect(removePlayer).toHaveBeenCalledWith("p2");
  expect(mockTiming.mock.calls.length).toBeGreaterThan(1);
  for (const call of mockTiming.mock.calls as unknown as [unknown, { duration: number }][]) {
    expect(call[1].duration).toBe(reduced ? 0 : 300);
  }
  TestRenderer.act(() => { row.unmount(); tree.unmount(); });
});

it('allows web touch gestures through the unbounded player list while retaining native scroll policy', () => {
  const { Platform } = require('react-native');
  const previous = Platform.OS;
  try {
    for (const platform of ['web', 'android']) {
      Platform.OS = platform;
      const renderer = renderPlayerList();
      const list = renderer.root.findByProps({ testID: 'SetupPlayersList' });
      expect(list.props.scrollEnabled).toBe(platform === 'web');
      TestRenderer.act(() => renderer.unmount());
    }
  } finally { Platform.OS = previous; }
});
