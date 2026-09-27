import React from "react";
import TestRenderer from "react-test-renderer";

import { GameplayRpcError, type RoomSnapshot } from "../../types/room";
import { useGameStore } from "../../store/store";
import { useAppVisibility } from "../../platform";
import {
  applyPendingOverlay,
  canApplySnapshot,
  useActiveGameRoomSync,
} from "../../hooks/useActiveGameRoomSync";

jest.mock("../../platform", () => ({
  useAppVisibility: jest.fn(),
}));
jest.mock("../../utils/guestRoom", () => ({
  ...jest.requireActual("../../utils/guestRoom"),
  readGuestRoomPendingLeave: jest.fn(),
  readGuestRoomSessionGrant: jest.fn(),
  clearGuestRoomSessionGrant: jest.fn(async () => undefined),
  isExpiredGuestRoomError: jest.fn((error: unknown) =>
    error instanceof Error && error.message === "guest_access_lost",
  ),
}));
jest.mock("../../utils/commandApiClient", () => ({
  generateIdempotencyKey: jest.fn(
    () => "00000000-0000-4000-8000-000000000099",
  ),
}));
jest.mock("../../utils/supabaseClient", () => ({
  getGuestRoomRpcClient: jest.fn(),
  getProviderScoreRefreshClient: jest.fn(() => ({
    refreshProviderScores: jest.fn().mockResolvedValue({
      sessionId: "session-1",
      requestId: "00000000-0000-4000-8000-000000000099",
      status: "updated",
      refreshedAt: "2026-09-03T00:00:00.000Z",
      results: [],
      warnings: [],
    }),
  })),
  getRoomRpcClient: jest.fn(),
  getSupabaseClient: jest.fn(() => ({
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      track: jest.fn().mockResolvedValue("ok"),
      presenceState: jest.fn(() => ({})),
    })),
    removeChannel: jest.fn().mockResolvedValue("ok"),
  })),
  mapGameplayError: jest.fn(() => null),
}));

const mockVisibility = jest.mocked(useAppVisibility);
const { getGuestRoomRpcClient, getRoomRpcClient, getSupabaseClient, mapGameplayError } = jest.requireMock(
  "../../utils/supabaseClient",
) as { getGuestRoomRpcClient: jest.Mock; getRoomRpcClient: jest.Mock; getSupabaseClient: jest.Mock; mapGameplayError: jest.Mock };
const { isExpiredGuestRoomError, readGuestRoomPendingLeave, readGuestRoomSessionGrant } = jest.requireMock(
  "../../utils/guestRoom",
) as { isExpiredGuestRoomError: jest.Mock; readGuestRoomPendingLeave: jest.Mock; readGuestRoomSessionGrant: jest.Mock };

const snapshot = (overrides: Partial<RoomSnapshot> = {}): RoomSnapshot => ({
  sessionId: "session-1",
  joinCode: "ROOM1",
  state: "in_progress",
  ownerParticipantId: "participant-1",
  lastEventSequence: 10,
  commonMatchId: "match-common",
  assignmentMode: "automatic",
  participants: [
    {
      id: "participant-1",
      displayName: "Host",
      membershipType: "registered",
      sessionRole: "owner",
      currentDrinkTotal: 1,
    },
  ],
  matches: [
    {
      id: "match-common",
      sourceProvider: "manual",
      sourceMatchId: "common",
      homeTeamName: "A",
      awayTeamName: "B",
      kickoffAt: null,
      homeScore: 1,
      awayScore: 0,
    },
    {
      id: "match-manual",
      sourceProvider: "manual",
      sourceMatchId: "manual",
      homeTeamName: "C",
      awayTeamName: "D",
      kickoffAt: null,
      homeScore: 0,
      awayScore: 0,
    },
  ],
  assignments: [
    { participantId: "participant-1", matchId: "match-common" },
    { participantId: "participant-1", matchId: "match-manual" },
  ],
  picks: [],
  assignmentPlan: {
    participantCount: 1,
    poolSize: 2,
    matchesPerPlayer: 1,
    sharedMatchesPerPair: 0,
    effectivePerPlayer: 1,
    requiredPoolSize: 2,
    relaxedFloor: 1,
    feasible: true,
    startable: true,
  },
  ...overrides,
});

