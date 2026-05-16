import React from "react";
import TestRenderer from "react-test-renderer";

import ProfileSection from "../../../components/preferences/ProfileSection";
import { useAccountAuth } from "../../../hooks/useAccountAuth";

jest.mock("../../../hooks/useAccountAuth", () => {
  const actual = jest.requireActual("../../../hooks/useAccountAuth");

  return {
    ...actual,
    useAccountAuth: jest.fn(),
  };
});

const mockUseAccountAuth = jest.mocked(useAccountAuth);

jest.mock("../../../app/style/theme", () => ({
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
  return {
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
        username: "captain-owner",
      },
      saveProfile: jest.fn(),
      status: "ready",
    } as never);

    const renderer = TestRenderer.create(React.createElement(ProfileSection));

    const { Text, TextInput } = require("react-native");
    const texts = renderer.root.findAllByType(Text);
    const labels = texts.flatMap((node: any) => node.props.children);
    const inputs = renderer.root.findAllByType(TextInput);

    expect(labels).toContain("Profile");
    expect(labels).toContain("Display name");
    expect(labels).toContain("Username or handle");
    expect(inputs[0].props.value).toBe("Captain");
    expect(inputs[1].props.value).toBe("captain-owner");

    renderer.unmount();
  });

  it("saves the edited profile fields", async () => {
    const saveProfile = jest.fn(async () => undefined);

    mockUseAccountAuth.mockReturnValue({
      account: {
        preferredDisplayName: "Captain",
        username: "captain-owner",
      },
      saveProfile,
      status: "ready",
    } as never);

    const renderer = TestRenderer.create(React.createElement(ProfileSection));

    const { TextInput } = require("react-native");

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    const inputs = renderer.root.findAllByType(TextInput);
    await TestRenderer.act(async () => {
      inputs[0].props.onChangeText("Captain Updated");
      inputs[1].props.onChangeText("captain-updated");
    });

    const updatedInputs = renderer.root.findAllByType(TextInput);

    expect(updatedInputs[0].props.value).toBe("Captain Updated");
    expect(updatedInputs[1].props.value).toBe("captain-updated");

    const saveButton = renderer.root.findByProps({ label: "Save profile" });

    await TestRenderer.act(async () => {
      saveButton.props.onPress();
      await Promise.resolve();
    });

    expect(saveProfile).toHaveBeenCalledWith({
      displayName: "Captain Updated",
      username: "captain-updated",
    });

    renderer.unmount();
  });

  it("shows the validation error message when saving fails", async () => {
    const saveProfile = jest.fn(async () => {
      throw new Error("Account username cannot be blank.");
    });

    mockUseAccountAuth.mockReturnValue({
      account: {
        preferredDisplayName: "Captain",
        username: "captain-owner",
      },
      saveProfile,
      status: "ready",
    } as never);

    const renderer = TestRenderer.create(React.createElement(ProfileSection));
    const saveButton = renderer.root.findByProps({ label: "Save profile" });

    await TestRenderer.act(async () => {
      saveButton.props.onPress();
      await Promise.resolve();
    });

    const { Text } = require("react-native");
    const texts = renderer.root.findAllByType(Text);
    const labels = texts.flatMap((node: any) => node.props.children);

    expect(labels).toContain("Account username cannot be blank.");

    renderer.unmount();
  });
});
