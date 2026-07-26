import { describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import {
  CATALOGUE_SOURCE_PROVIDER,
  MANUAL_SOURCE_PROVIDER,
  useRoomMatchPool,
  type RoomMatchPool,
} from "../../hooks/useRoomMatchPool";
import type { AddRoomMatchRequest, RoomMatchSummary } from "../../types/room";

const roomMatch = (
  overrides: Partial<RoomMatchSummary> & { id: string },
): RoomMatchSummary => ({
  sourceProvider: CATALOGUE_SOURCE_PROVIDER,
  sourceMatchId: "espn-x",
  homeTeamName: "Home",
  awayTeamName: "Away",
  kickoffAt: "2026-08-22T11:30:00.000Z",
  homeScore: 0,
  awayScore: 0,
  ...overrides,
});

/**
 * Renders the hook and hands back its latest value. `useRoomMatchPool` holds no
 * state of its own — the pool is the room snapshot — so a plain probe is enough.
 */
const mount = (
  roomMatches: RoomMatchSummary[],
  addMatch: (r: AddRoomMatchRequest) => Promise<void>,
  removeMatch: (id: string) => Promise<void>,
) => {
  let latest: RoomMatchPool | undefined;
  const Probe = () => {
    latest = useRoomMatchPool({ roomMatches, addMatch, removeMatch });
    return null;
  };
  TestRenderer.act(() => {
    TestRenderer.create(React.createElement(Probe));
  });
  if (!latest) {
    throw new Error("hook did not render");
  }
  return latest;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("useRoomMatchPool", () => {
  it("presents the room pool in the shape MatchList renders", () => {
    const pool = mount(
      [
        roomMatch({
          id: "room-1",
          homeTeamName: "Arsenal",
          awayTeamName: "Chelsea",
          homeScore: 2,
          awayScore: 1,
          kickoffAt: "2026-08-22T11:30:00.000Z",
        }),
      ],
      jest.fn(async () => {}),
      jest.fn(async () => {}),
    );

    expect(pool.matches).toEqual([
      {
        id: "room-1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        homeGoals: 2,
        awayGoals: 1,
        startTime: "2026-08-22T11:30:00.000Z",
      },
    ]);
  });

  it("maps a kickoff-less room match to an undefined startTime", () => {
    const pool = mount(
      [roomMatch({ id: "room-1", kickoffAt: null })],
      jest.fn(async () => {}),
      jest.fn(async () => {}),
    );

    expect(pool.matches[0].startTime).toBeUndefined();
  });

  /**
   * A fixture from the catalogue must keep its provider linkage, which is what
   * allows scores to be synced back to the room later.
   */
  it("adds a discovered fixture with its catalogue source id", async () => {
    const addMatch = jest.fn(async () => {});
    const pool = mount([], addMatch, jest.fn(async () => {}));

    await TestRenderer.act(async () => {
      pool.setMatches([
        {
          id: "401879322",
          homeTeam: "Hull City",
          awayTeam: "Manchester United",
          homeGoals: 0,
          awayGoals: 0,
          startTime: "2026-08-22T11:30:00.000Z",
        },
      ]);
      await flush();
    });

    expect(addMatch).toHaveBeenCalledWith({
      sourceProvider: CATALOGUE_SOURCE_PROVIDER,
      sourceMatchId: "401879322",
      homeTeamName: "Hull City",
      awayTeamName: "Manchester United",
      kickoffAt: "2026-08-22T11:30:00.000Z",
    });
  });

  /**
   * A hand-typed fixture has no catalogue id. `source_match_id` is nullable and the
   * pool's dedupe index is partial, so null is the correct value rather than a
   * fabricated one.
   */
  it("adds a hand-typed fixture as manual with no source id", async () => {
    const addMatch = jest.fn(async () => {});
    const pool = mount([], addMatch, jest.fn(async () => {}));

    await TestRenderer.act(async () => {
      pool.setMatches([
        {
          id: "1785066781000",
          homeTeam: "Local Rovers",
          awayTeam: "Village FC",
          homeGoals: 0,
          awayGoals: 0,
        },
      ]);
      await flush();
    });

    expect(addMatch).toHaveBeenCalledWith({
      sourceProvider: MANUAL_SOURCE_PROVIDER,
      sourceMatchId: null,
      homeTeamName: "Local Rovers",
      awayTeamName: "Village FC",
      kickoffAt: null,
    });
  });

  /**
   * MatchList and useMatchProcessing both append by passing the *whole* list back.
   * Only the genuinely new entries may be written, or every add would re-add
   * everything already in the room.
   */
  it("writes only the entries the room does not already hold", async () => {
    const addMatch = jest.fn(async () => {});
    const existing = roomMatch({ id: "room-1" });
    const pool = mount([existing], addMatch, jest.fn(async () => {}));

    await TestRenderer.act(async () => {
      pool.setMatches([
        ...pool.matches,
        {
          id: "espn-new",
          homeTeam: "New",
          awayTeam: "Fixture",
          homeGoals: 0,
          awayGoals: 0,
          startTime: "2026-08-22T14:00:00.000Z",
        },
      ]);
      await flush();
    });

    expect(addMatch).toHaveBeenCalledTimes(1);
    expect(addMatch).toHaveBeenCalledWith(
      expect.objectContaining({ sourceMatchId: "espn-new" }),
    );
  });

  it("adds every entry of a batch, one call each", async () => {
    const addMatch = jest.fn(async () => {});
    const pool = mount([], addMatch, jest.fn(async () => {}));

    await TestRenderer.act(async () => {
      pool.setMatches([
        { id: "a", homeTeam: "A", awayTeam: "B", homeGoals: 0, awayGoals: 0, startTime: "t1" },
        { id: "b", homeTeam: "C", awayTeam: "D", homeGoals: 0, awayGoals: 0, startTime: "t2" },
        { id: "c", homeTeam: "E", awayTeam: "F", homeGoals: 0, awayGoals: 0, startTime: "t3" },
      ]);
      await flush();
    });

    expect(addMatch).toHaveBeenCalledTimes(3);
  });

  /** MatchList's "clear all" passes an empty array — that must remove the pool. */
  it("removes every room match when handed an empty list", async () => {
    const removed: string[] = [];
    const removeMatch = jest.fn(async (id: string) => {
      removed.push(id);
    });
    const pool = mount(
      [roomMatch({ id: "room-1" }), roomMatch({ id: "room-2" })],
      jest.fn(async () => {}),
      removeMatch,
    );

    await TestRenderer.act(async () => {
      pool.setMatches([]);
      await flush();
    });

    expect(removed).toEqual(["room-1", "room-2"]);
  });

  it("never adds while clearing", async () => {
    const addMatch = jest.fn(async () => {});
    const pool = mount([roomMatch({ id: "room-1" })], addMatch, jest.fn(async () => {}));

    await TestRenderer.act(async () => {
      pool.setMatches([]);
      await flush();
    });

    expect(addMatch).not.toHaveBeenCalled();
  });

  it("removes a single match by id", () => {
    const removeMatch = jest.fn(async () => {});
    const pool = mount(
      [roomMatch({ id: "room-1" })],
      jest.fn(async () => {}),
      removeMatch,
    );

    TestRenderer.act(() => {
      pool.removeMatch("room-1");
    });

    expect(removeMatch).toHaveBeenCalledWith("room-1");
  });
});
