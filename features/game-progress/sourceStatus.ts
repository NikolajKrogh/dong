import type { Match } from "../../store/gameStore";
import type { SavedMatch } from "../../types/footballMatch";
import type { LiveScoresResult } from "../football-matches/useLiveScores";
import type { ActiveGameRoomSync } from "../rooms/useActiveGameRoomSync";

function sourceFailureMessage(reason: string): string {
  if (reason === "tracking_expired") return "Live tracking has expired. Restart tracking to resume updates.";
  if (["capacity_limited", "admission_limited", "identity_unresolved", "invalid_selection"].includes(reason)) return "Live tracking could not start. Saved scores are shown.";
  if (["acquisition_pending", "source_pending"].includes(reason)) return "Waiting for live scores. Saved scores are shown.";
  if (["budget_exhausted", "provider_cooldown", "acquisition_paused", "partial_provider_response", "source_stale"].includes(reason)) return "Live scores are delayed. Saved scores are shown.";
  return "Live scores are unavailable. Saved scores are shown.";
}

/** Source health is independent of the connection to the shared game. Healthy reads stay quiet. */
export function getMatchSourceStatusMessage(input: {
  error?: string | null;
  providerAvailabilityReason?: string | null;
  roomProcessingPending?: boolean;
  savedMatches?: SavedMatch[];
  now?: number;
}): string | null {
  if (input.roomProcessingPending) return "Score updates are being applied. Saved scores are shown.";
  const failure = input.error ?? input.providerAvailabilityReason;
  if (failure) return sourceFailureMessage(failure);
  const now = input.now ?? Date.now();
  const eligible = (input.savedMatches ?? []).filter(match => !["finished", "canceled", "abandoned"].includes(match.lifecycle)
    && !(match.kickoffValidity === "confirmed" && match.kickoffAt && Date.parse(match.kickoffAt) > now));
  const sourceFailure = eligible.find(match => match.freshness.availabilityReason)?.freshness.availabilityReason;
  if (sourceFailure) return sourceFailureMessage(sourceFailure);
  if (eligible.some(match => !match.freshness.lastSuccessfulCheckAt || match.homeScore === null || match.awayScore === null)) return "Waiting for live scores. Saved scores are shown.";
  if (eligible.some(match => match.freshness.isStale)) return "Live scores are delayed. Saved scores are shown.";
  return null;
}

export function getGameSourcePresentation(
  activeGame: ActiveGameRoomSync,
  solo: Pick<LiveScoresResult, "error" | "restartTracking" | "isPolling" | "lastUpdated">,
  matches: Match[],
) {
  const source = activeGame.isMultiplayer ? activeGame.snapshot ?? {} : {
    error: solo.error, savedMatches: matches.flatMap(match => match.catalogSnapshot ? [match.catalogSnapshot] : []),
  };
  const sourceStatusMessage = getMatchSourceStatusMessage(source);
  return {
    sourceStatusMessage,
    isPolling: !sourceStatusMessage && (activeGame.isMultiplayer ? activeGame.isEditable : solo.isPolling),
    onRestartTracking: !activeGame.isMultiplayer && solo.error === "tracking_expired" ? solo.restartTracking : undefined,
    lastUpdated: activeGame.isMultiplayer
      ? (activeGame.snapshot?.lastScoresCheckedAt ? new Date(activeGame.snapshot.lastScoresCheckedAt) : null)
      : solo.lastUpdated,
  };
}
