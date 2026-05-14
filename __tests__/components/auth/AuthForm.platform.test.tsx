import React from "react";
import TestRenderer from "react-test-renderer";

jest.mock("../../../app/style/theme", () => ({
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
    push: jest.fn(),
    replace: jest.fn(),
  }),
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

jest.mock("../../../hooks/useAccountAuth", () => {
  const actual = jest.requireActual("../../../hooks/useAccountAuth");

  return {
    ...actual,
    useAccountAuth: () => ({
      account: null,
      saveDisplayName: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      requestPasswordReset: jest.fn(),
      session: null,
      status: "signedOut",
      user: null,
    }),
  };
});

const AuthForm = require("../../../components/auth/AuthForm").default;

describe("AuthForm", () => {
  it("renders the sign-in form by default", () => {
    const tree = TestRenderer.create(React.createElement(AuthForm));
    const { Text } = require("react-native");
    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.flatMap((node: any) => node.props.children);

    expect(textContents).toContain("Welcome back");
    expect(textContents).toContain("Sign in");

    tree.unmount();
  });
});