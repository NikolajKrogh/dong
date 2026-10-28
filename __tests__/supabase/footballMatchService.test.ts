import { createFootballMatchService } from '../../supabase/functions/_shared/football-matches/footballMatchService';
import { emptyBoard } from '../fixtures/matchCatalog/scoreboards';

function fixture() {
  const result = { matches: [], groups: [], availability: 'available', retryAfterSeconds: null };
  const database = {
    prepareDiscovery: jest.fn().mockResolvedValue({
      ok: true,
      workerGeneration: 1,
      workGroupIds: ['1'],
      selection: { leagueCodes: ['eng.1'], date: '2026-10-26' },
      result,
    }),
    readDiscovery: jest.fn().mockResolvedValue(result),
    readSaved: jest.fn().mockResolvedValue({
      matches: [],
      missingCatalogMatchIds: ['1'],
      availability: 'unavailable',
      retryAfterSeconds: null,
    }),
    acquireSlot: jest.fn().mockResolvedValue({
      ok: true,
      dispatchToken: 'dispatch',
      workerGeneration: 1,
    }),
    releaseSlot: jest.fn(),
    claimBatch: jest.fn().mockResolvedValue([
      {
        ok: true,
        attemptId: '1',
        leaseToken: 'lease',
        workerGeneration: 1,
        resource: { kind: 'scoreboard', leagueCode: 'eng.1', date: '2026-10-26' },
      },
    ]),
    accept: jest.fn().mockResolvedValue({ ok: true }),
    fail: jest.fn(),
    pendingRooms: jest.fn().mockResolvedValue(['room']),
    processRoom: jest.fn().mockResolvedValue({ ok: true }),
    prepareSolo: jest.fn(),
    finalizeSolo: jest.fn(),
    replaceSolo: jest.fn(),
    beginDispatch: jest.fn(),
  };
  const provider = { read: jest.fn().mockResolvedValue({ ok: true, status: 200, data: emptyBoard }) };
  const catalog = createFootballMatchService({ database, provider, keyring: { currentKeyId: '', keys: {} }, crypto: globalThis.crypto });
  return { catalog, database, provider, result };
}

it('composes one acquisition wave then independently replays saved room facts before releasing the slot', async () => {
  const { catalog, database, provider, result } = fixture();
  expect(await catalog.discoverMatches({ leagueCodes: ['eng.1'], date: '2026-10-26' })).toEqual(result);
  expect(provider.read).toHaveBeenCalledTimes(1);
  expect(database.processRoom).toHaveBeenCalledWith('room', 'dispatch', 1);
  expect(database.releaseSlot).toHaveBeenCalledTimes(1);
  expect(database.readDiscovery).toHaveBeenCalledTimes(1);
});

it('fresh discovery and saved reads allocate no workers, acquire no source data and do not replay rooms', async () => {
  const { catalog, database, provider } = fixture();
  database.prepareDiscovery.mockResolvedValue({ ok: true, workerGeneration: 1, workGroupIds: [], result: { matches: [], groups: [], availability: 'available', retryAfterSeconds: null } });
  await catalog.discoverMatches({ leagueCodes: ['eng.1'], date: '2026-10-26' });
  await catalog.readSavedMatches(['1']);
  expect(database.acquireSlot).not.toHaveBeenCalled();
  expect(provider.read).not.toHaveBeenCalled();
  expect(database.pendingRooms).not.toHaveBeenCalled();
  expect(database.readSaved).toHaveBeenCalledWith(['1'], 'live');
});

it('keeps a committed source response when one room fails and bounds fanout to four concurrent rooms', async () => {
  const { catalog, database } = fixture();
  database.pendingRooms.mockResolvedValue(Array.from({ length: 105 }, (_, i) => `room-${i}`));
  let concurrent = 0;
  let peak = 0;
  database.processRoom.mockImplementation(async (room: string) => {
    peak = Math.max(peak, ++concurrent);
    await Promise.resolve(); concurrent--;
    if (room === 'room-0') throw new Error('room failed');
    return { ok: true };
  });
  await catalog.discoverMatches({ leagueCodes: ['eng.1'], date: '2026-10-26' });
  expect(database.accept).toHaveBeenCalledTimes(1);
  expect(database.processRoom).toHaveBeenCalledTimes(100);
  expect(peak).toBeLessThanOrEqual(4);
  expect(database.releaseSlot).toHaveBeenCalledTimes(1);
});
