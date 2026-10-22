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
    const contentScroll = renderer.root.find((node) => String(node.type) === "ScrollView");

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
      (node) => String(node.type) === "Text" && node.props.children === "Players",
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


describe('controlled route steps', () => {
 it('distinguishes explicit Back from choosing a new step', () => {
  const onStepChange=jest.fn(); const onStepBack=jest.fn();
  const tree=renderSetupWizard({activeStepKey:'common',onStepChange,onStepBack});
  TestRenderer.act(()=>tree.root.findByProps({testID:'SetupWizardBack'}).props.onPress());
  expect(onStepBack).toHaveBeenCalledWith('matches');expect(onStepChange).not.toHaveBeenCalled();
  TestRenderer.act(()=>tree.unmount());
 });
 it('requests a new key while keeping the caller selected step', () => {
  const onStepChange=jest.fn(); const tree=renderSetupWizard({activeStepKey:'matches',onStepChange});
  expect(tree.root.findByProps({testID:'SetupWizardStep-matches'}).props.accessibilityState.selected).toBe(true);
  TestRenderer.act(()=>tree.root.findByProps({testID:'SetupWizardNext'}).props.onPress());
  expect(onStepChange).toHaveBeenCalledWith('common');
  expect(tree.root.findByProps({testID:'SetupWizardStep-matches'}).props.accessibilityState.selected).toBe(true);
 });
 it('commits pending input once for repeated Next and cancels deferred work on unmount', () => {
  jest.useFakeTimers(); const onBeforeNext=jest.fn(()=>true); const onStepChange=jest.fn();
  const tree=renderSetupWizard({activeStepKey:'players',onStepChange,onBeforeNext});
  TestRenderer.act(()=>{tree.root.findByProps({testID:'SetupWizardNext'}).props.onPress();tree.root.findByProps({testID:'SetupWizardNext'}).props.onPress();});
  expect(onBeforeNext).toHaveBeenCalledTimes(1);
  TestRenderer.act(()=>tree.unmount());TestRenderer.act(()=>jest.runAllTimers());expect(onStepChange).not.toHaveBeenCalled();jest.useRealTimers();
 });
});


it('retains the native content scroller and gives short web pages natural content height', () => {
  const { Platform } = require('react-native');
  const previous = Platform.OS;
  mockUseWindowDimensions.mockReturnValue({ width: 640, height: 360, scale: 1, fontScale: 2 });
  try {
    for (const platform of ['web', 'android']) {
      Platform.OS = platform;
      const tree = renderSetupWizard();
      expect(tree.root.findAllByProps({ testID: 'SetupWizardPageScroll' })).toHaveLength(platform === 'web' ? 1 : 0);
      expect(tree.root.findAllByProps({ testID: 'SetupWizardContent' })).toHaveLength(1);
      expect(tree.root.findByProps({ testID: 'SetupWizardContent' }).props.style).toEqual([mockStyles.stepContentScroll, platform === 'web' ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', overflow: 'visible' } : false]);
      TestRenderer.act(() => tree.unmount());
    }
  } finally { Platform.OS = previous; }
});


it('keeps step content mounted while keyboard resizing changes the web scroll owner', () => {
  const mounted = jest.fn();
  const unmounted = jest.fn();
  const InputProbe = () => {
    React.useEffect(() => { mounted(); return unmounted; }, []);
    return React.createElement('TextInput');
  };
  mockUseWindowDimensions.mockReturnValue({ width: 360, height: 623, scale: 1, fontScale: 1 });
  const tree = renderSetupWizard({ steps: [{ ...step('players', 'Players'), content: React.createElement(InputProbe) }] });
  const SetupWizard = require('../../../components/setupGame/SetupWizard').default;
  const props = tree.root.findByType(SetupWizard).props;
  for (const height of [360, 623]) {
    mockUseWindowDimensions.mockReturnValue({ width: 360, height, scale: 1, fontScale: 1 });
    TestRenderer.act(() => tree.update(React.createElement(SetupWizard, props)));
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  }
  TestRenderer.act(() => tree.unmount());
  expect(unmounted).toHaveBeenCalledTimes(1);
});
