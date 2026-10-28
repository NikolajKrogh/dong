import { AVAILABLE_LEAGUES } from '../../../../constants/leagues.ts';
import { z } from 'npm:zod@4.4.3';
import { isUnsignedDecimal } from '../../../../shared/validation/identifiers.ts';
import { isBase64UrlText } from '../../../../shared/encoding/base64url.ts';

export type EspnResource = { leagueCode: string } & (
  | { kind: 'scoreboard'; date: string }
  | { kind: 'summary'; sourceEventId: string }
);

type ProviderFailureCode =
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'provider_throttled'
  | 'provider_access_rejected'
  | 'provider_response_too_large'
  | 'invalid_provider_response'
  | 'match_not_found';

export type EspnResult =
  | { ok: true; data: unknown; status: number; bytes: number }
  | {
      ok: false;
      code: ProviderFailureCode;
      status: number | null;
      scope: 'group' | 'provider';
      retryAfterSeconds: number | null;
    };

export interface EspnHttpClient {
  read(resource: EspnResource): Promise<EspnResult>;
}

type EspnFailure = Extract<EspnResult, { ok: false }>;

interface RequestState {
  controller: AbortController;
  hasTimedOut: boolean;
  bodyReader?: ReadableStreamDefaultReader<Uint8Array>;
}

const SUPPORTED_LEAGUE_CODES = new Set(AVAILABLE_LEAGUES.map(league => league.code));
const supportedLeagueCodeSchema = z.string().refine(code => SUPPORTED_LEAGUE_CODES.has(code));
const sourceEventIdSchema = z.string().min(1).max(128).refine(isBase64UrlText);
const providerResourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scoreboard'), leagueCode: supportedLeagueCodeSchema, date: z.iso.date() }),
  z.object({ kind: z.literal('summary'), leagueCode: supportedLeagueCodeSchema, sourceEventId: sourceEventIdSchema }),
]);
const ESPN_SOCCER_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'DONG-command-api/0.1 (+https://github.com/NikolajKrogh/dong)',
};

function buildResourceUrl(resource: EspnResource): string {
  const parsed = providerResourceSchema.safeParse(resource);
  if (!parsed.success) throw new Error('invalid_provider_resource');
  const selection = parsed.data;
  if (selection.kind === 'scoreboard') {
    return `${ESPN_SOCCER_BASE_URL}/${selection.leagueCode}/scoreboard?dates=${selection.date.replaceAll('-', '')}`;
  }
  return `${ESPN_SOCCER_BASE_URL}/${selection.leagueCode}/summary?event=${encodeURIComponent(selection.sourceEventId)}`;
}

function parseRetryAfterSeconds(header: string | null): number | null {
  if (!header) return null;
  if (isUnsignedDecimal(header)) {
    const seconds = Number(header);
    return Number.isSafeInteger(seconds) ? seconds : null;
  }
  const retryAtMs = Date.parse(header);
  if (!Number.isFinite(retryAtMs)) return null;
  return Math.max(0, Math.ceil((retryAtMs - Date.now()) / 1000));
}

function createProviderFailure(
  code: ProviderFailureCode,
  status: number | null = null,
  retryAfterSeconds: number | null = null,
): EspnFailure {
  return {
    ok: false,
    code,
    status,
    scope: code === 'provider_throttled' ? 'provider' : 'group',
    retryAfterSeconds,
  };
}

function classifyHttpFailure(status: number): ProviderFailureCode {
  switch (status) {
    case 429: return 'provider_throttled';
    case 401:
    case 403: return 'provider_access_rejected';
    case 404: return 'match_not_found';
    default: return 'provider_unavailable';
  }
}

function cancelQuietly(
  source: ReadableStream<Uint8Array> | ReadableStreamDefaultReader<Uint8Array> | null | undefined,
): void {
  void source?.cancel().catch(() => {});
}

function decodeJsonBody(chunks: Uint8Array[], byteCount: number, status: number): EspnResult {
  const body = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(body);
    return { ok: true, data: JSON.parse(json), status, bytes: byteCount };
  } catch {
    return createProviderFailure('invalid_provider_response', status);
  }
}

async function readResponseBody(response: Response, state: RequestState): Promise<EspnResult> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null && Number(declaredLength) > MAX_RESPONSE_BYTES) {
    cancelQuietly(response.body);
    return createProviderFailure('provider_response_too_large', response.status);
  }
  if (!response.body) return createProviderFailure('invalid_provider_response', response.status);
  const reader = response.body.getReader();
  state.bodyReader = reader;
  const chunks: Uint8Array[] = [];
  let byteCount = 0;
  while (!state.hasTimedOut) {
    const chunk = await reader.read();
    if (chunk.done) break;
    byteCount += chunk.value.byteLength;
    if (byteCount > MAX_RESPONSE_BYTES) {
      cancelQuietly(reader);
      return createProviderFailure('provider_response_too_large', response.status);
    }
    chunks.push(chunk.value);
  }
  if (state.hasTimedOut) return createProviderFailure('provider_timeout');
  return decodeJsonBody(chunks, byteCount, response.status);
}

async function fetchResource(fetch: typeof globalThis.fetch, url: string, state: RequestState): Promise<EspnResult> {
  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: state.controller.signal,
      redirect: 'error',
    });
    if (state.hasTimedOut) {
      cancelQuietly(response.body);
      return createProviderFailure('provider_timeout');
    }
    if (!response.ok) {
      cancelQuietly(response.body);
      return createProviderFailure(
        classifyHttpFailure(response.status),
        response.status,
        parseRetryAfterSeconds(response.headers.get('retry-after')),
      );
    }
    return await readResponseBody(response, state);
  } catch {
    return createProviderFailure(state.hasTimedOut ? 'provider_timeout' : 'provider_unavailable');
  }
}

export function createEspnHttpClient(dependencies: { fetch: typeof fetch }): EspnHttpClient {
  return {
    async read(resource: EspnResource): Promise<EspnResult> {
      const url = buildResourceUrl(resource);
      const state: RequestState = { controller: new AbortController(), hasTimedOut: false };
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      // Race the complete read: fetch or a body reader may ignore abort.
      const timeout = new Promise<EspnResult>(resolve => {
        timeoutId = setTimeout(() => {
          state.hasTimedOut = true;
          state.controller.abort();
          cancelQuietly(state.bodyReader);
          resolve(createProviderFailure('provider_timeout'));
        }, REQUEST_TIMEOUT_MS);
      });
      try {
        return await Promise.race([fetchResource(dependencies.fetch, url, state), timeout]);
      } finally {
        clearTimeout(timeoutId);
        state.controller.abort();
      }
    },
  };
}
