import React from "react";
import TestRenderer from "react-test-renderer";

function discoveryResult(matches: unknown[]) {
  return { matches, groups: [], availability: "available", retryAfterSeconds: null };
}

const mockUseGameStore = jest.fn();
const mockDiscoverMatches = jest.fn();

jest.mock("../../../store/store", () => ({
  useGameStore: (
    selector: (state: { configuredLeagues: unknown[] }) => unknown,
  ) => mockUseGameStore(selector),
}));

jest.mock("../../../utils/commandApiClient", () => ({
  getMatchDiscoveryApiClient: () => ({
    discoverMatches: mockDiscoverMatches,
  }),
}));

jest.mock("../../../features/football-matches/teamLogos", () => ({
  cacheTeamLogo: jest.fn(),
  cacheLeagueLogo: jest.fn(),
}));

describe("useMatchData", () => {
  it("uses bundled league names without a catalog request", async () => {
    let latest!: ReturnType<typeof import("../../../features/football-matches/useMatchData").useMatchData>;
    const Probe = () => { latest = require("../../../features/football-matches/useMatchData").useMatchData("2026-05-24"); return null; };
    let renderer!: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => { renderer = TestRenderer.create(<Probe />); });
    expect(mockDiscoverMatches).toHaveBeenCalledWith({ leagueCodes: ["eng.1", "usa.1"], requestedAt: "2026-05-24T00:00:00.000Z" });
    expect(latest.availableLeagues).toEqual([
      expect.objectContaining({ code: "eng.1", name: "Premier League" }),
      expect.objectContaining({ code: "usa.1", name: "MLS" }),
    ]);
    await TestRenderer.act(async () => renderer.unmount());
  });
  it("ignores a delayed response from an earlier selected date", async () => {
    let resolveOld!: (value: unknown) => void;
    mockDiscoverMatches
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce(discoveryResult([{
        id: "new",
        catalogMatchId: "222",
        league: "eng.1",
        homeTeam: "New Home",
        awayTeam: "New Away",
        startDateTime: "2026-05-25T19:00:00Z",
        status: "scheduled",
      }]));
    let latest!: ReturnType<typeof import("../../../features/football-matches/useMatchData").useMatchData>;
    const Probe = ({ date }: { date: string }) => {
      latest = require("../../../features/football-matches/useMatchData").useMatchData(date);
      return null;
    };
    let renderer!: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => { renderer = TestRenderer.create(<Probe date="2026-05-24" />); });
    await TestRenderer.act(async () => { renderer.update(<Probe date="2026-05-25" />); });
    await TestRenderer.act(async () => {
      resolveOld(discoveryResult([{
        id: "old",
        league: "eng.1",
        homeTeam: "Old Home",
        awayTeam: "Old Away",
        startDateTime: "2026-05-24T19:00:00Z",
        status: "scheduled",
      }]));
    });
    expect(latest.apiData[0].matches[0]).toMatchObject({ id: "new", catalogMatchId: "222", team1: "New Home" });
    await TestRenderer.act(async () => renderer.unmount());
  });
  const configuredLeagues = [
    { code: "eng.1", name: "Premier League", category: "Europe" },
    { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
  ];
  const globalWithFetch = globalThis as typeof globalThis & {
    fetch: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockUseGameStore.mockImplementation(
      (
        selector: (state: {
          configuredLeagues: typeof configuredLeagues;
        }) => unknown,
      ) => selector({ configuredLeagues }),
    );
    mockDiscoverMatches.mockResolvedValue(discoveryResult([
      {
        id: "match-1",
        league: "eng.1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        startDateTime: "2026-05-24T19:00:00Z",
        status: "scheduled",
        venue: "Emirates Stadium",
      },
      {
        id: "match-2",
        league: "usa.1",
        homeTeam: "LA Galaxy",
        awayTeam: "Inter Miami CF",
        startDateTime: "2026-05-24T21:30:00Z",
        status: "live",
        score: {
          home: 1,
          away: 2,
        },
      },
    ]));
    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [], leagues: [] }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps healthy matches with a named partial-results notice and retries without clearing them", async () => {
    const healthyMatch = {
      id: "healthy", league: "eng.1", homeTeam: "Arsenal", awayTeam: "Chelsea",
      startDateTime: "2026-05-24T19:00:00Z", status: "scheduled",
    };
    mockDiscoverMatches.mockResolvedValueOnce({
      matches: [healthyMatch], availability: "partial", retryAfterSeconds: 30,
      groups: [{ leagueCode: "usa.1", availability: "pending", isStale: true }],
    });
    let latest!: ReturnType<typeof import("../../../features/football-matches/useMatchData").useMatchData>;
    const Probe = () => {
      latest = require("../../../features/football-matches/useMatchData").useMatchData("2026-05-24");
      return null;
    };
    let renderer!: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => { renderer = TestRenderer.create(<Probe />); });
    expect(latest.apiData[0].matches[0].id).toBe("healthy");
    expect(latest.availabilityMessage).toContain("MLS");
    expect(latest.availabilityMessage).toContain("may be missing or out of date");
    expect(latest.availableLeagues).toEqual(configuredLeagues);

    mockDiscoverMatches.mockRejectedValueOnce(new Error("fetch failed"));
    await TestRenderer.act(async () => { await latest.retry(); });
    expect(latest.apiData[0].matches[0].id).toBe("healthy");
    expect(latest.isError).toBe(true);

    mockDiscoverMatches.mockResolvedValueOnce(discoveryResult([healthyMatch]));
    await TestRenderer.act(async () => { await latest.retry(); });
    expect(latest.availabilityMessage).toBe("");
    expect(latest.errorMessage).toBe("");
    expect(latest.isError).toBe(false);
    expect(mockDiscoverMatches).toHaveBeenCalledTimes(3);
    await TestRenderer.act(async () => renderer.unmount());
  });

  it("loads grouped match data through the command API client", async () => {
    let observedHook:
      | ReturnType<typeof import("../../../features/football-matches/useMatchData").useMatchData>
      | undefined;

    const Probe = () => {
      const { useMatchData } = require("../../../features/football-matches/useMatchData");

      observedHook = useMatchData("2026-05-24");
      return null;
    };

    let renderer: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockDiscoverMatches).toHaveBeenCalledWith({
      leagueCodes: ["eng.1", "usa.1"],
      requestedAt: "2026-05-24T00:00:00.000Z",
    });
    expect(observedHook?.availableLeagues).toEqual([
      { code: "eng.1", name: "Premier League", category: "Europe" },
      { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
    ]);
    expect(observedHook?.apiData).toEqual([
      {
        name: "Premier League",
        matches: [
          {
            id: "match-1",
            leagueCode: "eng.1",
            team1: "Arsenal",
            team2: "Chelsea",
            date: "2026-05-24",
            time: expect.any(String),
            // The provider's instant, kept verbatim alongside the lossy
            // date/time display pair.
            startDateTime: expect.any(String),
            venue: "Emirates Stadium",
          },
        ],
      },
      {
        name: "MLS",
        matches: [
          {
            id: "match-2",
            leagueCode: "usa.1",
            team1: "LA Galaxy",
            team2: "Inter Miami CF",
            date: "2026-05-24",
            time: expect.any(String),
            startDateTime: expect.any(String),
            venue: "",
          },
        ],
      },
    ]);
    expect(observedHook?.teamsData).toEqual([
      { key: "Arsenal-Premier League", value: "Arsenal", league: "Premier League" },
      { key: "Chelsea-Premier League", value: "Chelsea", league: "Premier League" },
      { key: "Inter Miami CF-MLS", value: "Inter Miami CF", league: "MLS" },
      { key: "LA Galaxy-MLS", value: "LA Galaxy", league: "MLS" },
    ]);

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });

  it("keeps a team that appears in more than one league as a per-league option", async () => {
    // Stable reference: a fresh array each render would retrigger the effect.
    const multiLeague = [
      { code: "eng.1", name: "Premier League", category: "Europe" },
      { code: "eng.fa", name: "FA Cup", category: "Europe" },
    ];
    mockUseGameStore.mockImplementation(
      (selector: (state: { configuredLeagues: unknown[] }) => unknown) =>
        selector({ configuredLeagues: multiLeague }),
    );
    mockDiscoverMatches.mockResolvedValueOnce(discoveryResult([
      {
        id: "league-match",
        league: "eng.1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        startDateTime: "2026-05-24T19:00:00Z",
        status: "scheduled",
      },
      {
        id: "cup-match",
        league: "eng.fa",
        homeTeam: "Arsenal",
        awayTeam: "Manchester City",
        startDateTime: "2026-05-25T19:00:00Z",
        status: "scheduled",
      },
    ]));

    let observedHook:
      | ReturnType<typeof import("../../../features/football-matches/useMatchData").useMatchData>
      | undefined;

    const Probe = () => {
      const { useMatchData } = require("../../../features/football-matches/useMatchData");

      observedHook = useMatchData("2026-05-24");
      return null;
    };

    let renderer: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
      await Promise.resolve();
    });

    // "Arsenal" must survive in both leagues rather than being deduped away.
    expect(observedHook?.teamsData).toHaveLength(4);
    expect(observedHook?.teamsData).toEqual(
      expect.arrayContaining([
        {
          key: "Arsenal-Premier League",
          value: "Arsenal",
          league: "Premier League",
        },
        { key: "Arsenal-FA Cup", value: "Arsenal", league: "FA Cup" },
      ]),
    );

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });

  it("returns empty grouped results when the command API returns no matches", async () => {
    mockDiscoverMatches.mockResolvedValueOnce(discoveryResult([]));

    let observedHook:
      | ReturnType<typeof import("../../../features/football-matches/useMatchData").useMatchData>
      | undefined;

    const Probe = () => {
      const { useMatchData } = require("../../../features/football-matches/useMatchData");

      observedHook = useMatchData("2026-05-24");
      return null;
    };

    let renderer: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(observedHook?.isError).toBe(false);
    expect(observedHook?.errorMessage).toBe("");
    expect(observedHook?.teamsData).toEqual([]);
    expect(observedHook?.availableLeagues).toEqual(configuredLeagues);
    expect(observedHook?.apiData).toEqual([
      { name: "Premier League", matches: [] },
      { name: "MLS", matches: [] },
    ]);

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });

  it("surfaces a sanitized error state without fallback teams when the command API fails", async () => {
    mockDiscoverMatches.mockRejectedValueOnce(new Error("fetch failed"));

    let observedHook:
      | ReturnType<typeof import("../../../features/football-matches/useMatchData").useMatchData>
      | undefined;

    const Probe = () => {
      const { useMatchData } = require("../../../features/football-matches/useMatchData");

      observedHook = useMatchData("2026-05-24");
      return null;
    };

    let renderer: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(observedHook?.isError).toBe(true);
    expect(observedHook?.errorMessage).toBe(
      "Match discovery is temporarily unavailable.",
    );
    expect(observedHook?.apiData).toEqual([]);
    expect(observedHook?.teamsData).toEqual([]);
    expect(observedHook?.availableLeagues).toEqual([]);

    await TestRenderer.act(async () => {
      TestRenderer.act(() => {
        renderer.unmount();
      });
    });
  });
});
