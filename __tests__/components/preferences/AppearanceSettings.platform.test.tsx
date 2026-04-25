import React from "react";
import TestRenderer from "react-test-renderer";

const mockSetTheme = jest.fn();

jest.mock("../../../store/store", () => ({
  useGameStore: () => ({
    theme: "light",
    setTheme: mockSetTheme,
  }),
}));

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#007AFF",
    textMuted: "#888",
    switchTrackOff: "#ccc",
    switchTrackOn: "#34C759",
    thumbOn: "#fff",
    thumbOff: "#fff",
  }),
}));

jest.mock("../../../app/style/userPreferencesStyles", () => ({
  createUserPreferencesStyles: () => ({
    commonStyles: {
      section: {},
      sectionTitle: {},
      card: {},
    },
    settingsStyles: {
      preferenceRow: {},
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
    return R.createElement(RN.View, { testID: "ShellSection", ...props },
      title ? R.createElement(RN.Text, null, title) : null,
      children);
  },
  ShellCard: ({ children, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");
    return R.createElement(RN.View, { testID: "ShellCard", ...props }, children);
  },
}));

describe("AppearanceSettings shell adoption", () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
  });

  it("renders the dark mode toggle with correct initial state", () => {
    const AppearanceSettings =
      require("../../../components/preferences/AppearanceSettings").default;

    const renderer = TestRenderer.create(
      React.createElement(AppearanceSettings)
    );

    const { Text, Switch } = require("react-native");
    const texts = renderer.root.findAllByType(Text);
    const labels = texts.map((t: any) => t.props.children).flat();
    expect(labels).toContain("Appearance");
    expect(labels).toContain("Dark Mode");

    // Switch should be off for light theme
    const switches = renderer.root.findAllByType(Switch);
    expect(switches).toHaveLength(1);
    expect(switches[0].props.value).toBe(false);

    renderer.unmount();
  });

  it("calls setTheme with 'dark' when switch is toggled on", () => {
    const AppearanceSettings =
      require("../../../components/preferences/AppearanceSettings").default;

    const renderer = TestRenderer.create(
      React.createElement(AppearanceSettings)
    );

    const { Switch } = require("react-native");
    const toggle = renderer.root.findByType(Switch);

    TestRenderer.act(() => {
      toggle.props.onValueChange(true);
    });

    expect(mockSetTheme).toHaveBeenCalledWith("dark");

    renderer.unmount();
  });

  it("calls setTheme with 'light' when switch is toggled off", () => {
    const AppearanceSettings =
      require("../../../components/preferences/AppearanceSettings").default;

    const renderer = TestRenderer.create(
      React.createElement(AppearanceSettings)
    );

    const { Switch } = require("react-native");
    const toggle = renderer.root.findByType(Switch);

    TestRenderer.act(() => {
      toggle.props.onValueChange(false);
    });

    expect(mockSetTheme).toHaveBeenCalledWith("light");

    renderer.unmount();
  });
});
