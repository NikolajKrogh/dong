import { getAllowedFootballMatchOrigins, createPublicFootballMatchHandler } from '../_shared/football-matches/footballMatchRequestHandlers.ts';
import { getFootballMatchPublicKeys, getFootballMatchRuntime } from '../_shared/football-matches/footballMatchRuntime.ts';

export default { fetch: createPublicFootballMatchHandler('discovery', {
  publicKeys: getFootballMatchPublicKeys(),
  getFootballMatchService: () => getFootballMatchRuntime().footballMatchService,
  allowedOrigins: getAllowedFootballMatchOrigins(Deno.env.get('MATCH_CATALOG_ALLOWED_ORIGINS')),
}) };
