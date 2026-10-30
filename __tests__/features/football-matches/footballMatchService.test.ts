import { createFootballMatchService, getFootballMatchService, FootballMatchError } from '../../../features/football-matches/footballMatchService';
import { getSupabaseClient } from '../../../lib/supabase';
import { normalizeEspnScoreboard } from '../../../supabase/functions/_shared/football-matches/espnMatchNormalizer';
import { liveBoard } from '../../fixtures/matchCatalog/scoreboards';
import type { SavedMatch } from '../../../types/footballMatch';

jest.mock('../../../lib/supabase', () => ({ getSupabaseClient: jest.fn() }));

const saved: SavedMatch = {
  ...normalizeEspnScoreboard(liveBoard, 'eng.1').matches[0], catalogMatchId: '9007199254740993', observationVersion: '1',
  freshness: { lastAttemptAt: null, lastSuccessfulCheckAt: '2026-10-25T18:00:00Z', observedAt: '2026-10-25T18:00:00Z', isStale: false, availabilityReason: null },
};
const savedResult = { matches: [saved], missingCatalogMatchIds: [], availability: 'available', retryAfterSeconds: null };
const group = { leagueCode: 'eng.1', date: '2026-10-25', availability: 'available', lastSuccessfulCheckAt: null, isStale: false, reason: null, retryAfterSeconds: null };

function transport() {
  return { invoke: jest.fn(), readSaved: jest.fn().mockResolvedValue(savedResult), wait: jest.fn().mockResolvedValue(undefined) };
}

