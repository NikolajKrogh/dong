import type { GuestRoomSession } from "../../types/guestRoom";
import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../test-utils/render";

jest.mock("expo-linking", () => ({ createURL: jest.fn() }));

const mockUseGuestRoomJoin = jest.fn(() => ({
  session: null as GuestRoomSession | null,
  error: null,
  isSubmitting: false,
  leaveRoom: jest.fn(),
  submitGuestJoin: jest.fn(),
}));

const mockUseAccountAuth = jest.fn(() => ({
  account: null as { id: string } | null,
}));

const mockRefreshHistory = jest.fn();
const mockPush = jest.fn();
const mockGetRoomSnapshot = jest.fn(() => Promise.resolve(null));
jest.mock("../../utils/supabaseClient", () => ({ getRoomRpcClient: () => ({ getRoomSnapshot: mockGetRoomSnapshot }) }));
const mockUseHistory = jest.fn();
jest.mock("../../features/history", () => ({
  useHistory: () => mockUseHistory(),
}));

const mockUseHostRoomCreate = jest.fn(() => ({
  isCreating: false,
  error: null as string | null,
  createRoom: jest.fn(),
}));

const mockUseMyActiveRoom = jest.fn(() => ({
  activeRoom: null as { sessionId: string; participantId: string; role: string; joinCode: string } | null,
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
  Link: ({ children, href }: { children: React.ReactElement; href: string }) =>
    require("react").cloneElement(children, { href, onPress: () => mockPush(href) }),
  useFocusEffect: (callback: () => void) => {
    require("react").useEffect(callback, [callback]);
  },
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockStoreState = {
  players: [] as any[],
  matches: [] as any[],
  history: [] as any[],
  activeGameContext: { mode: "solo", sessionId: null as string | null },
  resetState: jest.fn(),
};

jest.mock("../../store/store", () => ({
  useGameStore: Object.assign(() => mockStoreState, { getState: () => mockStoreState }),
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
  useSharedValue: (value: unknown) => ({
    value,
    get() { return this.value; },
    set(next: unknown) { this.value = next; },
  }),
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
  useSafeAreaInsets: () => ({ bottom: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue("true"),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../components/AppIcon", () => () => null);
jest.mock("tamagui", () => ({
  YStack: ({ children, ...props }: any) => require("react").createElement("View", props, children),
}));

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
    mockUseAccountAuth.mockReturnValue({ account: null });
    mockUseHostRoomCreate.mockReturnValue({ isCreating: false, error: null, createRoom: jest.fn() });
    mockUseMyActiveRoom.mockReturnValue({ activeRoom: null, isLoading: false, refresh: jest.fn() });
    mockStoreState.activeGameContext = { mode: "solo", sessionId: null };
    mockStoreState.players = [];
    mockStoreState.matches = [];
    mockStoreState.history = [];
    mockStoreState.resetState = jest.fn();
    mockRefreshHistory.mockClear();
    mockPush.mockClear();
    mockUseHistory.mockImplementation(() => ({
      history: mockStoreState.history,
      refresh: mockRefreshHistory,
      accountId: null,
    }));
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

  it.each([
    { name: "loaded cloud history", history: [{ id: "cloud-game", players: [], matches: [] }] },
    { name: "cloud history not loaded yet", history: [] },
  ])("opens History from Home with $name and no local games", ({ history }) => {
    mockUseHistory.mockReturnValue({ history, refresh: mockRefreshHistory, accountId: "host" });
    const HomeScreen = require("../../app/index").default;
    const renderer = actCreate(React.createElement(HomeScreen));
    expect(mockStoreState.history).toEqual([]);
    const card = renderer.root.findByProps({ testID: "home-history-stats-card" });
    expect(card.props.href).toBe("/history");
    TestRenderer.act(() => card.props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/history");
    expect(renderer.root.findAllByProps({ testID: "home-history-button" })).toHaveLength(0);
    expect(mockRefreshHistory).toHaveBeenCalled();
    TestRenderer.act(() => renderer.unmount());
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

  it("opens guest entry through the game choices", () => {
    const HomeScreen = require("../../app/index").default;

    const renderer = actCreate(React.createElement(HomeScreen));
    TestRenderer.act(() => renderer.root.findByProps({ testID: "home-start-game-button" }).props.onPress());
    const guestJoinButton = renderer.root.findByProps({ testID: "home-join-room-button" });

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

  it("uses the current-game card for an active guest room", () => {
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
          assignmentMode: "automatic", picks: [],
          assignmentPlan: { participantCount: 0, poolSize: 0, matchesPerPlayer: 0, sharedMatchesPerPair: 0, effectivePerPlayer: 0, requiredPoolSize: 0, relaxedFloor: 0, feasible: true, startable: false },
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

    expect(textContents).toContain("Continue Game");
    expect(textContents).toContain("Leave Room");
    TestRenderer.act(() => renderer.root.findByProps({ testID: "home-cancel-game" }).props.onPress());
    const confirmation = renderer.root.findByType(require("../../components/home/CancelGameModal").CancelGameModal);
    expect(confirmation.props).toMatchObject({ visible: true, title: "Leave Room" });
    TestRenderer.act(() => confirmation.props.onConfirm());
    expect(mockUseGuestRoomJoin.mock.results.at(-1)?.value.leaveRoom).toHaveBeenCalled();
    expect(mockStoreState.resetState).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({ testID: "home-start-game-button" })).toHaveLength(0);

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
    TestRenderer.act(() => renderer.root.findByProps({ testID: "home-cancel-game" }).props.onPress());
    const confirmation = renderer.root.findByType(require("../../components/home/CancelGameModal").CancelGameModal);
    TestRenderer.act(() => confirmation.props.onConfirm());
    expect(mockStoreState.resetState).toHaveBeenCalledTimes(1);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("routes local play and signed-out hosting from the choices", () => {
    const renderer = actCreate(React.createElement(require("../../app/index").default));
    TestRenderer.act(() => renderer.root.findByProps({ testID: "home-start-game-button" }).props.onPress());
    TestRenderer.act(() => renderer.root.findByProps({ testID: "home-play-local" }).props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith("/setupGame");
    TestRenderer.act(() => renderer.root.findByProps({ testID: "home-start-game-button" }).props.onPress());
    TestRenderer.act(() => renderer.root.findByProps({ testID: "home-create-room-button" }).props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith("/auth?returnTo=%2F");
    TestRenderer.act(() => renderer.unmount());
  });

  it("opens registered joining and keeps room-creation errors in the choices until a successful retry", async () => {
    mockUseAccountAuth.mockReturnValue({ account: { id: "account" } });
    const createRoom = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockUseHostRoomCreate.mockReturnValue({ isCreating: false, error: "Failed to create room.", createRoom });
    const renderer = actCreate(React.createElement(require("../../app/index").default));
    TestRenderer.act(() => renderer.root.findByProps({ testID: "home-start-game-button" }).props.onPress());
    TestRenderer.act(() => renderer.root.findByProps({ testID: "home-join-registered-button" }).props.onPress());
    expect(renderer.root.findByType(require("../../components/home/JoinRoomModal").JoinRoomModal).props.visible).toBe(true);
    TestRenderer.act(() => renderer.root.findByProps({ testID: "home-start-game-button" }).props.onPress());
    await TestRenderer.act(async () => renderer.root.findByProps({ testID: "home-create-room-button" }).props.onPress());
    const sheet = () => renderer.root.findByType(require("../../components/home/StartGameSheet").StartGameSheet);
    expect(sheet().props).toMatchObject({ visible: true, error: "Failed to create room." });
    await TestRenderer.act(async () => renderer.root.findByProps({ testID: "home-create-room-button" }).props.onPress());
    expect(sheet().props.visible).toBe(false);
    TestRenderer.act(() => renderer.unmount());
  });

  it.each(["owner", "member"])("uses authoritative room counts and the safe %s exit instead of resetting locally", async role => {
    mockUseAccountAuth.mockReturnValue({ account: { id: "account" } });
    mockUseMyActiveRoom.mockReturnValue({
      activeRoom: { sessionId: "room", participantId: "viewer", role, joinCode: "123456" },
      isLoading: false, refresh: jest.fn(),
    });
    mockGetRoomSnapshot.mockResolvedValue({ state: "in_progress", matches: [{ id: "match" }], participants: [{ id: "viewer" }, { id: "other" }] } as never);
    let renderer!: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => { renderer = TestRenderer.create(React.createElement(require("../../app/index").default)); });
    const card = renderer.root.findByType(require("../../components/home/CurrentGameCard").CurrentGameCard);
    expect(card.props.playersCount).toBe(2);
    expect(card.props.matchesCount).toBe(1);
    expect(renderer.root.findAllByProps({ testID: "home-start-game-button" })).toHaveLength(0);
    TestRenderer.act(() => renderer.root.findByProps({ testID: "home-cancel-game" }).props.onPress());
    expect(renderer.root.findByType(require("../../components/home/JoinRoomModal").JoinRoomModal).props).toMatchObject({ visible: true, leaveOnly: true });
    expect(mockStoreState.resetState).not.toHaveBeenCalled();
    TestRenderer.act(() => renderer.unmount());
  });

  it.each([
    { viewport: "phone", width: 390, height: 844, centerContent: false, contentMaxWidth: undefined },
    { viewport: "desktop", width: 1280, height: 900, centerContent: true, contentMaxWidth: 960 },
  ])("configures the shell for a $viewport viewport", ({ width, height, centerContent, contentMaxWidth }) => {
    mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
    const renderer = actCreate(React.createElement(require("../../app/index").default));
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(centerContent);
    expect(shell.props.contentMaxWidth).toBe(contentMaxWidth);

  });
});


it("keeps Home free of separate Friends and room buttons", () => {
  const renderer = actCreate(React.createElement(require("../../app/index").default));
  expect(renderer.root.findAllByProps({ testID: "home-friends-button" })).toHaveLength(0);
  expect(renderer.root.findAllByProps({ testID: "home-return-to-room" })).toHaveLength(0);
  expect(renderer.root.findByProps({ testID: "home-history-stats-card" }).props.href).toBe("/history");
  TestRenderer.act(() => renderer.unmount());
});
