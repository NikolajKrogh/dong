/**
 * The lobby's behaviour for a game that is already under way.
 *
 * The bug this pins: `hasHydratedGameplayRef` is per-mount, so the lobby could
 * not tell "the game just started while I was watching" from "I opened the lobby
 * of a game that was already running". Both redirected to /gameProgress, which
 * made the lobby unreachable and turned Home's "Return to room" into a bounce
 * straight back into the game.
 *
 * The discriminator is whether this mount ever observed a pre-start state.
 */
import React from "react";

import { actCreate } from "../../../test-utils/render";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";

const mockReplace = jest.fn();
const mockPush = jest.fn();

const mockLobby: Record<string, unknown> = {};
const mockEndGame = jest.fn(async () => true);

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => ({ sessionId: "room-1", participantId: "p1" }),
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
    setCommonMatch: jest.fn(),
    setAssignments: jest.fn(),
    setAssignmentSettings: jest.fn(),
    setAssignmentMode: jest.fn(),
    setMyPicks: jest.fn(),
    startGame: jest.fn(),
    endGame: mockEndGame,
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

const snapshot = (state: string) => ({
  sessionId: "room-1",
  joinCode: "123456",
  state,
  commonMatchId: null,
  assignmentMode: "automatic",
  participants: [
    {
      id: "p1",
      displayName: "Host",
      membershipType: "registered",
      sessionRole: "owner",
      currentDrinkTotal: 0,
    },
  ],
  matches: [],
  assignments: [],
  picks: [],
  assignmentPlan: {
    participantCount: 1,
    poolSize: 0,
    matchesPerPlayer: 1,
    sharedMatchesPerPair: 0,
    effectivePerPlayer: 1,
    requiredPoolSize: 2,
    relaxedFloor: 1,
    feasible: false,
    startable: false,
  },
});

const setLobby = (state: string) => {
  Object.assign(mockLobby, {
    snapshot: snapshot(state),
    participants: snapshot(state).participants,
    myRole: "owner",
    state,
    joinCode: "123456",
    roomEnded: state === "closed" || state === "completed",
    gameStarted: state === "in_progress",
    error: null,
    refresh: jest.fn(),
  });
};

const renderLobby = () => {
  const LobbyScreen = require("../../../app/lobby/[sessionId]").default;
  return actCreate(
    React.createElement(TamaguiTestProvider, null, React.createElement(LobbyScreen)),
  );
};

describe("lobby, for a game already in progress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not redirect when opened on a room that is already running", () => {
    setLobby("in_progress");
    const tree = renderLobby();

    expect(mockReplace).not.toHaveBeenCalled();
    expect(
      tree.root.findAllByProps({ testID: "lobby-in-progress" }).length,
    ).toBeGreaterThan(0);
  });

  it("offers the host a way back into the game and a way to end it", () => {
    setLobby("in_progress");
    const tree = renderLobby();

    expect(
      tree.root.findAllByProps({ testID: "lobby-return-to-game" }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ testID: "lobby-end-game" }).length,
    ).toBeGreaterThan(0);
  });

  it("still redirects when the game starts while the lobby is open (FR-012)", () => {
    setLobby("joinable");
    const tree = renderLobby();
    expect(mockReplace).not.toHaveBeenCalled();

    setLobby("in_progress");
    TestRendererAct(() => {
      tree.update(
        React.createElement(
          TamaguiTestProvider,
          null,
          React.createElement(
            require("../../../app/lobby/[sessionId]").default,
          ),
        ),
      );
    });

    expect(mockReplace).toHaveBeenCalledWith("/gameProgress");
  });
});

// Local alias so the update above runs inside act, matching test-utils/render.
function TestRendererAct(callback: () => void) {
  const TestRenderer = require("react-test-renderer");
  TestRenderer.act(callback);
}
