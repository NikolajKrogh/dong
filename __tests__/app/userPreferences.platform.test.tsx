
import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../test-utils/render";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSignOut = jest.fn();
const mockUseAccountAuth = jest.fn();
const mockStore = {
  theme: "light",
  configuredLeagues: [{ code: "EPL", name: "Premier League" }],
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
}));

jest.mock("../../hooks/useAccountAuth", () => ({
  useAccountAuth: () => mockUseAccountAuth(),
  buildAccountAuthRoute: (route: string, returnTo: string) => `${route}?returnTo=${encodeURIComponent(returnTo)}`,
}));

jest.mock("../../store/store", () => ({
  useGameStore: (selector: (state: typeof mockStore) => unknown) => selector(mockStore),
}));

jest.mock("../../styles/theme", () => ({
  useColors: () => ({ primary: "#007AFF", textLight: "#fff" }),
}));

jest.mock("tamagui", () => {
  const ReactLocal = require("react");
  const RN = require("react-native");
  return {
    Text: ({ children, ...props }: any) => ReactLocal.createElement(RN.Text, props, children),
    XStack: ({ children, ...props }: any) => ReactLocal.createElement(RN.View, props, children),
    YStack: ({ children, ...props }: any) => ReactLocal.createElement(RN.View, props, children),
  };
});

jest.mock("../../components/preferences/SettingsPage", () => ({ title, children }: any) => {
  const ReactLocal = require("react");
  const RN = require("react-native");
  return ReactLocal.createElement(RN.View, null, ReactLocal.createElement(RN.Text, null, title), children);
});

jest.mock("../../components/preferences/SettingsMenuRow", () => ({ label, onPress }: any) => {
  const ReactLocal = require("react");
  const RN = require("react-native");
  return ReactLocal.createElement(RN.TouchableOpacity, { onPress, testID: `row-${label}` }, ReactLocal.createElement(RN.Text, null, label));
});

jest.mock("../../components/ui", () => ({
  ShellSection: ({ title, children }: any) => {
    const ReactLocal = require("react");
    const RN = require("react-native");
    return ReactLocal.createElement(RN.View, null, ReactLocal.createElement(RN.Text, null, title), children);
  },
  ShellCard: ({ children, ...props }: any) => {
    const ReactLocal = require("react");
    const RN = require("react-native");
    return ReactLocal.createElement(RN.View, props, children);
  },
  ShellActionButton: ({ label, onPress }: any) => {
    const ReactLocal = require("react");
    const RN = require("react-native");
    return ReactLocal.createElement(RN.TouchableOpacity, { onPress, testID: `action-${label}` }, ReactLocal.createElement(RN.Text, null, label));
  },
}));

jest.mock("../../components/OnboardingScreen", () => () => {
  const ReactLocal = require("react");
  const RN = require("react-native");
  return ReactLocal.createElement(RN.Text, null, "Onboarding");
});

function renderMenu() {
  const Screen = require("../../app/userPreferences").default;
  return actCreate(React.createElement(Screen));
}

function labels(tree: TestRenderer.ReactTestRenderer): string[] {
  const { Text } = require("react-native");
  return tree.root.findAllByType(Text).flatMap((node: any) => node.props.children).filter((value: unknown) => typeof value === "string");
}

function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  TestRenderer.act(() => tree.root.findByProps({ testID }).props.onPress());
}

function unmount(tree: TestRenderer.ReactTestRenderer) {
  TestRenderer.act(() => tree.unmount());
}

describe("Settings menu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.theme = "light";
    mockUseAccountAuth.mockReturnValue({ account: { username: "Captain" }, status: "ready", signOut: mockSignOut, sessionNotice: null });
  });

  it("shows a compact signed-in menu and routes each settings row", () => {
    const tree = renderMenu();
    const text = labels(tree);
    expect(text).toContain("Profile & username");
    expect(text).toContain("Appearance");
    expect(text).toContain("Sound & notifications");
    expect(text).toContain("Leagues");
    expect(text).not.toContain("History import");
    expect(text).not.toContain("Dark Mode");
    expect(text).not.toContain("Save username");

    for (const [label, route] of [
      ["Profile & username", "/userPreferences/profile"],
      ["Appearance", "/userPreferences/appearance"],
      ["Sound & notifications", "/userPreferences/sound"],
      ["Leagues", "/userPreferences/leagues"],

    ]) {
      press(tree, `row-${label}`);
      expect(mockPush).toHaveBeenLastCalledWith(route);
    }
    unmount(tree);
  });

  it("keeps sign-out and onboarding available", () => {
    const tree = renderMenu();
    press(tree, "action-Sign out");
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    press(tree, "action-View onboarding");
    expect(labels(tree)).toContain("Onboarding");
    unmount(tree);
  });

  it("shows sign-in and session recovery without profile or sign-out", () => {
    mockUseAccountAuth.mockReturnValue({ account: null, status: "signedOut", sessionNotice: "Your session ended.", signOut: mockSignOut });
    const tree = renderMenu();
    const text = labels(tree);
    expect(text).toContain("Your session ended.");
    expect(text).toContain("Sign in or create account");
    expect(text).not.toContain("Profile & username");
    expect(text).not.toContain("Sign out");
    press(tree, "action-Sign in or create account");
    expect(mockPush).toHaveBeenCalledWith("/auth?returnTo=%2FuserPreferences");
    unmount(tree);
  });

  it("routes unfinished account setup back to Settings", () => {
    mockUseAccountAuth.mockReturnValue({ account: { username: null }, status: "needsUsername", sessionNotice: null, signOut: mockSignOut });
    const tree = renderMenu();
    expect(labels(tree)).not.toContain("Profile & username");
    press(tree, "action-Finish account setup");
    expect(mockPush).toHaveBeenCalledWith("/auth/onboarding?returnTo=%2FuserPreferences");
    unmount(tree);
  });
});
