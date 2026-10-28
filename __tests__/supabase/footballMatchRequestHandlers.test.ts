import { FootballMatchOperationError } from '../../supabase/functions/_shared/football-matches/footballMatchService';
import { getAllowedFootballMatchOrigins, createLegacyScoreRefreshHandler, createMatchMonitorHandler, createPublicFootballMatchHandler, type AuthenticateRequestHandler } from '../../supabase/functions/_shared/football-matches/footballMatchRequestHandlers';
import type { FootballMatchService } from '../../types/footballMatch';

const origin = 'https://dongthegame.com';
const token = '00000000-0000-4030-8000-000000000601';
const discovery = { matches: [], groups: [], availability: 'available', retryAfterSeconds: null };
const selection = { leagueCodes: ['eng.1'], date: '2026-10-26' };
const soloSelection = { operationId: token, catalogMatchIds: ['1'], creationNonce: 'A'.repeat(43) };
const request = (body: unknown, key = 'public-key', extra: Record<string, string> = {}) => new Request('https://project.test/functions/v1/catalog', {
  method: 'POST', headers: { 'content-type': 'application/json', apikey: key, origin, ...extra }, body: JSON.stringify(body),
});
function catalog(): jest.Mocked<FootballMatchService> {
  return { discoverMatches: jest.fn().mockResolvedValue(discovery), readSavedMatches: jest.fn(), replaceSoloTracking: jest.fn() };
}
const namedSecret: AuthenticateRequestHandler = handler => async req => req.headers.get('apikey') === 'named-monitor-secret'
  ? handler(req) : Response.json({ error: 'unauthorized' }, { status: 401 });

