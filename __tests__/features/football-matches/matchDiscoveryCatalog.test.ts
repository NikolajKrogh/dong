import { createMatchDiscoveryApiClient } from "../../../features/football-matches/matchDiscoveryAdapter";
import { MATCH_LIFECYCLE_LABELS, formatMatchScore } from "../../../features/football-matches/matchPresentation";
import { normalizeEspnScoreboard } from "../../../supabase/functions/_shared/football-matches/espnMatchNormalizer";
import type { SavedMatch } from "../../../types/footballMatch";
import lifecycles from "../../fixtures/matchCatalog/lifecycles.json";
import { liveBoard } from "../../fixtures/matchCatalog/scoreboards";

const saved: SavedMatch = {
  ...normalizeEspnScoreboard(liveBoard, "eng.1").matches[0],
  catalogMatchId: "123",
  observationVersion: "1",
  freshness: {
    lastAttemptAt: null,
    lastSuccessfulCheckAt: null,
    observedAt: null,
    isStale: true,
    availabilityReason: null,
  },
};
describe("maintained discovery catalog adapter", () => {
  it.each(lifecycles)("preserves the %s lifecycle and partially unknown scores", async lifecycle => {
    const match = { ...saved, lifecycle, homeScore: null, awayScore: 1 };
    const discoverMatches = jest.fn().mockResolvedValue({ matches: [match], groups: [], availability: "available" });
    const result = await createMatchDiscoveryApiClient({ discoverMatches }).discoverMatches({ leagueCodes: ["eng.1"] });
    expect(result.matches[0]).toMatchObject({ status: lifecycle, score: { home: null, away: 1 } });
    expect(Object.keys(MATCH_LIFECYCLE_LABELS)).toEqual(lifecycles);
    expect(formatMatchScore(null)).toBe("—");
    expect(formatMatchScore(0)).toBe("0");
  });
  it("delegates configured leagues and preserves calendar date, provider ID and additive catalog identity", async () => {
    const discover = jest.fn().mockResolvedValue({ matches: [saved], availability: "available", groups: [], retryAfterSeconds: null });
    const result = await createMatchDiscoveryApiClient({ discoverMatches: discover }).discoverMatches({
      leagueCodes: Array.from({ length: 20 }, (_, n) => `league.${n}`),
      requestedAt: "2026-10-26T23:30:00-05:00",
    });
    expect(discover).toHaveBeenCalledTimes(1);
    expect(discover.mock.calls[0][0].leagueCodes).toEqual(Array.from({ length: 20 }, (_, n) => `league.${n}`));
    expect(discover.mock.calls[0][0].date).toBe("2026-10-26");
    expect(result.matches).toEqual([expect.objectContaining({ id: "event-100", catalogMatchId: "123", startDateTime: "2026-10-25T18:00:00.000Z", score: { home: 2, away: 1 } })]);
    expect(result).toMatchObject({ groups: [], availability: "available", retryAfterSeconds: null });
  });
  it("does no transport work for no configured leagues", async () => {
    const discover = jest.fn();
    expect(await createMatchDiscoveryApiClient({ discoverMatches: discover }).discoverMatches({ leagueCodes: [] })).toEqual({ matches: [], groups: [], availability: "available", retryAfterSeconds: null });
    expect(discover).not.toHaveBeenCalled();
  });
  it("preserves known empty, cold pending and per-league partial availability", async () => {
    const groups = [{ leagueCode: "esp.1", date: "2026-10-26", availability: "pending", isStale: true, lastSuccessfulCheckAt: null, reason: "source_pending", retryAfterSeconds: 30 }];
    const discover = jest.fn()
      .mockResolvedValueOnce({ matches: [], groups: [], availability: "available", retryAfterSeconds: null })
      .mockResolvedValueOnce({ matches: [], groups, availability: "pending", retryAfterSeconds: 30 })
      .mockResolvedValueOnce({ matches: [saved], groups, availability: "partial", retryAfterSeconds: 30 });
    const adapter = createMatchDiscoveryApiClient({ discoverMatches: discover });
    expect(await adapter.discoverMatches({ leagueCodes: ["eng.1"] })).toMatchObject({ matches: [], availability: "available" });
    expect(await adapter.discoverMatches({ leagueCodes: ["eng.1"] })).toMatchObject({ matches: [], groups, availability: "pending", retryAfterSeconds: 30 });
    const partial = await adapter.discoverMatches({ leagueCodes: ["eng.1", "esp.1"] });
    expect(partial.matches).toHaveLength(1);
    expect(partial).toMatchObject({ groups, availability: "partial", retryAfterSeconds: 30 });
  });
});