describe('Football match service', () => {
  it('returns the first pending snapshot in picker mode without hidden follow-ups', async () => {
    const io = transport();
    io.invoke.mockResolvedValue({ matches: [], availability: 'pending', groups: [{ ...group, availability: 'pending' }], retryAfterSeconds: 15 });
    const result = await createFootballMatchService(io, { followUpPending: false })
      .discoverMatches({ leagueCodes: ['eng.1'], date: '2026-10-25' });
    expect(result.availability).toBe('pending');
    expect(io.invoke).toHaveBeenCalledTimes(1);
    expect(io.wait).not.toHaveBeenCalled();
  });

  afterEach(() => {
    jest.mocked(getSupabaseClient).mockReset();
  });

  it('uses saved-only RPC reads and keeps bigint IDs as strings without renewing tracking', async () => {
    const io = transport();
    const result = await createFootballMatchService(io).readSavedMatches([saved.catalogMatchId, saved.catalogMatchId]);
    expect(io.readSaved).toHaveBeenCalledWith([saved.catalogMatchId], 'live', undefined);
    expect(io.invoke).not.toHaveBeenCalled();
    expect(result.matches[0].catalogMatchId).toBe('9007199254740993');
  });

  it('handles empty reads without transport and reports evicted data without acquiring replacements', async () => {
    const io = transport();
    const client = createFootballMatchService(io);
    expect(await client.readSavedMatches([])).toMatchObject({ matches: [], availability: 'available' });
    expect(io.readSaved).not.toHaveBeenCalled();
    io.readSaved.mockResolvedValue({ ...savedResult, matches: [], missingCatalogMatchIds: [saved.catalogMatchId], availability: 'unavailable' });
    expect((await client.readSavedMatches([saved.catalogMatchId])).missingCatalogMatchIds).toEqual([saved.catalogMatchId]);
    expect(io.invoke).not.toHaveBeenCalled();
  });

  it('splits history bounds and oversized saved projections without admitting source work', async () => {
    const io = transport();
    io.readSaved.mockImplementation(async (ids: string[]) => {
      if (ids.length > 10) throw { code: '22023', message: 'projection_too_large' };
      return { ...savedResult, matches: [], missingCatalogMatchIds: ids };
    });
    const ids = Array.from({ length: 21 }, (_, i) => String(i + 1));
    const result = await createFootballMatchService(io).readSavedMatches(ids, { projection: 'history' });
    expect(result.missingCatalogMatchIds).toHaveLength(21);
    expect(io.readSaved.mock.calls.every(([batch]) => batch.length <= 20)).toBe(true);
    expect(io.invoke).not.toHaveBeenCalled();
  });

  it('rejects malformed IDs and does not silently accept numeric catalog identities', async () => {
    const io = transport();
    const client = createFootballMatchService(io);
    await expect(client.readSavedMatches(['-1'])).rejects.toMatchObject({ code: 'invalid_selection' });
    expect(io.readSaved).not.toHaveBeenCalled();
    io.readSaved.mockResolvedValue({ ...savedResult, matches: [{ ...saved, catalogMatchId: 12 }] });
    await expect(client.readSavedMatches(['12'])).rejects.toMatchObject({ code: 'transport_unavailable' });
  });

  it('normalizes explicit discovery, distinguishes valid empty from failure and follows pending at most twice', async () => {
    const io = transport();
    io.invoke.mockResolvedValue({ matches: [], availability: 'pending', groups: [{ ...group, availability: 'pending', retryAfterSeconds: 2 }], retryAfterSeconds: 2 });
    const client = createFootballMatchService(io);
    const result = await client.discoverMatches({ leagueCodes: [' eng.1 ', 'eng.1'], date: '2026-10-25' });
    expect(result.availability).toBe('pending');
    expect(io.invoke).toHaveBeenCalledTimes(3);
    expect(io.invoke.mock.calls[0]).toEqual(['discover-matches', { leagueCodes: ['eng.1'], date: '2026-10-25' }, undefined]);
    expect(io.wait.mock.calls.map(([ms]) => ms)).toEqual([15_000, 15_000]);
    io.invoke.mockReset().mockResolvedValue({ matches: [], availability: 'available', groups: [group], retryAfterSeconds: null });
    expect(await client.discoverMatches({ leagueCodes: ['eng.1'], date: '2026-10-25' })).toMatchObject({ matches: [], availability: 'available' });
    expect(io.invoke).toHaveBeenCalledTimes(1);
  });

  it('preserves partial saved content and obeys a longer advertised follow-up time', async () => {
    const io = transport();
    io.invoke.mockResolvedValueOnce({ matches: [saved], availability: 'partial', groups: [{ ...group, availability: 'pending', retryAfterSeconds: 40 }], retryAfterSeconds: 40 })
      .mockResolvedValue({ matches: [saved], availability: 'partial', groups: [{ ...group, availability: 'deferred' }], retryAfterSeconds: 60 });
    const result = await createFootballMatchService(io).discoverMatches({ leagueCodes: ['eng.1'], date: '2026-10-25' });
    expect(result.matches).toEqual([saved]);
    expect(io.wait).toHaveBeenCalledWith(40_000, undefined);
    expect(io.invoke).toHaveBeenCalledTimes(2);
  });

  it('returns long deferrals without an unbounded foreground wait or an early retry', async () => {
    const io = transport();
    io.invoke.mockResolvedValue({ matches: [], availability: 'pending', groups: [{ ...group, availability: 'pending', retryAfterSeconds: 120 }], retryAfterSeconds: 120 });
    expect(await createFootballMatchService(io).discoverMatches({ leagueCodes: ['eng.1'], date: '2026-10-25' })).toMatchObject({ retryAfterSeconds: 120 });
    expect(io.invoke).toHaveBeenCalledTimes(1);
    expect(io.wait).not.toHaveBeenCalled();
  });

  it('passes cancellation through and makes no request for an already aborted caller', async () => {
    const io = transport();
    const controller = new AbortController();
    const client = createFootballMatchService({ ...io, signal: controller.signal });
    await client.readSavedMatches(['1']);
    expect(io.readSaved).toHaveBeenCalledWith(['1'], 'live', controller.signal);
    controller.abort();
    await expect(client.readSavedMatches(['1'])).rejects.toMatchObject({ name: 'AbortError' });
    expect(io.readSaved).toHaveBeenCalledTimes(1);
  });

  it('passes a finite tracking request once, preserves issuance replay state and does not leak raw errors', async () => {
    const io = transport();
    const request = { operationId: '00000000-0000-4000-8000-000000000001', creationNonce: 'A'.repeat(43), catalogMatchIds: [saved.catalogMatchId] };
    io.invoke.mockResolvedValue({ grantToken: 'B'.repeat(43), selectionVersion: 1, isReplay: true, catalogMatchIds: request.catalogMatchIds, expiresAt: '2026-10-26T18:00:00Z', state: 'active' });
    expect(await createFootballMatchService(io).replaceSoloTracking(request)).toMatchObject({ isReplay: true, state: 'active' });
    expect(io.invoke).toHaveBeenCalledTimes(1);
    expect(io.invoke).toHaveBeenCalledWith('solo-match-tracking', request, undefined);
    io.invoke.mockRejectedValue(new Error('secret DSN and provider body'));
    await expect(createFootballMatchService(io).replaceSoloTracking(request)).rejects.toMatchObject({ code: 'transport_unavailable', message: 'transport_unavailable' });
  });

  it.each([
    ['lifecycle', { ...saved, lifecycle: 'invalid' }],
    ['freshness', { ...saved, freshness: { ...saved.freshness, observedAt: 123 } }],
    ['goals', { ...saved, goals: [{ side: 'invalid', kind: 'goal' }] }],
    ['statistics', { ...saved, homeTeamStatistics: { possession: 'unknown' } }],
    ['history', { ...saved, historyDetails: { rosterEntries: 'invalid' } }],
  ])('rejects malformed %s rather than exposing an unchecked SavedMatch', async (_, match) => {
    const io = transport();
    io.readSaved.mockResolvedValue({ ...savedResult, matches: [match] });
    await expect(createFootballMatchService(io).readSavedMatches([saved.catalogMatchId]))
      .rejects.toMatchObject({ code: 'transport_unavailable' });
    expect(io.readSaved).toHaveBeenCalledTimes(1);
  });

  it('preserves unknown response fields and nullable match facts for forward compatibility', async () => {
    const io = transport();
    const match = {
      ...saved,
      homeScore: null,
      awayScore: null,
      goals: null,
      futureFact: { source: 'catalog' },
      identity: { ...saved.identity, futureIdentityField: 'retained' },
    };
    io.readSaved.mockResolvedValue({ ...savedResult, matches: [match] });
    const result = await createFootballMatchService(io).readSavedMatches([saved.catalogMatchId]);
    expect(result.matches).toEqual([match]);
  });

  it('accepts the largest database bigint ID and rejects larger or noncanonical IDs before transport', async () => {
    const io = transport();
    const client = createFootballMatchService(io);
    await client.readSavedMatches(['9223372036854775807']);
    expect(io.readSaved).toHaveBeenCalledWith(['9223372036854775807'], 'live', undefined);
    io.readSaved.mockClear();
    for (const id of ['9223372036854775808', '01', '+1', '0', '1.0', '1e3', '١', '1\n']) {
      await expect(client.readSavedMatches([id])).rejects.toMatchObject({ code: 'invalid_selection' });
    }
    expect(io.readSaved).not.toHaveBeenCalled();
  });

  it('rejects mutually exclusive tracking credentials without sending a mutation', async () => {
    const io = transport();
    const request = {
      operationId: '00000000-0000-4000-8000-000000000001',
      creationNonce: 'A'.repeat(43),
      grantToken: 'B'.repeat(43),
      expectedSelectionVersion: 1,
      catalogMatchIds: [saved.catalogMatchId],
    };
    // @ts-expect-error Runtime validation must reject credentials a JavaScript caller can mix.
    const replacement = createFootballMatchService(io).replaceSoloTracking(request);
    await expect(replacement)
      .rejects.toMatchObject({ code: 'invalid_selection' });
    expect(io.invoke).not.toHaveBeenCalled();
  });

  it('preserves controlled response errors and their retry delay', async () => {
    const io = transport();
    io.readSaved.mockResolvedValue({ ok: false, code: 'capacity_limited', retryAfterSeconds: 45 });
    await expect(createFootballMatchService(io).readSavedMatches(['1']))
      .rejects.toMatchObject({ code: 'capacity_limited', retryAfterSeconds: 45 });
  });

  it('accepts a leap day and rejects invalid or noncanonical discovery dates before transport', async () => {
    const io = transport();
    io.invoke.mockResolvedValue({ matches: [], groups: [], availability: 'available' });
    const client = createFootballMatchService(io);
    await client.discoverMatches({ leagueCodes: ['eng.1'], date: '2024-02-29' });
    expect(io.invoke).toHaveBeenCalledWith('discover-matches', {
      leagueCodes: ['eng.1'], date: '2024-02-29',
    }, undefined);
    io.invoke.mockClear();
    for (const date of ['2025-02-29', '2026-04-31', '2026-1-01', '2026-01-01\n', '2026-01-01T00:00:00Z']) {
      await expect(client.discoverMatches({ leagueCodes: ['eng.1'], date }))
        .rejects.toMatchObject({ code: 'invalid_selection' });
    }
    expect(io.invoke).not.toHaveBeenCalled();
  });

  it('keeps observation versions as digit strings, including zero and leading zeros', async () => {
    const io = transport();
    const client = createFootballMatchService(io);
    for (const observationVersion of ['0', '0001', '9'.repeat(19)]) {
      io.readSaved.mockResolvedValue({ ...savedResult, matches: [{ ...saved, observationVersion }] });
      const result = await client.readSavedMatches([saved.catalogMatchId]);
      expect(result.matches[0].observationVersion).toBe(observationVersion);
    }
    for (const observationVersion of ['', '1e3', '-1', '١', '1\n', '9'.repeat(20)]) {
      io.readSaved.mockResolvedValue({ ...savedResult, matches: [{ ...saved, observationVersion }] });
      await expect(client.readSavedMatches([saved.catalogMatchId]))
        .rejects.toMatchObject({ code: 'transport_unavailable' });
    }
  });

  it('accepts only correctly sized Base64URL tokens for tracking requests and grants', async () => {
    const io = transport();
    const token = '-_Az09'.repeat(8).slice(0, 43);
    const request = {
      operationId: '00000000-0000-4000-8000-000000000001',
      creationNonce: token,
      catalogMatchIds: [saved.catalogMatchId],
    };
    const grant = {
      grantToken: token, selectionVersion: 1, isReplay: false,
      catalogMatchIds: request.catalogMatchIds, expiresAt: '2026-10-26T18:00:00Z', state: 'active',
    };
    io.invoke.mockResolvedValue(grant);
    const client = createFootballMatchService(io);
    expect((await client.replaceSoloTracking(request)).grantToken).toBe(token);
    for (const invalidToken of [
      'A'.repeat(42), 'A'.repeat(44),
      ...['+', '/', '=', 'é', '\n'].map(character => `${'A'.repeat(42)}${character}`),
    ]) {
      io.invoke.mockClear();
      await expect(client.replaceSoloTracking({ ...request, creationNonce: invalidToken }))
        .rejects.toMatchObject({ code: 'invalid_selection' });
      expect(io.invoke).not.toHaveBeenCalled();
      io.invoke.mockResolvedValue({ ...grant, grantToken: invalidToken });
      await expect(client.replaceSoloTracking(request))
        .rejects.toMatchObject({ code: 'transport_unavailable' });
    }
  });

  it('keeps the public error class and maps missing Supabase configuration', () => {
    jest.mocked(getSupabaseClient).mockImplementationOnce(() => { throw new Error('private config'); });
    expect(() => getFootballMatchService()).toThrow(FootballMatchError);
  });

  it('accepts partial database history with statistics available for only one team', async () => {
    const io = transport();
    const historyDetails = {
      rosterEntries: null,
      teamStats: { home: { saves: 2, possession: null }, away: null },
      availability: 'partial',
      isFinal: true,
      hasMoreRosterEntries: false,
    };
    io.readSaved.mockResolvedValue({ ...savedResult, matches: [{ ...saved, historyDetails }] });
    const result = await createFootballMatchService(io).readSavedMatches(
      [saved.catalogMatchId], { projection: 'history' },
    );
    expect(result.matches[0].historyDetails).toEqual({
      ...historyDetails,
      teamStats: { home: historyDetails.teamStats.home, away: {} },
    });
  });

  it('wires Supabase RPC cancellation and exposes only the controlled Edge Function error', async () => {
    const controller = new AbortController();
    const abortSignal = jest.fn().mockResolvedValue({ data: savedResult, error: null });
    const rpc = jest.fn().mockReturnValue({ abortSignal });
    const invoke = jest.fn().mockResolvedValue({
      data: null,
      error: { context: { json: jest.fn().mockResolvedValue({
        ok: false, code: 'capacity_limited', retryAfterSeconds: 45, debug: 'private upstream details',
      }) } },
    });
    // Only these SDK methods are used by the production adapter.
    (getSupabaseClient as jest.Mock).mockReturnValue({ functions: { invoke }, rpc });
    const client = getFootballMatchService({ signal: controller.signal });

    expect((await client.readSavedMatches([saved.catalogMatchId])).matches).toEqual([saved]);
    expect(rpc).toHaveBeenCalledWith('read_saved_matches', {
      catalog_match_ids: [saved.catalogMatchId], projection: 'live',
    });
    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
    await expect(client.discoverMatches({ leagueCodes: ['eng.1'], date: '2026-10-25' }))
      .rejects.toMatchObject({ code: 'capacity_limited', message: 'capacity_limited', retryAfterSeconds: 45 });
    expect(invoke).toHaveBeenCalledWith('discover-matches', {
      body: { leagueCodes: ['eng.1'], date: '2026-10-25' }, signal: controller.signal,
    });
  });

  it('cancels the built-in follow-up delay without issuing another discovery request', async () => {
    jest.useFakeTimers();
    try {
      const io = transport();
      const controller = new AbortController();
      io.invoke.mockResolvedValue({
        matches: [], availability: 'pending', groups: [{ ...group, availability: 'pending' }],
      });
      const client = createFootballMatchService({ ...io, wait: undefined, signal: controller.signal });
      const discovery = client.discoverMatches({ leagueCodes: ['eng.1'], date: '2026-10-25' });
      const cancellation = expect(discovery).rejects.toMatchObject({ name: 'AbortError' });
      await jest.advanceTimersByTimeAsync(0);
      controller.abort();
      await cancellation;
      expect(io.invoke).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
