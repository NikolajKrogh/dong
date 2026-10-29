import { renderHook } from "../../../test-utils/render";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import Toast from "react-native-toast-message";
import TestRenderer from "react-test-renderer";

import { useGoalToastQueue } from "../../../features/game-progress/useGoalToastQueue";
import type { LastGoalInfo } from "../../../features/game-progress/goalScoring";
import type { Match } from "../../../store/gameStore";

jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

const mockToastShow = jest.mocked(Toast.show);

const buildMatch = (overrides: Partial<Match> = {}): Match => ({
  id: "match-1",
  homeTeam: "Arsenal FC",
  awayTeam: "Chelsea FC",
  homeGoals: 1,
  awayGoals: 0,
  ...overrides,
});

const buildGoalInfo = (
  overrides: Partial<LastGoalInfo> = {},
): LastGoalInfo => ({
  match: buildMatch(),
  matchId: "match-1",
  team: "home",
  isLiveUpdate: false,
  timestamp: Date.now(),
  ...overrides,
});

const renderHookProbe = (getPlayersWhoDrink: (matchId: string) => string[]) =>
  renderHook(() => useGoalToastQueue(getPlayersWhoDrink));

describe("useGoalToastQueue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    { players: ["Alice"], message: "Alice should drink!" },
    { players: ["Alice", "Bob"], message: "Alice, Bob should drink!" },
    { players: ["Alice", "Bob", "Charlie"], message: "Alice, Bob, Charlie should drink!" },
    { players: ["Alice", "Bob", "Charlie", "David"], message: "Alice, Bob and 2 others should drink!" },
    { players: ["Alice", "Bob", "Cara", "Dan", "Eve"], message: "Alice, Bob and 3 others should drink!" },
    { players: Array.from({ length: 10 }, (_, i) => `Player ${i + 1}`), message: "Player 1, Player 2 and 8 others should drink!" },
  ])("shows the score and formats $players as $message", async ({ players, message }) => {
    const getPlayersWhoDrink = jest.fn(() => players);
    const { renderer, getLatest } = renderHookProbe(getPlayersWhoDrink);
    await TestRenderer.act(async () => {
      getLatest().enqueueGoalToast(buildGoalInfo());
    });
    expect(getPlayersWhoDrink).toHaveBeenCalledWith("match-1");
    expect(mockToastShow).toHaveBeenCalledTimes(1);
    expect(mockToastShow.mock.calls[0][0]).toMatchObject({
      text1: "Arsenal FC 1-0 Chelsea FC", text2: message,
    });
    TestRenderer.act(() => renderer.unmount());
  });

  it("does not enqueue (or show) a toast when no players are affected", async () => {
    const getPlayersWhoDrink = jest.fn(() => []);
    const { renderer, getLatest } = renderHookProbe(getPlayersWhoDrink);

    await TestRenderer.act(async () => {
      getLatest().enqueueGoalToast(buildGoalInfo());
      await Promise.resolve();
    });

    expect(mockToastShow).not.toHaveBeenCalled();

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("shows queued toasts one at a time, advancing only after onHide fires", async () => {
    const getPlayersWhoDrink = jest.fn(() => ["Alice"]);
    const { renderer, getLatest } = renderHookProbe(getPlayersWhoDrink);

    await TestRenderer.act(async () => {
      getLatest().enqueueGoalToast(buildGoalInfo({ matchId: "match-1" }));
      getLatest().enqueueGoalToast(
        buildGoalInfo({ matchId: "match-1", team: "away" }),
      );
      await Promise.resolve();
    });

    // Only the first toast has been shown so far.
    expect(mockToastShow).toHaveBeenCalledTimes(1);

    const firstCall = mockToastShow.mock.calls[0][0] as {
      onHide?: () => void;
    };

    await TestRenderer.act(async () => {
      firstCall.onHide?.();
      await Promise.resolve();
    });

    expect(mockToastShow).toHaveBeenCalledTimes(2);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("includes the scoring team in the toast props", async () => {
    const getPlayersWhoDrink = jest.fn(() => ["Alice"]);
    const { renderer, getLatest } = renderHookProbe(getPlayersWhoDrink);

    await TestRenderer.act(async () => {
      getLatest().enqueueGoalToast(buildGoalInfo({ team: "away" }));
      await Promise.resolve();
    });

    const [payload] = mockToastShow.mock.calls[0] as [
      { props?: Record<string, unknown> },
    ];
    expect(payload.props).toEqual({ scoringTeam: "away" });

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
