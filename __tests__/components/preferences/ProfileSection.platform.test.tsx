import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

import ProfileSection from "../../../components/preferences/ProfileSection";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";

const TestSubject = (props: Record<string, unknown> = {}) =>
  React.createElement(TamaguiTestProvider, null, React.createElement(ProfileSection, props));
import { useAccountAuth } from "../../../hooks/useAccountAuth";

jest.mock("../../../hooks/useAccountAuth", () => {
  const actual = jest.requireActual("../../../hooks/useAccountAuth");

  return {
    ...actual,
    useAccountAuth: jest.fn(),
  };
});

const mockUseAccountAuth = jest.mocked(useAccountAuth);

jest.mock("../../../styles/theme", () => ({
  // Real darkColors/lightColors are still needed: styles/tamaguiThemes.ts
  // (pulled in transitively via TamaguiTestProvider below) imports darkColors
  // from this module, so a mock providing only useColors leaves it undefined.
  ...jest.requireActual("../../../styles/theme"),
  useColors: () => ({
    border: "#cccccc",
    surface: "#ffffff",
    textPrimary: "#111111",
    textSecondary: "#555555",
    textMuted: "#888888",
  }),
}));

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

jest.mock("../../../components/ui", () => ({
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
  ShellActionButton: ({ label, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");
    return R.createElement(
      RN.View,
      { testID: "ShellActionButton", label, ...props },
      label ? R.createElement(RN.Text, null, label) : null,
    );
  },
}));

describe("ProfileSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the saved profile fields for a signed-in host", () => {
    mockUseAccountAuth.mockReturnValue({
      account: {
        preferredDisplayName: "Captain",
      },
      saveDisplayName: jest.fn(),
      status: "ready",
    });

    const renderer = actCreate(React.createElement(TestSubject));

    const { Text, TextInput } = require("react-native");
    const texts = renderer.root.findAllByType(Text);
    const labels = texts.flatMap((node: any) => node.props.children);
    const inputs = renderer.root.findAllByType(TextInput);

    expect(labels).toContain("Profile");
    expect(labels).toContain("Host identity");
    expect(labels).toContain("Display name");
    expect(labels).toContain("Save display name");
    expect(inputs).toHaveLength(1);
    expect(inputs[0].props.value).toBe("Captain");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("saves the edited display name", async () => {
    const saveDisplayName = jest.fn(async () => undefined);

    mockUseAccountAuth.mockReturnValue({
      account: {
        preferredDisplayName: "Captain",
      },
      saveDisplayName,
      status: "ready",
    });

    const renderer = actCreate(React.createElement(TestSubject));

    const { TextInput } = require("react-native");

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    const inputs = renderer.root.findAllByType(TextInput);
    await TestRenderer.act(async () => {
      inputs[0].props.onChangeText("Captain Updated");
    });

    const updatedInputs = renderer.root.findAllByType(TextInput);

    expect(updatedInputs[0].props.value).toBe("Captain Updated");

    const saveButton = renderer.root.findByProps({
      label: "Save display name",
    });

    await TestRenderer.act(async () => {
      saveButton.props.onPress();
      await Promise.resolve();
    });

    expect(saveDisplayName).toHaveBeenCalledWith("Captain Updated");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("shows the validation error message when saving fails", async () => {
    const saveDisplayName = jest.fn(async () => {
      throw new Error("Account display name cannot be blank.");
    });

    mockUseAccountAuth.mockReturnValue({
      account: {
        preferredDisplayName: "Captain",
      },
      saveDisplayName,
      status: "ready",
    });

    const renderer = actCreate(React.createElement(TestSubject));
    const saveButton = renderer.root.findByProps({
      label: "Save display name",
    });

    await TestRenderer.act(async () => {
      saveButton.props.onPress();
      await Promise.resolve();
    });

    const { Text } = require("react-native");
    const texts = renderer.root.findAllByType(Text);
    const labels = texts.flatMap((node: any) => node.props.children);

    expect(labels).toContain("Account display name cannot be blank.");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
