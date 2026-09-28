import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../test-utils/render";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

jest.mock("react-native", () => ({
  Platform: { OS: "web", select: (o: Record<string, unknown>) => o.web ?? o.default },
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
  Modal: ({ children, visible }: { children: React.ReactNode; visible: boolean }) => {
    if (!visible) return null;
    const ReactLocal = require("react");
    const buttons: React.ReactNode[] = [];
    const visit = (node: any) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node?.props) return;
      if (String(node.props.testID ?? "").startsWith("game-leave-")) {
        buttons.push(ReactLocal.createElement("View", {
          testID: node.props.testID, onPress: node.props.onPress,
        }));
      }
      visit(node.props.children);
    };
    visit(children);
    return ReactLocal.createElement("View", { testID: "LeaveModal" }, buttons);
  },
  RefreshControl: "RefreshControl",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("tamagui", () => ({ Text: "Text", YStack: "View" }));
jest.mock("../../styles/responsive", () => ({ isWideLayout: (width: number) => width >= 768 }));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));

const mockResetState = jest.fn();
let mockActiveGameContext = { sessionId: null as string | null,
  participantId: null as string | null, accessKind: "registered" };
jest.mock("../../store/store", () => ({
  useGameStore: (selector: (state: unknown) => unknown) => selector({
    activeGameContext: mockActiveGameContext, resetState: mockResetState,
  }),
}));

const mockExitRoom = jest.fn(async () => ({ status: "left" }));
jest.mock("../../hooks/useRoomExit", () => ({ useRoomExit: () => ({
  exitRoom: mockExitRoom, confirmSuccessor: jest.fn(), confirmClose: jest.fn(),
  cancel: jest.fn(), error: null, isExiting: false,
  pendingSuccessorChoice: false, eligibleSuccessors: [], needsCloseConfirm: false,
}) }));
jest.mock("../../hooks/useGuestRoomSession", () => ({ useGuestRoomSession: () => ({
  status: "idle", error: null, leaveRoom: jest.fn(),
}) }));
jest.mock("../../components/lobby/SuccessorChooserModal", () => ({
  SuccessorChooserModal: () => null,
}));
jest.mock("../../components/gameProgress/MultiplayerGameStatus", () => ({
  MultiplayerGameStatus: () => null,
}));

const controllerState = {
  colors: { primary: "#123456" },
  styles: {
    safeArea: {},
    container: {},
    tabContent: {},
    footerContainer: {},
  },
  activeTab: "matches",
  isAlertVisible: false,
  selectedMatchId: null,
  isQuickActionsVisible: false,
  refreshing: false,
  players: [{ id: "p1", name: "Alice", drinksTaken: 0 }],
  matches: [
    {
      id: "m1",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      homeGoals: 0,
      awayGoals: 0,
    },
  ],
  commonMatchId: "",
  playerAssignments: { p1: ["m1"] },
  liveMatches: [],
  isPolling: false,
  lastUpdated: null,
  setActiveTab: jest.fn(),
  openQuickActions: jest.fn(),
  closeQuickActions: jest.fn(),
  onRefresh: jest.fn(),
  handleDrinkIncrement: jest.fn(),
  handleDrinkDecrement: jest.fn(),
  handleBackToSetup: jest.fn(),
  handleEndGame: jest.fn(),
  handleGoalIncrement: jest.fn(),
  handleGoalDecrement: jest.fn(),
  cancelEndGame: jest.fn(),
  confirmEndGame: jest.fn(),
};

const mockUseGameProgressController = jest.fn(() => controllerState);

jest.mock("../../hooks/useGameProgressController", () => ({
  __esModule: true,
  default: () => mockUseGameProgressController(),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("../../components/ui", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return {
    ShellActionButton: ({ label, onPress, testID, disabled }: any) =>
      ReactLocal.createElement("View", { testID, onPress, disabled, label }),
    ShellScreen: ({ children, ...props }: any) =>
      ReactLocal.createElement(
        ReactNativeLocal.View,
        { testID: "ShellScreen", ...props },
        children,
      ),
  };
});

jest.mock("../../components/gameProgress/TabNavigation", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return ({ children, ...props }: any) =>
    ReactLocal.createElement(
      ReactNativeLocal.View,
      { testID: "TabNavigation", ...props },
      children,
    );
});

jest.mock("../../components/gameProgress/MatchesGrid/", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "MatchesGrid",
      ...props,
    });
});

