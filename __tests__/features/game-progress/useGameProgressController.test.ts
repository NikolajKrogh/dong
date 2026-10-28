import { actCreate } from "../../../test-utils/render";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import Toast from "react-native-toast-message";
import TestRenderer from "react-test-renderer";

import useGameProgressController from "../../../features/game-progress/useGameProgressController";
import { useLiveScores } from "../../../features/football-matches/useLiveScores";
import { useAppVisibility, useGoalSound } from "../../../platform";
import { useGameStore } from "../../../store/store";

jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

jest.mock("../../../features/football-matches/useLiveScores", () => ({
  useLiveScores: jest.fn(),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSetParams = jest.fn();
let mockNavigationReady = true;
let mockGameParams: { gameTab?: string | string[] } = {};

jest.mock("../../../utils/navigation/useNavigationReady", () => ({
  useNavigationReady: () => mockNavigationReady,
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockGameParams,
  useRouter: jest.fn(() => ({ push: mockPush, replace: mockReplace, setParams: mockSetParams })),
}));

jest.mock("../../../platform", () => ({
  useAppVisibility: jest.fn(),
  useGoalSound: jest.fn(),
}));

const mockUseLiveScores = jest.mocked(useLiveScores);
const mockUseAppVisibility = jest.mocked(useAppVisibility);
const mockUseGoalSound = jest.mocked(useGoalSound);
const mockToastShow = jest.mocked(Toast.show);

const startPolling = jest.fn();
const stopPolling = jest.fn();
const fetchCurrentScores = jest.fn(async () => undefined);
const playGoalSound = jest.fn(async () => true);

type Controller = ReturnType<typeof useGameProgressController>;

const renderControllerProbe = () => {
  let latest: Controller | undefined;

  const Probe = () => {
    latest = useGameProgressController();
    return null;
  };

  const renderer = actCreate(React.createElement(Probe));

  return { renderer, getLatest: () => latest as Controller, rerender: () => renderer.update(React.createElement(Probe)) };
};

describe("useGameProgressController (integration)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGameParams = {};
    mockNavigationReady = true;

    mockUseLiveScores.mockReturnValue({
      liveMatches: [],
      isPolling: false,
      lastUpdated: null,
      error: null,
      captureHistoryDetails: jest.fn(async () => undefined),
      endTracking: jest.fn(async () => undefined),
      startPolling,
      stopPolling,
      fetchCurrentScores,
    });
    mockUseAppVisibility.mockReturnValue({
      snapshot: {
        state: "active",
        source: "appState",
        isInteractive: true,
        capturedAt: Date.now(),
      },
      visibilityState: "active",
      isInteractive: true,
    });
    mockUseGoalSound.mockReturnValue({
      isSoundPlaying: false,
      playGoalSound,
      stopGoalSound: jest.fn(async () => undefined),
    });

    useGameStore.setState({
      players: [
        { id: "p1", name: "Alice", drinksTaken: 0 },
        { id: "p2", name: "Bob", drinksTaken: 0 },
      ],
      matches: [
        {
          id: "m1",
          homeTeam: "Arsenal FC",
          awayTeam: "Chelsea FC",
          homeGoals: 0,
          awayGoals: 0,
        },
      ],
      commonMatchId: "m1",
      playerAssignments: {},
      soundEnabled: true,
      commonMatchNotificationsEnabled: true,
    });
  });

  it("waits for container readiness before normalizing a malformed fresh-tab choice", async () => {
    mockGameParams = { gameTab: ["players", "matches"] };
    mockNavigationReady = false;
    const controller = renderControllerProbe();
    expect(mockSetParams).not.toHaveBeenCalled();
    mockNavigationReady = true;
    TestRenderer.act(() => controller.rerender());
    expect(mockSetParams).toHaveBeenCalledTimes(1);
    expect(mockSetParams).toHaveBeenCalledWith({ gameTab: undefined });
    await TestRenderer.act(async () => controller.renderer.unmount());
  });
  it("surfaces a solo source admission failure without hiding saved matches", async () => {
    mockUseLiveScores.mockReturnValue({
      liveMatches: [],
      isPolling: true,
      lastUpdated: null,
      error: "capacity_limited",
      captureHistoryDetails: jest.fn(async () => undefined),
      endTracking: jest.fn(async () => undefined),
      startPolling,
      stopPolling,
      fetchCurrentScores,
    });
    const controller = renderControllerProbe();
    expect(controller.getLatest()).toHaveProperty("sourceStatusMessage", "Live tracking could not start. Saved scores are shown.");
    expect(controller.getLatest().matches).toHaveLength(1);
    await TestRenderer.act(async () => controller.renderer.unmount());
  });

  it("restores the Players tab on remount and normalizes ambiguous route choices", async () => {
    mockGameParams = { gameTab: "players" };
    const first = renderControllerProbe();
    expect(first.getLatest().activeTab).toBe("players");
    TestRenderer.act(() => first.getLatest().setActiveTab("matches"));
    expect(mockSetParams).toHaveBeenCalledWith({ gameTab: undefined });
    await TestRenderer.act(async () => first.renderer.unmount());
    mockGameParams = { gameTab: ["players", "matches"] };
    const second = renderControllerProbe();
    expect(second.getLatest().activeTab).toBe("matches");
    expect(mockSetParams).toHaveBeenCalledWith({ gameTab: undefined });
    await TestRenderer.act(async () => second.renderer.unmount());
  });

  it("migrates legacy goals-only matches into homeGoals/awayGoals on mount", async () => {
    useGameStore.setState({
      matches: [
        {
          id: "legacy-1",
          homeTeam: "Arsenal FC",
          awayTeam: "Chelsea FC",
          homeGoals: undefined as unknown as number,
          awayGoals: undefined as unknown as number,
          goals: 5,
        },
      ],
    });

    const { renderer, getLatest } = renderControllerProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    const migrated = getLatest().matches.find((m) => m.id === "legacy-1");
    expect(migrated?.homeGoals).toBe(2);
    expect(migrated?.awayGoals).toBe(3);

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });

  it("starts polling when matches exist and stops polling on unmount", async () => {
    const { renderer } = renderControllerProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    expect(startPolling).toHaveBeenCalled();
    expect(stopPolling).not.toHaveBeenCalled();

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });

    expect(stopPolling).toHaveBeenCalled();
  });

  it("handleGoalIncrement updates the match, plays the goal sound, and shows a toast for the common match", async () => {
    const { renderer, getLatest } = renderControllerProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      getLatest().handleGoalIncrement("m1", "home");
      await Promise.resolve();
    });

    const updated = getLatest().matches.find((m) => m.id === "m1");
    expect(updated?.homeGoals).toBe(1);
    expect(playGoalSound).toHaveBeenCalledTimes(1);
    expect(mockToastShow).toHaveBeenCalledTimes(1);

    const [payload] = mockToastShow.mock.calls[0] as [{ text2: string }];
    // m1 is the common match, so both Alice and Bob should be listed.
    expect(payload.text2).toBe("Alice, Bob should drink!");

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });

  it.each<{ name: string; matchId: string; commonMatchId: string | null; assignments: Record<string, string[]>; expected: string | null }>([
    { name: "common match", matchId: "m3", commonMatchId: "m3", assignments: { p1: ["m1", "m3"], p2: ["m2"], p3: ["m1", "m2"], p4: [] }, expected: "Alice, Bob and 2 others should drink!" },
    { name: "first assigned match", matchId: "m1", commonMatchId: "m3", assignments: { p1: ["m1"], p2: ["m2"], p3: ["m1", "m2"], p4: [] }, expected: "Alice, Charlie should drink!" },
    { name: "second assigned match", matchId: "m2", commonMatchId: "m3", assignments: { p1: ["m1"], p2: ["m2"], p3: ["m1", "m2"], p4: [] }, expected: "Bob, Charlie should drink!" },
    { name: "no assigned players", matchId: "m4", commonMatchId: "m3", assignments: {}, expected: null },
    { name: "empty assignments", matchId: "m1", commonMatchId: null, assignments: { p4: [] }, expected: null },
    { name: "no common match", matchId: "m1", commonMatchId: null, assignments: { p1: ["m1"], p3: ["m1"] }, expected: "Alice, Charlie should drink!" },
  ])("resolves drinkers through the real controller for $name", ({ matchId, commonMatchId, assignments, expected }) => {
    useGameStore.setState({
      players: ["Alice", "Bob", "Charlie", "David"].map((name, index) => ({ id: `p${index + 1}`, name, drinksTaken: 0 })),
      matches: [{ id: matchId, homeTeam: "A", awayTeam: "B", homeGoals: 0, awayGoals: 0 }],
      commonMatchId, playerAssignments: assignments,
    });
    const { getLatest } = renderControllerProbe();
    TestRenderer.act(() => getLatest().handleGoalIncrement(matchId, "home"));
    if (expected === null) expect(mockToastShow).not.toHaveBeenCalled();
    else expect(mockToastShow).toHaveBeenCalledWith(expect.objectContaining({ text2: expected }));
  });

  it("suppresses the goal notification for the common match when commonMatchNotificationsEnabled is false", async () => {
    useGameStore.setState({ commonMatchNotificationsEnabled: false });

    const { renderer, getLatest } = renderControllerProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      getLatest().handleGoalIncrement("m1", "home");
      await Promise.resolve();
    });

    expect(playGoalSound).not.toHaveBeenCalled();
    expect(mockToastShow).not.toHaveBeenCalled();
    // The score itself still updates -- only the notification is suppressed.
    expect(getLatest().matches.find((m) => m.id === "m1")?.homeGoals).toBe(1);

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });

  it("handleGoalDecrement never takes a team's goals below zero", async () => {
    const { renderer, getLatest } = renderControllerProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      getLatest().handleGoalDecrement("m1", "home");
    });

    expect(getLatest().matches.find((m) => m.id === "m1")?.homeGoals).toBe(0);

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });

  it("handleDrinkIncrement/handleDrinkDecrement adjust a player's drinksTaken by 0.5, floored at 0", async () => {
    const { renderer, getLatest } = renderControllerProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      getLatest().handleDrinkIncrement("p1");
    });
    expect(
      getLatest().players.find((p) => p.id === "p1")?.drinksTaken,
    ).toBe(0.5);

    await TestRenderer.act(async () => {
      getLatest().handleDrinkDecrement("p1");
    });
    expect(
      getLatest().players.find((p) => p.id === "p1")?.drinksTaken,
    ).toBe(0);

    await TestRenderer.act(async () => {
      getLatest().handleDrinkDecrement("p1");
    });
    expect(
      getLatest().players.find((p) => p.id === "p1")?.drinksTaken,
    ).toBe(0);

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });

  it("onRefresh toggles refreshing around fetchCurrentScores and survives a rejection", async () => {
    fetchCurrentScores.mockRejectedValueOnce(new Error("network error"));
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { renderer, getLatest } = renderControllerProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      await getLatest().onRefresh();
    });

    expect(fetchCurrentScores).toHaveBeenCalledTimes(1);
    expect(getLatest().refreshing).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });

  it("confirmEndGame saves history, resets state, and navigates home", async () => {
    const { renderer, getLatest } = renderControllerProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      getLatest().handleEndGame();
    });
    expect(getLatest().isAlertVisible).toBe(true);

    await TestRenderer.act(async () => {
      getLatest().confirmEndGame();
    });

    expect(getLatest().isAlertVisible).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/");
    // resetState clears matches/players back to empty.
    expect(useGameStore.getState().matches).toEqual([]);

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });

  it("handleBackToSetup navigates to /setupGame, and quick-actions open/close toggles UI state", async () => {
    const { renderer, getLatest } = renderControllerProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      getLatest().handleBackToSetup();
    });
    expect(mockPush).toHaveBeenCalledWith("/setupGame");
    expect(getLatest().configurationLabel).toBe("Setup");
    expect(getLatest().players).toHaveLength(2);
    expect(getLatest().matches).toHaveLength(1);

    await TestRenderer.act(async () => {
      getLatest().openQuickActions("m1");
    });
    expect(getLatest().selectedMatchId).toBe("m1");
    expect(getLatest().isQuickActionsVisible).toBe(true);

    await TestRenderer.act(async () => {
      getLatest().closeQuickActions();
    });
    expect(getLatest().selectedMatchId).toBeNull();
    expect(getLatest().isQuickActionsVisible).toBe(false);

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });
});
