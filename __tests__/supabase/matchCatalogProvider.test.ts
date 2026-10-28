import { createEspnHttpClient } from '../../supabase/functions/_shared/football-matches/espnHttpClient';
import { normalizeEspnScoreboard } from '../../supabase/functions/_shared/football-matches/espnMatchNormalizer';
import { acquireProviderGroups, type AcquisitionDatabase } from '../../supabase/functions/_shared/football-matches/footballMatchService';
import { emptyBoard, finalBoard, futureBoard, liveBoard, liveEvent, partialBoard } from '../fixtures/matchCatalog/scoreboards';

describe('compact ESPN projection', () => {
  it('keeps event and competition identities distinct and preserves known zero versus missing metrics', () => {
    const result = normalizeEspnScoreboard(liveBoard, 'eng.1');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      identity: { sourceEventId: 'event-100', sourceCompetitionId: 'competition-200' },
      lifecycle: 'live', homeScore: 2, awayScore: 1,
      homeTeamStatistics: { fouls: 0, possession: 54.2, yellowCards: 1 },
      awayTeamStatistics: { fouls: null, possession: null, yellowCards: null },
      goals: [{ sourceAthleteId: 'athlete-1', athleteName: 'A Player', kind: 'penalty' }],
    });
  });

  it('accepts valid empty boards, future fixtures and explicit completion without inferring terminal status', () => {
    expect(normalizeEspnScoreboard(emptyBoard, 'eng.1')).toEqual({ matches: [], isPartial: false });
    expect(normalizeEspnScoreboard(futureBoard, 'eng.1').matches[0].lifecycle).toBe('scheduled');
    expect(normalizeEspnScoreboard(finalBoard, 'eng.1').matches[0].lifecycle).toBe('finished');
    expect(normalizeEspnScoreboard(partialBoard, 'eng.1').matches[0]).toMatchObject({ lifecycle: 'unknown', homeScore: null, awayScore: null, goals: null });
  });

  it('rejects malformed resources and skips ambiguous identities without selecting the first competition', () => {
    expect(() => normalizeEspnScoreboard({}, 'eng.1')).toThrow('invalid_provider_response');
    expect(normalizeEspnScoreboard({ events: [{ ...liveEvent, competitions: [...liveEvent.competitions, ...liveEvent.competitions] }] }, 'eng.1')).toEqual({ matches: [], isPartial: true });
    expect(normalizeEspnScoreboard({ events: [{ ...liveEvent, id: '' }] }, 'eng.1').matches).toEqual([]);
    const invalidScore = structuredClone(liveBoard);
    invalidScore.events[0].competitions[0].competitors[0].score = '2goals';
    expect(normalizeEspnScoreboard(invalidScore, 'eng.1').matches[0].homeScore).toBeNull();
  });

  it('does not invent a kickoff from a locale date or round malformed count statistics', () => {
    const malformed = structuredClone(liveBoard);
    malformed.events[0].date = '12';
    malformed.events[0].competitions[0].competitors[0].statistics![0].value = 1.5;
    expect(normalizeEspnScoreboard(malformed,'eng.1').matches[0]).toMatchObject({ kickoffAt: null, kickoffValidity: 'unknown', homeTeamStatistics: { shotAttempts: null } });
  });
});

