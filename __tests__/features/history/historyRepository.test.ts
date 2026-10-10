import { describe, expect, it, jest } from "@jest/globals";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadCloudHistory,
  mapDepartureResult,
  mergeHistory,
} from "../../../features/history";
import type { GameSession } from "../../../components/history/historyTypes";

interface QueryRequest {
  source: "summaries" | "early" | "links";
  from: number;
  to: number;
}

interface OrderRequest {
  source: QueryRequest["source"];
  column: string;
  ascending: boolean;
}

const pagedQuery = <T,>(
  source: QueryRequest["source"],
  rows: T[],
  requests: QueryRequest[],
  orderRequests: OrderRequest[],
  error: unknown | null = null,
) => {
  type TestQuery = {
    select: (...args: unknown[]) => TestQuery;
    order: (column: string, options: { ascending: boolean }) => TestQuery;
    abortSignal: (signal: AbortSignal) => Promise<{ data: T[] | null; error: unknown | null }>;
    range: (
      from: number,
      to: number,
    ) => TestQuery;
  };
  const query = {} as TestQuery;
  query.select = jest.fn(() => query) as TestQuery["select"];
  query.order = jest.fn((column: string, options: { ascending: boolean }) => {
    orderRequests.push({ source, column, ascending: options.ascending });
    return query;
  }) as TestQuery["order"];
  let rangeFrom = 0; let rangeTo = 0;
  query.range = jest.fn((from: number, to: number) => { rangeFrom = from; rangeTo = to; return query; });
  query.abortSignal = jest.fn((_signal: AbortSignal) => { const from = rangeFrom; const to = rangeTo;
      requests.push({ source, from, to });
      return Promise.resolve({
        data: error === null ? rows.slice(from, to + 1) : null,
        error,
      });
  }) as TestQuery["abortSignal"];
  return query;
};

const cloudSession = (
  id: string,
  overrides: Record<string, unknown> = {},
) => ({
  session_id: id,
  completed_at: "2026-09-20T12:00:00.000Z",
  common_match_id: null,
  matches_per_player: 2,
  players: [
    {
      id: "player-1",
      name: "Alex",
      drinksTaken: 3,
      leftAt: null,
      accountId: "account-1",
      membershipType: "registered",
    },
  ],
  matches: [
    {
      id: "match-1",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      homeGoals: 2,
      awayGoals: 1,
      goals: 3,
    },
  ],
  player_assignments: { "player-1": ["match-1"] },
  ...overrides,
});

const localSession = (id: string, name = "Alex"): GameSession => ({
  id,
  date: "2026-09-20T12:00:00.000Z",
  players: [{ id: "player-1", name, drinksTaken: 3 }],
  matches: [],
  commonMatchId: null,
  playerAssignments: {},
  matchesPerPlayer: 2,
});

