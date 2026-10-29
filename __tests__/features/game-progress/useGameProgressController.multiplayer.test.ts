import React from "react";
import TestRenderer from "react-test-renderer";

import { useLiveScores } from "../../../features/football-matches/useLiveScores";
import useGameProgressController from "../../../features/game-progress/useGameProgressController";
import { useActiveGameRoomSync, type ActiveGameRoomSync } from "../../../features/rooms/useActiveGameRoomSync";
import { useAppVisibility, useGoalSound } from "../../../platform";
import { useGameStore } from "../../../store/gameStore";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSetParams = jest.fn();
let mockNavigationReady = true;
let mockGameParams: { gameTab?: string | string[] } = {};

jest.mock("../../../features/rooms/useActiveGameRoomSync", () => ({
  useActiveGameRoomSync: jest.fn(),
}));
jest.mock("../../../features/football-matches/useLiveScores", () => ({
  useLiveScores: jest.fn(),
}));
jest.mock("../../../platform", () => ({
  useAppVisibility: jest.fn(),
  useGoalSound: jest.fn(),
}));
jest.mock("../../../platform/navigation/useNavigationReady", () => ({
  useNavigationReady: () => mockNavigationReady,
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockGameParams,
  useRouter: () => ({ push: mockPush, replace: mockReplace, setParams: mockSetParams }),
}));

const mockSync = jest.mocked(useActiveGameRoomSync);
const mockLiveScores = jest.mocked(useLiveScores);
const mockVisibility = jest.mocked(useAppVisibility);
const mockGoalSound = jest.mocked(useGoalSound);

const changeManualScore = jest.fn() as jest.MockedFunction<
  ActiveGameRoomSync["changeManualScore"]
>;
const changeParticipantDrink = jest.fn() as jest.MockedFunction<
  ActiveGameRoomSync["changeParticipantDrink"]
>;
const completeGame = jest.fn() as jest.MockedFunction<
  ActiveGameRoomSync["completeGame"]
>;
const refresh = jest.fn() as jest.MockedFunction<ActiveGameRoomSync["refresh"]>;
const retryMutation = jest.fn() as jest.MockedFunction<
  ActiveGameRoomSync["retryMutation"]
>;
const reassignParticipantMatches = jest.fn() as jest.MockedFunction<
  ActiveGameRoomSync["reassignParticipantMatches"]
>;
const fetchCurrentScores = jest.fn(async () => undefined);

const multiplayerSync: ActiveGameRoomSync = {
  acceptSnapshot: jest.fn(),
  isMultiplayer: true,
  isHost: true,
  isEditable: true,
  status: "ready",
  error: null,
  snapshot: null,
  ownerParticipantId: "p1",
  participantId: "p1",
  pendingMutations: [],
  lastAppliedSequence: 3,
  refresh,
  changeManualScore,
  changeParticipantDrink,
  retryMutation,
  completeGame,
  reassignParticipantMatches,
};

const renderController = () => {
  let latest: ReturnType<typeof useGameProgressController> | undefined;
  const Probe = () => {
    latest = useGameProgressController();
    return null;
  };
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });
  return {
    renderer: renderer!,
    latest: () => latest!,
  };
};

