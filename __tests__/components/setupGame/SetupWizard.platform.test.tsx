import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

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
  Platform: {
    OS: "web",
    select: (o: Record<string, unknown>) => o.web ?? o.default,
  },
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

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    primary: "#123456",
    secondary: "#234567",
    success: "#345678",
    textLight: "#ffffff",
    textMuted: "#666666",
  }),
}));

jest.mock("../../../styles/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

const step = (
  key: string,
  name: string,
  canEnter = true,
): Record<string, unknown> => ({
  key,
  name,
  icon: "add-circle",
  canEnter,
  content: React.createElement("View", { testID: `${key}Step` }),
});

const renderSetupWizard = (overrides: Record<string, unknown> = {}) => {
  const SetupWizard =
    require("../../../components/setupGame/SetupWizard").default;

  return actCreate(
    React.createElement(SetupWizard, {
      steps: [
        step("players", "Players"),
        step("matches", "Matches"),
        step("common", "Common"),
        step("assign", "Assign"),
      ],
      firstSlotAction: {
        label: "Home",
        icon: "home",
        iconPosition: "leading",
        onPress: mockPush,
      },
      finalAction: {
        label: "Start Game",
        icon: "play",
        onPress: jest.fn(),
      },
      ...overrides,
    }),
  );
};

describe("SetupWizard step generality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("renders as many steps as it is given, not a fixed four", () => {
    const renderer = renderSetupWizard({
      steps: [step("room", "Room"), step("assign", "Assign")],
    });

    expect(
      renderer.root.findAllByProps({ testID: "SetupWizardStep-room" }),
    ).not.toHaveLength(0);
    expect(
      renderer.root.findAllByProps({ testID: "SetupWizardStep-assign" }),
    ).not.toHaveLength(0);
    expect(
      renderer.root.findAllByProps({ testID: "SetupWizardStep-common" }),
    ).toHaveLength(0);
  });

  // canEnter gates entry only. It must never push a viewer off the step they
  // are on -- a room's snapshot polls every few seconds, and a host editing the
  // Assign step would otherwise be yanked backwards mid-edit.
  it("blocks Next and the indicator tap when the next step cannot be entered", () => {
    const renderer = renderSetupWizard({
      steps: [step("players", "Players"), step("matches", "Matches", false)],
    });

    const next = renderer.root.findByProps({ testID: "SetupWizardNext" });
    expect(next.props.disabled).toBe(true);

    const blocked = renderer.root.findByProps({
      testID: "SetupWizardStep-matches",
    });
    expect(blocked.props.disabled).toBe(true);

    TestRenderer.act(() => {
      blocked.props.onPress();
    });
    // Still on the first step, so the first-slot action (Home) is showing
    // rather than Back.
    expect(
      renderer.root.findAllByProps({ testID: "SetupWizardBack" }),
    ).toHaveLength(0);
  });

  it("advances on Next and swaps Home for Back", () => {
    const renderer = renderSetupWizard();

    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: "SetupWizardNext" }).props.onPress();
    });

    expect(
      renderer.root.findAllByProps({ testID: "SetupWizardBack" }),
    ).not.toHaveLength(0);
  });

  it("renders a disabled placeholder when there is no final action", () => {
    const renderer = renderSetupWizard({
      steps: [step("only", "Only")],
      finalAction: null,
    });

    const placeholder = renderer.root.findByProps({
      testID: "SetupWizardFinalDisabled",
    });
    expect(placeholder.props.disabled).toBe(true);
  });

  it("lets onBeforeNext claim the advance", () => {
    jest.useFakeTimers();
    const onBeforeNext = jest.fn(() => true);
    const renderer = renderSetupWizard({ onBeforeNext });

    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: "SetupWizardNext" }).props.onPress();
    });

    expect(onBeforeNext).toHaveBeenCalledWith(0);
    // Deferred, not immediate: the caller's own state write lands first.
    expect(
      renderer.root.findAllByProps({ testID: "SetupWizardBack" }),
    ).toHaveLength(0);

    TestRenderer.act(() => {
      jest.runAllTimers();
    });
    expect(
      renderer.root.findAllByProps({ testID: "SetupWizardBack" }),
    ).not.toHaveLength(0);
    jest.useRealTimers();
  });
});

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
    const contentScroll = renderer.root.findByType("ScrollView");

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
    expect(contentScroll.props.keyboardShouldPersistTaps).toBe("handled");
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