describe("active room sync composition", () => {
  beforeEach(() => {
    useGameStore.setState({ endedGuestSessionId: null });
    jest.clearAllMocks();
    readGuestRoomPendingLeave.mockResolvedValue(null);
    readGuestRoomSessionGrant.mockResolvedValue(null);
    mockVisibility.mockReturnValue({
      snapshot: {
        state: "active",
        source: "appState",
        isInteractive: true,
        capturedAt: Date.now(),
      },
      visibilityState: "active",
      isInteractive: true,
    });
  });

  it("publishes host termination and discards a late guest mutation result", async () => {
    const rpcSnapshot = snapshot();
    readGuestRoomSessionGrant.mockResolvedValue({ guestToken: "guest-token", sessionId: "session-1", participantId: "participant-1" });
    const getGuestRoomSnapshot = jest.fn().mockResolvedValue(rpcSnapshot);
    let finishMutation!: (value: unknown) => void;
    const changeManualScoreAsGuest = jest.fn(() => new Promise((resolve) => { finishMutation = resolve; }));
    getGuestRoomRpcClient.mockReturnValue({ getGuestRoomSnapshot, changeManualScoreAsGuest });
    useGameStore.setState({
      activeGameContext: { mode: "multiplayer", sessionId: "session-1", participantId: "participant-1", accessKind: "guest", lastAppliedSequence: 10 },
      players: [], matches: [], commonMatchId: null, playerAssignments: {},
    });
    let latest!: ReturnType<typeof useActiveGameRoomSync>;
    function Probe() {
      const value = useActiveGameRoomSync();
      React.useEffect(() => { latest = value; }, [value]);
      return null;
    }
    let renderer!: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => { renderer = TestRenderer.create(React.createElement(Probe)); });
    let pending!: ReturnType<typeof latest.changeManualScore>;
    await TestRenderer.act(async () => { pending = latest.changeManualScore("match-manual", "home", 1); });
    expect(latest.pendingMutations).toHaveLength(1);
    getGuestRoomSnapshot.mockRejectedValue(new Error("room_ended"));
    await TestRenderer.act(async () => { await latest.refresh(); });
    expect(useGameStore.getState().endedGuestSessionId).toBe("session-1");
    expect(useGameStore.getState().activeGameContext.sessionId).toBeNull();
    expect(useGameStore.getState().matches).toEqual([]);
    const { clearGuestRoomSessionGrant } = jest.requireMock("../../utils/guestRoom");
    expect(clearGuestRoomSessionGrant).toHaveBeenCalledWith("session-1");
    await TestRenderer.act(async () => {
      finishMutation({ sessionId: "session-1", matchId: "match-manual", homeScore: 1, awayScore: 0, lastEventSequence: 11 });
      await pending;
    });
    expect(useGameStore.getState().matches).toEqual([]);
    expect(useGameStore.getState().players).toEqual([]);
    expect(useGameStore.getState().activeGameContext.sessionId).toBeNull();
    expect(latest.pendingMutations).toEqual([]);
    await TestRenderer.act(async () => renderer.unmount());
  });

  it("renders pending score and drink changes over the last canonical snapshot", () => {
    const next = applyPendingOverlay(snapshot(), [
      {
        id: "goal-1",
        kind: "manual_score",
        matchId: "match-manual",
        team: "home",
        deltaGoals: 1,
        status: "pending",
      },
      {
        id: "drink-1",
        kind: "drink",
        participantId: "participant-1",
        deltaHalfDrinks: 1,
        status: "pending",
      },
    ]);

    expect(next.matches.find((match) => match.id === "match-manual")?.homeGoals).toBe(1);
    expect(next.players[0]?.drinksTaken).toBe(1.5);
    expect(next.matches.find((match) => match.id === "match-common")?.homeGoals).toBe(1);
  });

  it("does not overlay uncertain mutations over a canonical snapshot", () => {
    const next = applyPendingOverlay(snapshot(), [
      {
        id: "goal-uncertain",
        kind: "manual_score",
        matchId: "match-manual",
        team: "home",
        deltaGoals: 1,
        status: "uncertain",
      },
      {
        id: "drink-uncertain",
        kind: "drink",
        participantId: "participant-1",
        deltaHalfDrinks: 1,
        status: "uncertain",
      },
    ]);

    expect(
      next.matches.find((match) => match.id === "match-manual")?.homeGoals,
    ).toBe(0);
    expect(next.players[0]?.drinksTaken).toBe(1);
  });

  it("rejects older poll responses but accepts an equal or newer sequence", () => {
    expect(canApplySnapshot(10, snapshot({ lastEventSequence: 9 }))).toBe(false);
    expect(canApplySnapshot(10, snapshot({ lastEventSequence: 10 }))).toBe(true);
    expect(canApplySnapshot(10, snapshot({ lastEventSequence: 11 }))).toBe(true);
  });

  it("reconciles an accepted optimistic command into canonical state", async () => {
    const rpcSnapshot = snapshot();
    const changeManualScore = jest.fn().mockResolvedValue({
      sessionId: rpcSnapshot.sessionId,
      matchId: "match-manual",
      homeScore: 1,
      awayScore: 0,
      sequenceNumber: 11,
      eventId: "event-11",
      replayed: false,
    });
    getRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn().mockResolvedValue(rpcSnapshot),
      changeManualScore,
    });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: rpcSnapshot.sessionId,
        participantId: "participant-1",
        accessKind: "registered",
        lastAppliedSequence: 10,
      },
      matches: [],
      players: [],
      playerAssignments: {},
      commonMatchId: null,
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      await latest!.changeManualScore("match-manual", "home", 1);
    });

    expect(changeManualScore).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: "match-manual",
        team: "home",
        deltaGoals: 1,
      }),
    );
    expect(latest!.pendingMutations).toHaveLength(0);
    expect(latest!.status).toBe("ready");
    expect(useGameStore.getState().matches.find((match) => match.id === "match-manual")?.homeGoals).toBe(1);
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("keeps an uncertain request retryable while offline and resolves it once", async () => {
    const rpcSnapshot = snapshot();
    const changeManualScore = jest
      .fn()
      .mockRejectedValueOnce(new Error("network request failed"))
      .mockResolvedValueOnce({
        sessionId: rpcSnapshot.sessionId,
        matchId: "match-manual",
        homeScore: 1,
        awayScore: 0,
        sequenceNumber: 11,
        eventId: "event-11",
        replayed: true,
      });
    getRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn().mockResolvedValue(rpcSnapshot),
      changeManualScore,
    });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: rpcSnapshot.sessionId,
        participantId: "participant-1",
        accessKind: "registered",
        lastAppliedSequence: 10,
      },
      matches: [],
      players: [],
      playerAssignments: {},
      commonMatchId: null,
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      await expect(
        latest!.changeManualScore("match-manual", "home", 1),
      ).rejects.toThrow("network request failed");
    });
    expect(latest!.status).toBe("offline");
    expect(latest!.pendingMutations[0]?.status).toBe("uncertain");

    await TestRenderer.act(async () => {
      await latest!.retryMutation(latest!.pendingMutations[0]!.id);
    });
    expect(changeManualScore).toHaveBeenCalledTimes(2);
    expect(latest!.pendingMutations).toHaveLength(0);
    expect(latest!.status).toBe("ready");
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("rolls back a rejected optimistic command and exposes the stable error", async () => {
    const rpcSnapshot = snapshot();
    const changeManualScore = jest.fn().mockRejectedValue(
      new GameplayRpcError("negative_result", "A score cannot become negative."),
    );
    getRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn().mockResolvedValue(rpcSnapshot),
      changeManualScore,
    });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: rpcSnapshot.sessionId,
        participantId: "participant-1",
        accessKind: "registered",
        lastAppliedSequence: 10,
      },
      matches: [],
      players: [],
      playerAssignments: {},
      commonMatchId: null,
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      await expect(
        latest!.changeManualScore("match-manual", "home", -1),
      ).rejects.toMatchObject({ code: "negative_result" });
    });

    expect(latest!.pendingMutations).toHaveLength(0);
    expect(latest!.error).toBe("A score cannot become negative.");
    expect(useGameStore.getState().matches.find((match) => match.id === "match-manual")?.homeGoals).toBe(0);
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("keeps a completed room read-only after hydration", async () => {
    const completed = {
      ...snapshot(),
      state: "completed" as const,
      lastEventSequence: 12,
    };
    getRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn().mockResolvedValue(completed),
    });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: completed.sessionId,
        participantId: "participant-1",
        accessKind: "registered",
        lastAppliedSequence: 10,
      },
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
    });

    expect(latest!.status).toBe("ended");
    expect(latest!.isEditable).toBe(false);
    await expect(
      latest!.changeManualScore("match-manual", "home", 1),
    ).rejects.toMatchObject({ code: "service_unavailable" });
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("clears persisted room identity while retaining an access-lost notice", async () => {
    const forbidden = new GameplayRpcError(
      "forbidden",
      "You do not have access to this room.",
    );
    getRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn().mockRejectedValue(forbidden),
    });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: "session-1",
        participantId: "participant-1",
        accessKind: "registered",
        lastAppliedSequence: 10,
      },
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
    });

    expect(latest!.status).toBe("access_lost");
    expect(latest!.isMultiplayer).toBe(true);
    expect(useGameStore.getState().activeGameContext.mode).toBe("solo");
    expect(useGameStore.getState().activeGameContext.sessionId).toBeNull();
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("uses private registered-room broadcasts to refresh the canonical snapshot", async () => {
    const handlers = new Map<string, () => void>();
    const channel: any = {};
    channel.on = jest.fn((_type: string, filter: { event: string }, callback: () => void) => {
        handlers.set(filter.event, callback);
        return channel;
      });
    channel.subscribe = jest.fn((callback: (state: string) => void) => {
        callback("SUBSCRIBED");
        return channel;
      });
    channel.track = jest.fn().mockResolvedValue("ok");
    channel.presenceState = jest.fn(() => ({}));
    const removeChannel = jest.fn().mockResolvedValue("ok");
    const supabaseClient = {
      channel: jest.fn(() => channel),
      removeChannel,
    };
    getSupabaseClient.mockReturnValueOnce(supabaseClient);
    const getRoomSnapshot = jest.fn(async () => snapshot());
    getRoomRpcClient.mockReturnValue({ getRoomSnapshot });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: "session-1",
        participantId: "participant-1",
        accessKind: "registered",
        lastAppliedSequence: 10,
      },
    });

    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(() => {
        useActiveGameRoomSync();
        return null;
      }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(channel.on).toHaveBeenCalledWith("broadcast", { event: "room_changed" }, expect.any(Function));
    expect(supabaseClient.channel).toHaveBeenCalledWith("room:session-1", {
      config: { private: true, presence: { key: "participant-1" } },
    });
    expect(channel.track).toHaveBeenCalledWith({});

    await TestRenderer.act(async () => {
      handlers.get("room_changed")?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getRoomSnapshot).toHaveBeenCalledTimes(2);

    await TestRenderer.act(async () => renderer!.unmount());
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });

  it("maps raw snapshot authorization errors to terminal access loss", async () => {
    getRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn().mockRejectedValue({ message: "forbidden" }),
    });
    mapGameplayError.mockReturnValueOnce(
      new GameplayRpcError("forbidden", "You do not have access to this room."),
    );
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: "session-1",
        participantId: "participant-1",
        accessKind: "registered",
        lastAppliedSequence: 10,
      },
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
    });

    expect(mapGameplayError).toHaveBeenCalledWith({ message: "forbidden" });
    expect(latest!.status).toBe("access_lost");
    expect(useGameStore.getState().activeGameContext.mode).toBe("solo");
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("treats host-revoked guest access as terminal access loss", async () => {
    readGuestRoomSessionGrant.mockResolvedValue({
      guestToken: "guest-token",
      participantId: "participant-1",
      sessionId: "session-1",
      joinCode: "ROOM1",
      displayName: "Guest",
    });
    getGuestRoomRpcClient.mockReturnValue({
      getGuestRoomSnapshot: jest.fn().mockRejectedValue(new Error("guest_access_lost")),
    });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: "session-1",
        participantId: "participant-1",
        accessKind: "guest",
        lastAppliedSequence: 10,
      },
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(isExpiredGuestRoomError).toHaveBeenCalledWith(expect.any(Error));
    expect(latest!.status).toBe("access_lost");
    expect(useGameStore.getState().activeGameContext.mode).toBe("solo");
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("keeps gameplay state when a guest leave is still awaiting confirmation", async () => {
    const pendingLeave = {
      guestToken: "guest-token",
      participantId: "participant-1",
      sessionId: "session-1",
      joinCode: "ROOM1",
      displayName: "Guest",
    };
    const getGuestRoomSnapshot = jest.fn();
    readGuestRoomPendingLeave.mockResolvedValue(pendingLeave);
    readGuestRoomSessionGrant.mockResolvedValue(pendingLeave);
    getGuestRoomRpcClient.mockReturnValue({ getGuestRoomSnapshot });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: "session-1",
        participantId: "participant-1",
        accessKind: "guest",
        lastAppliedSequence: 10,
      },
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest!.status).toBe("offline");
    expect(latest!.error).toContain("awaiting confirmation");
    expect(readGuestRoomSessionGrant).not.toHaveBeenCalled();
    expect(getGuestRoomSnapshot).not.toHaveBeenCalled();
    expect(useGameStore.getState().activeGameContext).toMatchObject({
      mode: "multiplayer",
      sessionId: "session-1",
    });
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("does not apply a guest snapshot fetched before leave became pending", async () => {
    const pendingLeave = {
      guestToken: "guest-token",
      participantId: "participant-1",
      sessionId: "session-1",
      joinCode: "ROOM1",
      displayName: "Guest",
    };
    let resolveSnapshot!: (value: RoomSnapshot) => void;
    const snapshotRequest = new Promise<RoomSnapshot>((resolve) => {
      resolveSnapshot = resolve;
    });
    const getGuestRoomSnapshot = jest.fn(() => snapshotRequest);
    readGuestRoomSessionGrant.mockResolvedValue(pendingLeave);
    getGuestRoomRpcClient.mockReturnValue({ getGuestRoomSnapshot });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: "session-1",
        participantId: "participant-1",
        accessKind: "guest",
        lastAppliedSequence: 10,
      },
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getGuestRoomSnapshot).toHaveBeenCalledTimes(1);

    readGuestRoomPendingLeave.mockResolvedValue(pendingLeave);
    await TestRenderer.act(async () => {
      resolveSnapshot(snapshot());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest!.status).toBe("offline");
    expect(latest!.snapshot).toBeNull();
    expect(useGameStore.getState().activeGameContext).toMatchObject({
      mode: "multiplayer",
      sessionId: "session-1",
    });
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("does not let a room-A response overwrite room B after a switch", async () => {
    let resolveRoomA!: (value: RoomSnapshot) => void;
    const roomAResponse = new Promise<RoomSnapshot>((resolve) => {
      resolveRoomA = resolve;
    });
    const roomB = snapshot({
      sessionId: "session-2",
      joinCode: "ROOM2",
      lastEventSequence: 20,
      matches: snapshot().matches.map((match) => ({
        ...match,
        homeScore: match.id === "match-manual" ? 4 : match.homeScore,
      })),
    });
    getRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn((sessionId: string) =>
        sessionId === "session-1" ? roomAResponse : Promise.resolve(roomB),
      ),
    });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: "session-1",
        participantId: "participant-1",
        accessKind: "registered",
        lastAppliedSequence: 0,
      },
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
    });
    await TestRenderer.act(async () => {
      useGameStore.getState().setActiveGameContext({
        mode: "multiplayer",
        sessionId: "session-2",
        participantId: "participant-1",
        accessKind: "registered",
        lastAppliedSequence: 0,
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest!.snapshot?.sessionId).toBe("session-2");

    await TestRenderer.act(async () => {
      resolveRoomA(snapshot({ lastEventSequence: 99 }));
      await roomAResponse;
    });

    expect(latest!.snapshot?.sessionId).toBe("session-2");
    expect(
      useGameStore.getState().matches.find((match) => match.id === "match-manual")
        ?.homeGoals,
    ).toBe(4);
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("accepts host reassignment without rewriting canonical score or drink state", async () => {
    const rpcSnapshot = snapshot();
    const reassignParticipantMatches = jest.fn().mockResolvedValue({
      sessionId: rpcSnapshot.sessionId,
      participantId: "participant-1",
      addedMatchIds: ["match-manual"],
      removedMatchIds: [],
      matchIds: ["match-manual"],
      sequenceNumber: 11,
    });
    getRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest
        .fn()
        .mockResolvedValueOnce(rpcSnapshot)
        .mockResolvedValueOnce({ ...rpcSnapshot, lastEventSequence: 11 }),
      reassignParticipantMatches,
    });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: rpcSnapshot.sessionId,
        participantId: "participant-1",
        accessKind: "registered",
        lastAppliedSequence: 10,
      },
      matches: [],
      players: [],
      playerAssignments: {},
      commonMatchId: null,
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      await latest!.reassignParticipantMatches("participant-1", ["match-manual"]);
    });

    expect(reassignParticipantMatches).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: rpcSnapshot.sessionId,
        participantId: "participant-1",
        matchIds: ["match-manual"],
      }),
    );
    expect(useGameStore.getState().players[0]?.drinksTaken).toBe(1);
    expect(useGameStore.getState().matches[0]?.homeGoals).toBe(1);
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("rejects duplicate completion while the canonical request is pending", async () => {
    const rpcSnapshot = snapshot();
    let resolveCompletion!: (value: { status: "completed"; sessionId: string }) => void;
    const completion = new Promise<{ status: "completed"; sessionId: string }>(
      (resolve) => {
        resolveCompletion = resolve;
      },
    );
    const endGameSession = jest.fn(() => completion);
    getRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn().mockResolvedValue(rpcSnapshot),
      endGameSession,
    });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: rpcSnapshot.sessionId,
        participantId: "participant-1",
        accessKind: "registered",
        lastAppliedSequence: 10,
      },
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
    });

    let first!: Promise<{ status: "completed" | "closed"; sessionId: string }>;
    await TestRenderer.act(async () => {
      first = latest!.completeGame();
      await expect(latest!.completeGame()).rejects.toThrow(
        "Game completion is already in progress.",
      );
    });
    resolveCompletion({ status: "completed", sessionId: rpcSnapshot.sessionId });
    await TestRenderer.act(async () => {
      await first;
    });

    expect(endGameSession).toHaveBeenCalledTimes(1);
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("keeps host actions available during a routine snapshot refresh", async () => {
    const rpcSnapshot = snapshot();
    const getRoomSnapshot = jest.fn().mockResolvedValue(rpcSnapshot);
    getRoomRpcClient.mockReturnValue({ getRoomSnapshot });
    useGameStore.setState({
      activeGameContext: {
        mode: "multiplayer",
        sessionId: rpcSnapshot.sessionId,
        participantId: "participant-1",
        accessKind: "registered",
        lastAppliedSequence: 10,
      },
    });

    let latest: ReturnType<typeof useActiveGameRoomSync> | undefined;
    const Probe = () => {
      latest = useActiveGameRoomSync();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
    });
    expect(latest!.status).toBe("ready");
    expect(latest!.isEditable).toBe(true);

    let resolveRefresh!: (value: RoomSnapshot) => void;
    getRoomSnapshot.mockImplementationOnce(
      () => new Promise<RoomSnapshot>((resolve) => { resolveRefresh = resolve; }),
    );
    let pending!: ReturnType<ReturnType<typeof useActiveGameRoomSync>["refresh"]>;
    await TestRenderer.act(async () => {
      pending = latest!.refresh();
    });
    expect(latest!.status).toBe("refreshing");
    expect(latest!.isEditable).toBe(true);

    resolveRefresh(rpcSnapshot);
    await TestRenderer.act(async () => { await pending; });
    expect(latest!.status).toBe("ready");
    await TestRenderer.act(async () => renderer!.unmount());
  });
});
