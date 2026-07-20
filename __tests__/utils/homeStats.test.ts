import { describe, expect, it } from "@jest/globals";

import {
  getTopDrinker,
  getTotalDrinks,
  type HomeStatsGameSession,
} from "../../utils/homeStats";

const buildSession = (
  players: HomeStatsGameSession["players"],
): HomeStatsGameSession => ({ players });

describe("getTotalDrinks", () => {
  it("returns 0 for an empty history", () => {
    expect(getTotalDrinks([])).toBe(0);
  });

  it("sums drinksTaken across all players in all sessions", () => {
    const history = [
      buildSession([{ name: "Alice", drinksTaken: 2 }, { name: "Bob", drinksTaken: 1 }]),
      buildSession([{ name: "Alice", drinksTaken: 3 }]),
    ];

    expect(getTotalDrinks(history)).toBe(6);
  });

  it("treats a missing drinksTaken as 0", () => {
    const history = [buildSession([{ name: "Alice" }])];

    expect(getTotalDrinks(history)).toBe(0);
  });
});

describe("getTopDrinker", () => {
  it("returns null for an empty history", () => {
    expect(getTopDrinker([])).toBeNull();
  });

  it("returns null when every player has zero drinks", () => {
    const history = [buildSession([{ name: "Alice", drinksTaken: 0 }])];

    expect(getTopDrinker(history)).toBeNull();
  });

  it("returns the single top drinker across sessions", () => {
    const history = [
      buildSession([{ name: "Alice", drinksTaken: 2 }, { name: "Bob", drinksTaken: 5 }]),
      buildSession([{ name: "Alice", drinksTaken: 1 }]),
    ];

    expect(getTopDrinker(history)).toEqual({ name: "Bob", drinks: 5 });
  });

  it("aggregates the same player's drinks across multiple sessions before comparing", () => {
    const history = [
      buildSession([{ name: "Alice", drinksTaken: 2 }, { name: "Bob", drinksTaken: 3 }]),
      buildSession([{ name: "Alice", drinksTaken: 4 }]),
    ];

    // Alice: 2 + 4 = 6, Bob: 3 -> Alice wins
    expect(getTopDrinker(history)).toEqual({ name: "Alice", drinks: 6 });
  });

  it("picks the first player encountered on a tie (first-writer-keeps-lead semantics)", () => {
    const history = [
      buildSession([{ name: "Alice", drinksTaken: 3 }, { name: "Bob", drinksTaken: 3 }]),
    ];

    expect(getTopDrinker(history)).toEqual({ name: "Alice", drinks: 3 });
  });
});
