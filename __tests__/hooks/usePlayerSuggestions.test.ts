import { beforeEach, describe, expect, it } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import {
  usePlayerSuggestions,
  type PlayerSuggestion,
} from "../../hooks/usePlayerSuggestions";
import { useGameStore } from "../../store/store";

interface HistoryGamePlayer {
  id: string;
  name: string;
  drinksTaken?: number;
}

const buildGame = (
  date: string,
  players: HistoryGamePlayer[],
  overrides: Partial<{
    id: string;
    matches: unknown[];
    commonMatchId: string | null;
    playerAssignments: Record<string, string[]>;
    matchesPerPlayer: number;
  }> = {},
) => ({
  id: overrides.id ?? `game-${date}`,
  date,
  players,
  matches: overrides.matches ?? [],
  commonMatchId: overrides.commonMatchId ?? null,
  playerAssignments: overrides.playerAssignments ?? {},
  matchesPerPlayer: overrides.matchesPerPlayer ?? 1,
});

const setHistory = (history: ReturnType<typeof buildGame>[]) => {
  useGameStore.setState({ history: history as never });
};

const renderHookProbe = (searchQuery: string) => {
  let latest:
    | { playerSuggestions: PlayerSuggestion[]; hasHistory: boolean }
    | undefined;

  const Probe = () => {
    latest = usePlayerSuggestions(searchQuery);
    return null;
  };

  const renderer = TestRenderer.create(React.createElement(Probe));

  return { renderer, getLatest: () => latest };
};

describe("usePlayerSuggestions", () => {
  beforeEach(() => {
    setHistory([]);
  });

  it("reports no history and empty suggestions when the game log is empty", () => {
    const { renderer, getLatest } = renderHookProbe("");

    expect(getLatest()?.hasHistory).toBe(false);
    expect(getLatest()?.playerSuggestions).toEqual([]);

    renderer.unmount();
  });

  it("aggregates games played, total drinks, and average across multiple sessions", () => {
    setHistory([
      buildGame("2026-01-01T00:00:00.000Z", [
        { id: "p1", name: "Alice", drinksTaken: 4 },
      ]),
      buildGame("2026-01-08T00:00:00.000Z", [
        { id: "p1", name: "Alice", drinksTaken: 2 },
      ]),
    ]);

    const { renderer, getLatest } = renderHookProbe("");

    const alice = getLatest()?.playerSuggestions.find(
      (player) => player.name === "Alice",
    );

    expect(alice).toMatchObject({
      gamesPlayed: 2,
      totalDrinks: 6,
      averageDrinksPerGame: 3,
      lastPlayed: "2026-01-08T00:00:00.000Z",
    });

    renderer.unmount();
  });

  it("sorts by descending average drinks per game", () => {
    setHistory([
      buildGame("2026-01-01T00:00:00.000Z", [
        { id: "p1", name: "LightDrinker", drinksTaken: 1 },
        { id: "p2", name: "HeavyDrinker", drinksTaken: 9 },
      ]),
    ]);

    const { renderer, getLatest } = renderHookProbe("");
    const names = getLatest()?.playerSuggestions.map((player) => player.name);

    expect(names).toEqual(["HeavyDrinker", "LightDrinker"]);

    renderer.unmount();
  });

  it("breaks near-equal averages by most recent play date", () => {
    setHistory([
      buildGame("2026-01-01T00:00:00.000Z", [
        { id: "p1", name: "Older", drinksTaken: 3 },
      ]),
      buildGame("2026-02-01T00:00:00.000Z", [
        { id: "p2", name: "Newer", drinksTaken: 3 },
      ]),
    ]);

    const { renderer, getLatest } = renderHookProbe("");
    const names = getLatest()?.playerSuggestions.map((player) => player.name);

    expect(names).toEqual(["Newer", "Older"]);

    renderer.unmount();
  });

  it("filters suggestions case-insensitively by the search query", () => {
    setHistory([
      buildGame("2026-01-01T00:00:00.000Z", [
        { id: "p1", name: "Alice", drinksTaken: 1 },
        { id: "p2", name: "Bob", drinksTaken: 1 },
      ]),
    ]);

    const { renderer, getLatest } = renderHookProbe("ali");
    const names = getLatest()?.playerSuggestions.map((player) => player.name);

    expect(names).toEqual(["Alice"]);

    renderer.unmount();
  });

  it("caps suggestions at 6 players", () => {
    setHistory([
      buildGame(
        "2026-01-01T00:00:00.000Z",
        Array.from({ length: 8 }, (_, index) => ({
          id: `p${index}`,
          name: `Player${index}`,
          drinksTaken: index,
        })),
      ),
    ]);

    const { renderer, getLatest } = renderHookProbe("");

    expect(getLatest()?.playerSuggestions).toHaveLength(6);

    renderer.unmount();
  });

  it("defaults missing drinksTaken to zero", () => {
    setHistory([
      buildGame("2026-01-01T00:00:00.000Z", [{ id: "p1", name: "Alice" }]),
    ]);

    const { renderer, getLatest } = renderHookProbe("");
    const alice = getLatest()?.playerSuggestions.find(
      (player) => player.name === "Alice",
    );

    expect(alice).toMatchObject({ totalDrinks: 0, averageDrinksPerGame: 0 });

    renderer.unmount();
  });
});
