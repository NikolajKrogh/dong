// eslint-disable-next-line import/no-unresolved -- pinned Deno dependency.
import { withSupabase } from "npm:@supabase/server@1.9.2";
// eslint-disable-next-line import/no-unresolved -- pinned Deno dependency.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import type { Database, Json } from "../../../types/database.types.ts";
import { highsOptimizer } from "../_shared/assignments/highsOptimizer.ts";
import { getAllowedFootballMatchOrigins, withFootballMatchCors } from "../_shared/football-matches/footballMatchRequestHandlers.ts";
import { createAssignmentPreviewHandler } from "./handler.ts";

const origins = getAllowedFootballMatchOrigins(Deno.env.get("MATCH_CATALOG_ALLOWED_ORIGINS"));
const authenticated = withSupabase<Database>(
  { auth: "user", cors: false, errors: { detailed: false } },
  (request, context) => createAssignmentPreviewHandler({
    optimizer: highsOptimizer,
    async prepare(input) {
      const { data, error } = await context.supabase.rpc("prepare_room_assignment_preview", {
        session_id: input.sessionId, purpose: input.purpose, configuration: input.configuration as Json, expected_token: input.expectedToken,
      });
      if (error) throw error;
      return data as Record<string, unknown>;
    },
    async publish(proposalId, result) {
      const admin = createClient<Database>(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await admin.rpc("store_room_assignment_proposal", {
        proposal_id: proposalId, assignments: result.assignments as Json, quality: result.quality as unknown as Json,
      });
      if (error) throw error;
      return data;
    },
  })(request),
);
export default { fetch: withFootballMatchCors(authenticated, origins) };
