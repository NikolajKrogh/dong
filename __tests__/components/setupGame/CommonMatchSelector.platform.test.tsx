import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockStyles = {
  tabContent: { testStyle: "tabContent" },
  sectionHeader: { testStyle: "sectionHeader" },
  sectionTitle: { testStyle: "sectionTitle" },
  centeredView: { testStyle: "centeredView" },
  modalView: { testStyle: "modalView" },
  modalText: { testStyle: "modalText" },
  button: { testStyle: "button" },
  buttonCancel: { testStyle: "buttonCancel" },
  textStyle: { testStyle: "textStyle" },
  emptyListContainer: { testStyle: "emptyListContainer" },
  emptyListTitleText: { testStyle: "emptyListTitleText" },
  emptyListSubtitleText: { testStyle: "emptyListSubtitleText" },
  commonMatchList: { testStyle: "commonMatchList" },
  commonMatchListWide: {
    testStyle: "commonMatchListWide",
    flexDirection: "row",
  },
  matchItemWrapper: { testStyle: "matchItemWrapper" },
  commonMatchCardWide: {
    testStyle: "commonMatchCardWide",
    width: "48%",
  },
  matchCard: { testStyle: "matchCard" },
  selectedMatchCard: { testStyle: "selectedMatchCard" },
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
  selectedRibbon: { testStyle: "selectedRibbon" },
  selectedRibbonText: { testStyle: "selectedRibbonText" },
};

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  Image: "Image",
  Modal: "Modal",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
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

jest.mock("../../../utils/teamLogos", () => ({
  getTeamLogoWithFallback: jest.fn(() => null),
}));

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    primaryLight: "#345678",
    primaryLighter: "#eef2ff",
    surface: "#ffffff",
    textMuted: "#666666",
  }),
}));

jest.mock("../../../app/style/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

const renderCommonMatchSelector = () => {
  const CommonMatchSelector =
    require("../../../components/setupGame/CommonMatchSelector").default;

  return TestRenderer.create(
    React.createElement(CommonMatchSelector, {
      matches: [
        {
          id: "m1",
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          homeGoals: 0,
          awayGoals: 0,
        },
        {
          id: "m2",
          homeTeam: "Liverpool",
          awayTeam: "Spurs",
          homeGoals: 0,
          awayGoals: 0,
        },
      ],
      selectedCommonMatch: "m1",
      handleSelectCommonMatch: jest.fn(),
    }),
  );
};

describe("CommonMatchSelector responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("keeps a stacked list on phone-sized viewports", () => {
    const renderer = renderCommonMatchSelector();
    const list = renderer.root.findByProps({ testID: "CommonMatchList" });
    const wrappers = renderer.root.findAllByProps({
      testID: "CommonMatchCard",
    });

    expect(list.props.style).toEqual(
      expect.arrayContaining([mockStyles.commonMatchList]),
    );
    expect(list.props.style).not.toEqual(
      expect.arrayContaining([mockStyles.commonMatchListWide]),
    );
    wrappers.forEach((wrapper) => {
      expect(wrapper.props.style).not.toEqual(
        expect.arrayContaining([mockStyles.commonMatchCardWide]),
      );
    });
  });

  it("wraps cards into a wide grid on desktop-sized viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderCommonMatchSelector();
    const list = renderer.root.findByProps({ testID: "CommonMatchList" });
    const wrappers = renderer.root.findAllByProps({
      testID: "CommonMatchCard",
    });

    expect(list.props.style).toEqual(
      expect.arrayContaining([
        mockStyles.commonMatchList,
        mockStyles.commonMatchListWide,
      ]),
    );
    wrappers.forEach((wrapper) => {
      expect(wrapper.props.style).toEqual(
        expect.arrayContaining([
          mockStyles.matchItemWrapper,
          mockStyles.commonMatchCardWide,
        ]),
      );
    });
  });
});
