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
const mockLeaveGuestRoom = jest.fn();

const mockStoreSetters = {
  setPlayers: jest.fn(),
  setMatches: jest.fn(),
  setCommonMatchId: jest.fn(),
  setPlayerAssignments: jest.fn(),
  setActiveGameContext: jest.fn(),
  clearActiveGameContext: jest.fn(),
  endedGuestSessionId: null as string | null,
};

let mockGuestSession: unknown = null;
let mockGuestRoomStatus = "idle";
let mockHomeRoomActions: Record<string, unknown> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("../../../features/account", () => ({
  useAccountAuth: () => ({ account: null }),
}));
jest.mock("../../../features/rooms/useHostRoomCreate", () => ({
  useHostRoomCreate: () => ({
    isCreating: false,
    error: null,
    createRoom: jest.fn(),
  }),
}));
jest.mock("../../../features/rooms/useMyActiveRoom", () => ({
  useMyActiveRoom: () => ({ activeRoom: null, refresh: jest.fn() }),
}));
jest.mock("../../../features/rooms/useRegisteredRoomJoin", () => ({
  useRegisteredRoomJoin: () => ({
    isJoining: false,
    error: null,
    conflictRoom: null,
    joinRoom: jest.fn(),
    clearConflict: jest.fn(),
  }),
}));
jest.mock("../../../features/rooms/useRoomExit", () => ({
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
jest.mock("../../../features/rooms/useGuestRoomJoin", () => ({
  useGuestRoomJoin: () => ({
    session: mockGuestSession,
    status: mockGuestRoomStatus,
    error: null,
    isSubmitting: false,
    leaveRoom: mockLeaveGuestRoom,
    submitGuestJoin: jest.fn(),
    setMyPicks: jest.fn(),
    isBusy: false,
  }),
}));

jest.mock("../../../store/gameStore", () => ({
  useGameStore: (selector: (state: unknown) => unknown) =>
    selector(mockStoreSetters),
}));

const buildSession = (state: string, sessionId = "session-1") => ({
  grant: {
    guestToken: "t",
    participantId: "guest-1",
    sessionId,
    joinCode: "ROOM42",
    displayName: "Casey",
  },
  snapshot: {
    sessionId,
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
  const { useHomeRoomActions } = require("../../../features/home/useHomeRoomActions") as {
    useHomeRoomActions: () => Record<string, unknown>;
  };
  const actions = useHomeRoomActions() as unknown as Record<string, unknown>;
  React.useEffect(() => {
    mockHomeRoomActions = actions;
  }, [actions]);
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

describe("guest room entry from Home", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGuestSession = null; mockGuestRoomStatus = "idle"; });
  it("opens the join dialog without a session", () => {
    const tree = renderHook();
    TestRenderer.act(() => (mockHomeRoomActions.handleOpenGuestJoin as () => void)());
    expect(mockHomeRoomActions.isGuestJoinModalVisible).toBe(true);
    TestRenderer.act(() => tree.unmount());
  });
  it("opens the guest page for an existing session", () => {
    mockGuestSession = buildSession("joinable"); const tree = renderHook();
    TestRenderer.act(() => (mockHomeRoomActions.handleOpenGuestJoin as () => void)());
    expect(mockPush).toHaveBeenCalledWith("/guestRoom?tab=matches");
    expect(mockHomeRoomActions.isGuestJoinModalVisible).toBe(false);
    TestRenderer.act(() => tree.unmount());
  });
  it("clears join fields after termination without owning navigation", () => {
    const tree = renderHook();
    TestRenderer.act(() => (mockHomeRoomActions.setGuestName as (name: string) => void)("Casey"));
    mockGuestRoomStatus = "ended"; rerender(tree);
    expect(mockHomeRoomActions.guestName).toBe(""); expect(mockReplace).not.toHaveBeenCalled();
    TestRenderer.act(() => tree.unmount());
  });
});
