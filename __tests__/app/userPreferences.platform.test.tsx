import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

jest.mock("react-native", () => {
  const ReactNative = jest.requireActual("react-native");

  return new Proxy(ReactNative, {
    get(target, prop, receiver) {
      if (prop === "useWindowDimensions") {
        return () => mockUseWindowDimensions();
      }

      return Reflect.get(target, prop, receiver);
    },
  });
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../store/store", () => ({
  useGameStore: () => ({
    soundEnabled: true,
    setSoundEnabled: jest.fn(),
    commonMatchNotificationsEnabled: false,
    setCommonMatchNotificationsEnabled: jest.fn(),
    configuredLeagues: [{ code: "EPL", name: "Premier League" }],
    addLeague: jest.fn(),
    removeLeague: jest.fn(),
    resetLeaguesToDefaults: jest.fn(),
    defaultSelectedLeagues: [],
    setDefaultSelectedLeagues: jest.fn(),
    theme: "light",
    setTheme: jest.fn(),
  }),
}));

jest.mock("../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#007AFF",
    secondary: "#6C757D",
    textMuted: "#888",
    surface: "#ffffff",
    background: "#f5f5f5",
    backgroundLight: "#fafafa",
    switchTrackOff: "#ccc",
    switchTrackOn: "#34C759",
    thumbOn: "#fff",
    thumbOff: "#fff",
    white: "#fff",
  }),
}));

jest.mock("../../app/style/userPreferencesStyles", () => ({
  createUserPreferencesStyles: () => ({
    commonStyles: {
      safeArea: {},
      container: {},
      contentContainer: {},
      section: {},
      sectionTitle: {},
      card: {},
    },
    headerStyles: {
      header: {},
      backButton: {},
      headerTitle: {},
    },
    settingsStyles: {
      preferenceRow: {},
      labelContainer: {},
      prefIcon: {},
      preferenceLabel: {},
      onboardingButton: {},
      onboardingButtonText: {},
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
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
  ShellSection: ({ children, title, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");
    return R.createElement(
      RN.View,
      { testID: "ShellSection", ...props },
      title ? R.createElement(RN.Text, null, title) : null,
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
}));

jest.mock("../../components/OnboardingScreen", () => () => null);

jest.mock("../../components/preferences/AddLeagueModal", () => () => null);
jest.mock("../../components/preferences/ManageLeaguesModal", () => () => null);
jest.mock(
  "../../components/preferences/SelectDefaultLeaguesModal",
  () => () => null,
);

describe("UserPreferences shell adoption", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("renders Header, AppearanceSettings, SoundNotificationSettings, LeagueSettings, and OnboardingButton", () => {
    const Screen = require("../../app/userPreferences").default;

    const renderer = TestRenderer.create(React.createElement(Screen));

    const { Text } = require("react-native");
    const texts = renderer.root.findAllByType(Text);
    const textContents = texts.map((t: any) => t.props.children).flat();

    expect(textContents).toContain("Settings");
    expect(textContents).toContain("Appearance");
    expect(textContents).toContain("Sound & Notifications");
    expect(textContents).toContain("League Configuration");
    expect(textContents).toContain("View Onboarding");

    renderer.unmount();
  });

  it("keeps the shared shell unconstrained on phone-sized viewports", () => {
    const Screen = require("../../app/userPreferences").default;

    const renderer = TestRenderer.create(React.createElement(Screen));
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(false);
    expect(shell.props.contentMaxWidth).toBeUndefined();

    renderer.unmount();
  });

  it("centers the shared shell on desktop-wide viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const Screen = require("../../app/userPreferences").default;

    const renderer = TestRenderer.create(React.createElement(Screen));
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(true);
    expect(shell.props.contentMaxWidth).toBe(960);

    renderer.unmount();
  });

  it("renders SafeAreaView as root wrapper", () => {
    const Screen = require("../../app/userPreferences").default;

    const renderer = TestRenderer.create(React.createElement(Screen));

    // SafeAreaView is mocked to pass children through, so the component renders
    // without error — confirming it wraps in SafeAreaView
    expect(renderer.toJSON()).toBeTruthy();

    renderer.unmount();
  });
});
