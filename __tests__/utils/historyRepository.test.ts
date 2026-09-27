import { describe, expect, it, jest } from "@jest/globals";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadCloudHistory,
  mergeHistory,
  type HistoryImportLink,
} from "../../utils/historyRepository";
import type { GameSession } from "../../components/history/historyTypes";

interface QueryRequest {
  source: "summaries" | "links";
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
    range: (
      from: number,
      to: number,
    ) => Promise<{ data: T[] | null; error: unknown | null }>;
  };
  const query = {} as TestQuery;
  query.select = jest.fn(() => query) as TestQuery["select"];
  query.order = jest.fn((column: string, options: { ascending: boolean }) => {
    orderRequests.push({ source, column, ascending: options.ascending });
    return query;
  }) as TestQuery["order"];
  query.range = jest.fn((from: number, to: number) => {
      requests.push({ source, from, to });
      return Promise.resolve({
        data: error === null ? rows.slice(from, to + 1) : null,
        error,
      });
  }) as TestQuery["range"];
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
    { id: "player-1", name: "Alex", drinksTaken: 3, leftAt: null },
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
  it("maps cloud summaries and paginates summaries and import links below the API row limit", async () => {
    const summaries = Array.from({ length: 501 }, (_, index) =>
      cloudSession(`cloud-${String(index).padStart(3, "0")}`, {
        completed_at: index === 0 ? null : "2026-09-20T12:00:00.000Z",
      }),
    );
    const importLinks: HistoryImportLink[] = Array.from(
      { length: 501 },
      (_, index) => ({
        source_local_session_id: `local-${String(index).padStart(3, "0")}`,
        cloud_session_id: `cloud-${String(index).padStart(3, "0")}`,
      }),
    );
    const requests: QueryRequest[] = [];
    const orderRequests: OrderRequest[] = [];
    const client = {
      from: jest.fn(() =>
        pagedQuery("summaries", summaries, requests, orderRequests),
      ),
      rpc: jest.fn(() =>
        pagedQuery("links", importLinks, requests, orderRequests),
      ),
    } as unknown as SupabaseClient;

    const result = await loadCloudHistory(client);

    expect(client.from).toHaveBeenCalledWith("completed_session_summaries");
    expect(client.rpc).toHaveBeenCalledWith("get_history_import_links");
    expect(result.sessions).toHaveLength(501);
    expect(result.importLinks).toHaveLength(501);
    expect(result.sessions[0]).toMatchObject({
      id: "cloud-000",
      date: "",
      players: [{ id: "player-1", name: "Alex", drinksTaken: 3, leftAt: null }],
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
        { source: "links", from: 0, to: 499 },
        { source: "links", from: 500, to: 999 },
      ]),
    );
    expect(orderRequests).toEqual(
      expect.arrayContaining([
        { source: "summaries", column: "session_id", ascending: true },
        { source: "links", column: "source_local_session_id", ascending: true },
        { source: "links", column: "cloud_session_id", ascending: true },
      ]),
    );
  });

  it("rejects the combined load if either page stream fails", async () => {
    const requests: QueryRequest[] = [];
    const orderRequests: OrderRequest[] = [];
    const client = {
      from: jest.fn(() => pagedQuery("summaries", [], requests, orderRequests)),
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

  it("merges by session ID and import link, never by player name or date", () => {
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
      [
        { source_local_session_id: "local-imported", cloud_session_id: "cloud-2" },
        { source_local_session_id: "stale-local", cloud_session_id: "missing-cloud" },
      ],
    );

    expect(merged.map((session) => session.id)).toEqual([
      "local-unique",
      "cloud-1",
      "cloud-2",
    ]);
    expect(merged[0]).toBe(sameNameAndDate);
    expect(merged[1].players[0].drinksTaken).toBe(4);
  });
});
