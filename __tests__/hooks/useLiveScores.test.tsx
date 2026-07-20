import React, { useEffect } from "react";
import TestRenderer from "react-test-renderer";

const mockUseGameStore = jest.fn();

jest.mock("../../store/store", () => ({
  useGameStore: (
    selector: (state: { configuredLeagues: unknown[] }) => unknown,
  ) => mockUseGameStore(selector),
}));

describe("useLiveScores", () => {
  const trackedMatches = [
    {
      id: "tracked-match",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      homeGoals: 0,
      awayGoals: 0,
    },
  ];
  const configuredLeagues = [
    {
      name: "Premier League",
      code: "eng.1",
      category: "Europe",
    },
  ];
  const globalWithFetch = globalThis as typeof globalThis & {
    fetch: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockUseGameStore.mockImplementation(
      (
        selector: (state: {
          configuredLeagues: typeof configuredLeagues;
        }) => unknown,
      ) => selector({ configuredLeagues }),
    );
    globalWithFetch.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ events: [] }) });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("keeps polling controls stable after polling starts", async () => {
    let observedHook:
      | ReturnType<typeof import("../../hooks/useLiveScores").useLiveScores>
      | undefined;

    const Probe = () => {
      const { useLiveScores } = require("../../hooks/useLiveScores");

      observedHook = useLiveScores(trackedMatches, jest.fn(), 1000);
      return null;
    };

    let renderer: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
    });

    const initialStartPolling = observedHook?.startPolling;
    const initialStopPolling = observedHook?.stopPolling;

    await TestRenderer.act(async () => {
      observedHook?.startPolling();
      await Promise.resolve();
    });

    expect(observedHook?.startPolling).toBe(initialStartPolling);
    expect(observedHook?.stopPolling).toBe(initialStopPolling);

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });

  it("does not restart polling when controller-style effects rerender", async () => {
    const setIntervalSpy = jest.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = jest.spyOn(globalThis, "clearInterval");

    const ControllerProbe = () => {
      const { useLiveScores } = require("../../hooks/useLiveScores");
      const { startPolling, stopPolling } = useLiveScores(
        trackedMatches,
        jest.fn(),
        1000,
      );

      useEffect(() => {
        if (trackedMatches.length === 0) {
          return;
        }

        startPolling();

        return () => {
          stopPolling();
        };
      }, [startPolling, stopPolling]);

      return null;
    };

    let renderer: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(ControllerProbe));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});
