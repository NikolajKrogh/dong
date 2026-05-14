import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

type ExchangeCodeForSessionResult = {
  data: { session: null };
  error: null;
};

const mockExchangeCodeForSession: jest.MockedFunction<
  (code: string) => Promise<ExchangeCodeForSessionResult>
> = jest.fn();

jest.mock("@expo/vector-icons", () => {
  const RN = require("react-native");
  const ReactLocal = require("react");
  return {
    Ionicons: ({ name }: any) =>
      ReactLocal.createElement(RN.View, { testID: `icon-${String(name)}` }),
  };
});

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    backgroundSubtle: "#f0f0f0",
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
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock("../../../utils/supabaseClient", () => ({
  getSupabaseClient: jest.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

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
      { testID: "ShellActionButton", ...props },
      label ? ReactLocal.createElement(RN.Text, null, label) : null,
    );
  },
}));

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

jest.mock("../../../hooks/useAccountAuth", () => {
  const actual = jest.requireActual<
    typeof import("../../../hooks/useAccountAuth")
  >("../../../hooks/useAccountAuth");

  return {
    ...actual,
    useAccountAuth: () => ({
      account: null,
      changePassword: jest.fn(),
      deleteAccount: jest.fn(),
      saveDisplayName: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      verifySignupOtp: jest.fn(),
      requestPasswordReset: jest.fn(),
      session: null,
      status: "signedOut",
      user: null,
    }),
  };
});

const AuthForm = require("../../../components/auth/AuthForm").default;

describe("AuthForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the sign-in form by default", () => {
    const tree = TestRenderer.create(React.createElement(AuthForm));
    const { Text } = require("react-native");
    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.flatMap((node: any) => node.props.children);

    expect(textContents).toContain("Sign in");
    expect(textContents).toContain("Create account");

    tree.unmount();
  });

  it("exchanges a confirmation code from the email link", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const tree = TestRenderer.create(
      React.createElement(AuthForm, {
        confirmationCode: "confirmation-code-123",
      }),
    );

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith(
      "confirmation-code-123",
    );

    tree.unmount();
  });
});