describe("useGameProgressController multiplayer routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGameParams = {};
    mockNavigationReady = true;
    multiplayerSync.status = "ready";
    multiplayerSync.error = null;
    multiplayerSync.snapshot = null;
    multiplayerSync.isHost = true;
    multiplayerSync.isEditable = true;
    changeManualScore.mockResolvedValue({
      sessionId: "room-1",
      sequenceNumber: 4,
      eventId: "event-1",
      replayed: false,
    });
    changeParticipantDrink.mockResolvedValue({
      sessionId: "room-1",
      sequenceNumber: 5,
      eventId: "event-2",
      replayed: false,
    });
    completeGame.mockResolvedValue({ status: "completed", sessionId: "room-1" });
    refresh.mockResolvedValue(null);
    retryMutation.mockResolvedValue(null);
    reassignParticipantMatches.mockResolvedValue({
      sessionId: "room-1",
      participantId: "p1",
      addedMatchIds: [],
      removedMatchIds: [],
      matchIds: [],
      sequenceNumber: 6,
    });
    mockSync.mockReturnValue(multiplayerSync);
    mockLiveScores.mockReturnValue({
      liveMatches: [],
      isPolling: false,
      lastUpdated: null,
      error: null,
      captureHistoryDetails: jest.fn(async () => undefined),
      restartTracking: jest.fn(async () => undefined),
      endTracking: jest.fn(async () => undefined),
      startPolling: jest.fn(),
      stopPolling: jest.fn(),
      fetchCurrentScores,
    });
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
    mockGoalSound.mockReturnValue({
      isSoundPlaying: false,
      playGoalSound: jest.fn(async () => true),
      stopGoalSound: jest.fn(async () => undefined),
    });
    useGameStore.setState({
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
      commonMatchId: "m1",
      playerAssignments: {},
      history: [],
      activeGameContext: {
        mode: "multiplayer",
        sessionId: "room-1",
        participantId: "p1",
        accessKind: "registered",
        lastAppliedSequence: 3,
      },
    });
  });

  it("uses server score-check freshness while background snapshots refresh", async () => {
    mockSync.mockReturnValue({ ...multiplayerSync, status: "refreshing", snapshot: {
      lastScoresCheckedAt: "2026-10-22T15:00:00Z",
    } as NonNullable<ActiveGameRoomSync["snapshot"]> });
    const { renderer, latest } = renderController();
    expect(latest().lastUpdated).toEqual(new Date("2026-10-22T15:00:00Z"));
    expect(latest().refreshing).toBe(false);
    expect(latest()).toHaveProperty("sourceStatusMessage", null);
    await TestRenderer.act(async () => renderer.unmount());
  });
  it("separates source cooldown feedback from a healthy room connection", async () => {
    const snapshot = {
      lastScoresCheckedAt: "2026-10-22T15:00:00Z",
      providerAvailabilityReason: "provider_cooldown",
      roomProcessingPending: false,
    } as NonNullable<ActiveGameRoomSync["snapshot"]>;
    mockSync.mockReturnValue({ ...multiplayerSync, snapshot });
    const { renderer, latest } = renderController();
    expect(latest()).toHaveProperty("sourceStatusMessage", "Live scores are delayed. Saved scores are shown.");
    expect(latest().activeGame.error).toBeNull();
    expect(latest().lastUpdated).toEqual(new Date("2026-10-22T15:00:00Z"));
    await TestRenderer.act(async () => renderer.unmount());
  });
  it("shows accepted-score processing without calling it a new source check", async () => {
    const snapshot = {
      lastScoresCheckedAt: null,
      providerAvailabilityReason: null,
      roomProcessingPending: true,
    } as NonNullable<ActiveGameRoomSync["snapshot"]>;
    mockSync.mockReturnValue({ ...multiplayerSync, snapshot });
    const { renderer, latest } = renderController();
    expect(latest()).toHaveProperty("sourceStatusMessage", "Score updates are being applied. Saved scores are shown.");
    expect(latest().lastUpdated).toBeNull();
    await TestRenderer.act(async () => renderer.unmount());
  });

  it("routes manual goals and drinks through canonical commands", async () => {
    const { renderer, latest } = renderController();

    await TestRenderer.act(async () => {
      latest().handleGoalIncrement("m1", "home");
      latest().handleDrinkIncrement("p1");
      await Promise.resolve();
    });

    expect(changeManualScore).toHaveBeenCalledWith("m1", "home", 1);
    expect(changeParticipantDrink).toHaveBeenCalledWith("p1", 1);
    expect(useGameStore.getState().matches[0].homeGoals).toBe(0);
    expect(useGameStore.getState().players[0].drinksTaken).toBe(0);

    await TestRenderer.act(async () => renderer.unmount());
  });

  it("ignores provider callback totals and avoids local multiplayer completion history", async () => {
    const { renderer, latest } = renderController();

    await TestRenderer.act(async () => {
      latest().handleGoalIncrement("m1", "home", 4);
      latest().handleEndGame();
      latest().confirmEndGame();
      await Promise.resolve();
    });

    expect(changeManualScore).not.toHaveBeenCalled();
    expect(completeGame).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().history).toHaveLength(0);
    expect(mockLiveScores).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      60000,
      false,
    );

    await TestRenderer.act(async () => renderer.unmount());
  });

  it("clears a terminal multiplayer game and returns every participant home", async () => {
    multiplayerSync.status = "ended";
    const { renderer } = renderController();

    expect(useGameStore.getState().players).toEqual([]);
    expect(useGameStore.getState().matches).toEqual([]);
    expect(mockReplace).toHaveBeenCalledWith("/");

    await TestRenderer.act(async () => renderer.unmount());
  });

  it("does not let a non-host invoke canonical completion", async () => {
    const originalHost = multiplayerSync.isHost;
    multiplayerSync.isHost = false;
    mockSync.mockReturnValue(multiplayerSync);
    const { renderer, latest } = renderController();

    await TestRenderer.act(async () => {
      latest().handleEndGame();
      latest().confirmEndGame();
      await Promise.resolve();
    });

    expect(completeGame).not.toHaveBeenCalled();
    expect(useGameStore.getState().history).toHaveLength(0);
    multiplayerSync.isHost = originalHost;
    await TestRenderer.act(async () => renderer.unmount());
  });

  it("uses the canonical room refresh for pull-to-refresh", async () => {
    const { renderer, latest } = renderController();

    await TestRenderer.act(async () => {
      await latest().onRefresh();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchCurrentScores).not.toHaveBeenCalled();

    await TestRenderer.act(async () => renderer.unmount());
  });

  it("preserves active multiplayer context on Home and opens the host editor", async () => {
    const { renderer, latest } = renderController();

    TestRenderer.act(() => latest().handleGoHome());
    expect(useGameStore.getState().activeGameContext.sessionId).toBe("room-1");

    TestRenderer.act(() => latest().handleBackToSetup());
    expect(useGameStore.getState().activeGameContext.mode).toBe("multiplayer");
    expect(mockPush).toHaveBeenCalledWith("/editGame");
    expect(completeGame).not.toHaveBeenCalled();
    await TestRenderer.act(async () => renderer.unmount());
  });


  it.each(["guest", "registered"] as const)("keeps %s context while hydrating instead of fabricating a solo game", async (accessKind) => {
    useGameStore.setState({ activeGameContext: { ...useGameStore.getState().activeGameContext, accessKind } });
    mockSync.mockReturnValue({ ...multiplayerSync, status: "hydrating", isEditable: false });
    const { renderer, latest } = renderController();
    TestRenderer.act(() => latest().handleBackToSetup());
    expect(useGameStore.getState().activeGameContext.sessionId).toBe("room-1");
    expect(mockPush).not.toHaveBeenCalledWith("/setupGame");
    expect(completeGame).not.toHaveBeenCalled();
    if (accessKind === "guest") {
      expect(latest().isRoomStatusVisible).toBe(true);
      expect(mockPush).not.toHaveBeenCalled();
    }
    await TestRenderer.act(async () => renderer.unmount());
  });

  it("opens guest read-only status without entering the registered lobby", async () => {
    useGameStore.setState({ activeGameContext: { ...useGameStore.getState().activeGameContext, accessKind: "guest" } });
    const { renderer, latest } = renderController();
    TestRenderer.act(() => latest().handleBackToSetup());
    expect(latest().configurationLabel).toBe("Room status");
    expect(latest().isRoomStatusVisible).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
    expect(useGameStore.getState().activeGameContext.accessKind).toBe("guest");
    expect(changeManualScore).not.toHaveBeenCalled();
    expect(changeParticipantDrink).not.toHaveBeenCalled();
    TestRenderer.act(() => latest().closeRoomStatus());
    expect(latest().isRoomStatusVisible).toBe(false);
    await TestRenderer.act(async () => renderer.unmount());
  });

  it("keeps a registered member's existing permissions when opening configuration", async () => {
    mockSync.mockReturnValue({ ...multiplayerSync, isHost: false, isEditable: false });
    const { renderer, latest } = renderController();
    TestRenderer.act(() => latest().handleBackToSetup());
    expect(latest().configurationLabel).toBe("Room status");
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/lobby/[sessionId]", params: { sessionId: "room-1" } });
    expect(completeGame).not.toHaveBeenCalled();
    expect(useGameStore.getState().activeGameContext.sessionId).toBe("room-1");
    await TestRenderer.act(async () => renderer.unmount());
  });

  it("clears terminal multiplayer context when navigating Home", async () => {
    mockSync.mockReturnValue({
      ...multiplayerSync,
      isEditable: false,
      status: "ended",
    });
    const { renderer, latest } = renderController();

    TestRenderer.act(() => latest().handleGoHome());

    expect(useGameStore.getState().activeGameContext.mode).toBe("solo");
    await TestRenderer.act(async () => renderer.unmount());
  });
});
