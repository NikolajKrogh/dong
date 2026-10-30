// eslint-disable-next-line import/no-unresolved -- Deno resolves this pinned npm module.
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import { getAllowedFootballMatchOrigins, createMatchMonitorHandler } from '../_shared/football-matches/footballMatchRequestHandlers.ts';
import { getFootballMatchRuntime } from '../_shared/football-matches/footballMatchRuntime.ts';

export default { fetch: createMatchMonitorHandler({
  authenticate: handler => withSupabase({ auth: 'secret:match_monitor', cors: false, errors: { detailed: false } }, request => handler(request)),
  run: dispatch => getFootballMatchRuntime().run(dispatch),
  allowedOrigins: getAllowedFootballMatchOrigins(Deno.env.get('MATCH_CATALOG_ALLOWED_ORIGINS')),
}) };