describe('public football match request handlers', () => {
  it('accepts exact configured legacy and publishable app keys, with CORS for success and preflight', async () => {
    const module = catalog();
    const handle = createPublicFootballMatchHandler('discovery', { publicKeys: ['public-key', 'sb_publishable_one'], getFootballMatchService: () => module });
    for (const key of ['public-key', 'sb_publishable_one']) {
      const response = await handle(request(selection, key));
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual(discovery);
    }
    const options = await handle(new Request('https://project.test/', { method: 'OPTIONS', headers: { origin } }));
    expect(options.status).toBe(204);
    expect(module.discoverMatches).toHaveBeenCalledTimes(2);
    expect(module.readSavedMatches).not.toHaveBeenCalled();
  });

  it('rejects missing/wrong/worker keys and JWT-only requests before constructing a module', async () => {
    const build = jest.fn();
    const handle = createPublicFootballMatchHandler('discovery', { publicKeys: ['', 'public-key'], getFootballMatchService: build });
    for (const key of ['', 'sb_secret_worker', 'some-other-public-key']) {
      const response = await handle(request(selection, key, { authorization: 'Bearer user-jwt' }));
      expect(response.status).toBe(401);
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      expect(await response.json()).toEqual({ ok: false, code: 'not_permitted', retryAfterSeconds: null });
    }
    expect(build).not.toHaveBeenCalled();
  });

  it('rejects unapproved origins, methods, malformed dates and caller acquisition options', async () => {
    const module = catalog();
    const handle = createPublicFootballMatchHandler('discovery', { publicKeys: ['public-key'], getFootballMatchService: () => module });
    const blocked = await handle(request(selection, 'public-key', { origin: 'https://other.test' }));
    expect(blocked.status).toBe(403);
    expect(blocked.headers.has('access-control-allow-origin')).toBe(false);
    expect((await handle(new Request('https://project.test/', { method: 'GET', headers: { origin } }))).status).toBe(405);
    for (const body of [{ ...selection, force: true }, { ...selection, sourceUrl: 'https://espn.test' }, { ...selection, date: '2026-02-30' }, { ...selection, leagueCodes: [1] }, []]) {
      expect((await handle(request(body))).status).toBe(400);
    }
    expect(module.discoverMatches).not.toHaveBeenCalled();
  });

  it('caps streaming body bytes without trusting a missing or forged content length', async () => {
    const module = catalog();
    const handle = createPublicFootballMatchHandler('discovery', { publicKeys: ['public-key'], getFootballMatchService: () => module });
    expect((await handle(request({ ...selection, padding: 'x'.repeat(4096) }, 'public-key', { 'content-length': '10' }))).status).toBe(413);
    expect((await handle(request(selection, 'public-key', { 'content-length': '4097' }))).status).toBe(413);
    expect((await handle(new Request('https://project.test/', { method: 'POST', headers: { apikey: 'public-key', origin, 'content-type': 'application/json' }, body: '{' }))).status).toBe(400);
    expect((await handle(request(selection, 'public-key', { 'content-type': 'text/plain' }))).status).toBe(400);
    expect(module.discoverMatches).not.toHaveBeenCalled();
  });

  it('cancels a stalled request stream after five seconds without initializing the backend', async () => {
    jest.useFakeTimers();
    try {
      const build = jest.fn();
      const handle = createPublicFootballMatchHandler('discovery', { publicKeys: ['public-key'], getFootballMatchService: build });
      const reader = { read: jest.fn().mockImplementation(() => new Promise(() => {})), cancel: jest.fn().mockResolvedValue(undefined), releaseLock: jest.fn() };
      const stalled = { method: 'POST', headers: new Headers({ apikey: 'public-key', origin, 'content-type': 'application/json' }), body: { getReader: () => reader } } as unknown as Request;
      const pending = handle(stalled);
      await jest.advanceTimersByTimeAsync(5_001);
      const response = await pending;
      expect(response.status).toBe(408);
      expect(await response.json()).toEqual({ ok: false, code: 'transport_unavailable', retryAfterSeconds: null });
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      expect(reader.cancel).toHaveBeenCalledTimes(1);
      expect(reader.releaseLock).toHaveBeenCalledTimes(1);
      expect(build).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
  });

  it('returns safe errors and honors explicit admission retry time without leaking secrets', async () => {
    const module = catalog();
    const handle = createPublicFootballMatchHandler('solo', { publicKeys: ['public-key'], getFootballMatchService: () => module });
    const body = soloSelection;
    module.replaceSoloTracking.mockRejectedValueOnce(new FootballMatchOperationError('admission_limited', 60));
    const limited = await handle(request(body));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    expect(limited.headers.get('access-control-allow-origin')).toBe(origin);
    module.replaceSoloTracking.mockRejectedValueOnce(new Error('postgres password and internal body must not escape'));
    const failure = await handle(request(body));
    expect(failure.status).toBe(503);
    expect(await failure.json()).toEqual({ ok: false, code: 'transport_unavailable', retryAfterSeconds: null });
    module.replaceSoloTracking.mockResolvedValueOnce({ grantToken: 'grant', selectionVersion: 1, isReplay: false, catalogMatchIds: ['1'], state: 'active', expiresAt: '2026-10-27T00:00:00Z' });
    expect((await handle(request(body))).status).toBe(200);
    expect(module.discoverMatches).not.toHaveBeenCalled();
  });

  it('maps documented conflict and authority errors without reflecting arbitrary error fields', async () => {
    const module = catalog();
    const handle = createPublicFootballMatchHandler('solo', { publicKeys: ['public-key'], getFootballMatchService: () => module });
    for (const [code, status] of [['invalid_tracking_grant', 401], ['tracking_expired', 403], ['tracking_conflict', 409], ['configuration_required', 503]] as const) {
      module.replaceSoloTracking.mockRejectedValueOnce(new FootballMatchOperationError(code));
      expect((await handle(request(soloSelection))).status).toBe(status);
    }
    module.replaceSoloTracking.mockRejectedValueOnce({ code: 'SQL secrets', message: 'private' });
    expect(await (await handle(request(soloSelection))).json()).toEqual({ ok: false, code: 'transport_unavailable', retryAfterSeconds: null });
  });

  it('rejects malformed or mixed solo authority before initializing the backend', async () => {
    const build = jest.fn();
    const handle = createPublicFootballMatchHandler('solo', { publicKeys: ['public-key'], getFootballMatchService: build });
    for (const body of [{}, { ...soloSelection, catalogMatchIds: [] }, { ...soloSelection, catalogMatchIds: ['9223372036854775808'] }, { ...soloSelection, grantToken: 'A'.repeat(43) }, { ...soloSelection, expectedSelectionVersion: 1 }]) {
      expect((await handle(request(body))).status).toBe(400);
    }
    expect((await handle(request({ operationId: token, catalogMatchIds: ['1'], grantToken: 'short', expectedSelectionVersion: 1 }))).status).toBe(401);
    expect(build).not.toHaveBeenCalled();
  });
});

describe('restricted match monitor ingress', () => {
  it('requires named-secret authentication before dispatch work and gives auth failures CORS', async () => {
    const run = jest.fn();
    const handle = createMatchMonitorHandler({ authenticate: namedSecret, run });
    for (const key of ['public-key', 'sb_secret_other', '']) {
      const response = await handle(request({ dispatchToken: token, workerGeneration: 1 }, key, { authorization: 'Bearer user-jwt' }));
      expect(response.status).toBe(401);
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('accepts only a dispatch token and safe generation, with one server-owned 35-second deadline', async () => {
    const run = jest.fn().mockResolvedValue({ acceptedGroups: 1, deferredGroups: 2, roomVersionsApplied: 3 });
    const handle = createMatchMonitorHandler({ authenticate: namedSecret, run, now: () => 1000 });
    const response = await handle(request({ dispatchToken: token, workerGeneration: 7 }, 'named-monitor-secret'));
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith({ dispatchToken: token, generation: 7, deadline: 36_000 });
    for (const body of [{ dispatchToken: token, workerGeneration: 7, roomIds: [] }, { dispatchToken: token, workerGeneration: 7, deadline: 1 }, { dispatchToken: 'arbitrary', workerGeneration: 7 }, { dispatchToken: token, workerGeneration: 0 }, { dispatchToken: token, workerGeneration: Number.MAX_SAFE_INTEGER + 1 }]) {
      expect((await handle(request(body, 'named-monitor-secret'))).status).toBe(400);
    }
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('denies an expired database dispatch without exposing internal state', async () => {
    const handle = createMatchMonitorHandler({ authenticate: namedSecret, run: async () => { throw new FootballMatchOperationError('not_permitted'); } });
    const response = await handle(request({ dispatchToken: token, workerGeneration: 1 }, 'named-monitor-secret'));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, code: 'not_permitted', retryAfterSeconds: null });
  });
});

describe('registered legacy refresh compatibility', () => {
  it('authorizes a saved room then returns not_due without a provider-success timestamp', async () => {
    const authorizeRoom = jest.fn().mockResolvedValue({ ok: true });
    const handle = createLegacyScoreRefreshHandler({ authenticate: namedSecret, authorizeRoom, allowedOrigins: getAllowedFootballMatchOrigins() });
    const response = await handle(request({ sessionId: token }, 'named-monitor-secret', { 'idempotency-key': token }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sessionId: token, requestId: token, status: 'not_due', refreshedAt: null, results: [], warnings: [] });
    expect(authorizeRoom).toHaveBeenCalledWith(expect.any(Request), token);
    authorizeRoom.mockResolvedValueOnce({ ok: false, code: 'not_room_participant' });
    expect((await handle(request({ sessionId: token }, 'named-monitor-secret', { 'idempotency-key': token }))).status).toBe(403);
    expect((await handle(request({ sessionId: token }, 'named-monitor-secret'))).status).toBe(422);
    expect(authorizeRoom).toHaveBeenCalledTimes(2);
    authorizeRoom.mockResolvedValueOnce({ ok: false, code: 'transport_unavailable' });
    expect((await handle(request({ sessionId: token }, 'named-monitor-secret', { 'idempotency-key': token }))).status).toBe(503);
  });
});
