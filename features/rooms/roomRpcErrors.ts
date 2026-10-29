import type {
  GameplayActionResult,
  GameplayErrorCode,
  ReassignmentErrorCode
} from "../../types/room";
import { GameplayRpcError, ReassignmentRpcError } from "../../types/room";

const REASSIGNMENT_ERROR_MESSAGES: Record<ReassignmentErrorCode, string> = {
  not_authenticated: "Sign-in is required to change assignments.",
  room_not_found: "The room no longer exists.",
  not_host: "Only the host can change assignments.",
  host_participant_not_found:
    "The host identity is out of date. Refresh the room and try again.",
  invalid_reassignment_input:
    "Choose a valid, duplicate-free set of matches and try again.",
  game_not_in_progress: "Assignments can only change while the game is running.",
  participant_not_in_room: "That player is no longer in the room.",
  cannot_reassign_common_match:
    "The common match belongs to everyone and cannot be changed here.",
  match_not_in_room_pool: "That match is not part of this room.",
  assignment_count_mismatch:
    "Replace every existing match slot; the number of slots cannot change.",
  idempotency_key_reused:
    "This request key was already used for a different assignment change.",
};

const REASSIGNMENT_ERROR_CODES = new Set<ReassignmentErrorCode>(
  Object.keys(REASSIGNMENT_ERROR_MESSAGES) as ReassignmentErrorCode[],
);

export const GAMEPLAY_ERROR_MESSAGES: Record<GameplayErrorCode, string> = {
  room_processing_pending: "Accepted match updates are still being applied. Try again shortly.",
  not_authenticated: "Sign-in is required for this action.",
  not_room_participant: "You are no longer an active participant in this room.",
  participant_inactive: "That participant is no longer active.",
  target_inactive: "That participant is no longer active.",
  room_not_found: "The room no longer exists.",
  match_not_in_room: "That match is not part of this room.",
  invalid_room_state: "The game is no longer accepting gameplay changes.",
  game_not_in_progress: "The game is no longer running.",
  manual_score_required: "Only manual matches accept participant score changes.",
  provider_score_required: "Provider-controlled scores cannot be edited manually.",
  provider_match_mismatch: "The provider match identity no longer matches the room.",
  invalid_provider_score: "The provider returned an invalid score.",
  invalid_delta: "That gameplay change is invalid.",
  negative_result: "A score or drink total cannot become negative.",
  idempotency_conflict: "That request has already been used for a different action.",
  idempotency_key_reused: "That request has already been used for a different action.",
  not_host: "Only the current host can perform this action.",
  forbidden: "You do not have access to this room.",
  guest_token_expired: "The guest room session has expired.",
  service_unavailable: "The shared game service is unavailable. Reconnect and refresh.",
  unknown_error: "The shared game could not accept that action.",
};

const GAMEPLAY_ERROR_CODES = new Set<GameplayErrorCode>(
  Object.keys(GAMEPLAY_ERROR_MESSAGES) as GameplayErrorCode[],
);

export const mapGameplayError = (error: unknown) => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const code = GAMEPLAY_ERROR_CODES.has(message as GameplayErrorCode)
    ? (message as GameplayErrorCode)
    : null;
  return code ? new GameplayRpcError(code, GAMEPLAY_ERROR_MESSAGES[code]) : null;
};

export const readGameplayResult = (
  data: unknown,
  functionName: string,
): GameplayActionResult => {
  if (!data || typeof data !== "object") {
    throw new Error(`Supabase ${functionName} returned no response payload.`);
  }
  const result = data as Partial<GameplayActionResult>;
  return {
    ...result,
    sessionId: String(result.sessionId ?? ""),
    sequenceNumber:
      typeof result.sequenceNumber === "number" ? result.sequenceNumber : null,
    eventId: typeof result.eventId === "string" ? result.eventId : null,
    replayed: result.replayed === true,
  } as GameplayActionResult;
};

export const mapReassignmentError = (error: unknown) => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  if (!REASSIGNMENT_ERROR_CODES.has(message as ReassignmentErrorCode)) {
    return null;
  }

  const code = message as ReassignmentErrorCode;
  return new ReassignmentRpcError(code, REASSIGNMENT_ERROR_MESSAGES[code]);
};

/** Pending commits only saved-source progress, so repeat the original business inputs. */
export async function withRoomProcessingRetry<T extends { data: unknown; error: unknown }>(operation: () => PromiseLike<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await operation();
    const data = response.data as { ok?: boolean; code?: string } | null;
    if (response.error || data?.ok !== false || data.code !== "room_processing_pending") return response;
    if (attempt >= 2) throw new GameplayRpcError("room_processing_pending", GAMEPLAY_ERROR_MESSAGES.room_processing_pending);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
