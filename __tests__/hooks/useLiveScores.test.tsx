import React from "react";
import TestRenderer from "react-test-renderer";
import { useGameStore, type Match } from "../../store/store";
import { useLiveScores } from "../../hooks/useLiveScores";
import { normalizeEspnScoreboard } from "../../supabase/functions/_shared/football-matches/espnMatchNormalizer";
import { liveBoard } from "../fixtures/matchCatalog/scoreboards";
import type { SavedMatch } from "../../types/footballMatch";
import { FootballMatchError } from "../../utils/footballMatchService";

const mockRead = jest.fn();
const mockTracking = jest.fn();
const mockDiscovery = jest.fn();
jest.mock("../../utils/footballMatchService", () => ({
  ...jest.requireActual("../../utils/footballMatchService"),
  getFootballMatchService: () => ({
    readSavedMatches: mockRead,
    replaceSoloTracking: mockTracking,
    discoverMatches: mockDiscovery,
  }),
}));
jest.mock("../../platform/guestCredential", () => ({ generateToken: jest.fn(async () => "12".repeat(32)) }));

const match: Match = {
  id: "event-100",
  catalogMatchId: "123",
  homeTeam: "Home FC",
  awayTeam: "Away FC",
  homeGoals: 0,
  awayGoals: 0,
};

function saved(): SavedMatch {
  return {
    ...normalizeEspnScoreboard(liveBoard, "eng.1").matches[0],
    catalogMatchId: "123",
    observationVersion: "1",
    freshness: {
      lastAttemptAt: "2026-10-26T12:00:00Z",
      lastSuccessfulCheckAt: "2026-10-26T12:00:01Z",
      observedAt: "2026-10-26T12:00:01Z",
      isStale: false,
      availabilityReason: null,
    },
  };
}

let observed: ReturnType<typeof useLiveScores>;
let renderer: TestRenderer.ReactTestRenderer;
let callback: jest.Mock;
async function mount(
  matches: Match[] = [match],
  enabled = true,
): Promise<React.ComponentType<{ values: Match[] }>> {
  function Probe({ values }: { values: Match[] }): React.ReactElement | null {
    observed = useLiveScores(values, callback, 60000, enabled);
    return null;
  }

  await TestRenderer.act(async () => { renderer = TestRenderer.create(<Probe values={matches} />); });
  return Probe;
}

async function read(): Promise<void> {
  await TestRenderer.act(async () => { await observed.fetchCurrentScores(); });
}

