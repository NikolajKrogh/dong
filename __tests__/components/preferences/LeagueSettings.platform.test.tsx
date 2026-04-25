import React from "react";
import TestRenderer from "react-test-renderer";

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

describe("LeagueSettings shell adoption", () => {
  it("renders section title and card with configured leagues", () => {
    const LeagueSettings =
      require("../../../components/preferences/LeagueSettings").default;

    const renderer = TestRenderer.create(
      React.createElement(LeagueSettings, {
        configuredLeagues: [
          { code: "EPL", name: "Premier League" },
          { code: "LIGA", name: "La Liga" },
        ],
        onManageLeaguesPress: jest.fn(),
        onAddLeaguesPress: jest.fn(),
        defaultSelectedLeagues: [{ code: "EPL", name: "Premier League" }],
        onSetDefaultLeaguesPress: jest.fn(),
      })
    );

    const { Text } = require("react-native");
    const texts = renderer.root.findAllByType(Text);
    const textContents = texts.map((t: any) => t.props.children).flat();

    expect(textContents).toContain("League Configuration");
    expect(textContents).toContain("Remove Leagues");
    expect(textContents).toContain("Add New Leagues");
    expect(textContents).toContain("Set Default Leagues");

    renderer.unmount();
  });

  it("displays correct league count", () => {
    const LeagueSettings =
      require("../../../components/preferences/LeagueSettings").default;

    const renderer = TestRenderer.create(
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
      })
    );

    const { Text } = require("react-native");
    const texts = renderer.root.findAllByType(Text);
    const textContents = texts.map((t: any) => t.props.children).flat();

    expect(textContents).toContain("3 leagues");

    renderer.unmount();
  });
});
