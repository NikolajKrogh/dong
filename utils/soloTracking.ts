import { useGameStore } from "../store/store";
import type { FootballMatchErrorCode, SoloTrackingSelection } from "../types/footballMatch";
import { generateIdempotencyKey } from "./commandApiClient";
import { FootballMatchError, getFootballMatchService } from "./footballMatchService";

const definitiveTrackingErrors = new Set<FootballMatchErrorCode>([
  "invalid_selection",
  "identity_unresolved",
  "tracking_expired",
  "operation_conflict",
  "tracking_conflict",
  "invalid_tracking_grant",
  "not_permitted",
]);

/** A known rejection has no ambiguous success to recover; never retry that nonce forever. */
export function settleTrackingRejection(request: SoloTrackingSelection, error: unknown): boolean {
  let candidate: unknown;
  if (error instanceof FootballMatchError) candidate = error.code;
  else {
    const failure = error as { code?: unknown; message?: unknown } | null;
    candidate = typeof failure?.code === "string" ? failure.code : failure?.message;
  }
  if (typeof candidate !== "string" || !definitiveTrackingErrors.has(candidate as FootballMatchErrorCode)) return false;
  const state = useGameStore.getState();
  const tracking = state.soloTracking;
  if (tracking?.pending?.operationId !== request.operationId) return true;
  const invalidGrant = ["tracking_expired", "invalid_tracking_grant", "tracking_conflict"].includes(candidate);
  state.setSoloTracking({ grant: invalidGrant ? null : tracking.grant, pending: null, rejection: { catalogMatchIds: request.catalogMatchIds, code: candidate as FootballMatchErrorCode } });
  return true;
}

export async function endSoloTracking(): Promise<void> {
  const state = useGameStore.getState();
  if (!state.soloTracking || !state.soloTracking.pending && state.soloTracking.grant?.state !== "active") return;
  let attempted = state.soloTracking.pending;
  try {
    const footballMatchService = getFootballMatchService();
    let grant = state.soloTracking.grant;
    const pending = state.soloTracking.pending;
    if (pending) grant = await footballMatchService.replaceSoloTracking(pending);
    if (!grant || grant.state === "ended") return;
    const request: SoloTrackingSelection = {
      operationId: generateIdempotencyKey(), catalogMatchIds: [], grantToken: grant.grantToken, expectedSelectionVersion: grant.selectionVersion,
    };
    if (useGameStore.getState().soloTracking !== state.soloTracking) return;
    state.setSoloTracking({ grant, pending: request });
    attempted = request;
    const ended = await footballMatchService.replaceSoloTracking(request);
    if (useGameStore.getState().soloTracking?.pending?.operationId === request.operationId) {
      useGameStore.getState().setSoloTracking({ grant: ended, pending: null });
    }
  } catch (failure) {
    if (attempted) settleTrackingRejection(attempted, failure);
    // Ambiguous inputs survive for recovery; finite expiry still bounds demand.
  }
}