jest.mock("../../components/gameProgress/PlayersList", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "PlayersList",
      ...props,
    });
});

jest.mock("../../components/gameProgress/MatchQuickActionsModal", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "MatchQuickActionsModal",
      ...props,
    });
});

jest.mock("../../components/gameProgress/EndGameModal", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "EndGameModal",
      ...props,
    });
});

jest.mock("../../components/gameProgress/FooterButtons", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, {
      testID: "FooterButtons",
      ...props,
    });
});

jest.mock("../../components/gameProgress/ReassignmentControl", () => ({
  ReassignmentControl: () => null,
}));

const renderGameProgressScreen = () => {
  const GameProgressScreen = require("../../app/gameProgress").default;

  return actCreate(React.createElement(GameProgressScreen));
};

describe("GameProgressScreen responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveGameContext = { sessionId: null, participantId: null, accessKind: "registered" };
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("cancels departure without a command, then confirms once", async () => {
    mockActiveGameContext = { sessionId: "room-1", participantId: "p1",
      accessKind: "registered" };
    mockUseGameProgressController.mockReturnValue({ ...controllerState,
      activeGame: { isMultiplayer: true, isHost: false, isEditable: true,
        status: "ready", snapshot: null },
    } as never);
    const renderer = renderGameProgressScreen();
    const footer = renderer.root.findByProps({ testID: "FooterButtons" });
    expect(footer.props.showLeaveGame).toBe(true);
    await TestRenderer.act(async () => { footer.props.onLeaveGame(); });
    await TestRenderer.act(async () => {
      renderer.root.findByProps({ testID: "game-leave-cancel" }).props.onPress();
    });
    expect(mockExitRoom).not.toHaveBeenCalled();
    await TestRenderer.act(async () => { footer.props.onLeaveGame(); });
    await TestRenderer.act(async () => {
      await renderer.root.findByProps({ testID: "game-leave-confirm-button" }).props.onPress();
    });
    expect(mockExitRoom).toHaveBeenCalledTimes(1);
    expect(mockResetState).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("wires controller data into the route layout", () => {
    const renderer = renderGameProgressScreen();
    const tabNavigation = renderer.root.findByProps({
      testID: "TabNavigation",
    });
    const footerButtons = renderer.root.findByProps({
      testID: "FooterButtons",
    });

    expect(mockUseGameProgressController).toHaveBeenCalled();
    expect(tabNavigation.props.matchesCount).toBe(1);
    expect(tabNavigation.props.playersCount).toBe(1);
    expect(footerButtons.props.onBackToSetup).toBe(
      controllerState.handleBackToSetup,
    );
    expect(footerButtons.props.onEndGame).toBe(controllerState.handleEndGame);
  });

  it("keeps the shared shell unconstrained on phone-sized viewports", () => {
    const renderer = renderGameProgressScreen();
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

    const renderer = renderGameProgressScreen();
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(true);
    expect(shell.props.contentMaxWidth).toBe(1280);
  });

  it("disables multiplayer editing and End Game for a non-editable member", () => {
    mockUseGameProgressController.mockReturnValue({
      ...controllerState,
      activeGame: {
        isMultiplayer: true,
        isHost: false,
        isEditable: false,
        status: "offline",
        error: "Offline",
        snapshot: null,
        ownerParticipantId: "owner",
        participantId: "p1",
        pendingMutations: [],
        lastAppliedSequence: 1,
        refresh: jest.fn(),
        changeManualScore: jest.fn(),
        changeParticipantDrink: jest.fn(),
        retryMutation: jest.fn(),
        completeGame: jest.fn(),
        reassignParticipantMatches: jest.fn(),
      },
    } as never);
    const renderer = renderGameProgressScreen();

    expect(renderer.root.findByProps({ testID: "PlayersList" }).props.disabled).toBe(
      true,
    );
    expect(
      renderer.root.findByProps({ testID: "MatchQuickActionsModal" }).props.disabled,
    ).toBe(true);
    expect(
      renderer.root.findByProps({ testID: "FooterButtons" }).props.showEndGame,
    ).toBe(false);
    mockUseGameProgressController.mockReturnValue(controllerState);
  });
});

jest.mock("../../components/gameProgress/MultiplayerGameStatus", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return {
    MultiplayerGameStatus: (props: any) =>
      ReactLocal.createElement(ReactNativeLocal.View, {
        testID: "MultiplayerGameStatus",
        ...props,
      }),
  };
});
