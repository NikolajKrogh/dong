import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

jest.mock("react-native", () => {
  return {
    View: "View",
    Text: "Text",
    TouchableOpacity: "TouchableOpacity",
    Modal: "Modal",
    Image: "Image",
    ScrollView: "ScrollView",
    useWindowDimensions: () => mockUseWindowDimensions(),
  };
});

const mockPlatformAnimation = jest.fn(() => null);

jest.mock("../../platform", () => ({
  PlatformAnimation: mockPlatformAnimation,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const mockStoreState = {
  players: [] as any[],
  matches: [] as any[],
  history: [] as any[],
  resetState: jest.fn(),
};

jest.mock("../../store/store", () => ({
  useGameStore: () => mockStoreState,
}));

jest.mock("../../app/style/theme", () => ({
  useColors: () => ({
    background: "#f5f5f5",
    white: "#ffffff",
    primary: "#007AFF",
  }),
}));

jest.mock("../../app/style/indexStyles", () => ({
  __esModule: true,
  default: () => ({
    splashContainer: {},
    splashAnimation: {},
    safeArea: { backgroundColor: "#ffffff" },
    scrollContainer: {},
    headerContainer: {},
    logo: {},
    userPreferencesButton: {},
  }),
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    View: "View",
  },
  Easing: {
    out: jest.fn((value) => value),
    quad: "quad",
  },
  runOnJS: (callback: (...args: any[]) => unknown) => callback,
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: unknown) => ({ value }),
  withDelay: (_delay: number, value: unknown) => value,
  withTiming: (
    value: unknown,
    _config: unknown,
    callback?: (finished: boolean) => void,
  ) => {
    callback?.(true);
    return value;
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue("true"),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../components/AppIcon", () => () => null);

jest.mock("../../components/OnboardingScreen", () => {
  const RN = require("react-native");
  const R = require("react");
  return ({ onFinish }: { onFinish: () => void }) =>
    R.createElement(
      RN.View,
      { testID: "onboarding" },
      R.createElement(RN.Text, null, "Onboarding"),
    );
});

jest.mock("../../components/ui", () => ({
  ShellScreen: ({ children, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");
    return R.createElement(
      RN.View,
      { testID: "ShellScreen", ...props },
      children,
    );
  },
  ShellCard: ({ children, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");
    return R.createElement(
      RN.View,
      { testID: "ShellCard", ...props },
      children,
    );
  },
  ShellSection: ({ children, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");
    return R.createElement(
      RN.View,
      { testID: "ShellSection", ...props },
      children,
    );
  },
  ShellActionButton: ({ label, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");
    return R.createElement(
      RN.View,
      { testID: "ShellActionButton", ...props },
      label ? R.createElement(RN.Text, null, label) : null,
    );
  },
}));

describe("HomeScreen platform adoption", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
    mockPlatformAnimation.mockClear();
    mockStoreState.players = [];
    mockStoreState.matches = [];
    mockStoreState.history = [];
    mockStoreState.resetState = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // This MUST be the first test — hasSplashBeenShown is a module-level singleton
  it("shows splash with animation adapter instead of ShellScreen on first render", () => {
    const HomeScreen = require("../../app/index").default;

    const renderer = TestRenderer.create(React.createElement(HomeScreen));

    // Splash is showing — animation adapter used
    expect(mockPlatformAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "splash" }),
      {},
    );
    // No ShellScreen during splash
    const shellScreens = renderer.root.findAllByProps({
      testID: "ShellScreen",
    });
    expect(shellScreens).toHaveLength(0);

    TestRenderer.act(() => {
      jest.runOnlyPendingTimers();
    });

    renderer.unmount();
  });

  it("shows ShellActionButton for Start New Game when no game in progress", () => {
    const HomeScreen = require("../../app/index").default;

    const renderer = TestRenderer.create(React.createElement(HomeScreen));

    const buttons = renderer.root.findAllByProps({
      testID: "home-start-game-button",
    });
    // Check for "Start New Game" label via the nested text element
    const allText = renderer.root.findAllByType("Text" as any);
    const textContents = allText.map((t: any) => t.props.children).flat();
    expect(textContents).toContain("Start New Game");
    expect(buttons.length).toBeGreaterThan(0);

    renderer.unmount();
  });

  it("shows ShellCard for current game when game is in progress", () => {
    mockStoreState.players = [{ name: "Alice" }, { name: "Bob" }];
    mockStoreState.matches = [{ id: 1 }] as any[];

    const HomeScreen = require("../../app/index").default;

    const renderer = TestRenderer.create(React.createElement(HomeScreen));

    const cards = renderer.root.findAllByProps({
      testID: "home-current-game-card",
    });
    expect(cards.length).toBeGreaterThan(0);

    // Find all text nodes to verify button labels
    const { Text } = require("react-native");
    const allText = renderer.root.findAllByType(Text);
    const textContents = allText.map((t: any) => t.props.children).flat();
    expect(textContents).toContain("Continue Game");
    expect(textContents).toContain("Cancel Game");

    renderer.unmount();
  });

  it("keeps the home shell unconstrained on phone-sized viewports", () => {
    const HomeScreen = require("../../app/index").default;

    const renderer = TestRenderer.create(React.createElement(HomeScreen));
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(false);
    expect(shell.props.contentMaxWidth).toBeUndefined();

    renderer.unmount();
  });

  it("centers the home shell on desktop-wide viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const HomeScreen = require("../../app/index").default;

    const renderer = TestRenderer.create(React.createElement(HomeScreen));
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(true);
    expect(shell.props.contentMaxWidth).toBe(960);

    renderer.unmount();
  });
});