describe("historyRepository", () => {
  it.each(["browser", "native"])("maps and paginates canonical cloud history with a %s signal", async (runtime) => {
    const summaries = Array.from({ length: 501 }, (_, index) =>
      cloudSession(`cloud-${String(index).padStart(3, "0")}`, {
        completed_at: index === 0 ? null : "2026-09-20T12:00:00.000Z",
      }),
    );
    const requests: QueryRequest[] = [];
    const orderRequests: OrderRequest[] = [];
    const client = {
      from: jest.fn((table: string) =>
        pagedQuery(table === "early_leave_results" ? "early" : "summaries",
          table === "early_leave_results" ? [] : summaries, requests, orderRequests),
      ),
      rpc: jest.fn(() =>
        pagedQuery("links", [], requests, orderRequests),
      ),
    } as unknown as SupabaseClient;

    const signal = new AbortController().signal;
    if (runtime === "native") Object.defineProperty(signal, "throwIfAborted", { value: undefined });
    const result = await loadCloudHistory(client, signal);

    expect(client.from).toHaveBeenCalledWith("completed_session_summaries");
    expect(client.from).toHaveBeenCalledWith("early_leave_results");
    expect(client.rpc).not.toHaveBeenCalled();
    expect(result.sessions).toHaveLength(501);
    expect(result.sessions[0]).toMatchObject({
      id: "cloud-000",
      date: "",
      players: [{
        id: "player-1",
        name: "Alex",
        drinksTaken: 3,
        leftAt: null,
        accountId: "account-1",
        membershipType: "registered",
      }],
      matches: [
        {
          id: "match-1",
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          homeGoals: 2,
          awayGoals: 1,
          goals: 3,
        },
      ],
      playerAssignments: { "player-1": ["match-1"] },
      matchesPerPlayer: 2,
    });
    expect(requests).toEqual(
      expect.arrayContaining([
        { source: "summaries", from: 0, to: 499 },
        { source: "summaries", from: 500, to: 999 },
      ]),
    );
    expect(orderRequests).toEqual(
      expect.arrayContaining([
        { source: "summaries", column: "session_id", ascending: true },
      ]),
    );
  });

  it("rejects a canceled native signal before requesting cloud history", async () => {
    const controller = new AbortController();
    Object.defineProperty(controller.signal, "throwIfAborted", { value: undefined });
    Object.defineProperty(controller.signal, "reason", { value: undefined });
    controller.abort();
    const client = { from: jest.fn() } as unknown as SupabaseClient;
    await expect(loadCloudHistory(client, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("preserves legacy fallbacks for malformed summary fields", async () => {
    const summaries = [
      cloudSession("fallback-fields", {
        players: [null, {
          id: 12,
          name: false,
          drinksTaken: Number.POSITIVE_INFINITY,
          accountId: 12,
          membershipType: "unknown",
          leftAt: 12,
        }],
        matches: [null, {
          id: 12,
          homeTeam: false,
          awayTeam: 12,
          homeGoals: Number.POSITIVE_INFINITY,
          awayGoals: "3",
          goals: Number.NaN,
        }],
        player_assignments: {
          p1: ["match-1", null, 12],
          p2: "not-an-array",
        },
        matches_per_player: Number.POSITIVE_INFINITY,
      }),
      cloudSession("fallback-arrays", {
        players: "not-an-array",
        matches: null,
        player_assignments: [],
      }),
    ];
    const requests: QueryRequest[] = [];
    const orderRequests: OrderRequest[] = [];
    const client = {
      from: jest.fn((table: string) =>
        pagedQuery(
          table === "early_leave_results" ? "early" : "summaries",
          table === "early_leave_results" ? [] : summaries,
          requests,
          orderRequests,
        ),
      ),
    } as unknown as SupabaseClient;

    const { sessions } = await loadCloudHistory(client);

    expect(sessions[0]).toMatchObject({
      players: [
        {
          id: "",
          name: "",
          drinksTaken: 0,
          accountId: null,
          membershipType: undefined,
          leftAt: null,
        },
        {
          id: "",
          name: "",
          drinksTaken: 0,
          accountId: null,
          membershipType: undefined,
          leftAt: null,
        },
      ],
      matches: [
        { id: "", homeTeam: "", awayTeam: "", homeGoals: 0, awayGoals: 0, goals: 0 },
        { id: "", homeTeam: "", awayTeam: "", homeGoals: 0, awayGoals: 0, goals: 0 },
      ],
      playerAssignments: { p1: ["match-1"], p2: [] },
      matchesPerPlayer: 0,
    });
    expect(sessions[1]).toMatchObject({
      players: [],
      matches: [],
      playerAssignments: {},
    });
  });

  it("rejects the combined load if either page stream fails", async () => {
    const requests: QueryRequest[] = [];
    const orderRequests: OrderRequest[] = [];
    const client = {
      from: jest.fn((table: string) => pagedQuery(table === "early_leave_results" ? "early" : "summaries", [], requests, orderRequests, { message: "private backend detail" })),
      rpc: jest.fn(() =>
        pagedQuery("links", [], requests, orderRequests, {
          message: "private backend detail",
        }),
      ),
    } as unknown as SupabaseClient;

    await expect(loadCloudHistory(client)).rejects.toMatchObject({
      message: "private backend detail",
    });
  });

  it("merges by session ID, never by player name or date", () => {
    const localDirectDuplicate = localSession("cloud-1");
    const localLinkedDuplicate = localSession("local-imported");
    const sameNameAndDate = localSession("local-unique", "Alex");
    const cloud = [
      {
        ...localSession("cloud-1"),
        players: [{ id: "cloud-player", name: "Alex", drinksTaken: 4 }],
      },
      localSession("cloud-2"),
      localSession("cloud-2"),
    ];

    const merged = mergeHistory(
      [localDirectDuplicate, localLinkedDuplicate, sameNameAndDate],
      cloud,
    );

    expect(merged.map((session) => session.id)).toEqual([
      "local-imported",
      "local-unique",
      "cloud-1",
      "cloud-2",
    ]);
    expect(merged[1]).toBe(sameNameAndDate);
    expect(merged[2].players[0].drinksTaken).toBe(4);
  });

  it("maps a frozen departure and replaces it with canonical completion", () => {
    const provisional = mapDepartureResult("room-1", "2026-09-28T10:00:00Z", {
      sessionId: "room-1", state: "in_progress", commonMatchId: null,
      participants: [{ id: "p1", displayName: "Alex", membershipType: "guest",
        currentDrinkTotal: 3, leftAt: "2026-09-28T10:00:00Z" }],
      matches: [{ id: "m1", homeTeamName: "A", awayTeamName: "B", homeScore: 2, awayScore: 1 }],
      assignments: [{ participantId: "p1", matchId: "m1" }],
      assignmentPlan: { matchesPerPlayer: 1 },
    });
    expect(provisional).toMatchObject({ isEarlyLeaveResult: true,
      players: [{ drinksTaken: 3, leftAt: "2026-09-28T10:00:00Z" }],
      matches: [{ goals: 3 }], playerAssignments: { p1: ["m1"] } });
    const completed = localSession("room-1");
    expect(mergeHistory([provisional], [provisional, completed])).toEqual([completed]);
  });

  it("keeps departure field fallbacks and rejects malformed structures", () => {
    const provisional = mapDepartureResult("room-2", "2026-09-28T10:00:00Z", {
      sessionId: "room-2",
      state: "in_progress",
      commonMatchId: 12,
      participants: [{
        id: "p1",
        displayName: false,
        currentDrinkTotal: Number.POSITIVE_INFINITY,
        membershipType: "unknown",
        leftAt: 12,
      }],
      matches: [{
        id: "m1",
        homeTeamName: false,
        awayTeamName: 12,
        homeScore: Number.NaN,
        awayScore: "3",
      }],
      assignments: [null, { participantId: "p1", matchId: 12 }, { participantId: "p1", matchId: "m1" }],
      assignmentPlan: { matchesPerPlayer: "2" },
    });

    expect(provisional).toMatchObject({
      players: [{
        id: "p1",
        name: "",
        drinksTaken: 0,
        membershipType: undefined,
        leftAt: null,
      }],
      matches: [{ id: "m1", homeTeam: "", awayTeam: "", homeGoals: 0, awayGoals: 0, goals: 0 }],
      commonMatchId: null,
      playerAssignments: { p1: ["m1"] },
      matchesPerPlayer: 0,
    });

    expect(() => mapDepartureResult("room-2", "2026-09-28T10:00:00Z", {
      sessionId: "room-2",
      state: "in_progress",
      participants: "not-an-array",
      matches: [],
      assignments: [],
      assignmentPlan: {},
    })).toThrow("Invalid departure result.");

    expect(() => mapDepartureResult("room-2", "not-a-date", {
      sessionId: "room-2",
      state: "in_progress",
      participants: [],
      matches: [],
      assignments: [],
      assignmentPlan: {},
    })).toThrow("Invalid departure result.");

    expect(() => mapDepartureResult("room-2", "2026-09-28T10:00:00Z", {
      sessionId: "room-2",
      state: "in_progress",
      participants: [{ id: 12 }],
      matches: [],
      assignments: [],
      assignmentPlan: {},
    })).toThrow("Invalid departure participant.");
  });
});
