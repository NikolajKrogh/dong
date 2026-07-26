import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

import PasswordResetForm from "../../../components/auth/PasswordResetForm";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";

const TestSubject: typeof PasswordResetForm = (props) =>
  React.createElement(TamaguiTestProvider, null, React.createElement(PasswordResetForm, props));

jest.mock("tamagui", () => {
  const RN = require("react-native");
  const ReactLocal = require("react");
  // Partial mock: real createTamagui/createTokens/TamaguiProvider are kept so
  // TamaguiTestProvider (used below) can build an actual theme/config context --
  // the babel-plugin-generated style code in the component under test needs
  // that context even for the props this mock swaps out for plain RN elements.
  const actual = jest.requireActual("tamagui");
  return {
    ...actual,
    Text: ({ children, ...props }: any) =>
      ReactLocal.createElement(RN.Text, props, children),
    XStack: ({ children, ...props }: any) =>
      ReactLocal.createElement(RN.View, props, children),
    YStack: ({ children, ...props }: any) =>
      ReactLocal.createElement(RN.View, props, children),
  };
});

const mockExchangeCodeForSession = jest.fn();
const mockReplace = jest.fn();
const mockRequestPasswordReset = jest.fn();
const mockCompletePasswordRecovery = jest.fn();

jest.mock("../../../styles/theme", () => ({
  // Real darkColors/lightColors are still needed: styles/tamaguiThemes.ts
  // (pulled in transitively via TamaguiTestProvider below) imports darkColors
  // from this module, so a mock providing only useColors leaves it undefined.
  ...jest.requireActual("../../../styles/theme"),
  useColors: () => ({
    textPrimary: "#111111",
    textSecondary: "#666666",
    textMuted: "#888888",
    border: "#dddddd",
    surface: "#ffffff",
    danger: "#ff0000",
    primary: "#007AFF",
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock("../../../utils/supabaseClient", () => ({
  getSupabaseClient: jest.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

jest.mock("../../../hooks/useAccountAuth", () => {
  const actual = jest.requireActual("../../../hooks/useAccountAuth");

  return {
    ...actual,
    useAccountAuth: () => ({
      account: null,
      completePasswordRecovery: mockCompletePasswordRecovery,
      requestPasswordReset: mockRequestPasswordReset,
      saveDisplayName: jest.fn(),
      saveProfile: jest.fn(),
      session: null,
      sessionNotice: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      status: "signedOut",
      user: null,
    }),
  };
});

jest.mock("../../../components/ui", () => ({
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

describe("PasswordResetForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the recovery email request form by default", () => {
    const tree = actCreate(React.createElement(TestSubject));

    const { Text } = require("react-native");
    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.flatMap((node: any) => node.props.children);

    expect(textContents).toContain("Reset your password");
    expect(textContents).toContain("Send recovery email");

    tree.unmount();
  });

  it("opens a recovery link and switches to the new-password form", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const tree = actCreate(
      React.createElement(TestSubject, {
        recoveryCode: "recovery-code-123",
      }),
    );

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith(
      "recovery-code-123",
    );

    const { Text } = require("react-native");
    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.flatMap((node: any) => node.props.children);

    expect(textContents).toContain("Set a new password");
    expect(textContents).toContain("Update password");

    tree.unmount();
  });
});
