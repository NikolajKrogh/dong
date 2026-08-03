import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../test-utils/render";

const mockUseGuestRoomJoin = jest.fn(() => ({
  session: null,
  error: null,
  isSubmitting: false,
  leaveRoom: jest.fn(),
  submitGuestJoin: jest.fn(),
}));

const mockUseAccountAuth = jest.fn(() => ({
  account: null as { id: string } | null,
}));

const mockUseHostRoomCreate = jest.fn(() => ({
  isCreating: false,
  error: null as string | null,
  createRoom: jest.fn(),
}));

const mockUseMyActiveRoom = jest.fn(() => ({
  activeRoom: null as { sessionId: string } | null,
  isLoading: false,
  refresh: jest.fn(),
}));

const mockUseRegisteredRoomJoin = jest.fn(() => ({
  isJoining: false,
  error: null as string | null,
  conflictRoom: null,
  joinRoom: jest.fn(),
  clearConflict: jest.fn(),
}));

const mockUseRoomExit = jest.fn(() => ({
  isExiting: false,
  error: null as string | null,
  pendingSuccessorChoice: false,
  eligibleSuccessors: [],
  needsCloseConfirm: false,
  exitRoom: jest.fn(),
  confirmSuccessor: jest.fn(),
  confirmClose: jest.fn(),
  cancel: jest.fn(),
}));

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

jest.mock("react-native", () => {
  return {
    Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
    ActivityIndicator: "ActivityIndicator",
    View: "View",
    Text: "Text",
    Pressable: "Pressable",
    TouchableOpacity: "TouchableOpacity",
    Modal: "Modal",
    Image: "Image",
    ScrollView: "ScrollView",
    TextInput: "TextInput",
    useWindowDimensions: () => mockUseWindowDimensions(),
  };
});

const mockPlatformAnimation = jest.fn(() => null);

jest.mock("../../platform", () => ({
  PlatformAnimation: mockPlatformAnimation,
}));

jest.mock("../../hooks/useGuestRoomJoin", () => ({
  useGuestRoomJoin: () => mockUseGuestRoomJoin(),
}));

jest.mock("../../hooks/useAccountAuth", () => ({
  useAccountAuth: () => mockUseAccountAuth(),
}));

jest.mock("../../hooks/useHostRoomCreate", () => ({
  useHostRoomCreate: () => mockUseHostRoomCreate(),
}));

jest.mock("../../hooks/useMyActiveRoom", () => ({
  useMyActiveRoom: () => mockUseMyActiveRoom(),
}));

jest.mock("../../hooks/useRegisteredRoomJoin", () => ({
  useRegisteredRoomJoin: () => mockUseRegisteredRoomJoin(),
}));

