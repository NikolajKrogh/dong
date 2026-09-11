import {
  buildFetchTargets,
  fetchScoreboards,
  isUuid,
  isUuidV4,
  normalizeProviderResults,
  parseSupportedLeagues,
  type ClaimedProviderMatch,
} from "../../supabase/functions/refresh-provider-scores/provider";

const claimedMatch = (
  overrides: Partial<ClaimedProviderMatch> = {},
): ClaimedProviderMatch => ({
  matchId: "00000000-0000-4000-8000-000000000401",
  provider: "espn",
  sourceMatchId: "espn-1",
  sourceLeagueCode: "eng.1",
  kickoffAt: "2026-09-03T18:00:00.000Z",
  ...overrides,
});

const scoreboard = (id: string, home: unknown, away: unknown) => ({
  events: [
    {
      id,
      competitions: [
        {
          competitors: [
            { homeAway: "home", score: { value: home } },
            { homeAway: "away", score: { value: away } },
          ],
        },
      ],
    },
  ],
});

describe("provider score refresh normalization", () => {
  it("validates room UUIDs and requires UUIDv4 idempotency keys", () => {
    expect(isUuid("00000000-0000-1000-8000-000000000001")).toBe(true);
    expect(isUuidV4("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuidV4("00000000-0000-1000-8000-000000000001")).toBe(false);
    expect(isUuidV4("request-1")).toBe(false);
  });

  it("groups known leagues by canonical UTC date and deduplicates requests", () => {
    expect(
      buildFetchTargets(
        [claimedMatch(), claimedMatch({ matchId: "match-2" })],
        ["eng.1", "den.1"],
      ),
    ).toEqual([{ leagueCode: "eng.1", date: "20260903" }]);
  });

  it("uses only the fixed allowlist when resolving a legacy league", () => {
    expect(
      buildFetchTargets(
        [claimedMatch({ sourceLeagueCode: null })],
        ["eng.1", "den.1"],
      ),
    ).toEqual([
      { leagueCode: "eng.1", date: "20260903" },
      { leagueCode: "den.1", date: "20260903" },
    ]);
    expect(parseSupportedLeagues("eng.1, eng.1,../../secret,den.1")).toEqual([
      "eng.1",
      "den.1",
    ]);
  });

  it("accepts only an exact event ID with non-negative integer scores", () => {
    const normalized = normalizeProviderResults([claimedMatch()], [
      {
        target: { leagueCode: "eng.1", date: "20260903" },
        scoreboard: scoreboard("espn-1", "2", 1),
      },
      {
        target: { leagueCode: "den.1", date: "20260903" },
        scoreboard: scoreboard("other-event", 9, 9),
      },
    ]);

    expect(normalized.observations).toEqual([
      expect.objectContaining({
        sourceMatchId: "espn-1",
        sourceLeagueCode: "eng.1",
        homeScore: 2,
        awayScore: 1,
      }),
    ]);
    expect(normalized.warnings).toEqual([]);
  });

  it("skips malformed scores and ambiguous legacy event IDs", () => {
    const legacy = claimedMatch({ sourceLeagueCode: null });
    const malformed = normalizeProviderResults([claimedMatch()], [
      {
        target: { leagueCode: "eng.1", date: "20260903" },
        scoreboard: scoreboard("espn-1", 1.5, 0),
      },
    ]);
    const ambiguous = normalizeProviderResults([legacy], [
      {
        target: { leagueCode: "eng.1", date: "20260903" },
        scoreboard: scoreboard("espn-1", 1, 0),
      },
      {
        target: { leagueCode: "den.1", date: "20260903" },
        scoreboard: scoreboard("espn-1", 1, 0),
      },
    ]);

    expect(malformed.observations).toEqual([]);
    expect(malformed.warnings).toContainEqual({
      leagueCode: "eng.1",
      code: "match_not_found",
    });
    expect(ambiguous.observations).toEqual([]);
    expect(ambiguous.warnings).toContainEqual({ code: "match_not_found" });
  });

  it("limits provider concurrency to four requests", async () => {
    let active = 0;
    let maximum = 0;
    const fetchImpl = jest.fn(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return {
        ok: true,
        json: async () => ({ events: [] }),
      } as Response;
    });
    const targets = Array.from({ length: 10 }, (_, index) => ({
      leagueCode: `league-${index}`,
      date: "20260903",
    }));

    const results = await fetchScoreboards(targets, {
      baseUrl: "http://provider.test/root/",
      concurrency: 20,
      fetchImpl,
    });

    expect(results).toHaveLength(10);
    expect(maximum).toBeLessThanOrEqual(4);
    expect(fetchImpl).toHaveBeenCalledTimes(10);
  });

  it("maps timeouts and malformed JSON separately", async () => {
    const timeoutFetch = jest.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const malformedFetch = jest.fn(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    }) as unknown as Response);
    const target = [{ leagueCode: "eng.1", date: "20260903" }];

    await expect(
      fetchScoreboards(target, {
        baseUrl: "http://provider.test",
        timeoutMs: 1,
        fetchImpl: timeoutFetch as typeof fetch,
      }),
    ).resolves.toEqual([{
      target: target[0],
      error: "provider_unavailable",
      failureReason: "timeout",
    }]);
    await expect(
      fetchScoreboards(target, {
        baseUrl: "http://provider.test",
        fetchImpl: malformedFetch as typeof fetch,
      }),
    ).resolves.toEqual([
      {
        target: target[0],
        error: "invalid_provider_response",
        failureReason: "invalid_json",
      },
    ]);
  });
});
