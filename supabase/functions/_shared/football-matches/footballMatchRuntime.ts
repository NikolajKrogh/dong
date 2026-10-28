import { FootballMatchOperationError, createFootballMatchService, runDueMatchWork } from './footballMatchService.ts';
import { createEspnHttpClient } from './espnHttpClient.ts';
import type { MatchMonitorDispatch } from './footballMatchRequestHandlers.ts';
import { createPostgresFootballMatchRepository } from './postgresFootballMatchRepository.ts';

type FootballMatchRuntime = {
  footballMatchService: ReturnType<typeof createFootballMatchService>;
  run: (dispatch: MatchMonitorDispatch) => ReturnType<typeof runDueMatchWork>;
};

function parseNamedKeys(value: string | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const keys: Record<string, string> = {};
    for (const [name, key] of Object.entries(parsed)) {
      if (typeof key === 'string' && key.length > 0) keys[name] = key;
    }
    return keys;
  } catch { return {}; }
}

export function getFootballMatchPublicKeys(): string[] {
  return [Deno.env.get('SUPABASE_ANON_KEY') ?? '', ...Object.values(parseNamedKeys(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'))).filter(key => key.startsWith('sb_publishable_'))].filter(Boolean);
}

function createFootballMatchRuntime(): FootballMatchRuntime {
  const connection = Deno.env.get('MATCH_CATALOG_DATABASE_URL');
  if (!connection) throw new FootballMatchOperationError('configuration_required');
  const database = createPostgresFootballMatchRepository(connection);
  const fixturesOnly = Deno.env.get('MATCH_CATALOG_FIXTURES_ONLY') === 'true';
  const provider = createEspnHttpClient({ fetch: (url, options) => {
    // Local checks inject a controlled provider into footballMatchService.ts. They never opt out by supplying a URL.
    if (fixturesOnly) return Promise.reject(new Error('fixture_provider_required'));
    return fetch(url, options);
  } });
  const footballMatchService = createFootballMatchService({ database, provider, crypto: globalThis.crypto, keyring: {
    currentKeyId: Deno.env.get('MATCH_CATALOG_SIGNING_KEY_ID') ?? '',
    keys: parseNamedKeys(Deno.env.get('MATCH_CATALOG_SIGNING_KEYS')),
  } });
  return { footballMatchService, run: (dispatch: MatchMonitorDispatch) => runDueMatchWork({ database, provider, ...dispatch }) };
}

let cachedRuntime: FootballMatchRuntime | undefined;
export function getFootballMatchRuntime(): FootballMatchRuntime {
  return cachedRuntime ??= createFootballMatchRuntime();
}