jest.mock("../../hooks/useRoomExit", () => ({
  useRoomExit: () => mockUseRoomExit(),
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

jest.mock("../../styles/theme", () => ({
  useColors: () => ({
    background: "#f5f5f5",
    white: "#ffffff",
    primary: "#007AFF",
  }),
}));

jest.mock("../../styles/indexStyles", () => ({
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

jest.mock("../../components/guestJoin/GuestJoinModal", () => ({
  GuestJoinModal: ({ visible, session }: any) => {
    const RN = require("react-native");
    const R = require("react");

    if (!visible) {
      return null;
    }

    const modalStateText = session ? "guest-modal-session" : "guest-modal-form";

    return visible
      ? R.createElement(
          RN.View,
          { testID: "GuestJoinModal" },
          R.createElement(RN.Text, null, modalStateText),
        )
      : null;
  },
}));

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
      RN.Pressable,
      { testID: "ShellActionButton", ...props },
      label ? R.createElement(RN.Text, null, label) : null,
    );
  },
}));

describe("HomeScreen platform adoption", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseGuestRoomJoin.mockReset();
    mockUseGuestRoomJoin.mockReturnValue({
      session: null,
      error: null,
      isSubmitting: false,
      leaveRoom: jest.fn(),
      submitGuestJoin: jest.fn(),
    });
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

    const renderer = actCreate(React.createElement(HomeScreen));

    // Splash is showing first — animation adapter used before ShellScreen.
    // The mocked reanimated withTiming() resolves synchronously, so by the
    // time the initial act() settles, the splash's completion effect has
    // already run and swapped in ShellScreen — this call capture is what's
    // left to verify the splash render happened at all.
    expect(mockPlatformAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "splash" }),
      undefined,
    );

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("shows ShellActionButton for Start New Game when no game in progress", () => {
    const HomeScreen = require("../../app/index").default;

    const renderer = actCreate(React.createElement(HomeScreen));

    const buttons = renderer.root.findAllByProps({
      testID: "home-start-game-button",
    });
    // Check for "Start New Game" label via the nested text element
    const allText = renderer.root.findAllByType("Text" as any);
    const textContents = allText.flatMap((t: any) => t.props.children);
    expect(textContents).toContain("Start New Game");
    expect(buttons.length).toBeGreaterThan(0);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("opens the guest modal from the home CTA", () => {
    const HomeScreen = require("../../app/index").default;

    const renderer = actCreate(React.createElement(HomeScreen));
    const guestJoinButton = renderer.root.findByProps({
      testID: "home-join-room-button",
    });

    TestRenderer.act(() => {
      guestJoinButton.props.onPress();
    });

    const modal = renderer.root.findByProps({ testID: "GuestJoinModal" });
    const { Text } = require("react-native");
    const textNodes = modal.findAllByType(Text);
    const renderedText = textNodes
      .flatMap((node: any) => node.props.children)
      .join("");

    expect(renderedText).toContain("guest-modal-form");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("updates the guest CTA label when a guest room is already active", () => {
    mockUseGuestRoomJoin.mockReturnValue({
      session: {
        grant: {
          guestToken: "guest-token-1",
          participantId: "guest-1",
          sessionId: "session-1",
          joinCode: "ROOM42",
          displayName: "Casey",
        },
        snapshot: {
          sessionId: "session-1",
          joinCode: "ROOM42",
          state: "joinable",
          commonMatchId: "match-1",
          participants: [],
          matches: [],
          assignments: [],
        },
      },
      error: null,
      isSubmitting: false,
      leaveRoom: jest.fn(),
      submitGuestJoin: jest.fn(),
    });

    const HomeScreen = require("../../app/index").default;
    const renderer = actCreate(React.createElement(HomeScreen));
    const { Text } = require("react-native");
    const allText = renderer.root.findAllByType(Text);
    const textContents = allText.flatMap((node: any) => node.props.children);

    expect(textContents).toContain("Return to Guest Room");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("shows ShellCard for current game when game is in progress", () => {
    mockStoreState.players = [{ name: "Alice" }, { name: "Bob" }];
    mockStoreState.matches = [{ id: 1 }] as any[];

    const HomeScreen = require("../../app/index").default;

    const renderer = actCreate(React.createElement(HomeScreen));

    const cards = renderer.root.findAllByProps({
      testID: "home-current-game-card",
    });
    expect(cards.length).toBeGreaterThan(0);

    // Find all text nodes to verify button labels
    const { Text } = require("react-native");
    const allText = renderer.root.findAllByType(Text);
    const textContents = allText.flatMap((t: any) => t.props.children);
    expect(textContents).toContain("Continue Game");
    expect(textContents).toContain("Cancel Game");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("keeps the home shell unconstrained on phone-sized viewports", () => {
    const HomeScreen = require("../../app/index").default;

    const renderer = actCreate(React.createElement(HomeScreen));
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(false);
    expect(shell.props.contentMaxWidth).toBeUndefined();

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("centers the home shell on desktop-wide viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const HomeScreen = require("../../app/index").default;

    const renderer = actCreate(React.createElement(HomeScreen));
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(true);
    expect(shell.props.contentMaxWidth).toBe(960);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