describe('shared acquisition composition', () => {
  function database(): jest.Mocked<AcquisitionDatabase> {
    return {
      acquireSlot: jest.fn().mockResolvedValue({ ok: true, dispatchToken: 'worker-token', workerGeneration: 1 }),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
      claimBatch: jest.fn().mockImplementation(async groupIds => groupIds.slice(0,4).map((groupId: string) => ({ ok: true, attemptId: groupId, leaseToken: `lease-${groupId}`, workerGeneration: 1, resource: { kind: 'scoreboard', leagueCode: 'eng.1', date: '2026-10-25' } }))),
      accept: jest.fn().mockResolvedValue({ ok: true }), fail: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('does no HTTP for denied ownership and does not allocate an empty or late wave', async () => {
    const db = database();
    const provider = { read: jest.fn().mockResolvedValue({ ok: true, data: emptyBoard, status: 200, bytes: 0 }) };
    const work = { database: db, provider, purpose: 'discovery' as const, generation: 1, deadline: 35_000, now: () => 0 };
    await acquireProviderGroups({ ...work, groupIds: [] });
    await acquireProviderGroups({ ...work, groupIds: ['1'], deadline: 1 });
    expect(db.acquireSlot).not.toHaveBeenCalled();
    db.claimBatch.mockResolvedValue([]);
    expect(await acquireProviderGroups({ ...work, groupIds: ['1', '1'] })).toMatchObject({ attemptedGroups: 0, deferredGroups: 1 });
    expect(provider.read).not.toHaveBeenCalled();
    expect(db.releaseSlot).toHaveBeenCalledTimes(1);
  });

  it('commits healthy peers independently and never retries an ambiguous failed commit', async () => {
    const db = database();
    db.accept.mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce({ ok: true });
    const provider = { read: jest.fn().mockResolvedValue({ ok: true, data: emptyBoard, status: 200, bytes: 0 }) };
    expect(await acquireProviderGroups({ database: db, provider, groupIds: ['1', '2'], purpose: 'live', generation: 1, deadline: 35_000, now: () => 0 })).toEqual({ attemptedGroups: 2, acceptedGroups: 1, failedGroups: 1, deferredGroups: 0 });
    expect(provider.read).toHaveBeenCalledTimes(2);
    expect(db.claimBatch).toHaveBeenCalledTimes(1);
    expect(db.fail).not.toHaveBeenCalled();
  });

  it('counts and records an invalid source resource once while leaving unrelated peers usable', async () => {
    const db = database();
    const provider = { read: jest.fn().mockResolvedValueOnce({ ok: true, data: {}, status: 200, bytes: 2 }).mockResolvedValueOnce({ ok: true, data: emptyBoard, status: 200, bytes: 0 }) };
    expect(await acquireProviderGroups({ database: db, provider, groupIds: ['1', '2'], purpose: 'discovery', generation: 1, deadline: 35_000, now: () => 0 })).toMatchObject({ attemptedGroups: 2, acceptedGroups: 1, failedGroups: 1 });
    expect(db.fail).toHaveBeenCalledWith(expect.objectContaining({ attemptId: '1' }), expect.objectContaining({ code: 'invalid_provider_response' }));
    expect(db.accept).toHaveBeenCalledTimes(1);
  });
});

const response = (body: string, status = 200, headers: Record<string, string> = {}, stall = false) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  body: {
    cancel: jest.fn().mockResolvedValue(undefined),
    getReader: () => {
      let sent = false;
      return { read: async () => { if (stall) return new Promise(() => {}); if (sent) return { done: true }; sent = true; return { done: false, value: new TextEncoder().encode(body) }; }, cancel: jest.fn().mockResolvedValue(undefined), releaseLock: jest.fn() };
    },
  },
}) as unknown as Response;

describe('owned ESPN HTTP adapter', () => {
  it('constructs one safe request with explicit headers and no inline retry', async () => {
    const fetcher = jest.fn().mockResolvedValue(response(JSON.stringify(emptyBoard)));
    const result = await createEspnHttpClient({ fetch: fetcher }).read({ kind: 'scoreboard', leagueCode: 'eng.1', date: '2026-10-25' });
    expect(result).toMatchObject({ ok: true, data: emptyBoard });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20261025', expect.objectContaining({ headers: { Accept: 'application/json', 'User-Agent': 'DONG-command-api/0.1 (+https://github.com/NikolajKrogh/dong)' }, redirect: 'error' }));
    await expect(createEspnHttpClient({ fetch: fetcher }).read({ kind: 'scoreboard', leagueCode: '../../x', date: '2026-10-25' })).rejects.toThrow('invalid_provider_resource');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects league codes outside the shared release catalog before fetching', async () => {
    const fetcher = jest.fn().mockResolvedValue(response(JSON.stringify(emptyBoard)));
    await expect(createEspnHttpClient({ fetch: fetcher }).read({ kind: 'scoreboard', leagueCode: 'future.1', date: '2026-10-25' }))
      .rejects.toThrow('invalid_provider_resource');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('isolates access rejection, shares throttle scope, honors Retry-After and never returns provider bodies', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(response('secret upstream body', 403)).mockResolvedValueOnce(response('secret upstream body', 429, { 'retry-after': '1200' }));
    const client = createEspnHttpClient({ fetch: fetcher });
    expect(await client.read({ kind: 'scoreboard', leagueCode: 'eng.1', date: '2026-10-25' })).toEqual({ ok: false, code: 'provider_access_rejected', status: 403, scope: 'group', retryAfterSeconds: null });
    expect(await client.read({ kind: 'scoreboard', leagueCode: 'esp.1', date: '2026-10-25' })).toEqual({ ok: false, code: 'provider_throttled', status: 429, scope: 'provider', retryAfterSeconds: 1200 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('caps streamed bytes and classifies invalid JSON', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(response('x'.repeat(2 * 1024 * 1024 + 1))).mockResolvedValueOnce(response('not json'));
    const client = createEspnHttpClient({ fetch: fetcher });
    expect(await client.read({ kind: 'scoreboard', leagueCode: 'eng.1', date: '2026-10-25' })).toMatchObject({ ok: false, code: 'provider_response_too_large' });
    expect(await client.read({ kind: 'scoreboard', leagueCode: 'eng.1', date: '2026-10-25' })).toMatchObject({ ok: false, code: 'invalid_provider_response' });
  });

  it('bounds the whole request including a stalled body even if fetch ignores abort', async () => {
    jest.useFakeTimers();
    try {
      const stalled = response('', 200, {}, true);
      const fetcher = jest.fn().mockResolvedValue(stalled);
      const pending = createEspnHttpClient({ fetch: fetcher }).read({ kind: 'scoreboard', leagueCode: 'eng.1', date: '2026-10-25' });
      await jest.advanceTimersByTimeAsync(10_001);
      expect(await pending).toMatchObject({ ok: false, code: 'provider_timeout' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { jest.useRealTimers(); }
  });
});
