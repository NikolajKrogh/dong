import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockStyles = {
  matchItemWrapper: { testStyle: "matchItemWrapper" },
  matchItemWrapperWide: { testStyle: "matchItemWrapperWide", maxWidth: 560 },
  matchCard: { testStyle: "matchCard" },
  matchCardGradient: { testStyle: "matchCardGradient" },
  matchTeamsContainer: { testStyle: "matchTeamsContainer" },
  matchTeamColumn: { testStyle: "matchTeamColumn" },
  logoContainer: { testStyle: "logoContainer" },
  teamLogo: { testStyle: "teamLogo" },
  teamLogoPlaceholder: { testStyle: "teamLogoPlaceholder" },
  teamLogoPlaceholderText: { testStyle: "teamLogoPlaceholderText" },
  teamName: { testStyle: "teamName" },
  vsDivider: { testStyle: "vsDivider" },
  vsText: { testStyle: "vsText" },
  matchTimeHeader: { testStyle: "matchTimeHeader" },
  matchTimeText: { testStyle: "matchTimeText" },
  removeButton: { testStyle: "removeButton" },
};

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  Image: "Image",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children, ...props }: any) => {
    const ReactLocal = require("react");
    const ReactNativeLocal = require("react-native");

    return ReactLocal.createElement(
      ReactNativeLocal.View,
      { testID: "LinearGradient", ...props },
      children,
    );
  },
}));

jest.mock("../../../components/AppIcon", () => () => null);

jest.mock("../../../utils/teamLogos", () => ({
  getTeamLogoWithFallback: () => null,
}));

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    primaryLighter: "#eef4ff",
    surface: "#ffffff",
    primary: "#0057ff",
    danger: "#cc0000",
  }),
}));

jest.mock("../../../app/style/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

const renderMatchItem = () => {
  const MatchItem = require("../../../components/setupGame/MatchItem").default;

  return TestRenderer.create(
    React.createElement(MatchItem, {
      match: {
        id: "m1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        startTime: "2026-05-01T19:30:00Z",
      },
      handleRemoveMatch: jest.fn(),
    }),
  );
};

describe("MatchItem responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("keeps the compact card wrapper on phone-sized viewports", () => {
    const renderer = renderMatchItem();
    const wrapper = renderer.root.findByProps({
      testID: "SetupMatchItemWrapper",
    });

    expect(wrapper.props.style).toEqual([mockStyles.matchItemWrapper, false]);
  });

  it("constrains the card wrapper on desktop-sized viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderMatchItem();
    const wrapper = renderer.root.findByProps({
      testID: "SetupMatchItemWrapper",
    });

    expect(wrapper.props.style).toEqual([
      mockStyles.matchItemWrapper,
      mockStyles.matchItemWrapperWide,
    ]);
  });
});
