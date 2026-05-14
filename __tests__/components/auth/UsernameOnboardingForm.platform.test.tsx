import React from "react";
import TestRenderer from "react-test-renderer";

import UsernameOnboardingForm from "../../../components/auth/UsernameOnboardingForm";

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
    replace: jest.fn(),
  }),
}));

jest.mock("../../../hooks/useAccountAuth", () => {
  const actual = jest.requireActual("../../../hooks/useAccountAuth");

  return {
    ...actual,
    useAccountAuth: () => ({
      account: { preferredDisplayName: null },
      saveDisplayName: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      requestPasswordReset: jest.fn(),
      session: { user: { id: "host-1" } },
      status: "needsDisplayName",
      user: { id: "host-1" },
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
      { testID: "ShellActionButton", ...props },
      label ? ReactLocal.createElement(RN.Text, null, label) : null,
    );
  },
}));

describe("UsernameOnboardingForm", () => {
  it("renders the required display-name onboarding form", () => {
    const tree = TestRenderer.create(
      React.createElement(UsernameOnboardingForm),
    );

    const { Text } = require("react-native");
    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.flatMap((node: any) => node.props.children);

    expect(textContents).toContain("Choose your display name");
    expect(textContents).toContain("Save display name");

    tree.unmount();
  });
});