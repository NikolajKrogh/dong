/**
 * The pre-start room, rendered as the single-player setup wizard.
 *
 * What matters here is that host and member get the *same four steps in the same
 * order* — SetupWizard's current step is uncontrolled, so a steps array whose
 * shape changed between the ~4s snapshot polls would remount the wizard and drop
 * the viewer back to step one mid-edit. The host/member difference lives inside
 * a step's content and in the final action, never in the array's shape.
 */
import React from "react";

import { actCreate } from "../../../test-utils/render";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";

const mockReplace = jest.fn();
const mockPush = jest.fn();

const mockLobby: Record<string, unknown> = {};
const mockSetCommonMatch = jest.fn();
const mockStartGame = jest.fn();

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => ({ sessionId: "room-1", participantId: "p1" }),
}));

// The wizard is stubbed so the steps array it is handed can be inspected
// directly. Rendering it for real would only ever show step one.
jest.mock("../../../components", () => ({
  SetupWizard: "SetupWizard",
  MatchList: "MatchList",
  CommonMatchSelector: "CommonMatchSelector",
}));
jest.mock("../../../components/matchSelection/SelectableMatchList", () => ({
  SelectableMatchList: "SelectableMatchList",
}));

jest.mock("../../../components/ui", () => ({
  ShellScreen: "ShellScreen",
  ShellActionButton: "ShellActionButton",
}));

jest.mock("../../../components/lobby/ParticipantList", () => ({
  ParticipantList: "ParticipantList",
}));
jest.mock("../../../components/lobby/PlayerPickPanel", () => ({
  PlayerPickPanel: "PlayerPickPanel",
}));
jest.mock("../../../components/lobby/RoomEndedNotice", () => ({
  RoomEndedNotice: "RoomEndedNotice",
}));
jest.mock("../../../components/lobby/SuccessorChooserModal", () => ({
  SuccessorChooserModal: "SuccessorChooserModal",
}));

jest.mock("../../../hooks/useRoomLobby", () => ({
  useRoomLobby: () => mockLobby,
}));

jest.mock("../../../hooks/useRoomConfigure", () => ({
  useRoomConfigure: () => ({
    isBusy: false,
    error: null,
    addMatch: jest.fn(),
    addMatches: jest.fn(),
    removeMatch: jest.fn(),
    removeMatches: jest.fn(),
    setCommonMatch: mockSetCommonMatch,
    setAssignments: jest.fn(),
    setAssignmentSettings: jest.fn(),
    setAssignmentMode: jest.fn(),
    setMyPicks: jest.fn(),
    startGame: mockStartGame,
    endGame: jest.fn(),
  }),
}));

jest.mock("../../../hooks/useRoomExit", () => ({
  useRoomExit: () => ({
    isExiting: false,
    error: null,
    pendingSuccessorChoice: false,
    eligibleSuccessors: [],
    needsCloseConfirm: false,
    exitRoom: jest.fn(),
    confirmSuccessor: jest.fn(),
    confirmClose: jest.fn(),
    cancel: jest.fn(),
  }),
}));

jest.mock("../../../store/store", () => ({
  useGameStore: (selector: (state: unknown) => unknown) =>
    selector({
      setPlayers: jest.fn(),
      setMatches: jest.fn(),
      setCommonMatchId: jest.fn(),
      setPlayerAssignments: jest.fn(),
    }),
}));

interface LobbyOptions {
  role?: "owner" | "member";
  state?: string;
  poolSize?: number;
  commonMatchId?: string | null;
  startable?: boolean;
}

const setLobby = ({
  role = "owner",
  state = "joinable",
  poolSize = 2,
  commonMatchId = "m1",
  startable = true,
}: LobbyOptions = {}) => {
  const matches = Array.from({ length: poolSize }, (_, index) => ({
    id: `m${index + 1}`,
    homeTeamName: `Home ${index + 1}`,
    awayTeamName: `Away ${index + 1}`,
    homeScore: 0,
    awayScore: 0,
    kickoffAt: null,
  }));
  const participants = [
    {
      id: "p1",
      displayName: "Host",
      membershipType: "registered",
      sessionRole: "owner",
      currentDrinkTotal: 0,
    },
  ];

  Object.assign(mockLobby, {
    snapshot: {
      sessionId: "room-1",
      joinCode: "123456",
      state,
      commonMatchId,
      assignmentMode: "automatic",
      participants,
      matches,
      assignments: [],
      picks: [],
      assignmentPlan: {
        participantCount: 1,
        poolSize,
        matchesPerPlayer: 1,
        sharedMatchesPerPair: 0,
        effectivePerPlayer: 1,
        requiredPoolSize: 2,
        relaxedFloor: 1,
        feasible: startable,
        startable,
      },
    },
    participants,
    myRole: role,
    state,
    joinCode: role === "owner" ? "123456" : null,
    roomEnded: state === "closed" || state === "completed",
    gameStarted: state === "in_progress",
    error: null,
    refresh: jest.fn(),
  });
};

