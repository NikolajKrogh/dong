import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabase";
import type { Database } from "../../types/database";
import type { Json } from "../../types/database.types";
import type { RoomSnapshot } from "../../types/room";
import type { AssignmentTransport, PreparedAssignmentPreview } from "./roomAssignments";

/** The lifecycle module owns retries; this adapter makes exactly one remote call. */
export function createRoomAssignmentTransport(supabase?: SupabaseClient<Database>): AssignmentTransport {
  return {
    async prepare({ sessionId, purpose, context }) {
      if (context.configuration.assignmentMode !== "automatic") {
        const targetsByParticipantId = context.targetsByParticipantId ?? {};
        return {
          proposalId: null, expiresAt: null, targetsByParticipantId,
          assignments: Object.fromEntries(Object.keys(targetsByParticipantId).map(id => [id,
            context.configuration.assignments.filter(assignment => assignment.participantId === id).map(assignment => assignment.matchId)])),
          sharingPolicy: Object.values(targetsByParticipantId).every(target => target === 0) ? "common_only" : "preference",
          requiresSharingConsent: false, quality: null,
        };
      }
      const client = supabase ?? getSupabaseClient();
      const { data, error } = await client.functions.invoke("room-assignment-preview", {
        body: { sessionId, purpose, expectedToken: context.expectedToken, configuration: context.configuration },
      });
      if (error) {
        const response = (error as { context?: Response }).context;
        const body = response && typeof response.json === "function" ? await response.json().catch(() => null) : null;
        throw new Error(body?.code ?? "assignment_preview_unavailable");
      }
      if (!data || typeof data !== "object") throw new Error("assignment_preview_unavailable");
      return data as PreparedAssignmentPreview;
    },
    async commit({ sessionId, purpose, context, proposalId, idempotencyKey, acceptRelaxedSharing }) {
      const client = supabase ?? getSupabaseClient();
      const commitArguments = { session_id: sessionId, proposal_id: proposalId, expected_token: context.expectedToken,
        idempotency_key: idempotencyKey, accept_relaxed_sharing: acceptRelaxedSharing };
      const response = purpose === "start"
        ? await client.rpc("start_game_session_v2", commitArguments)
        : await client.rpc("save_running_game_configuration_v2", {
          ...commitArguments, configuration: context.configuration as unknown as Json,
        });
      if (response.error) throw response.error;
      const data = response.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("assignment_commit_unavailable");
      return data as unknown as RoomSnapshot;
    },
  };
}
