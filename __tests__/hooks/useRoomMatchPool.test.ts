import { describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import {
  CATALOGUE_SOURCE_PROVIDER,
  MANUAL_SOURCE_PROVIDER,
  useRoomMatchPool,
  type RoomMatchPool,
} from "../../hooks/useRoomMatchPool";
import type {
  AddRoomMatchRequest,
  BatchRoomMatchResult,
  RoomMatchSummary,
} from "../../types/room";

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
  addMatches: (r: AddRoomMatchRequest[]) => Promise<BatchRoomMatchResult | null>,
  removeMatch: (id: string) => Promise<void>,
  removeMatches: (ids: string[]) => Promise<void> = jest.fn(async () => {}),
  onBatchAdded?: (result: BatchRoomMatchResult) => void,
) => {
  let latest: RoomMatchPool | undefined;
  const Probe = () => {
    latest = useRoomMatchPool({
      roomMatches,
      addMatches,
      removeMatch,
      removeMatches,
      onBatchAdded,
    });
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
      jest.fn(async () => ({ added: 0, skipped: 0 })),
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
        kickoffAt: "2026-08-22T11:30:00.000Z",
      },
    ]);
  });

  /**
   * Regression: match discovery puts a *local* `"HH:MM"` display string in
   * `startTime`. Sending that as `kickoffAt` made `add_room_match` fail its insert
   * against a `timestamptz` column, so every add from the catalogue errored and the
   * room stayed empty. Provenance and the kickoff must both come from `kickoffAt`.
   */
  it("never sends a display-only startTime as the kickoff timestamp", async () => {
    const addMatches = jest.fn(async () => ({ added: 1, skipped: 0 }));
    const pool = mount([], addMatches, jest.fn(async () => {}));

    await TestRenderer.act(async () => {
      pool.setMatches([
        {
          id: "401879322",
          homeTeam: "Hull City",
          awayTeam: "Manchester United",
          homeGoals: 0,
          awayGoals: 0,
          startTime: "13:30",
        },
      ]);
      await flush();
    });

    expect(addMatches).toHaveBeenCalledWith([
      expect.objectContaining({ kickoffAt: null }),
    ]);
    expect(addMatches).not.toHaveBeenCalledWith([
      expect.objectContaining({ kickoffAt: "13:30" }),
    ]);
  });

  it("maps a kickoff-less room match to an undefined startTime", () => {
    const pool = mount(
      [roomMatch({ id: "room-1", kickoffAt: null })],
      jest.fn(async () => ({ added: 0, skipped: 0 })),
      jest.fn(async () => {}),
    );

    expect(pool.matches[0].startTime).toBeUndefined();
  });

  /**
   * A fixture from the catalogue must keep its provider linkage, which is what
   * allows scores to be synced back to the room later.
   */
  it("adds a discovered fixture with its catalogue source id", async () => {
    const addMatches = jest.fn(async () => ({ added: 1, skipped: 0 }));
    const pool = mount([], addMatches, jest.fn(async () => {}));

    await TestRenderer.act(async () => {
      pool.setMatches([
        {
          id: "401879322",
          homeTeam: "Hull City",
          awayTeam: "Manchester United",
          homeGoals: 0,
          awayGoals: 0,
          // What discovery really produces: a local display time, plus the
          // provider's ISO instant alongside it.
          startTime: "13:30",
          kickoffAt: "2026-08-22T11:30:00.000Z",
        },
      ]);
      await flush();
    });

    expect(addMatches).toHaveBeenCalledWith([
      {
        sourceProvider: CATALOGUE_SOURCE_PROVIDER,
        sourceMatchId: "401879322",
        homeTeamName: "Hull City",
        awayTeamName: "Manchester United",
        kickoffAt: "2026-08-22T11:30:00.000Z",
      },
    ]);
  });

  /**
   * A hand-typed fixture has no catalogue id. `source_match_id` is nullable and the
   * pool's dedupe index is partial, so null is the correct value rather than a
   * fabricated one.
   */
  it("adds a hand-typed fixture as manual with no source id", async () => {
    const addMatches = jest.fn(async () => ({ added: 1, skipped: 0 }));
    const pool = mount([], addMatches, jest.fn(async () => {}));

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

    expect(addMatches).toHaveBeenCalledWith([
      {
        sourceProvider: MANUAL_SOURCE_PROVIDER,
        sourceMatchId: null,
        homeTeamName: "Local Rovers",
        awayTeamName: "Village FC",
        kickoffAt: null,
      },
    ]);
  });

  /**
   * MatchList and useMatchProcessing both append by passing the *whole* list back.
   * Only the genuinely new entries may be written, or every add would re-add
   * everything already in the room.
   */
  it("writes only the entries the room does not already hold", async () => {
    const addMatches = jest.fn(async () => ({ added: 1, skipped: 0 }));
    const existing = roomMatch({ id: "room-1" });
    const pool = mount([existing], addMatches, jest.fn(async () => {}));

    await TestRenderer.act(async () => {
      pool.setMatches([
        ...pool.matches,
        {
          id: "espn-new",
          homeTeam: "New",
          awayTeam: "Fixture",
          homeGoals: 0,
          awayGoals: 0,
          startTime: "16:00",
          kickoffAt: "2026-08-22T14:00:00.000Z",
        },
      ]);
      await flush();
    });

    expect(addMatches).toHaveBeenCalledTimes(1);
    expect(addMatches).toHaveBeenCalledWith([
      expect.objectContaining({ sourceMatchId: "espn-new" }),
    ]);
  });

  /**
   * The whole point of batching: eleven fixtures used to mean eleven RPCs, eleven
   * room-row locks and eleven snapshot refreshes.
   */
  it("sends a whole batch in a single call", async () => {
    const addMatches = jest.fn(
      async (_requests: AddRoomMatchRequest[]) => ({ added: 3, skipped: 0 }),
    );
    const pool = mount([], addMatches, jest.fn(async () => {}));

    await TestRenderer.act(async () => {
      pool.setMatches([
        { id: "a", homeTeam: "A", awayTeam: "B", homeGoals: 0, awayGoals: 0, kickoffAt: "2026-08-22T12:00:00.000Z" },
        { id: "b", homeTeam: "C", awayTeam: "D", homeGoals: 0, awayGoals: 0, kickoffAt: "2026-08-22T13:00:00.000Z" },
        { id: "c", homeTeam: "E", awayTeam: "F", homeGoals: 0, awayGoals: 0, kickoffAt: "2026-08-22T14:00:00.000Z" },
      ]);
      await flush();
    });

    expect(addMatches).toHaveBeenCalledTimes(1);
    expect(addMatches.mock.calls[0][0]).toHaveLength(3);
  });

  /** MatchList's "clear all" passes an empty array — that must remove the pool. */
  it("removes every room match in one call when handed an empty list", async () => {
    const removeMatches = jest.fn(async () => {});
    const pool = mount(
      [roomMatch({ id: "room-1" }), roomMatch({ id: "room-2" })],
      jest.fn(async () => ({ added: 0, skipped: 0 })),
      jest.fn(async () => {}),
      removeMatches,
    );

    await TestRenderer.act(async () => {
      pool.setMatches([]);
      await flush();
    });

    expect(removeMatches).toHaveBeenCalledTimes(1);
    expect(removeMatches).toHaveBeenCalledWith(["room-1", "room-2"]);
  });

  it("never adds while clearing", async () => {
    const addMatches = jest.fn(async () => ({ added: 0, skipped: 0 }));
    const pool = mount([roomMatch({ id: "room-1" })], addMatches, jest.fn(async () => {}));

    await TestRenderer.act(async () => {
      pool.setMatches([]);
      await flush();
    });

    expect(addMatches).not.toHaveBeenCalled();
  });

  it("removes a single match by id", () => {
    const removeMatch = jest.fn(async () => {});
    const pool = mount(
      [roomMatch({ id: "room-1" })],
      jest.fn(async () => ({ added: 0, skipped: 0 })),
      removeMatch,
    );

    TestRenderer.act(() => {
      pool.removeMatch("room-1");
    });

    expect(removeMatch).toHaveBeenCalledWith("room-1");
  });
  /**
   * The reason batching matters beyond round trips. The caller resets its error
   * slot at the start of every call, so when this looped the singular RPC a
   * failure on fixture 3 was wiped by fixtures 4..n and the host saw nothing —
   * just a pool quietly short of what they selected. One call has nothing to
   * overwrite it.
   */
  describe("batch outcome reporting", () => {
    it("reports how many landed and how many were already there", async () => {
      const onBatchAdded = jest.fn();
      const pool = mount(
        [],
        jest.fn(async () => ({ added: 8, skipped: 3 })),
        jest.fn(async () => {}),
        jest.fn(async () => {}),
        onBatchAdded,
      );

      await TestRenderer.act(async () => {
        pool.setMatches([
          { id: "a", homeTeam: "A", awayTeam: "B", homeGoals: 0, awayGoals: 0 },
        ]);
        await flush();
      });

      expect(onBatchAdded).toHaveBeenCalledWith({ added: 8, skipped: 3 });
    });

    // A rejected batch resolves null; there is nothing to report and the caller's
    // error surface carries the reason instead.
    it("reports nothing when the batch failed", async () => {
      const onBatchAdded = jest.fn();
      const pool = mount(
        [],
        jest.fn(async () => null),
        jest.fn(async () => {}),
        jest.fn(async () => {}),
        onBatchAdded,
      );

      await TestRenderer.act(async () => {
        pool.setMatches([
          { id: "a", homeTeam: "A", awayTeam: "B", homeGoals: 0, awayGoals: 0 },
        ]);
        await flush();
      });

      expect(onBatchAdded).not.toHaveBeenCalled();
    });

    it("does not call the server when every fixture is already in the pool", async () => {
      const addMatches = jest.fn(async () => ({ added: 0, skipped: 0 }));
      const pool = mount([roomMatch({ id: "room-1" })], addMatches, jest.fn(async () => {}));

      await TestRenderer.act(async () => {
        pool.setMatches(pool.matches);
        await flush();
      });

      expect(addMatches).not.toHaveBeenCalled();
    });
  });
});
