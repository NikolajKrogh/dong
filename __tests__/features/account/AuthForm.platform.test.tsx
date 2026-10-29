import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

let mockAuthStatus = "signedOut";
const mockDismissTo = jest.fn();
const mockReplace = jest.fn();

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

jest.mock("../../../styles/theme", () => ({
  // Real darkColors/lightColors are still needed: styles/tamaguiThemes.ts
  // (pulled in transitively via TamaguiTestProvider below) imports darkColors
  // from this module, so a mock providing only useColors leaves it undefined.
  ...(jest.requireActual("../../../styles/theme") as object),
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
    replace: mockReplace,
    dismissTo: mockDismissTo,
  }),
}));

jest.mock("../../../lib/supabase", () => ({
getSupabaseClient: jest.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  }))
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
  // Partial mock: real createTamagui/createTokens/TamaguiProvider are kept so
  // TamaguiTestProvider (used below) can build an actual theme/config context --
  // the babel-plugin-generated style code in the component under test needs
  // that context even for the props this mock swaps out for plain RN elements.
  const actual = jest.requireActual("tamagui") as object;
  return {
    ...actual,
    Text: ({ children, ...props }: any) =>
      ReactLocal.createElement(RN.Text, props, children),
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

jest.mock("../../../features/account", () => {
  const actual = jest.requireActual<
    typeof import("../../../features/account")
  >("../../../features/account");

  return {
    ...actual,
    useAccountAuth: () => ({
      account: null,
      changePassword: jest.fn(),
      deleteAccount: jest.fn(),
      saveUsername: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      verifySignupOtp: jest.fn(),
      requestPasswordReset: jest.fn(),
      session: null,
      status: mockAuthStatus,
      user: null,
    }),
  };
});

const AuthForm = require("../../../features/account/AuthForm").default;
const { TamaguiTestProvider } = require("../../../test-utils/tamagui");
const TestSubject = (props: any) =>
  React.createElement(TamaguiTestProvider, null, React.createElement(AuthForm, props));

const openRegistration = (tree: ReturnType<typeof actCreate>) => {
  const createTab = tree.root.findAll((node) => node.props.active === false && typeof node.props.onPress === 'function')[0];
  TestRenderer.act(() => createTab.props.onPress());
};

const registrationSubmit = (tree: ReturnType<typeof actCreate>) =>
  tree.root.findAll((node) => typeof node.props.label === 'string' && node.props.label.startsWith('Create account') && typeof node.props.onPress === 'function')[0];

describe("AuthForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthStatus = "signedOut";
  });

  it.each(["/friends?tab=requests", null])("returns through an existing destination after sign-in (%s)", (returnTo) => {
    mockAuthStatus = "ready";
    actCreate(React.createElement(TestSubject, { returnTo }));
    expect(mockDismissTo).toHaveBeenCalledWith(returnTo ?? "/");
    expect(mockReplace).not.toHaveBeenCalled();

  });

  it("keeps username onboarding and its intended return target", () => {
    mockAuthStatus = "needsUsername";
    actCreate(React.createElement(TestSubject, { returnTo: "/friends?tab=requests" }));
    expect(mockReplace).toHaveBeenCalledWith("/auth/onboarding?returnTo=%2Ffriends%3Ftab%3Drequests");
    expect(mockDismissTo).not.toHaveBeenCalled();

  });

  it("renders the sign-in form by default", () => {
    const tree = actCreate(React.createElement(TestSubject));
    const { Text } = require("react-native");
    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.flatMap((node: any) => node.props.children);

    expect(textContents).toContain("Sign in");
    expect(textContents).toContain("Create account");
  });

  it("exchanges a confirmation code from the email link", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    actCreate(
      React.createElement(TestSubject, {
        confirmationCode: "confirmation-code-123",
      }),
    );

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith(
      "confirmation-code-123",
    );
  });
});


it('names fields and distinguishes sign-in from registration autofill', () => {
  const tree = actCreate(React.createElement(TestSubject));
  const { TextInput } = require('react-native');
  let inputs = tree.root.findAllByType(TextInput);
  expect(inputs.map((node) => node.props.accessibilityLabel)).toEqual(['Email address', 'Password']);
  expect(inputs.map((node) => node.props.autoComplete)).toEqual(['username', 'current-password']);
  openRegistration(tree);
  inputs = tree.root.findAllByType(TextInput);
  expect(inputs.map((node) => node.props.accessibilityLabel)).toEqual(['Display name', 'Email address', 'Password', 'Confirm password']);
  expect(inputs.map((node) => node.props.autoComplete)).toEqual(['nickname', 'email', 'new-password', 'new-password']);
  const toggle = tree.root.findAll((node) => node.props.accessibilityLabel === 'Show password' && typeof node.props.onPress === 'function')[0];
  TestRenderer.act(() => toggle.props.onPress());
  expect(tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === 'Password')?.props.secureTextEntry).toBe(false);
  TestRenderer.act(() => tree.unmount());
});

it('announces password mismatch and associates it with confirmation', () => {
  const tree = actCreate(React.createElement(TestSubject));
  openRegistration(tree);
  const { TextInput } = require('react-native');
  const password = tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === 'Password')!;
  TestRenderer.act(() => password.props.onChangeText('one-password'));
  const submit = registrationSubmit(tree);
  TestRenderer.act(() => submit.props.onPress());
  expect(tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === 'Confirm password')?.props).toMatchObject({ 'aria-invalid': true, 'aria-describedby': 'auth-form-error' });
  expect(tree.root.findAll((node) => node.props.nativeID === 'auth-form-error' && node.props.role === 'alert').length).toBeGreaterThan(0);
  TestRenderer.act(() => tree.unmount());
});


it('names the verification code field and declares one-time-code autofill', async () => {
  const tree = actCreate(React.createElement(TestSubject));
  openRegistration(tree);
  const submit = registrationSubmit(tree);
  await TestRenderer.act(async () => { await submit.props.onPress(); });
  const { TextInput } = require('react-native');
  const code = tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === 'Verification code');
  expect(code?.props).toMatchObject({ autoComplete: 'one-time-code', textContentType: 'oneTimeCode', keyboardType: 'number-pad' });
  TestRenderer.act(() => tree.unmount());
});
