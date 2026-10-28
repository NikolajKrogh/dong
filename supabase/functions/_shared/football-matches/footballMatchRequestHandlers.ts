import { FootballMatchOperationError } from './footballMatchService.ts';
import type { FootballMatchService, FootballMatchErrorCode, MatchDiscoverySelection, SoloTrackingSelection } from '../../../../types/footballMatch.ts';

type PublicFootballMatchOperation = 'discovery' | 'solo';
export interface MatchMonitorDispatch { dispatchToken: string; generation: number; deadline: number }
type HttpRequestHandler = (request: Request) => Promise<Response>;
export type AuthenticateRequestHandler = (handler: HttpRequestHandler) => HttpRequestHandler;
const uuidV4Pattern = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const DEFAULT_ALLOWED_ORIGINS = ['https://dongthegame.com', 'http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:3000', 'http://127.0.0.1:3000'];
class RequestBodyError extends Error {
  constructor(readonly status: number, readonly code = 'invalid_selection') { super(code); }
}

export function getAllowedFootballMatchOrigins(additional = ''): ReadonlySet<string> {
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...additional.split(',').map(origin => origin.trim()).filter(Boolean)]);
}

function createCorsHeaders(origin: string | null, allowed: ReadonlySet<string>): Headers {
  const result = new Headers({
    'content-type': 'application/json', 'cache-control': 'no-store',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, apikey, content-type, idempotency-key, x-client-info',
    vary: 'Origin',
  });
  if (origin && allowed.has(origin)) result.set('access-control-allow-origin', origin);
  return result;
}

function createErrorResponse(code: string, status: number, retryAfterSeconds: number | null = null): Response {
  const response = Response.json({ ok: false, code, retryAfterSeconds }, { status });
  if (retryAfterSeconds !== null) response.headers.set('retry-after', String(retryAfterSeconds));
  return response;
}

function mapErrorToResponse(error: unknown): Response {
  if (error instanceof RequestBodyError) return createErrorResponse(error.code, error.status);
  if (!(error instanceof FootballMatchOperationError)) return createErrorResponse('transport_unavailable', 503);
  const code = error.code;
  const status = getFootballMatchErrorStatus(code);
  const retry = error.retryAfterSeconds;
  return createErrorResponse(code, status, retry !== null && Number.isSafeInteger(retry) && retry >= 0 ? retry : null);
}

function getFootballMatchErrorStatus(code: FootballMatchErrorCode): number {
  switch (code) {
    case 'invalid_selection':
    case 'unsupported_league':
    case 'date_out_of_range':
    case 'projection_too_large':
      return 400;
    case 'invalid_tracking_grant':
      return 401;
    case 'tracking_expired':
    case 'not_permitted':
      return 403;
    case 'operation_conflict':
    case 'tracking_conflict':
    case 'identity_unresolved':
      return 409;
    case 'admission_limited':
      return 429;
    default:
      return 503;
  }
}

/** Limit streaming bytes before allocating/parsing JSON; never trust Content-Length alone. */
async function readJsonRequestBody(request: Request, limit: number): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) throw new FootballMatchOperationError('invalid_selection');
  const declared = request.headers.get('content-length');
  if (declared && !/^\d+$/.test(declared)) throw new FootballMatchOperationError('invalid_selection');
  if (declared && Number(declared) > limit) throw new RequestBodyError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new FootballMatchOperationError('invalid_selection');
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RequestBodyError(408, 'transport_unavailable'));
      void reader.cancel().catch(() => {});
    }, 5_000);
  });
  try {
    await Promise.race([(async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { void reader.cancel().catch(() => {}); throw new RequestBodyError(413); }
        chunks.push(value);
      }
    })(), timeout]);
  } finally { clearTimeout(timer!); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid');
    return body as Record<string, unknown>;
  } catch { throw new FootballMatchOperationError('invalid_selection'); }
}

/** Apply CORS after authentication as well, so auth and unexpected errors reach web callers. */
export function withFootballMatchCors(handler: HttpRequestHandler, allowed = getAllowedFootballMatchOrigins()): HttpRequestHandler {
  return async request => {
    const origin = request.headers.get('origin');
    let response: Response;
    if (origin && !allowed.has(origin)) response = createErrorResponse('not_permitted', 403);
    else if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
    else if (request.method !== 'POST') response = createErrorResponse('invalid_selection', 405);
    else {
      try { response = await handler(request); } catch (error) { response = mapErrorToResponse(error); }
    }
    const combined = new Headers(response.headers);
    for (const [key, value] of createCorsHeaders(origin, allowed)) combined.set(key, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: combined });
  };
}

