/**
 * A guest joins the game when the host starts it (FR-012).
 *
 * The guest surface used to sit on "Current state: in_progress" indefinitely —
 * the registered lobby redirected, the guest card did not. These pin both
 * halves: that the redirect happens on an observed start, and that it does
 * *not* happen when the card is opened on a room that was already running,
 * because "Leave Guest Room" only exists inside that card.
 */
import React from "react";
import TestRenderer from "react-test-renderer";

const mockPush = jest.fn();
const mockReplace = jest.fn();

const mockStoreSetters = {
  setPlayers: jest.fn(),
  setMatches: jest.fn(),
  setCommonMatchId: jest.fn(),
  setPlayerAssignments: jest.fn(),
};

let mockGuestSession: unknown = null;

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("../../hooks/useAccountAuth", () => ({
  useAccountAuth: () => ({ account: null }),
}));
jest.mock("../../hooks/useHostRoomCreate", () => ({
  useHostRoomCreate: () => ({
    isCreating: false,
    error: null,
    createRoom: jest.fn(),
  }),
}));
jest.mock("../../hooks/useMyActiveRoom", () => ({
  useMyActiveRoom: () => ({ activeRoom: null, refresh: jest.fn() }),
}));
jest.mock("../../hooks/useRegisteredRoomJoin", () => ({
  useRegisteredRoomJoin: () => ({
    isJoining: false,
    error: null,
    conflictRoom: null,
    joinRoom: jest.fn(),
    clearConflict: jest.fn(),
  }),
}));
jest.mock("../../hooks/useRoomExit", () => ({
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
jest.mock("../../hooks/useGuestRoomJoin", () => ({
  useGuestRoomJoin: () => ({
    session: mockGuestSession,
    error: null,
    isSubmitting: false,
    leaveRoom: jest.fn(),
    submitGuestJoin: jest.fn(),
    setMyPicks: jest.fn(),
    isBusy: false,
  }),
}));

jest.mock("../../store/store", () => ({
  useGameStore: (selector: (state: unknown) => unknown) =>
    selector(mockStoreSetters),
}));

const buildSession = (state: string) => ({
  grant: {
    guestToken: "t",
    participantId: "guest-1",
    sessionId: "session-1",
    joinCode: "ROOM42",
    displayName: "Casey",
  },
  snapshot: {
    sessionId: "session-1",
    joinCode: "ROOM42",
    state,
    commonMatchId: "match-1",
    assignmentMode: "automatic",
    participants: [
      {
        id: "guest-1",
        displayName: "Casey",
        membershipType: "guest",
        sessionRole: "member",
        currentDrinkTotal: 0,
      },
    ],
    matches: [
      {
        id: "match-1",
        sourceProvider: "espn",
        sourceMatchId: "e1",
        homeTeamName: "Arsenal",
        awayTeamName: "Chelsea",
        kickoffAt: null,
        // Nullable on the guest snapshot, unlike the registered one.
        homeScore: null,
        awayScore: null,
      },
    ],
    assignments: [{ participantId: "guest-1", matchId: "match-1" }],
    picks: [],
    assignmentPlan: {
      participantCount: 1,
      poolSize: 1,
      matchesPerPlayer: 1,
      sharedMatchesPerPair: 0,
      effectivePerPlayer: 1,
      requiredPoolSize: 2,
      relaxedFloor: 2,
      feasible: false,
      startable: false,
    },
  },
});

// One component identity, defined once. Declaring Probe inside the render
// helpers gave `update()` a *different* component type each time, which
// remounts rather than re-renders — resetting the very refs under test.
const Probe: React.FC = () => {
  const { useHomeRoomActions } = require("../../hooks/useHomeRoomActions") as {
    useHomeRoomActions: () => Record<string, unknown>;
  };
  useHomeRoomActions();
  return null;
};

const renderHook = () => {
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });
  return renderer as unknown as TestRenderer.ReactTestRenderer;
};

const rerender = (renderer: TestRenderer.ReactTestRenderer) => {
  TestRenderer.act(() => {
    renderer.update(React.createElement(Probe));
  });
};

describe("guest joins the game when the host starts it", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGuestSession = null;
  });

  it("redirects when the start is observed from the guest card", () => {
    mockGuestSession = buildSession("joinable");
    const renderer = renderHook();
    expect(mockPush).not.toHaveBeenCalled();

    mockGuestSession = buildSession("in_progress");
    rerender(renderer);

    expect(mockPush).toHaveBeenCalledWith("/gameProgress");
  });

  it("hydrates the gameplay store from the guest snapshot", () => {
    mockGuestSession = buildSession("joinable");
    const renderer = renderHook();
    mockGuestSession = buildSession("in_progress");
    rerender(renderer);

    expect(mockStoreSetters.setPlayers).toHaveBeenCalledWith([
      { id: "guest-1", name: "Casey", drinksTaken: 0 },
    ]);
    // Null scores must land as 0 — the game screen increments them.
    expect(mockStoreSetters.setMatches).toHaveBeenCalledWith([
      expect.objectContaining({ homeGoals: 0, awayGoals: 0 }),
    ]);
    expect(mockStoreSetters.setCommonMatchId).toHaveBeenCalledWith("match-1");
  });

  it("does not redirect when opened on a room that is already running", () => {
    // Otherwise the guest is trapped: Leave Guest Room lives in the card they
    // would be bounced away from.
    mockGuestSession = buildSession("in_progress");
    renderHook();

    expect(mockPush).not.toHaveBeenCalled();
    // Hydration still runs, so the game screen has something to show.
    expect(mockStoreSetters.setPlayers).toHaveBeenCalled();
  });
});
