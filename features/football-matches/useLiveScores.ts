import { useCallback, useEffect, useRef, useState } from "react";
import { Match, useGameStore } from "../../store/store";
import { FOOTBALL_MATCH_PROVIDER } from "../../types/footballMatch";
import type { SavedMatch } from "../../types/footballMatch";
import type { MatchWithScore } from "../../types/matchScores";
import { getFootballMatchService } from "./footballMatchService";
import { generateIdempotencyKey } from "../../utils/commandApiClient";
import { generateToken } from "../../platform/guestCredential";
import { encodeBase64Url } from "../../shared/encoding/base64url";
import { endSoloTracking, settleTrackingRejection } from "./soloTrackingService";

function sameSelection(left: string[], right: string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function isLegacyProviderSelection(match: Match): match is Match & { sourceLeagueCode: string; kickoffAt: string } {
  return !match.catalogMatchId && (!match.sourceProvider || match.sourceProvider === FOOTBALL_MATCH_PROVIDER)
    && Boolean(match.sourceLeagueCode && match.kickoffAt && Number.isFinite(Date.parse(match.kickoffAt)));
}

function nonceFromHex(hex: string): string {
  if (!/^[\da-f]{64}$/i.test(hex)) throw new Error("secure_random_unavailable");
  const bytes = Uint8Array.from({ length: 32 }, (_, index) => parseInt(hex.slice(index * 2, index * 2 + 2), 16));
  return encodeBase64Url(bytes);
}

function savedMatchToLiveMatch(saved: SavedMatch, id: string): MatchWithScore {
  return {
    id, homeScore: saved.homeScore, awayScore: saved.awayScore,
    homeTeam: saved.homeTeam.name, awayTeam: saved.awayTeam.name,
    homeTeamId: saved.homeTeam.sourceTeamId ?? "", awayTeamId: saved.awayTeam.sourceTeamId ?? "",
    isLive: saved.lifecycle === "live", status: saved.rawStatus ?? saved.lifecycle,
    minutesPlayed: saved.displayClock ?? undefined,
    goalScorers: saved.goals?.filter(goal => !goal.isRetracted && goal.kind !== "shootout").map(goal => ({
      name: goal.athleteName ?? "Unknown scorer", time: goal.clock ?? "–", teamId: goal.sourceTeamId ?? "",
      isPenalty: goal.kind === "penalty", isOwnGoal: goal.kind === "own_goal", goalType: goal.kind,
    })),
    goalsAvailability: saved.goalsAvailability, hasMoreGoals: saved.hasMoreGoals,
    homeTeamStatistics: saved.homeTeamStatistics ?? undefined,
    awayTeamStatistics: saved.awayTeamStatistics ?? undefined, freshness: saved.freshness,
  };
}

export interface LiveScoresResult {
  liveMatches: MatchWithScore[];
  isPolling: boolean;
  lastUpdated: Date | null;
  error: string | null;
  startPolling: () => void;
  stopPolling: () => void;
  fetchCurrentScores: () => Promise<void>;
  captureHistoryDetails: () => Promise<void>;
  endTracking: () => Promise<void>;
}

/** Finite solo demand plus saved-only reads. No provider HTTP, probes or league sweeps. */
export function useLiveScores(
  matches: Match[],
  updateCallback: (matchId: string, team: "home" | "away", newGoals: number) => void,
  intervalMs = 60000,
  enabled = true,
): LiveScoresResult {
  const [liveMatches, setLiveMatches] = useState<MatchWithScore[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generationRef = useRef(0);
  const inFlightRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestRef = useRef({ matches, updateCallback, enabled });
  useEffect(() => { latestRef.current = { matches, updateCallback, enabled }; }, [matches, updateCallback, enabled]);
  const selectionKey = enabled ? [...new Set(matches.flatMap(match => {
    if (match.catalogMatchId) return [`catalog:${match.catalogMatchId}`];
    if (isLegacyProviderSelection(match)) {
      return [`legacy:${match.sourceProvider ?? FOOTBALL_MATCH_PROVIDER}:${match.sourceLeagueCode}:${match.sourceMatchId ?? match.id}:${match.kickoffAt}`];
    }
    return [];
  }))].sort().join("|") : "";

  useEffect(() => {
    generationRef.current++;
    abortRef.current?.abort();
    // The counter deliberately invalidates every outstanding async generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { generationRef.current++; abortRef.current?.abort(); };
  }, [selectionKey, enabled]);

  const fetchCurrentScores = useCallback(async () => {
    if (!latestRef.current.enabled) return;
    const current = latestRef.current;
    const legacy = current.matches.filter(isLegacyProviderSelection);
    if (!current.matches.some(match => match.catalogMatchId) && !legacy.length) return;
    const generation = generationRef.current;
    if (inFlightRef.current === generation) return;
    inFlightRef.current = generation;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const footballMatchService = getFootballMatchService({ signal: controller.signal });
      const state = useGameStore.getState();
      const linked = new Map<string, string>();
      // Only recover explicit legacy selection metadata; never scan configured leagues.
      const scopes = new Map(legacy.slice(0, 20).map(match => [`${match.sourceLeagueCode}:${new Date(match.kickoffAt).toISOString().slice(0, 10)}`, match]));
      const pendingScopes = [...scopes.values()];
      async function recoverLegacyScopes(): Promise<void> {
        if (generationRef.current !== generation || controller.signal.aborted || !pendingScopes.length) return;
        // Limit client recovery to two requests; provider acquisition remains server-owned.
        const results = await Promise.all(pendingScopes.splice(0, 2).map(selected =>
          footballMatchService.discoverMatches({ leagueCodes: [selected.sourceLeagueCode], date: new Date(selected.kickoffAt).toISOString().slice(0, 10) }),
        ));
        if (generationRef.current !== generation || controller.signal.aborted) return;
        for (const result of results) {
          for (const saved of result.matches) {
            const match = legacy.find(candidate => candidate.sourceLeagueCode === saved.identity.leagueCode && (candidate.sourceMatchId ?? candidate.id) === saved.identity.sourceEventId);
            if (match) linked.set(match.id, saved.catalogMatchId);
          }
        }
        return recoverLegacyScopes();
      }
      await recoverLegacyScopes();
      if (generationRef.current !== generation || controller.signal.aborted) return;
      const ids = [...new Set(current.matches.flatMap(match => {
        const id = match.catalogMatchId ?? linked.get(match.id);
        return id ? [id] : [];
      }))].sort();
      if (!ids.length) return;
      const result = await footballMatchService.readSavedMatches(ids);
      if (generationRef.current !== generation || controller.signal.aborted) return;
      const byId = new Map(result.matches.map(saved => [saved.catalogMatchId, saved]));
      // Only established terminal facts leave demand; missing/unknown identity is never silently dropped.
      const trackingIds = ids.filter(id => !['finished', 'canceled', 'abandoned'].includes(byId.get(id)?.lifecycle ?? 'unknown'));
      let tracking = state.soloTracking;
      let pendingRecoveryFailed = false;
      let trackingError: string | null = null;
      if (tracking?.grant?.state === "active" && !tracking.pending && Date.parse(tracking.grant.expiresAt) <= Date.now()) {
        const expiredSelection = tracking.grant.catalogMatchIds;
        tracking = { grant: null, pending: null, rejection: { catalogMatchIds: expiredSelection, code: "tracking_expired" } };
        state.setSoloTracking(tracking);
      }
      if (tracking?.pending) {
        const request = tracking.pending;
        try {
          const grant = await footballMatchService.replaceSoloTracking(request);
          if (generationRef.current !== generation) return;
          tracking = { grant, pending: null };
          useGameStore.getState().setSoloTracking(tracking);
        } catch (failure) {
          if (controller.signal.aborted) return;
          if (settleTrackingRejection(request, failure)) tracking = useGameStore.getState().soloTracking;
          else pendingRecoveryFailed = true;
          if (pendingRecoveryFailed || sameSelection(request.catalogMatchIds, trackingIds)) trackingError = failure instanceof Error ? failure.message : "transport_unavailable";
        }
      }
      const rejection = tracking?.rejection;
      const blocked = rejection && sameSelection(rejection.catalogMatchIds, trackingIds);
      if (blocked) trackingError = rejection.code;
      const selectionChanged = trackingIds.length > 0
        ? !tracking?.grant || tracking.grant.state === "ended" || !sameSelection(tracking.grant.catalogMatchIds, trackingIds)
        : tracking?.grant?.state === "active" && tracking.grant.catalogMatchIds.length > 0;
      if (selectionChanged && !pendingRecoveryFailed && !blocked) {
        // Keep original creation/replacement inputs across ambiguous transport failures.
        let pending = tracking?.pending;
        if (!pending) {
          if (tracking?.grant && tracking.grant.state === "active" && Date.parse(tracking.grant.expiresAt) > Date.now()) {
            pending = { operationId: generateIdempotencyKey(), catalogMatchIds: trackingIds, grantToken: tracking.grant.grantToken, expectedSelectionVersion: tracking.grant.selectionVersion };
          } else {
            pending = { operationId: generateIdempotencyKey(), catalogMatchIds: trackingIds, creationNonce: nonceFromHex(await generateToken()) };
          }
          if (generationRef.current !== generation) return;
          tracking = { grant: tracking?.grant ?? null, pending };
          state.setSoloTracking(tracking);
        }
        try {
          const grant = await footballMatchService.replaceSoloTracking(pending);
          if (generationRef.current !== generation) return;
          useGameStore.getState().setSoloTracking({ grant, pending: null });
        } catch (failure) {
          if (controller.signal.aborted) return;
          // Admission failure must not hide previously accepted public facts.
          settleTrackingRejection(pending, failure);
          trackingError = failure instanceof Error ? failure.message : "transport_unavailable";
        }
      }
      setError(trackingError ?? (result.missingCatalogMatchIds.length ? 'saved_match_unavailable' : null));
      const next = latestRef.current.matches.flatMap(match => {
        const catalogId = match.catalogMatchId ?? linked.get(match.id);
        const saved = catalogId ? byId.get(catalogId) : undefined;
        return saved ? [savedMatchToLiveMatch(saved, match.id)] : [];
      });
      setLiveMatches(previous => {
        const merged = new Map(previous.map(match => [match.id, match]));
        for (const match of next) merged.set(match.id, match);
        return latestRef.current.matches.flatMap(match => merged.has(match.id) ? [merged.get(match.id)!] : []);
      });
      const successful = result.matches.flatMap(match => match.freshness.lastSuccessfulCheckAt ? [Date.parse(match.freshness.lastSuccessfulCheckAt)] : []);
      if (successful.length) setLastUpdated(new Date(Math.max(...successful)));
      if (linked.size) state.setMatches(previous => previous.map(match => linked.has(match.id) ? { ...match, catalogMatchId: linked.get(match.id), sourceProvider: FOOTBALL_MATCH_PROVIDER } : match));
      useGameStore.getState().captureSavedMatches(result.matches);
      const currentMatches = new Map(latestRef.current.matches.map(match => [match.id, match]));
      for (const live of next) {
        const match = currentMatches.get(live.id);
        if (!match || live.homeScore === null || live.awayScore === null) continue;
        if (live.homeScore > match.homeGoals) latestRef.current.updateCallback(match.id, "home", live.homeScore);
        if (live.awayScore > match.awayGoals) latestRef.current.updateCallback(match.id, "away", live.awayScore);
      }
    } catch (failure) {
      if (generationRef.current === generation && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "transport_unavailable");
    } finally {
      if (inFlightRef.current === generation) inFlightRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!latestRef.current.enabled || intervalRef.current) return;
    if (!latestRef.current.matches.some(match => match.catalogMatchId || isLegacyProviderSelection(match))) return;
    setIsPolling(true);
    void fetchCurrentScores();
    intervalRef.current = setInterval(() => { void fetchCurrentScores(); }, intervalMs);
  }, [fetchCurrentScores, intervalMs]);
  const stopPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsPolling(false);
  }, []);
  const captureHistoryDetails = useCallback(async () => {
    const ids = [...new Set(latestRef.current.matches.flatMap(match => match.catalogMatchId ? [match.catalogMatchId] : []))];
    if (!ids.length || !latestRef.current.enabled) return;
    const generation = generationRef.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const result = await getFootballMatchService({ signal: controller.signal }).readSavedMatches(ids, { projection: "history" });
      if (generationRef.current === generation) useGameStore.getState().captureSavedMatches(result.matches);
    } catch { /* Keep details already captured locally when saved history is unavailable. */ }
    finally { clearTimeout(timeout); }
  }, []);
  const endTracking = endSoloTracking;
  useEffect(() => {
    const hasLegacySelection = matches.some(isLegacyProviderSelection);
    if (enabled && !selectionKey && !hasLegacySelection) void endTracking();
  }, [enabled, endTracking, matches, selectionKey]);
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return { liveMatches, isPolling, lastUpdated, error, startPolling, stopPolling, fetchCurrentScores, captureHistoryDetails, endTracking };
}
