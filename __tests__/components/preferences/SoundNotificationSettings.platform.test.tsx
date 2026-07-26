import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    textMuted: "#888",
    switchTrackOff: "#ccc",
    switchTrackOn: "#34C759",
    thumbOn: "#fff",
    thumbOff: "#fff",
  }),
}));

jest.mock("../../../styles/userPreferencesStyles", () => ({
  createUserPreferencesStyles: () => ({
    settingsStyles: {
      preferenceRow: {},
      preferenceRowLast: {},
      labelContainer: {},
      prefIcon: {},
      preferenceLabel: {},
    },
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

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
}));

describe("SoundNotificationSettings", () => {
  it("renders both synced toggles with their current values", () => {
    const SoundNotificationSettings =
      require("../../../components/preferences/SoundNotificationSettings").default;

    const renderer = actCreate(
      React.createElement(SoundNotificationSettings, {
        soundEnabled: true,
        setSoundEnabled: jest.fn(),
        commonMatchNotificationsEnabled: false,
        setCommonMatchNotificationsEnabled: jest.fn(),
      }),
    );

    const { Text, Switch } = require("react-native");
    const texts = renderer.root.findAllByType(Text);
    const labels = texts.flatMap((node: any) => node.props.children);
    const toggles = renderer.root.findAllByType(Switch);

    expect(labels).toContain("Sound & Notifications");
    expect(labels).toContain("Enable Sound");
    expect(labels).toContain("Common Match Notifications");
    expect(toggles[0].props.value).toBe(true);
    expect(toggles[1].props.value).toBe(false);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("calls the synced setting setters when the toggles change", () => {
    const setSoundEnabled = jest.fn();
    const setCommonMatchNotificationsEnabled = jest.fn();
    const SoundNotificationSettings =
      require("../../../components/preferences/SoundNotificationSettings").default;

    const renderer = actCreate(
      React.createElement(SoundNotificationSettings, {
        soundEnabled: true,
        setSoundEnabled,
        commonMatchNotificationsEnabled: false,
        setCommonMatchNotificationsEnabled,
      }),
    );

    const { Switch } = require("react-native");
    const toggles = renderer.root.findAllByType(Switch);

    TestRenderer.act(() => {
      toggles[0].props.onValueChange(false);
      toggles[1].props.onValueChange(true);
    });

    expect(setSoundEnabled).toHaveBeenCalledWith(false);
    expect(setCommonMatchNotificationsEnabled).toHaveBeenCalledWith(true);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
