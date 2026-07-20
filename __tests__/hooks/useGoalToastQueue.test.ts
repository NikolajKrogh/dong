import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import Toast from "react-native-toast-message";
import TestRenderer from "react-test-renderer";

import { useGoalToastQueue } from "../../hooks/useGoalToastQueue";
import type { LastGoalInfo } from "../../hooks/gameProgress/goalScoring";
import type { Match } from "../../store/store";

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

type Hook = ReturnType<typeof useGoalToastQueue>;

const renderHookProbe = (getPlayersWhoDrink: (matchId: string) => string[]) => {
  let latest: Hook | undefined;

  const Probe = () => {
    latest = useGoalToastQueue(getPlayersWhoDrink);
    return null;
  };

  const renderer = TestRenderer.create(React.createElement(Probe));

  return { renderer, getLatest: () => latest as Hook };
};

describe("useGoalToastQueue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a toast with the score title and a drink message for one player", async () => {
    const getPlayersWhoDrink = jest.fn(() => ["Alice"]);
    const { renderer, getLatest } = renderHookProbe(getPlayersWhoDrink);

    await TestRenderer.act(async () => {
      getLatest().enqueueGoalToast(buildGoalInfo());
      await Promise.resolve();
    });

    expect(mockToastShow).toHaveBeenCalledTimes(1);
    const [payload] = mockToastShow.mock.calls[0] as [
      { text1: string; text2: string },
    ];
    expect(payload.text1).toBe("Arsenal FC 1-0 Chelsea FC");
    expect(payload.text2).toBe("Alice should drink!");

    renderer.unmount();
  });

  it("formats the message for more than 3 affected players", async () => {
    const getPlayersWhoDrink = jest.fn(() => [
      "Alice",
      "Bob",
      "Cara",
      "Dan",
      "Eve",
    ]);
    const { renderer, getLatest } = renderHookProbe(getPlayersWhoDrink);

    await TestRenderer.act(async () => {
      getLatest().enqueueGoalToast(buildGoalInfo());
      await Promise.resolve();
    });

    const [payload] = mockToastShow.mock.calls[0] as [{ text2: string }];
    expect(payload.text2).toBe("Alice, Bob and 3 others should drink!");

    renderer.unmount();
  });

  it("does not enqueue (or show) a toast when no players are affected", async () => {
    const getPlayersWhoDrink = jest.fn(() => []);
    const { renderer, getLatest } = renderHookProbe(getPlayersWhoDrink);

    await TestRenderer.act(async () => {
      getLatest().enqueueGoalToast(buildGoalInfo());
      await Promise.resolve();
    });

    expect(mockToastShow).not.toHaveBeenCalled();

    renderer.unmount();
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

    renderer.unmount();
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

    renderer.unmount();
  });
});
