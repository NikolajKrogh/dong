import { runDueMatchWork, type FootballMatchRepository, type ClaimedRequest } from '../../supabase/functions/_shared/football-matches/footballMatchService';

const dispatchToken = '00000000-0000-4030-8000-000000000601';
const groups = ['1', '2', '3', '4', '5'];
function claim(id: string): ClaimedRequest {
  return { ok: true, attemptId: id, leaseToken: `lease-${id}`, workerGeneration: 1, resource: { kind: 'scoreboard', leagueCode: 'eng.1', date: '2026-10-26' } };
}
function database(): jest.Mocked<FootballMatchRepository> {
  return {
    acquireSlot: jest.fn(), releaseSlot: jest.fn().mockResolvedValue(undefined),
    claimBatch: jest.fn().mockResolvedValue(groups.slice(0, 4).map(claim)),
    accept: jest.fn().mockResolvedValue({ ok: true }), fail: jest.fn().mockResolvedValue(undefined),
    prepareSolo: jest.fn(), finalizeSolo: jest.fn(), replaceSolo: jest.fn(),
    prepareDiscovery: jest.fn(), readDiscovery: jest.fn(), readSaved: jest.fn(),
    pendingRooms: jest.fn().mockResolvedValue([]), processRoom: jest.fn().mockResolvedValue({ ok: true, processedObservations: 1 }),
    beginDispatch: jest.fn().mockResolvedValue({ ok: true, groupIds: groups }),
  };
}
const provider = () => ({ read: jest.fn().mockResolvedValue({ ok: true, data: { events: [] }, status: 200, bytes: 13 }) });

