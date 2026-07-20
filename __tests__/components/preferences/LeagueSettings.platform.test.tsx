import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#007AFF",
    secondary: "#6C757D",
    textMuted: "#888",
    surface: "#ffffff",
    background: "#f5f5f5",
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

describe("LeagueSettings shell adoption", () => {
  it("renders section title and card with configured leagues", () => {
    const LeagueSettings =
      require("../../../components/preferences/LeagueSettings").default;

    const renderer = actCreate(
      React.createElement(LeagueSettings, {
        configuredLeagues: [
          { code: "EPL", name: "Premier League" },
          { code: "LIGA", name: "La Liga" },
        ],
        onManageLeaguesPress: jest.fn(),
        onAddLeaguesPress: jest.fn(),
        defaultSelectedLeagues: [{ code: "EPL", name: "Premier League" }],
        onSetDefaultLeaguesPress: jest.fn(),
      }),
    );

    const { Text } = require("react-native");
    const texts = renderer.root.findAllByType(Text);
    const textContents = texts.map((t: any) => t.props.children).flat();

    expect(textContents).toContain("League Configuration");
    expect(textContents).toContain("Remove Leagues");
    expect(textContents).toContain("Add New Leagues");
    expect(textContents).toContain("Set Default Leagues");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("displays correct league count", () => {
    const LeagueSettings =
      require("../../../components/preferences/LeagueSettings").default;

    const renderer = actCreate(
      React.createElement(LeagueSettings, {
        configuredLeagues: [
          { code: "EPL", name: "Premier League" },
          { code: "LIGA", name: "La Liga" },
          { code: "BL", name: "Bundesliga" },
        ],
        onManageLeaguesPress: jest.fn(),
        onAddLeaguesPress: jest.fn(),
        defaultSelectedLeagues: [],
        onSetDefaultLeaguesPress: jest.fn(),
      }),
    );

    const { Text } = require("react-native");
    const texts = renderer.root.findAllByType(Text);
    const textContents = texts.map((t: any) => t.props.children).flat();

    expect(textContents).toContain("3 leagues");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("routes the league actions through the provided handlers", () => {
    const onManageLeaguesPress = jest.fn();
    const onAddLeaguesPress = jest.fn();
    const onSetDefaultLeaguesPress = jest.fn();
    const LeagueSettings =
      require("../../../components/preferences/LeagueSettings").default;

    const renderer = actCreate(
      React.createElement(LeagueSettings, {
        configuredLeagues: [{ code: "EPL", name: "Premier League" }],
        onManageLeaguesPress,
        onAddLeaguesPress,
        defaultSelectedLeagues: [],
        onSetDefaultLeaguesPress,
      }),
    );

    const { TouchableOpacity, Text } = require("react-native");
    const rows = renderer.root.findAllByType(TouchableOpacity);
    const texts = renderer.root.findAllByType(Text);
    const textContents = texts.map((t: any) => t.props.children).flat();

    TestRenderer.act(() => {
      rows[0].props.onPress();
      rows[1].props.onPress();
      rows[2].props.onPress();
    });

    expect(onManageLeaguesPress).toHaveBeenCalled();
    expect(onAddLeaguesPress).toHaveBeenCalled();
    expect(onSetDefaultLeaguesPress).toHaveBeenCalled();
    expect(textContents).toContain("Tap to set");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
