import React from "react";
import TestRenderer from "react-test-renderer";

import useGameProgressController from "../../hooks/useGameProgressController";
import {
  useActiveGameRoomSync,
  type ActiveGameRoomSync,
} from "../../hooks/useActiveGameRoomSync";
import { useLiveScores } from "../../hooks/useLiveScores";
import { useAppVisibility, useGoalSound } from "../../platform";
import { useGameStore } from "../../store/store";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("../../hooks/useActiveGameRoomSync", () => ({
  useActiveGameRoomSync: jest.fn(),
}));
jest.mock("../../hooks/useLiveScores", () => ({
  useLiveScores: jest.fn(),
}));
jest.mock("../../platform", () => ({
  useAppVisibility: jest.fn(),
  useGoalSound: jest.fn(),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
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

  it("preserves active multiplayer context on Home but clears it for Setup", async () => {
    const { renderer, latest } = renderController();

    TestRenderer.act(() => latest().handleGoHome());
    expect(useGameStore.getState().activeGameContext.sessionId).toBe("room-1");

    TestRenderer.act(() => latest().handleBackToSetup());
    expect(useGameStore.getState().activeGameContext.mode).toBe("solo");
    expect(mockPush).toHaveBeenCalledWith("/setupGame");
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