describe('one durable match monitor pass', () => {
  it('denies stale/unknown dispatches before HTTP or room processing', async () => {
    const db = database();
    db.beginDispatch.mockResolvedValue({ ok: false, code: 'invalid_dispatch' });
    const source = provider();
    await expect(runDueMatchWork({ database: db, provider: source, dispatchToken, generation: 1, deadline: 35_000, now: () => 0 })).rejects.toMatchObject({ code: 'not_permitted' });
    expect(source.read).not.toHaveBeenCalled();
    expect(db.claimBatch).not.toHaveBeenCalled();
    expect(db.processRoom).not.toHaveBeenCalled();
    expect(db.releaseSlot).not.toHaveBeenCalled();
  });

  it('uses the existing dispatch and makes one wave of at most four requests', async () => {
    const db = database();
    const source = provider();
    const result = await runDueMatchWork({ database: db, provider: source, dispatchToken, generation: 1, deadline: 35_000, now: () => 0 });
    expect(result).toMatchObject({ attemptedGroups: 4, acceptedGroups: 4, deferredGroups: 1, failedGroups: 0 });
    expect(db.acquireSlot).not.toHaveBeenCalled();
    expect(db.claimBatch).toHaveBeenCalledTimes(1);
    expect(db.claimBatch).toHaveBeenCalledWith(groups, 'live', dispatchToken, 1);
    expect(source.read).toHaveBeenCalledTimes(4);
    expect(db.releaseSlot).toHaveBeenCalledWith(dispatchToken, 1, 'completed');
  });

  it('replays saved room observations when no acquisition reservation is available', async () => {
    const db = database();
    db.claimBatch.mockResolvedValue([]);
    db.pendingRooms.mockResolvedValueOnce(['room-a', 'room-b']).mockResolvedValue([]);
    const source = provider();
    const result = await runDueMatchWork({ database: db, provider: source, dispatchToken, generation: 1, deadline: 35_000, now: () => 0 });
    expect(source.read).not.toHaveBeenCalled();
    expect(db.processRoom.mock.calls.map(call => call[0]).sort()).toEqual(['room-a', 'room-b']);
    expect(result).toMatchObject({ attemptedGroups: 0, processedRooms: 2, failedRooms: 0 });
    expect(db.pendingRooms).toHaveBeenCalledWith(null);
  });

  it('bounds room fan-out and isolates a failed room while accepted source facts survive', async () => {
    const db = database();
    db.claimBatch.mockResolvedValue([claim('1')]);
    db.pendingRooms.mockResolvedValueOnce(Array.from({ length: 120 }, (_, index) => `room-${index}`)).mockResolvedValue([]);
    let active = 0;
    let peak = 0;
    db.processRoom.mockImplementation(async room => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      if (room === 'room-3') throw new Error('isolated room failure');
      return { ok: true, processedObservations: 1 };
    });
    const result = await runDueMatchWork({ database: db, provider: provider(), dispatchToken, generation: 1, deadline: 35_000, now: () => 0 });
    expect(db.processRoom).toHaveBeenCalledTimes(100);
    expect(peak).toBeLessThanOrEqual(4);
    expect(result).toMatchObject({ acceptedGroups: 1, processedRooms: 99, failedRooms: 1 });
    expect(db.accept).toHaveBeenCalledTimes(1);
    expect(db.fail).not.toHaveBeenCalled();
  });

  it('admits no new network wave within the final fifteen seconds and respects replay deadline margin', async () => {
    const db = database();
    const source = provider();
    db.pendingRooms.mockResolvedValue(['room-a']);
    const result = await runDueMatchWork({ database: db, provider: source, dispatchToken, generation: 1, deadline: 4_000, now: () => 0 });
    expect(result).toMatchObject({ attemptedGroups: 0, processedRooms: 0 });
    expect(source.read).not.toHaveBeenCalled();
    expect(db.processRoom).not.toHaveBeenCalled();
    expect(db.claimBatch).not.toHaveBeenCalled();
  });

  it('does not retry an ambiguous source commit and still continues saved room processing', async () => {
    const db = database();
    db.claimBatch.mockResolvedValue([claim('1')]);
    db.accept.mockRejectedValue(new Error('lost response after potential commit'));
    db.pendingRooms.mockResolvedValueOnce(['room-a']).mockResolvedValue([]);
    const source = provider();
    const result = await runDueMatchWork({ database: db, provider: source, dispatchToken, generation: 1, deadline: 35_000, now: () => 0 });
    expect(result).toMatchObject({ attemptedGroups: 1, failedGroups: 1, processedRooms: 1 });
    expect(source.read).toHaveBeenCalledTimes(1);
    expect(db.fail).not.toHaveBeenCalled();
  });

  it.each(['beginDispatch', 'claimBatch', 'releaseSlot'] as const)('settles by the 35-second deadline when %s never answers', async operation => {
    jest.useFakeTimers({ now: 0 });
    try {
      const db = database();
      db[operation].mockImplementation(() => new Promise<never>(() => {}));
      const source = provider();
      let settled = false;
      void runDueMatchWork({ database: db, provider: source, dispatchToken, generation: 1, deadline: 35_000 }).then(() => { settled = true; }, () => { settled = true; });
      await jest.advanceTimersByTimeAsync(35_001);
      expect(settled).toBe(true);
      if (operation !== 'releaseSlot') expect(source.read).not.toHaveBeenCalled();
      else expect(source.read).toHaveBeenCalledTimes(4);
      await jest.advanceTimersByTimeAsync(60_000);
      expect(source.read.mock.calls.length).toBe(operation === 'releaseSlot' ? 4 : 0);
    } finally { jest.useRealTimers(); }
  });

  it('yields a stalled preliminary replay lookup to the network wave after its two-second share', async () => {
    jest.useFakeTimers({ now: 0 });
    try {
      const db = database();
      db.pendingRooms.mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue([]);
      const source = provider();
      let settled = false;
      void runDueMatchWork({ database: db, provider: source, dispatchToken, generation: 1, deadline: 35_000 }).then(() => { settled = true; }, () => { settled = true; });
      await jest.advanceTimersByTimeAsync(2_001);
      expect(source.read).toHaveBeenCalledTimes(4);
      await jest.advanceTimersByTimeAsync(33_000);
      expect(settled).toBe(true);
    } finally { jest.useRealTimers(); }
  });

  it('does not start source HTTP when an ambiguous reservation reply arrives after the worker deadline', async () => {
    jest.useFakeTimers({ now: 0 });
    try {
      const db = database();
      let returnClaims: (claims: ClaimedRequest[]) => void = () => { throw new Error('claim has not started'); };
      db.claimBatch.mockImplementation(() => new Promise(resolve => { returnClaims = resolve; }));
      const source = provider();
      let settled = false;
      void runDueMatchWork({ database: db, provider: source, dispatchToken, generation: 1, deadline: 35_000 }).then(() => { settled = true; }, () => { settled = true; });
      await jest.advanceTimersByTimeAsync(35_001);
      expect(settled).toBe(true);
      returnClaims([claim('1')]);
      await jest.advanceTimersByTimeAsync(1);
      expect(source.read).not.toHaveBeenCalled();
      expect(db.accept).not.toHaveBeenCalled();
      expect(db.fail).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
  });
});