describe("saved-only live scores", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGameStore.setState({ matches: [match], history: [], soloTracking: null });
    callback = jest.fn();
    mockTracking.mockImplementation(async input => ({
      grantToken: "A".repeat(43),
      selectionVersion: input.expectedSelectionVersion ? input.expectedSelectionVersion + 1 : 1,
      isReplay: false,
      catalogMatchIds: input.catalogMatchIds,
      expiresAt: "2099-01-01T00:00:00Z",
      state: input.catalogMatchIds.length ? "active" : "ended",
    }));
    mockRead.mockResolvedValue({ matches: [saved()], missingCatalogMatchIds: [], availability: "available" });
    mockDiscovery.mockResolvedValue({ matches: [saved()], availability: "available" });
    global.fetch = jest.fn().mockRejectedValue(new Error("Provider HTTP is forbidden"));
  });
  afterEach(async () => {
    if (renderer) {
      await TestRenderer.act(async () => renderer.unmount());
    }
    jest.useRealTimers();
  });

  it("creates one finite selection, reads saved facts, and preserves source match IDs", async () => {
    await mount();
    await read();
    expect(mockTracking).toHaveBeenCalledWith(expect.objectContaining({ creationNonce: expect.stringMatching(/^[\w-]{43}$/), catalogMatchIds: ["123"] }));
    expect(mockRead).toHaveBeenCalledWith(["123"]);
    expect(observed.liveMatches[0]).toMatchObject({ id: "event-100", homeScore: 2, awayScore: 1 });
    expect(callback.mock.calls).toEqual([["event-100", "home", 2], ["event-100", "away", 1]]);
    expect(observed.lastUpdated?.toISOString()).toBe("2026-10-26T12:00:01.000Z");
    await read();
    expect(mockTracking).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does no transport work for manual-only selections or disabled multiplayer polling", async () => {
    await mount([{ ...match, catalogMatchId: undefined }]);
    await read();
    expect(mockTracking).not.toHaveBeenCalled();
    expect(mockRead).not.toHaveBeenCalled();
  });
  it("leaves multiplayer source ownership entirely on the server", async () => {
    await mount([match], false);
    await read();
    await TestRenderer.act(async () => observed.startPolling());
    expect(observed.isPolling).toBe(false);
    expect(mockTracking).not.toHaveBeenCalled();
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockDiscovery).not.toHaveBeenCalled();
  });

  it("keeps accepted details and source freshness through offline or evicted responses", async () => {
    await mount();
    await read();
    mockRead.mockRejectedValueOnce(new Error("transport_unavailable"));
    await read();
    expect(observed.liveMatches).toHaveLength(1);
    expect(observed.error).toBe("transport_unavailable");
    mockRead.mockResolvedValueOnce({ matches: [], missingCatalogMatchIds: ["123"], availability: "unavailable" });
    await read();
    expect(observed.liveMatches[0].homeScore).toBe(2);
    expect(useGameStore.getState().matches[0].catalogSnapshot?.homeTeamStatistics?.fouls).toBe(0);
  });

  it("does not invent score or statistic zero from unknown fields", async () => {
    mockRead.mockResolvedValue({ matches: [{ ...saved(), homeScore: null, awayScore: null, homeTeamStatistics: null }], missingCatalogMatchIds: [], availability: "partial" });
    await mount();
    await read();
    expect(callback).not.toHaveBeenCalled();
    expect(observed.liveMatches[0].homeScore).toBeNull();
    expect(observed.liveMatches[0].homeTeamStatistics).toBeUndefined();
  });
  it("tracks only live/nonterminal facts while reading and preserving every selected match", async () => {
    const final = { ...saved(), catalogMatchId: "456", lifecycle: "finished", isCompleted: true };
    mockRead.mockResolvedValue({ matches: [saved(), final], missingCatalogMatchIds: [], availability: "available" });
    await mount([match, { ...match, id: "finished-source", catalogMatchId: "456" }]);
    await read();
    expect(mockRead).toHaveBeenCalledWith(["123", "456"]);
    expect(mockTracking).toHaveBeenCalledWith(expect.objectContaining({ catalogMatchIds: ["123"] }));
    expect(observed.liveMatches.map(match => match.id)).toEqual(["event-100", "finished-source"]);
  });
  it("ends admitted demand when all selected canonical matches finish without hiding saved results", async () => {
    await mount();
    await read();
    mockRead.mockResolvedValue({ matches: [{ ...saved(), lifecycle: "finished", isCompleted: true }], missingCatalogMatchIds: [], availability: "available" });
    await read();
    expect(mockTracking).toHaveBeenLastCalledWith(expect.objectContaining({ catalogMatchIds: [], expectedSelectionVersion: 1 }));
    expect(observed.liveMatches[0].homeScore).toBe(2);
    await read();
    expect(mockTracking).toHaveBeenCalledTimes(2);
  });

  it("links only an explicit legacy league/date selection without changing its local source ID", async () => {
    const legacy = { ...match, catalogMatchId: undefined, sourceLeagueCode: "eng.1", sourceProvider: "espn", kickoffAt: "2026-10-25T18:00:00Z" };
    useGameStore.setState({ matches: [legacy] });
    await mount([legacy]);
    await read();
    expect(mockDiscovery).toHaveBeenCalledTimes(1);
    expect(mockDiscovery).toHaveBeenCalledWith({ leagueCodes: ["eng.1"], date: "2026-10-25" });
    expect(useGameStore.getState().matches[0]).toMatchObject({ id: "event-100", catalogMatchId: "123" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reuses identical admission inputs after an ambiguous creation failure", async () => {
    mockTracking.mockRejectedValueOnce(new Error("transport_unavailable"));
    await mount();
    await read();
    await read();
    expect(mockTracking.mock.calls[0][0]).toEqual(mockTracking.mock.calls[1][0]);
    expect(mockRead).toHaveBeenCalledTimes(2);
  });
  it("recovers the original issuance before replacing an ambiguous earlier selection", async () => {
    mockTracking.mockRejectedValueOnce(new Error("transport_unavailable"));
    const Probe = await mount();
    await read();
    await TestRenderer.act(async () => renderer.update(<Probe values={[{ ...match, id: "new-source", catalogMatchId: "456" }]} />));
    await read();
    expect(mockTracking.mock.calls[1][0]).toEqual(mockTracking.mock.calls[0][0]);
    expect(mockTracking.mock.calls[2][0]).toMatchObject({ catalogMatchIds: ["456"], grantToken: "A".repeat(43), expectedSelectionVersion: 1 });
  });
  it("clears existing finite demand when the last provider match is removed", async () => {
    useGameStore.setState({ soloTracking: { grant: { grantToken: "A".repeat(43), selectionVersion: 1, isReplay: false, catalogMatchIds: ["123"], expiresAt: "2099-01-01T00:00:00Z", state: "active" }, pending: null } });
    await mount([]);
    expect(mockTracking).toHaveBeenCalledWith(expect.objectContaining({ catalogMatchIds: [], expectedSelectionVersion: 1 }));
    expect(useGameStore.getState().soloTracking?.grant?.state).toBe("ended");
    expect(mockRead).not.toHaveBeenCalled();
  });

  it("rejects late results after the selected match changes", async () => {
    let resolve!: (value: unknown) => void;
    mockRead.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const Probe = await mount();
    let pending!: Promise<void>;
    await TestRenderer.act(async () => { pending = observed.fetchCurrentScores(); await Promise.resolve(); });
    await TestRenderer.act(async () => { renderer.update(<Probe values={[{ ...match, id: "new-source", catalogMatchId: "456" }]} />); });
    await TestRenderer.act(async () => { resolve({ matches: [saved()], missingCatalogMatchIds: [], availability: "available" }); await pending; });
    expect(callback).not.toHaveBeenCalled();
    expect(observed.liveMatches).toEqual([]);
  });
  it("fences two different unlinked legacy selections before late discovery can admit the old one", async () => {
    let resolveOld!: (value: unknown) => void;
    mockDiscovery.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    const legacy = { ...match, catalogMatchId: undefined, sourceLeagueCode: "eng.1", sourceProvider: "espn", kickoffAt: "2026-10-25T18:00:00Z" };
    const next = { ...legacy, id: "new-source", sourceLeagueCode: "esp.1", kickoffAt: "2026-10-26T18:00:00Z" };
    const Probe = await mount([legacy]);
    let oldRead!: Promise<void>;
    await TestRenderer.act(async () => { oldRead = observed.fetchCurrentScores(); await Promise.resolve(); });
    const nextSaved = { ...saved(), catalogMatchId: "456", identity: { ...saved().identity, sourceEventId: "new-source", leagueCode: "esp.1" } };
    mockDiscovery.mockResolvedValue({ matches: [nextSaved], availability: "available" });
    mockRead.mockResolvedValue({ matches: [nextSaved], missingCatalogMatchIds: [], availability: "available" });
    await TestRenderer.act(async () => renderer.update(<Probe values={[next]} />));
    await read();
    expect(mockDiscovery).toHaveBeenCalledTimes(2);
    await TestRenderer.act(async () => { resolveOld({ matches: [saved()], availability: "available" }); await oldRead; });
    expect(mockTracking.mock.calls.every(([request]) => !request.catalogMatchIds.includes("123"))).toBe(true);
    expect(observed.liveMatches[0]).toMatchObject({ id: "new-source" });
  });
  it("does not let a definitively rejected old creation poison a later game selection", async () => {
    mockTracking.mockImplementation(async input => {
      if (input.catalogMatchIds.includes("123")) throw new FootballMatchError("identity_unresolved");
      return { grantToken: "C".repeat(43), selectionVersion: 1, isReplay: false, catalogMatchIds: input.catalogMatchIds, expiresAt: "2099-01-01T00:00:00Z", state: "active" };
    });
    const Probe = await mount();
    await read();
    await TestRenderer.act(async () => {
      useGameStore.getState().resetState();
      renderer.update(<Probe values={[{ ...match, id: "new-source", catalogMatchId: "456" }]} />);
    });
    await read();
    expect(mockTracking.mock.calls.some(([request]) => request.catalogMatchIds.includes("456"))).toBe(true);
    expect(useGameStore.getState().soloTracking?.grant?.catalogMatchIds).toEqual(["456"]);
  });
  it("clears definitively expired pending authority so a new game can create a fresh issuance", async () => {
    const rejected = { operationId: "00000000-0000-4000-8000-000000000001", creationNonce: "B".repeat(43), catalogMatchIds: ["123"] };
    useGameStore.setState({ soloTracking: { grant: null, pending: rejected } });
    mockTracking.mockImplementation(async input => {
      if (input.creationNonce === rejected.creationNonce) throw Object.assign(new Error("tracking_expired"), { code: "tracking_expired" });
      return { grantToken: "C".repeat(43), selectionVersion: 1, isReplay: false, catalogMatchIds: input.catalogMatchIds, expiresAt: "2099-01-01T00:00:00Z", state: "active" };
    });
    await mount();
    await TestRenderer.act(async () => observed.endTracking());
    useGameStore.getState().resetState();
    await read();
    expect(mockTracking.mock.calls.some(([request]) => request.creationNonce && request.creationNonce !== rejected.creationNonce)).toBe(true);
    expect(useGameStore.getState().soloTracking?.grant?.grantToken).toBe("C".repeat(43));
  });
  it("surfaces an expired same-selection grant without silent renewal, then allows an explicit new game", async () => {
    useGameStore.setState({ soloTracking: { grant: { grantToken: "A".repeat(43), selectionVersion: 1, isReplay: false, catalogMatchIds: ["123"], expiresAt: "2020-01-01T00:00:00Z", state: "active" }, pending: null } });
    await mount();
    await read();
    expect(observed.error).toBe("tracking_expired");
    expect(mockTracking).not.toHaveBeenCalled();
    expect(mockRead).toHaveBeenCalledTimes(1);
    useGameStore.getState().resetState();
    await read();
    expect(mockTracking).toHaveBeenCalledWith(expect.objectContaining({ creationNonce: expect.any(String) }));
    expect(useGameStore.getState().soloTracking?.grant?.expiresAt).toBe("2099-01-01T00:00:00Z");
  });

  it("captures self-contained history once and ends finite demand without source HTTP", async () => {
    await mount();
    await read();
    await TestRenderer.act(async () => { await observed.captureHistoryDetails(); });
    useGameStore.getState().saveGameToHistory();
    await TestRenderer.act(async () => { await observed.endTracking(); });
    const history = useGameStore.getState().history[0];
    expect(history.matches[0].catalogSnapshot?.goals?.[0].athleteName).toBe("A Player");
    expect(JSON.stringify(history)).not.toContain("grantToken");
    expect(mockRead).toHaveBeenLastCalledWith(["123"], { projection: "history" });
    expect(mockTracking).toHaveBeenLastCalledWith(expect.objectContaining({ catalogMatchIds: [], expectedSelectionVersion: 1 }));
    useGameStore.setState({ matches: [] });
    expect(history.matches[0].catalogSnapshot?.homeScore).toBe(2);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("keeps controls stable and clears one polling interval", async () => {
    jest.useFakeTimers();
    const clear = jest.spyOn(globalThis, "clearInterval");
    await mount();
    const start = observed.startPolling;
    await TestRenderer.act(async () => { observed.startPolling(); });
    expect(observed.startPolling).toBe(start);
    await TestRenderer.act(async () => { observed.stopPolling(); });
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
