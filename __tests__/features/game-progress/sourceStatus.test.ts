import { getMatchSourceStatusMessage } from "../../../features/game-progress/sourceStatus";
import { normalizeEspnScoreboard } from "../../../supabase/functions/_shared/football-matches/espnMatchNormalizer";
import { liveBoard } from "../../fixtures/matchCatalog/scoreboards";
import type { SavedMatch } from "../../../types/footballMatch";

const saved: SavedMatch = {
  ...normalizeEspnScoreboard(liveBoard, "eng.1").matches[0],
  catalogMatchId: "123",
  observationVersion: "1",
  freshness: {
    lastAttemptAt: "2026-10-26T10:00:00Z",
    lastSuccessfulCheckAt: "2026-10-26T10:00:01Z",
    observedAt: "2026-10-26T10:00:01Z",
    isStale: false,
    availabilityReason: null,
  },
};

function staleMatch(): SavedMatch {
  return {
    ...saved,
    freshness: { ...saved.freshness, isStale: true },
  };
}

describe("nonblocking source status", () => {
  it("stays quiet for healthy source facts and manual-only games", () => {
    expect(getMatchSourceStatusMessage({ savedMatches: [saved] })).toBeNull();
    expect(getMatchSourceStatusMessage({ savedMatches: [] })).toBeNull();
  });
  it("shows stale source facts separately from successful room synchronization", () => {
    expect(getMatchSourceStatusMessage({ savedMatches: [staleMatch()] })).toBe(
      "Live scores are delayed. Saved scores are shown.",
    );
    expect(getMatchSourceStatusMessage({ providerAvailabilityReason: "provider_cooldown" })).toBe("Live scores are delayed. Saved scores are shown.");
  });
  it("does not warn about expected pre-kickoff inactivity or immutable terminal facts", () => {
    expect(
      getMatchSourceStatusMessage({
        savedMatches: [
          { ...staleMatch(), kickoffAt: "2099-01-01T00:00:00Z", lifecycle: "scheduled" },
        ],
        now: Date.parse("2026-10-26T00:00:00Z"),
      }),
    ).toBeNull();
    expect(
      getMatchSourceStatusMessage({
        savedMatches: [{ ...staleMatch(), lifecycle: "finished" }],
      }),
    ).toBeNull();
  });
  it("distinguishes accepted processing, unknown scores, expired authority and private failure details", () => {
    expect(
      getMatchSourceStatusMessage({ roomProcessingPending: true, providerAvailabilityReason: "provider_cooldown" }),
    ).toBe("Score updates are being applied. Saved scores are shown.");
    expect(getMatchSourceStatusMessage({ savedMatches: [{ ...saved, homeScore: null }] })).toBe("Waiting for live scores. Saved scores are shown.");
    expect(getMatchSourceStatusMessage({ error: "tracking_expired" })).toBe("Live tracking has expired. Start a new game to resume updates.");
    expect(getMatchSourceStatusMessage({ providerAvailabilityReason: "PRIVATE_SQL_DETAIL" })).toBe("Live scores are unavailable. Saved scores are shown.");
  });
});