const renderLobby = () => {
  const LobbyScreen = require("../../../app/lobby/[sessionId]").default;
  return actCreate(
    React.createElement(
      TamaguiTestProvider,
      null,
      React.createElement(LobbyScreen),
    ),
  );
};

/** The steps array handed to the (stubbed) wizard. */
const wizardProps = (tree: ReturnType<typeof actCreate>) =>
  tree.root.findByType("SetupWizard" as unknown as React.ElementType).props;

/** Renders one step's content on its own so it can be queried. */
const renderStep = (content: React.ReactNode) =>
  actCreate(React.createElement(TamaguiTestProvider, null, content));

describe("pre-start lobby, as the setup wizard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("gives the host the four wizard steps in wizard order", () => {
    setLobby({ role: "owner" });
    const props = wizardProps(renderLobby());

    expect(props.steps.map((step: { key: string }) => step.key)).toEqual([
      "room",
      "matches",
      "common",
      "assign",
    ]);
  });

  it("gives a member the identical step shape, so a poll cannot remount the wizard", () => {
    setLobby({ role: "member" });
    const props = wizardProps(renderLobby());

    expect(props.steps.map((step: { key: string }) => step.key)).toEqual([
      "room",
      "matches",
      "common",
      "assign",
    ]);
  });

  it("offers the host Start Game and a member nothing to press", () => {
    setLobby({ role: "owner" });
    expect(wizardProps(renderLobby()).finalAction.testID).toBe(
      "lobby-start-game",
    );

    setLobby({ role: "member" });
    // null is what makes SetupWizard render its "Waiting for host" placeholder.
    expect(wizardProps(renderLobby()).finalAction).toBeNull();
  });

  it("disables Start Game while the pool is below the hard floor", () => {
    setLobby({ role: "owner", startable: false });
    expect(wizardProps(renderLobby()).finalAction.disabled).toBe(true);
  });

  it("puts Leave Room in the first nav slot", () => {
    setLobby({ role: "owner" });
    expect(wizardProps(renderLobby()).firstSlotAction.testID).toBe(
      "lobby-leave-button",
    );
  });

  it("lets the host acquire matches but shows a member the pool inert", () => {
    setLobby({ role: "owner" });
    const hostStep = renderStep(wizardProps(renderLobby()).steps[1].content);
    expect(
      hostStep.root.findAllByType("MatchList" as unknown as React.ElementType)
        .length,
    ).toBe(1);

    setLobby({ role: "member" });
    const memberStep = renderStep(wizardProps(renderLobby()).steps[1].content);
    expect(
      memberStep.root.findAllByType("MatchList" as unknown as React.ElementType)
        .length,
    ).toBe(0);
    const inert = memberStep.root.findByType(
      "SelectableMatchList" as unknown as React.ElementType,
    );
    // Every match disabled — this is a view of the pool, not a control.
    expect(inert.props.disabledMatchIds).toEqual(["m1", "m2"]);
  });

  it("writes the host's Common Match choice back to the room", () => {
    setLobby({ role: "owner" });
    const step = renderStep(wizardProps(renderLobby()).steps[2].content);
    step.root
      .findByType("CommonMatchSelector" as unknown as React.ElementType)
      .props.handleSelectCommonMatch("m2");

    expect(mockSetCommonMatch).toHaveBeenCalledWith("m2");
  });

  it("shows a member the same cards without letting them write", () => {
    setLobby({ role: "member" });
    const step = renderStep(wizardProps(renderLobby()).steps[2].content);
    step.root
      .findByType("CommonMatchSelector" as unknown as React.ElementType)
      .props.handleSelectCommonMatch("m2");

    expect(mockSetCommonMatch).not.toHaveBeenCalled();
  });

  it("keeps the Assign step reachable for a picker before a Common Match exists", () => {
    setLobby({ role: "member", commonMatchId: null });
    const withoutPicking = wizardProps(renderLobby()).steps[3].canEnter;
    expect(withoutPicking).toBe(false);

    // player_picked + joinable is what `canPick` needs; the pick panel has to be
    // reachable whether or not the host has designated a Common Match yet.
    setLobby({ role: "member", commonMatchId: null });
    (mockLobby.snapshot as { assignmentMode: string }).assignmentMode =
      "player_picked";
    expect(wizardProps(renderLobby()).steps[3].canEnter).toBe(true);
  });

  it("does not mount the wizard for a game already in progress", () => {
    setLobby({ role: "owner", state: "in_progress" });
    const tree = renderLobby();

    expect(
      tree.root.findAllByType("SetupWizard" as unknown as React.ElementType)
        .length,
    ).toBe(0);
    expect(
      tree.root.findAllByProps({ testID: "lobby-in-progress" }).length,
    ).toBeGreaterThan(0);
  });
});
