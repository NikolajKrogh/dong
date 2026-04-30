import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockPush = jest.fn();

const mockStyles = {
  wizardContainer: { testStyle: "wizardContainer" },
  wizardWideLayout: { testStyle: "wizardWideLayout", flexDirection: "row" },
  stepIndicatorContainer: { testStyle: "stepIndicatorContainer" },
  stepIndicatorWide: {
    testStyle: "stepIndicatorWide",
    flexDirection: "column",
  },
  wizardMainPanel: { testStyle: "wizardMainPanel", flex: 1 },
  stepContentScroll: { testStyle: "stepContentScroll", flex: 1 },
  wizardNavigation: { testStyle: "wizardNavigation" },
  wizardNavigationWide: {
    testStyle: "wizardNavigationWide",
    justifyContent: "flex-end",
  },
  stepButton: { testStyle: "stepButton" },
  activeStepButton: { testStyle: "activeStepButton" },
  stepButtonWide: { testStyle: "stepButtonWide" },
  stepButtonLabel: { testStyle: "stepButtonLabel" },
  stepButtonLabelActive: { testStyle: "stepButtonLabelActive" },
  stepConnector: { testStyle: "stepConnector" },
  stepConnectorWide: { testStyle: "stepConnectorWide" },
  activeStepConnector: { testStyle: "activeStepConnector" },
  navButton: { testStyle: "navButton" },
  navButtonWide: { testStyle: "navButtonWide" },
  navButtonText: { testStyle: "navButtonText" },
};

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  ScrollView: "ScrollView",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../../components/AppIcon", () => () => null);

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    secondary: "#234567",
    success: "#345678",
    textLight: "#ffffff",
    textMuted: "#666666",
  }),
}));

jest.mock("../../../app/style/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

const renderSetupWizard = () => {
  const SetupWizard =
    require("../../../components/setupGame/SetupWizard").default;

  return TestRenderer.create(
    React.createElement(SetupWizard, {
      playersStep: React.createElement("View", { testID: "PlayersStep" }),
      matchesStep: React.createElement("View", { testID: "MatchesStep" }),
      commonMatchStep: React.createElement("View", {
        testID: "CommonMatchStep",
      }),
      assignStep: React.createElement("View", { testID: "AssignStep" }),
      handleStartGame: jest.fn(),
      canAdvanceToMatches: true,
      canAdvanceToCommonMatch: true,
      canAdvanceToAssign: true,
      canStartGame: true,
    }),
  );
};

describe("SetupWizard responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("keeps the mobile stacked layout on phone-sized viewports", () => {
    const renderer = renderSetupWizard();
    const root = renderer.root.findByProps({ testID: "SetupWizardRoot" });
    const stepRail = renderer.root.findByProps({ testID: "SetupWizardSteps" });
    const navigation = renderer.root.findByProps({
      testID: "SetupWizardNavigation",
    });

    expect(root.props.style).toEqual(
      expect.arrayContaining([mockStyles.wizardContainer]),
    );
    expect(root.props.style).not.toEqual(
      expect.arrayContaining([mockStyles.wizardWideLayout]),
    );
    expect(stepRail.props.style).not.toEqual(
      expect.arrayContaining([mockStyles.stepIndicatorWide]),
    );
    expect(navigation.props.style).not.toEqual(
      expect.arrayContaining([mockStyles.wizardNavigationWide]),
    );
  });

  it("switches to a split layout on desktop-wide viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderSetupWizard();
    const root = renderer.root.findByProps({ testID: "SetupWizardRoot" });
    const stepRail = renderer.root.findByProps({ testID: "SetupWizardSteps" });
    const navigation = renderer.root.findByProps({
      testID: "SetupWizardNavigation",
    });
    const stepLabels = renderer.root.findAll(
      (node) => node.type === "Text" && node.props.children === "Players",
    );

    expect(root.props.style).toEqual(
      expect.arrayContaining([
        mockStyles.wizardContainer,
        mockStyles.wizardWideLayout,
      ]),
    );
    expect(stepRail.props.style).toEqual(
      expect.arrayContaining([
        mockStyles.stepIndicatorContainer,
        mockStyles.stepIndicatorWide,
      ]),
    );
    expect(navigation.props.style).toEqual(
      expect.arrayContaining([
        mockStyles.wizardNavigation,
        mockStyles.wizardNavigationWide,
      ]),
    );
    expect(stepLabels).toHaveLength(1);
  });
});
