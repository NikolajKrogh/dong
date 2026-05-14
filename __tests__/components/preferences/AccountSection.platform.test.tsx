import React from "react";
import TestRenderer from "react-test-renderer";

import AccountSection from "../../../components/preferences/AccountSection";
import { useAccountAuth } from "../../../hooks/useAccountAuth";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/userPreferences",
}));

jest.mock("../../../hooks/useAccountAuth", () => {
  const actual = jest.requireActual("../../../hooks/useAccountAuth");

  return {
    ...actual,
    useAccountAuth: jest.fn(),
  };
});

const mockUseAccountAuth = jest.mocked(useAccountAuth);

jest.mock("tamagui", () => {
  const RN = require("react-native");
  const ReactLocal = require("react");
  return {
    Text: ({ children, onPress, testID }: any) =>
      ReactLocal.createElement(RN.Text, { onPress, testID }, children),
    XStack: ({ children, onPress, testID }: any) =>
      ReactLocal.createElement(RN.View, { onPress, testID }, children),
    YStack: ({ children, onPress, testID }: any) =>
      ReactLocal.createElement(RN.View, { testID }, children),
    styled: (_Comp: any, _styles: any) => {
      const Wrapped = ({ children, onPress, testID }: any) =>
        ReactLocal.createElement(RN.View, { onPress, testID }, children);
      return Wrapped;
    },
  };
});

jest.mock("../../../components/ui", () => ({
  ShellSection: ({ children, title }: any) => {
    const RN = require("react-native");
    const ReactLocal = require("react");

    return ReactLocal.createElement(
      RN.View,
      { testID: "ShellSection" },
      title ? ReactLocal.createElement(RN.Text, null, title) : null,
      children,
    );
  },
  ShellCard: ({ children, ...props }: any) => {
    const RN = require("react-native");
    const ReactLocal = require("react");

    return ReactLocal.createElement(
      RN.View,
      { testID: "ShellCard", ...props },
      children,
    );
  },
  ShellActionButton: ({ label, ...props }: any) => {
    const RN = require("react-native");
    const ReactLocal = require("react");

    return ReactLocal.createElement(
      RN.View,
      { testID: "ShellActionButton", label, ...props },
      label ? ReactLocal.createElement(RN.Text, null, label) : null,
    );
  },
}));

describe("AccountSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const findButtonByLabel = (tree: TestRenderer.ReactTestRenderer, label: string) => {
    const { Text } = require("react-native");

    return tree.root
      .findAllByProps({ testID: "ShellActionButton" })
      .find((button) =>
        button.findAllByType(Text).some((text) => text.props.children === label),
      );
  };

  it("shows a sign-in entry point when no account is active", () => {
    mockUseAccountAuth.mockReturnValue({
      account: null,
      changePassword: jest.fn(),
      deleteAccount: jest.fn(),
      requestPasswordReset: jest.fn(),
      saveDisplayName: jest.fn(),
      session: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      verifySignupOtp: jest.fn(),
      status: "signedOut",
      user: null,
    } as never);

    const tree = TestRenderer.create(React.createElement(AccountSection));

    const { Text } = require("react-native");
    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.flatMap((node: any) => node.props.children);

    expect(textContents).toContain("Account");
    expect(textContents).toContain(
      "Sign in or create account",
    );

    const signInButton = findButtonByLabel(
      tree,
      "Sign in or create account",
    );

    expect(signInButton).toBeDefined();

    signInButton!.props.onPress();

    expect(mockPush).toHaveBeenCalledWith(
      "/auth?returnTo=%2FuserPreferences",
    );

    tree.unmount();
  });

  it("routes account setup back to the account flow when display name is missing", () => {
    mockUseAccountAuth.mockReturnValue({
      account: { preferredDisplayName: null },
      changePassword: jest.fn(),
      deleteAccount: jest.fn(),
      requestPasswordReset: jest.fn(),
      saveDisplayName: jest.fn(),
      session: { user: { id: "host-1" } },
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      verifySignupOtp: jest.fn(),
      status: "needsDisplayName",
      user: { id: "host-1" },
    } as never);

    const tree = TestRenderer.create(React.createElement(AccountSection));

    const finishButton = findButtonByLabel(tree, "Finish account setup");

    expect(finishButton).toBeDefined();

    finishButton!.props.onPress();

    expect(mockPush).toHaveBeenCalledWith(
      "/auth/onboarding?returnTo=%2FuserPreferences",
    );

    tree.unmount();
  });

  it("keeps sign-out available when the account is ready", () => {
    const signOut = jest.fn();

    mockUseAccountAuth.mockReturnValue({
      account: { preferredDisplayName: "Captain" },
      changePassword: jest.fn(),
      deleteAccount: jest.fn(),
      requestPasswordReset: jest.fn(),
      saveDisplayName: jest.fn(),
      session: { user: { id: "host-1" } },
      signIn: jest.fn(),
      signOut,
      signUp: jest.fn(),
      verifySignupOtp: jest.fn(),
      status: "ready",
      user: { id: "host-1" },
    } as never);

    const tree = TestRenderer.create(React.createElement(AccountSection));

    const signOutButton = findButtonByLabel(tree, "Sign out");

    expect(signOutButton).toBeDefined();

    signOutButton!.props.onPress();

    expect(signOut).toHaveBeenCalled();

    tree.unmount();
  });
});