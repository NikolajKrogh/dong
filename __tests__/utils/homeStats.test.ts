import { describe, expect, it } from "@jest/globals";

import {
  getTopDrinker,
  getTotalDrinks,
  type HomeStatsGameSession,
  type HomeStatsPlayer,
} from "../../utils/homeStats";

const buildSession = (
  id: string,
  players: HomeStatsPlayer[],
): HomeStatsGameSession => ({
  id,
  date: "2026-04-24T19:00:00.000Z",
  players,
});

describe("getTotalDrinks", () => {
  it("returns 0 for an empty history", () => {
    expect(getTotalDrinks([])).toBe(0);
  });

  it("sums drinksTaken across all players in all sessions", () => {
    const history = [
      buildSession("session-1", [
        { id: "alice-1", name: "Alice", drinksTaken: 2 },
        { id: "bob-1", name: "Bob", drinksTaken: 1 },
      ]),
      buildSession("session-2", [
        { id: "alice-2", name: "Alice", drinksTaken: 3 },
      ]),
    ];

    expect(getTotalDrinks(history)).toBe(6);
  });

  it("treats a missing drinksTaken as 0", () => {
    expect(getTotalDrinks([buildSession("session-1", [{ id: "alice", name: "Alice" }])])).toBe(0);
  });
});

describe("getTopDrinker", () => {
  it("returns null for an empty history", () => {
    expect(getTopDrinker([])).toBeNull();
  });

  it("returns null when every player has zero drinks", () => {
    expect(
      getTopDrinker([buildSession("session-1", [{ id: "alice", name: "Alice", drinksTaken: 0 }])]),
    ).toBeNull();
  });

  it("returns the top participant by the shared lifetime identity rules", () => {
    const history = [
      buildSession("session-1", [
        { id: "alice-1", name: "Alice", drinksTaken: 2 },
        { id: "bob-1", name: "Bob", drinksTaken: 5 },
      ]),
      buildSession("session-2", [
        { id: "alice-2", name: "Alice", drinksTaken: 1 },
      ]),
    ];

    expect(getTopDrinker(history)).toMatchObject({ name: "Bob", drinks: 5 });
  });

  it("merges registered cloud sessions by account ID", () => {
    const history = [
      buildSession("session-1", [
        { id: "alice-1", accountId: "account-a", membershipType: "registered", name: "Alice", drinksTaken: 2 },
        { id: "bob-1", accountId: "account-b", membershipType: "registered", name: "Bob", drinksTaken: 3 },
      ]),
      buildSession("session-2", [
        { id: "alice-2", accountId: "account-a", membershipType: "registered", name: "Alice", drinksTaken: 4 },
      ]),
    ];

    expect(getTopDrinker(history)).toMatchObject({ name: "Alice", drinks: 6 });
  });

  it("does not merge local players with the same name across sessions", () => {
    const history = [
      buildSession("session-1", [
        { id: "alice-1", name: "Alice", drinksTaken: 3 },
        { id: "bob-1", name: "Bob", drinksTaken: 2 },
      ]),
      buildSession("session-2", [
        { id: "alice-2", name: "Alice", drinksTaken: 4 },
      ]),
    ];

    expect(getTopDrinker(history)).toMatchObject({ name: "Alice", drinks: 4 });
  });

  it("uses stable name and identity ordering to resolve equal totals", () => {
    const history = [
      buildSession("session-1", [
        { id: "z-player", name: "Zoe", drinksTaken: 3 },
        { id: "a-player", name: "Alex", drinksTaken: 3 },
      ]),
    ];

    expect(getTopDrinker(history)).toMatchObject({ name: "Alex", drinks: 3 });
  });
});
