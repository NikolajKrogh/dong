import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

import UsernameOnboardingForm from "../../../components/auth/UsernameOnboardingForm";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";

const TestSubject: typeof UsernameOnboardingForm = (props) =>
  React.createElement(TamaguiTestProvider, null, React.createElement(UsernameOnboardingForm, props));

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
    YStack: ({ children, ...props }: any) =>
      ReactLocal.createElement(RN.View, props, children),
  };
});

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
      saveProfile: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      requestPasswordReset: jest.fn(),
      session: { user: { id: "host-1" } },
      sessionNotice: null,
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
    const tree = actCreate(
      React.createElement(TestSubject),
    );

    const { Text } = require("react-native");
    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.flatMap((node: any) => node.props.children);

    expect(textContents).toContain("Choose your display name");
    expect(textContents).toContain("Save display name");

    tree.unmount();
  });
});
