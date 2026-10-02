
import React from "react";
import TestRenderer from "react-test-renderer";
import { Alert } from "react-native";
import { actCreate } from "../../test-utils/render";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDeleteAccount = jest.fn();
const mockUseAccountAuth = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("../../hooks/useAccountAuth", () => ({
  useAccountAuth: () => mockUseAccountAuth(),
  buildAccountAuthRoute: (route: string, returnTo: string) => `${route}?returnTo=${encodeURIComponent(returnTo)}`,
}));

jest.mock("../../styles/theme", () => ({ useColors: () => ({ primary: "#007AFF", textLight: "#fff" }) }));

jest.mock("tamagui", () => {
  const R = require("react");
  const RN = require("react-native");
  return {
    Text: ({ children, ...props }: any) => R.createElement(RN.Text, props, children),
    XStack: ({ children, ...props }: any) => R.createElement(RN.View, props, children),
    YStack: ({ children, ...props }: any) => R.createElement(RN.View, props, children),
  };
});

jest.mock("../../components/preferences/SettingsPage", () => ({ title, children }: any) => {
  const R = require("react");
  const RN = require("react-native");
  return R.createElement(RN.View, null, R.createElement(RN.Text, null, title), children);
});

jest.mock("../../components/preferences/ProfileSection", () => () => {
  const R = require("react");
  const RN = require("react-native");
  return R.createElement(RN.Text, null, "Display name form");
});

jest.mock("../../components/preferences/SettingsMenuRow", () => ({ label, onPress }: any) => {
  const R = require("react");
  const RN = require("react-native");
  return R.createElement(RN.TouchableOpacity, { testID: `row-${label}`, onPress }, R.createElement(RN.Text, null, label));
});

jest.mock("../../components/ui", () => ({
  ShellSection: ({ title, children }: any) => {
    const R = require("react");
    const RN = require("react-native");
    return R.createElement(RN.View, null, R.createElement(RN.Text, null, title), children);
  },
  ShellCard: ({ children }: any) => {
    const R = require("react");
    const RN = require("react-native");
    return R.createElement(RN.View, null, children);
  },
}));

function renderProfile() {
  const Screen = require("../../app/userPreferences/profile").default;
  return actCreate(React.createElement(Screen));
}

function textOf(tree: TestRenderer.ReactTestRenderer): string[] {
  const { Text } = require("react-native");
  return tree.root.findAllByType(Text).flatMap((node: any) => node.props.children).filter((value: unknown) => typeof value === "string");
}

describe("Profile settings route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAccountAuth.mockReturnValue({ account: { username: "Captain" }, status: "ready", deleteAccount: mockDeleteAccount });
  });

  it("shows profile editing and returns password changes to Profile", () => {
    const tree = renderProfile();
    expect(textOf(tree)).toContain("Captain");
    expect(textOf(tree)).toContain("Display name form");
    TestRenderer.act(() => tree.root.findByProps({ testID: "row-Change password" }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/auth/change-password?returnTo=%2FuserPreferences%2Fprofile");
    TestRenderer.act(() => tree.unmount());
  });

  it("requires confirmation before deleting an account", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const tree = renderProfile();
    TestRenderer.act(() => tree.root.findByProps({ testID: "row-Delete account" }).props.onPress());
    expect(mockDeleteAccount).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "Delete account",
      expect.stringContaining("permanently deletes"),
      expect.arrayContaining([expect.objectContaining({ text: "Cancel" }), expect.objectContaining({ text: "Delete", style: "destructive" })]),
    );
    TestRenderer.act(() => tree.unmount());
    alertSpy.mockRestore();
  });

  it("returns signed-out visitors to the Settings entry", () => {
    mockUseAccountAuth.mockReturnValue({ account: null, status: "signedOut", deleteAccount: mockDeleteAccount });
    const tree = renderProfile();
    expect(mockReplace).toHaveBeenCalledWith("/userPreferences");
    expect(textOf(tree)).not.toContain("Display name form");
    TestRenderer.act(() => tree.unmount());
  });

  it("keeps unfinished account setup out of Profile", () => {
    mockUseAccountAuth.mockReturnValue({ account: { username: null }, status: "needsUsername", deleteAccount: mockDeleteAccount });
    const tree = renderProfile();
    expect(mockReplace).toHaveBeenCalledWith("/userPreferences");
    expect(textOf(tree)).not.toContain("Display name form");
    TestRenderer.act(() => tree.unmount());
  });
});
