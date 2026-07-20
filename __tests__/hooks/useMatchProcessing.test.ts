import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import React, { useState } from "react";
import TestRenderer from "react-test-renderer";

import { useMatchProcessing } from "../../hooks/useMatchProcessing";
import type { Match } from "../../store/store";
import type { MatchData } from "../../utils/matchUtils";

interface HarnessResult {
  matches: Match[];
  startProcessing: (filteredMatches: MatchData[]) => void;
  isProcessing: boolean;
  processingState: {
    isProcessing: boolean;
    matchesAdded: number;
    matchesSkipped: number;
    totalToProcess: number;
  };
  homeTeamCalls: string[];
  awayTeamCalls: string[];
}

const buildMatchData = (
  overrides: Partial<MatchData> = {},
): MatchData => ({
  id: "match-a",
  team1: "Arsenal FC",
  team2: "Chelsea FC",
  ...overrides,
});

const buildMatch = (overrides: Partial<Match> = {}): Match => ({
  id: "existing-1",
  homeTeam: "Liverpool FC",
  awayTeam: "Everton FC",
  homeGoals: 0,
  awayGoals: 0,
  ...overrides,
});

const renderHarness = (
  initialMatches: Match[],
  setGlobalMatches?: (matches: Match[]) => void,
) => {
  let latest: HarnessResult | undefined;

  const Harness = () => {
    const [matches, setMatches] = useState<Match[]>(initialMatches);
    const homeTeamCallsRef = React.useRef<string[]>([]);
    const awayTeamCallsRef = React.useRef<string[]>([]);
    const homeTeamRef = React.useRef("");
    const awayTeamRef = React.useRef("");

    const setHomeTeam = (team: string) => {
      homeTeamRef.current = team;
      homeTeamCallsRef.current.push(team);
    };
    const setAwayTeam = (team: string) => {
      awayTeamRef.current = team;
      awayTeamCallsRef.current.push(team);
    };
    const handleAddMatch = () => {
      setMatches((prev) => [
        ...prev,
        {
          id: `${homeTeamRef.current}-${awayTeamRef.current}`,
          homeTeam: homeTeamRef.current,
          awayTeam: awayTeamRef.current,
          homeGoals: 0,
          awayGoals: 0,
        },
      ]);
    };

    const hook = useMatchProcessing(
      matches,
      setHomeTeam,
      setAwayTeam,
      handleAddMatch,
      setGlobalMatches,
    );

    latest = {
      matches,
      ...hook,
      homeTeamCalls: homeTeamCallsRef.current,
      awayTeamCalls: awayTeamCallsRef.current,
    };

    return null;
  };

  const renderer = TestRenderer.create(React.createElement(Harness));

  return { renderer, getLatest: () => latest as HarnessResult };
};

