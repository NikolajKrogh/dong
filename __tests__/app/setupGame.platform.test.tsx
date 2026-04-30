import React from "react";
import TestRenderer from "react-test-renderer";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockPush = jest.fn();

const mockStoreState = {
  players: [{ id: "p1", name: "Alice" }],
  matches: [
    {
      id: "m1",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      homeGoals: 0,
      awayGoals: 0,
    },
  ],
  commonMatchId: "m1",
  playerAssignments: { p1: ["m1"] },
  matchesPerPlayer: 2,
  setPlayers: jest.fn(),
  setMatches: jest.fn(),
  setCommonMatchId: jest.fn(),
  setPlayerAssignments: jest.fn(),
  setMatchesPerPlayer: jest.fn(),
};

jest.mock("react-native", () => ({
  View: "View",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../store/store", () => ({
  useGameStore: () => mockStoreState,
}));

jest.mock("../../app/style/theme", () => ({
  useColors: () => ({ background: "#fff" }),
}));

jest.mock("../../app/style/setupGameStyles", () => ({
  __esModule: true,
  default: () => ({
    safeArea: {},
  }),
}));

jest.mock("../../components/ui", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return {
    ShellScreen: ({ children, ...props }: any) =>
      ReactLocal.createElement(
        ReactNativeLocal.View,
        { testID: "ShellScreen", ...props },
        children,
      ),
  };
});

jest.mock("../../components", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  const makeComponent = (testID: string) => (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, { testID, ...props });

  return {
    SetupGamePlayerList: makeComponent("SetupGamePlayerList"),
    MatchList: makeComponent("MatchList"),
    AssignmentSection: makeComponent("AssignmentSection"),
    CommonMatchSelector: makeComponent("CommonMatchSelector"),
    SetupWizard: makeComponent("SetupWizard"),
  };
});

const renderSetupGameScreen = () => {
  const SetupGameScreen = require("../../app/setupGame").default;

  return TestRenderer.create(React.createElement(SetupGameScreen));
};

describe("SetupGameScreen responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("wires setup state into the route wizard", () => {
    const renderer = renderSetupGameScreen();
    const wizard = renderer.root.findByProps({ testID: "SetupWizard" });

    expect(wizard.props.canAdvanceToMatches).toBe(true);
    expect(wizard.props.canAdvanceToCommonMatch).toBe(true);
    expect(wizard.props.canAdvanceToAssign).toBe(true);
    expect(wizard.props.canStartGame).toBe(true);
    expect(wizard.props.playersStep.props.players).toEqual(
      mockStoreState.players,
    );
    expect(wizard.props.matchesStep.props.matches).toEqual(
      mockStoreState.matches,
    );
    expect(wizard.props.commonMatchStep.props.selectedCommonMatch).toBe(
      mockStoreState.commonMatchId,
    );
    expect(wizard.props.assignStep.props.playerAssignments).toEqual(
      mockStoreState.playerAssignments,
    );
  });

  it("keeps the shared shell unconstrained on phone-sized viewports", () => {
    const renderer = renderSetupGameScreen();
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(false);
    expect(shell.props.contentMaxWidth).toBeUndefined();
  });

  it("centers the shared shell on desktop-wide viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderSetupGameScreen();
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(true);
    expect(shell.props.contentMaxWidth).toBe(1120);
  });
});