export function createPublicFootballMatchHandler(operation: PublicFootballMatchOperation, config: {
  publicKeys: readonly string[];
  getFootballMatchService: () => FootballMatchService;
  allowedOrigins?: ReadonlySet<string>;
}): HttpRequestHandler {
  return withFootballMatchCors(async request => {
    const key = request.headers.get('apikey');
    if (!key || !config.publicKeys.some(candidate => candidate.length > 0 && candidate === key)) return createErrorResponse('not_permitted', 401);
    const body = await readJsonRequestBody(request, 4096);
    const keys = operation === 'discovery' ? ['leagueCodes', 'date']
      : ['operationId', 'catalogMatchIds', 'creationNonce', 'grantToken', 'expectedSelectionVersion'];
    if (Object.keys(body).some(key => !keys.includes(key))) throw new FootballMatchOperationError('invalid_selection');
    if (operation === 'discovery') {
      if (!Array.isArray(body.leagueCodes) || body.leagueCodes.length > 128 || !body.leagueCodes.every(code => typeof code === 'string' && code.length <= 80)
        || typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new FootballMatchOperationError('invalid_selection');
      const day = new Date(`${body.date}T00:00:00Z`);
      if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== body.date) throw new FootballMatchOperationError('invalid_selection');
      return Response.json(await config.getFootballMatchService().discoverMatches(body as unknown as MatchDiscoverySelection));
    }
    const ids = body.catalogMatchIds;
    const capability = /^[A-Za-z0-9_-]{43}$/;
    if (typeof body.operationId !== 'string' || !uuidV4Pattern.test(body.operationId) || !Array.isArray(ids) || ids.length > 20
      || !ids.every(id => typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id) && (id.length < 19 || id <= '9223372036854775807'))) throw new FootballMatchOperationError('invalid_selection');
    if ('creationNonce' in body) {
      if (typeof body.creationNonce !== 'string' || !capability.test(body.creationNonce) || ids.length === 0
        || 'grantToken' in body || 'expectedSelectionVersion' in body) throw new FootballMatchOperationError('invalid_selection');
    } else if (typeof body.grantToken !== 'string' || !capability.test(body.grantToken)
      || !Number.isSafeInteger(body.expectedSelectionVersion) || Number(body.expectedSelectionVersion) < 1) throw new FootballMatchOperationError('invalid_tracking_grant');
    return Response.json(await config.getFootballMatchService().replaceSoloTracking(body as unknown as SoloTrackingSelection));
  }, config.allowedOrigins);
}

export function createMatchMonitorHandler(config: {
  authenticate: AuthenticateRequestHandler;
  run: (dispatch: MatchMonitorDispatch) => Promise<unknown>;
  now?: () => number;
  allowedOrigins?: ReadonlySet<string>;
}): HttpRequestHandler {
  const now = config.now ?? Date.now;
  return withFootballMatchCors(config.authenticate(async request => {
    const startedAt = now();
    const body = await readJsonRequestBody(request, 512);
    if (Object.keys(body).some(key => key !== 'dispatchToken' && key !== 'workerGeneration')
      || typeof body.dispatchToken !== 'string' || !uuidV4Pattern.test(body.dispatchToken)
      || !Number.isSafeInteger(body.workerGeneration) || Number(body.workerGeneration) < 1) throw new FootballMatchOperationError('invalid_selection');
    return Response.json(await config.run({ dispatchToken: body.dispatchToken, generation: Number(body.workerGeneration), deadline: startedAt + 35_000 }));
  }), config.allowedOrigins);
}

/** Registered-member-only old route: authorize its saved snapshot, but never acquire source data. */
export function createLegacyScoreRefreshHandler(config: {
  authenticate: AuthenticateRequestHandler;
  authorizeRoom: (request: Request, sessionId: string) => Promise<{ ok: boolean; code?: string }>;
  allowedOrigins?: ReadonlySet<string>;
}): HttpRequestHandler {
  return withFootballMatchCors(config.authenticate(async request => {
    const requestId = request.headers.get('idempotency-key');
    if (!requestId || !uuidV4Pattern.test(requestId)) return createErrorResponse('invalid_selection', 422);
    const body = await readJsonRequestBody(request, 4096);
    if (Object.keys(body).some(key => key !== 'sessionId') || typeof body.sessionId !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(body.sessionId)) return createErrorResponse('invalid_selection', 422);
    const permission = await config.authorizeRoom(request, body.sessionId);
    if (!permission.ok) {
      if (permission.code === 'transport_unavailable') return createErrorResponse('transport_unavailable', 503);
      return createErrorResponse(permission.code === 'room_not_found' ? 'room_not_found' : 'not_permitted', permission.code === 'room_not_found' ? 404 : 403);
    }
    return Response.json({ sessionId: body.sessionId, requestId, status: 'not_due', refreshedAt: null, results: [], warnings: [] });
  }), config.allowedOrigins);
}
