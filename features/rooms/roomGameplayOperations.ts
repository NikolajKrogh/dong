import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database";
import type {
  GameplayActionResult,
  ReassignParticipantMatchesResponse
} from "../../types/room";
import type { RoomRpcClient } from "./roomRpcClient";
import { mapGameplayError, mapReassignmentError, readGameplayResult, withRoomProcessingRetry } from "./roomRpcErrors";
export function createRoomGameplayOperations(client: SupabaseClient<Database>): Pick<RoomRpcClient, "reassignParticipantMatches" | "changeManualScore" | "changeParticipantDrink"> {
  return {
    async reassignParticipantMatches(input) {
      const { data, error } = await withRoomProcessingRetry(() => client
        .rpc("reassign_participant_matches", {
          session_id: input.sessionId,
          participant_id: input.participantId,
          match_ids: input.matchIds,
          idempotency_key: input.idempotencyKey,
        })
        .overrideTypes<ReassignParticipantMatchesResponse, { merge: false }>());

      if (error) {
        throw mapReassignmentError(error) ?? error;
      }

      if (!data || typeof data !== "object" || Array.isArray(data) || "Error" in data) {
        throw new Error(
          "Supabase reassign_participant_matches returned no response payload.",
        );
      }

      return data;
    },
    async changeManualScore(input) {
      const { data, error } = await withRoomProcessingRetry(() => client
        .rpc("change_manual_score", {
          session_id: input.sessionId,
          match_id: input.matchId,
          team: input.team,
          delta_goals: input.deltaGoals,
          idempotency_key: input.idempotencyKey,
        })
        .overrideTypes<GameplayActionResult, { merge: false }>());

      if (error) {
        throw mapGameplayError(error) ?? error;
      }
      return readGameplayResult(data, "change_manual_score");
    },
    async changeParticipantDrink(input) {
      const { data, error } = await withRoomProcessingRetry(() => client
        .rpc("change_participant_drink", {
          session_id: input.sessionId,
          participant_id: input.participantId,
          delta_half_drinks: input.deltaHalfDrinks,
          idempotency_key: input.idempotencyKey,
        })
        .overrideTypes<GameplayActionResult, { merge: false }>());

      if (error) {
        throw mapGameplayError(error) ?? error;
      }
      return readGameplayResult(data, "change_participant_drink");
    }
  };
}
