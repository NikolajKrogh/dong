import { acquireProviderGroups, type AcquisitionDatabase, type ClaimedRequest } from '../../supabase/functions/_shared/football-matches/footballMatchService';
import { finalSummary } from '../fixtures/matchCatalog/summary';

const summaryClaim: ClaimedRequest = { ok: true, attemptId: '20', leaseToken: 'summary-lease', workerGeneration: 1,
  resource: { kind: 'summary', leagueCode: 'eng.1', sourceEventId: 'event-100' } };
function database(): jest.Mocked<AcquisitionDatabase> {
  return {
    acquireSlot: jest.fn().mockResolvedValue({ ok: true, dispatchToken: 'worker', workerGeneration: 1 }),
    releaseSlot: jest.fn().mockResolvedValue(undefined), claimBatch: jest.fn().mockResolvedValue([summaryClaim]),
    accept: jest.fn().mockResolvedValue({ ok: true }), fail: jest.fn().mockResolvedValue(undefined),
  };
}

describe('bounded shared completion acquisition', () => {
  it('normalizes full summary roster and boxscore through one shared claim without per-player acquisition', async () => {
    const db = database();
    const source = { read: jest.fn().mockResolvedValue({ ok: true, data: structuredClone(finalSummary), status: 200, bytes: 1000 }) };
    const result = await acquireProviderGroups({ database: db, provider: source, groupIds: Array(100).fill('8'), purpose: 'completion', generation: 1, deadline: 35_000, now: () => 0 });
    expect(result).toEqual({ attemptedGroups: 1, acceptedGroups: 1, deferredGroups: 0, failedGroups: 0 });
    expect(db.claimBatch).toHaveBeenCalledWith(['8'], 'completion', 'worker', 1);
    expect(source.read).toHaveBeenCalledTimes(1);
    expect(source.read).toHaveBeenCalledWith(summaryClaim.resource);
    const projection = db.accept.mock.calls[0][1];
    expect(projection.matches[0].historyDetails?.rosterEntries).toHaveLength(5);
    expect(projection.matches[0].historyDetails?.teamStats?.home.totalPasses).toBe(500);
    expect(projection.matches[0].goals?.some(goal => goal.kind === 'penalty' && goal.sourceAthleteId === 'scorer-2')).toBe(true);
    expect(JSON.stringify(projection)).not.toMatch(/private-image|Do not retain|headshot|commentary/);
    expect(db.fail).not.toHaveBeenCalled();
  });

  it('rejects malformed or foreign-event summaries without accepting a destructive replacement', async () => {
    const db = database();
    const foreign = structuredClone(finalSummary);
    foreign.header.id = 'different-event';
    const source = { read: jest.fn().mockResolvedValueOnce({ ok: true, data: { rosters: finalSummary.rosters }, status: 200, bytes: 1000 })
      .mockResolvedValueOnce({ ok: true, data: foreign, status: 200, bytes: 1000 }) };
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await acquireProviderGroups({ database: db, provider: source, groupIds: ['8'], purpose: 'completion', generation: 1, deadline: 35_000, now: () => 0 })).toMatchObject({ acceptedGroups: 0, failedGroups: 1 });
    }
    expect(db.accept).not.toHaveBeenCalled();
    expect(db.fail).toHaveBeenCalledTimes(2);
    expect(db.fail).toHaveBeenLastCalledWith(summaryClaim, expect.objectContaining({ code: 'invalid_provider_response', scope: 'group' }));
    expect(source.read.mock.calls.every(([resource]) => resource.kind === 'summary')).toBe(true);
  });

  it('records unavailable completion once and obeys a database denial without an athlete or scoreboard fallback', async () => {
    const db = database();
    const failed = { ok: false, code: 'match_not_found', status: 404, scope: 'group', retryAfterSeconds: null };
    const source = { read: jest.fn().mockResolvedValue(failed) };
    const work = { database: db, provider: source, groupIds: ['8'], purpose: 'completion' as const, generation: 1, deadline: 35_000, now: () => 0 };
    expect(await acquireProviderGroups(work)).toMatchObject({ attemptedGroups: 1, failedGroups: 1 });
    expect(db.fail).toHaveBeenCalledWith(summaryClaim, failed);
    db.claimBatch.mockResolvedValue([]);
    expect(await acquireProviderGroups(work)).toMatchObject({ attemptedGroups: 0, deferredGroups: 1 });
    expect(source.read).toHaveBeenCalledTimes(1);
    expect(db.accept).not.toHaveBeenCalled();
  });

  it('does not repeat or refund an uncertain summary commit, leaving shared budget/cap decisions to SQL', async () => {
    const db = database();
    db.accept.mockRejectedValue(new Error('response lost after possible commit'));
    const source = { read: jest.fn().mockResolvedValue({ ok: true, data: finalSummary, status: 200, bytes: 1000 }) };
    const result = await acquireProviderGroups({ database: db, provider: source, groupIds: ['8'], purpose: 'completion', generation: 1, deadline: 35_000, now: () => 0 });
    expect(result).toMatchObject({ attemptedGroups: 1, acceptedGroups: 0, failedGroups: 1 });
    expect(source.read).toHaveBeenCalledTimes(1);
    expect(db.claimBatch).toHaveBeenCalledTimes(1);
    expect(db.fail).not.toHaveBeenCalled();
  });
});