describe("useMatchProcessing", () => {
  describe("batch path (setGlobalMatches provided)", () => {
    it("adds only unique matches in a single setGlobalMatches call and reports skip stats", () => {
      const setGlobalMatches = jest.fn();
      const { renderer, getLatest } = renderHarness(
        [buildMatch()],
        setGlobalMatches,
      );

      TestRenderer.act(() => {
        getLatest().startProcessing([
          buildMatchData({ id: "new-1", team1: "Arsenal FC", team2: "Chelsea FC" }),
          buildMatchData({
            id: "dup-1",
            team1: "Liverpool FC",
            team2: "Everton FC",
          }),
        ]);
      });

      expect(setGlobalMatches).toHaveBeenCalledTimes(1);
      const [calledWith] = setGlobalMatches.mock.calls[0] as [Match[]];
      expect(calledWith).toHaveLength(2);
      expect(calledWith.some((m) => m.id === "new-1")).toBe(true);

      // startProcessing already filters out matches that duplicate the
      // existing list before processBatchDirectly ever sees them, so the
      // duplicate never reaches (and never inflates) processBatchDirectly's
      // own skip count -- only the unique candidate is counted here.
      expect(getLatest().processingState.matchesAdded).toBe(1);
      expect(getLatest().processingState.matchesSkipped).toBe(0);
      expect(getLatest().processingState.totalToProcess).toBe(1);
      expect(getLatest().isProcessing).toBe(false);

      renderer.unmount();
    });

    it("does not call setGlobalMatches when every candidate already exists", () => {
      const setGlobalMatches = jest.fn();
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      const { renderer, getLatest } = renderHarness(
        [buildMatch()],
        setGlobalMatches,
      );

      TestRenderer.act(() => {
        getLatest().startProcessing([
          buildMatchData({
            id: "dup-1",
            team1: "Liverpool FC",
            team2: "Everton FC",
          }),
        ]);
      });

      expect(setGlobalMatches).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "All filtered matches are already in your list",
      );

      consoleWarnSpy.mockRestore();
      renderer.unmount();
    });
  });

  describe("guard clauses (shared by both paths)", () => {
    it("warns and skips when no candidate has both teams filled in", () => {
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      const setGlobalMatches = jest.fn();

      const { renderer, getLatest } = renderHarness([], setGlobalMatches);

      TestRenderer.act(() => {
        getLatest().startProcessing([
          buildMatchData({ team1: "", team2: "Chelsea FC" }),
        ]);
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith("No valid matches to add");
      expect(setGlobalMatches).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      renderer.unmount();
    });

    it("warns and ignores a new startProcessing call while one is already in progress", () => {
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      // No setGlobalMatches -> takes the sequential path, which sets isProcessing true.
      const { renderer, getLatest } = renderHarness([]);

      TestRenderer.act(() => {
        getLatest().startProcessing([buildMatchData()]);
      });

      expect(getLatest().isProcessing).toBe(true);

      TestRenderer.act(() => {
        getLatest().startProcessing([
          buildMatchData({ id: "second", team1: "X", team2: "Y" }),
        ]);
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Match processing is already in progress, ignoring new request",
      );

      consoleWarnSpy.mockRestore();
      renderer.unmount();
    });
  });

  describe("sequential path (no setGlobalMatches)", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("processes one match end to end: sets teams, adds it, then clears processing state", async () => {
      const { renderer, getLatest } = renderHarness([]);

      TestRenderer.act(() => {
        getLatest().startProcessing([
          buildMatchData({ id: "m1", team1: "Arsenal FC", team2: "Chelsea FC" }),
        ]);
      });

      expect(getLatest().isProcessing).toBe(true);

      // Flush the effect that schedules the 100ms kick-off timer before advancing.
      await TestRenderer.act(async () => {
        await Promise.resolve();
      });

      // Drain the 100ms kick-off timer plus the internal 50ms polling loop.
      for (let i = 0; i < 20; i += 1) {
        await TestRenderer.act(async () => {
          await jest.advanceTimersByTimeAsync(50);
        });

        if (getLatest().isProcessing === false) {
          break;
        }
      }

      expect(getLatest().homeTeamCalls).toContain("Arsenal FC");
      expect(getLatest().awayTeamCalls).toContain("Chelsea FC");
      expect(getLatest().matches).toHaveLength(1);
      expect(getLatest().processingState.matchesAdded).toBe(1);
      expect(getLatest().processingState.matchesSkipped).toBe(0);
      expect(getLatest().isProcessing).toBe(false);

      renderer.unmount();
    });

    it("skips a candidate that becomes a duplicate mid-batch (added by an earlier candidate in the same run)", async () => {
      // startProcessing's own dedup pass only filters candidates against
      // matches that exist *before* the run starts, so two identical
      // candidates in the same call both get queued -- the in-flight
      // "already exists" check inside processMatch is what catches the
      // second one once the first has actually been added.
      const { renderer, getLatest } = renderHarness([]);

      TestRenderer.act(() => {
        getLatest().startProcessing([
          buildMatchData({ id: "m1", team1: "Arsenal FC", team2: "Chelsea FC" }),
          buildMatchData({ id: "m2", team1: "Arsenal FC", team2: "Chelsea FC" }),
        ]);
      });

      for (let i = 0; i < 40; i += 1) {
        await TestRenderer.act(async () => {
          await jest.advanceTimersByTimeAsync(50);
        });

        if (getLatest().isProcessing === false) {
          break;
        }
      }

      expect(getLatest().processingState.matchesSkipped).toBe(1);
      expect(getLatest().processingState.matchesAdded).toBe(1);
      expect(getLatest().matches).toHaveLength(1);

      renderer.unmount();
    });
  });
});
