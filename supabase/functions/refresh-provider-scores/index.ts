// eslint-disable-next-line import/no-unresolved -- Deno resolves this pinned npm module.
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import type { Database } from '../../../types/database.types.ts';
import { getAllowedFootballMatchOrigins, createLegacyScoreRefreshHandler, withFootballMatchCors } from '../_shared/football-matches/footballMatchRequestHandlers.ts';

const origins = getAllowedFootballMatchOrigins(Deno.env.get('PROVIDER_SCORE_ALLOWED_ORIGINS'));
const authenticated = withSupabase<Database>(
  { auth: 'user', cors: false, errors: { detailed: false } },
  async (request, context) => createLegacyScoreRefreshHandler({
    authenticate: handler => handler,
    allowedOrigins: origins,
    authorizeRoom: async (_request, sessionId) => {
      // User-scoped RPC enforces actual registered room membership, including re-entry.
      const { data, error } = await context.supabase.rpc('get_room_snapshot', { session_id: sessionId });
      if (error) {
        const code = error.message.includes('room_not_found') ? 'room_not_found'
          : /forbidden|not_room_participant|not_authenticated/.test(error.message) ? 'not_permitted' : 'transport_unavailable';
        return { ok: false, code };
      }
      return { ok: data !== null };
    },
  })(request),
);

// Compatibility only: an authorized read never reserves acquisition, applies arbitrary
// scores, or reports a new provider-success timestamp.
export default { fetch: withFootballMatchCors(authenticated, origins) };
