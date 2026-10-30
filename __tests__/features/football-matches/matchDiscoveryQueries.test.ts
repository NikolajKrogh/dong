/** @jest-environment jsdom */
import { focusManager, onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { createMatchDiscoveryQueries } from '../../../features/football-matches/matchDiscoveryQueries';
import type { MatchDiscoveryApiClient, NormalizedMatch } from '../../../features/football-matches/matchDiscoveryAdapter';

type Result = Awaited<ReturnType<MatchDiscoveryApiClient['discoverMatches']>>;
const date = '2026-10-30';
const now = Date.parse(`${date}T12:00:00Z`);
const fixture = (league: string, id = league): NormalizedMatch => ({
  id, catalogMatchId: id, league, homeTeam: `${league} home`, awayTeam: `${league} away`,
  startDateTime: `${date}T15:00:00Z`, status: 'scheduled',
});
const result = (codes: string[], availability: Result['availability'] = 'available', retry = 15): Result => ({
  matches: codes.map(code => fixture(code)), availability, retryAfterSeconds: availability === 'pending' ? retry : null,
  groups: codes.map(leagueCode => ({ leagueCode, date, availability, isStale: false,
    lastSuccessfulCheckAt: new Date(Date.now()).toISOString(), reason: null,
    retryAfterSeconds: availability === 'pending' ? retry : null })),
});

const clients: QueryClient[] = [];
function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.mount();
  clients.push(client);
  const discover = jest.fn(async ({ leagueCodes }: { leagueCodes: string[]; date: string }) => result(leagueCodes));
  const discoveryQueries = createMatchDiscoveryQueries({ queryClient: client, discoverOnce: discover });
  function watch(codes: string[], sourceDate = date) {
    const selection = { date: sourceDate, leagueCodes: codes, active: true };
    const observers = discoveryQueries.createQueryOptions(selection).map(options => new QueryObserver(client, options));
    const unsubscribers = observers.map(observer => observer.subscribe(() => {}));
    return { selection, observers,
      read: () => discoveryQueries.createViewModel(selection, observers.map(observer => observer.getCurrentResult())),
      retry: () => discoveryQueries.retry(selection),
      close: () => unsubscribers.forEach(unsubscribe => unsubscribe()),
    };
  }
  return { client, discover, discoveryQueries, watch };
}
const flush = () => jest.advanceTimersByTimeAsync(0);

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  jest.setSystemTime(now);
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
});
afterEach(() => {
  clients.splice(0).forEach(client => { client.clear(); client.unmount(); });
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
  jest.useRealTimers();
});

it('canonicalizes selected demand, batches it and does nothing for an empty selection', async () => {
  const { watch, discover } = harness();
  const empty = watch([]);
  expect(empty.read().leagueStates).toEqual([]);
  const a = watch([' eng.2 ', 'eng.1', 'eng.1']);
  await flush();
  expect(discover).toHaveBeenCalledTimes(1);
  expect(discover).toHaveBeenCalledWith({ date, leagueCodes: ['eng.1', 'eng.2'] });
  expect(a.read().matches).toHaveLength(2);
});

it('publishes usable A while B is pending and shares B across overlapping consumers', async () => {
  const { watch, discover } = harness();
  discover.mockImplementation(async ({ leagueCodes }) => ({ ...result(leagueCodes), groups: leagueCodes.map(code =>
    result([code], code === 'B' ? 'pending' : 'available').groups[0]) }));
  const first = watch(['A', 'B']);
  const second = watch(['B', 'C']);
  await flush();
  expect(discover).toHaveBeenCalledTimes(1);
  expect(first.read().leagueStates.map(state => state.status)).toEqual(['available', 'pending']);
  expect(first.read().isInitialLoading).toBe(false);
  first.close();
  await jest.advanceTimersByTimeAsync(15_000);
  expect(discover).toHaveBeenLastCalledWith({ date, leagueCodes: ['B'] });
  expect(second.read().matches.map(match => match.id)).toEqual(['B', 'C']);
});

it('reuses fresh results, fetches only C and never polls completed results while idle', async () => {
  const { watch, discover } = harness();
  const first = watch(['A', 'B']);
  await flush(); first.close();
  const reopened = watch(['B', 'A', 'C']);
  await flush();
  expect(discover).toHaveBeenCalledTimes(2);
  expect(discover).toHaveBeenLastCalledWith({ date, leagueCodes: ['C'] });
  await jest.advanceTimersByTimeAsync(120_000);
  expect(discover).toHaveBeenCalledTimes(2);
  expect(reopened.read().leagueStates.every(state => state.status === 'available')).toBe(true);
});

it('limits a shared pending cycle to three checks; early Retry and a new observer cannot reset it', async () => {
  const { watch, discover } = harness();
  discover.mockImplementation(async ({ leagueCodes }) => result(leagueCodes, 'pending'));
  const first = watch(['A']); await flush();
  await first.retry(); await flush();
  expect(discover).toHaveBeenCalledTimes(1);
  watch(['A']); await flush();
  await jest.advanceTimersByTimeAsync(45_000);
  expect(discover).toHaveBeenCalledTimes(3);
  watch(['A']); await flush();
  await jest.advanceTimersByTimeAsync(90_000);
  expect(discover).toHaveBeenCalledTimes(3);
  await first.retry(); await flush();
  expect(discover).toHaveBeenCalledTimes(4);
});

it('honors a long deferral and manual Retry cooldown without an automatic continuation', async () => {
  const { watch, discover } = harness();
  discover.mockImplementation(async ({ leagueCodes }) => result(leagueCodes, 'pending', 120));
  const view = watch(['A']); await flush();
  await jest.advanceTimersByTimeAsync(119_000); await view.retry();
  expect(discover).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1_000);
  expect(discover).toHaveBeenCalledTimes(1);
  await view.retry(); await flush();
  expect(discover).toHaveBeenCalledTimes(2);
});

it('refreshes old source facts without warning for server-fresh fixtures, including checked empty', async () => {
  const { watch, discover } = harness();
  const old = result(['A']); old.groups[0].lastSuccessfulCheckAt = new Date(now - 60_000).toISOString();
  discover.mockResolvedValue(old);
  const view = watch(['A']); await flush();
  expect(view.read().leagueStates[0].status).toBe('available');
  const empty = result(['A']); empty.matches = [];
  discover.mockResolvedValue(empty); await view.retry(); await flush();
  expect(view.read().leagueStates[0].status).toBe('empty');
  await jest.advanceTimersByTimeAsync(60_000);
  expect(view.read().leagueStates[0].status).toBe('empty');
  discover.mockResolvedValue({ ...empty, groups: [{ ...empty.groups[0], lastSuccessfulCheckAt: null }] });
  await view.retry(); await flush();
  expect(view.read().leagueStates[0].status).toBe('outdated');
});

it('retains rows on partial and failed refresh, and never exposes raw failures', async () => {
  const { watch, discover } = harness();
  const view = watch(['A']); await flush();
  await jest.advanceTimersByTimeAsync(60_000);
  const partial = result(['A'], 'partial'); partial.matches = [];
  discover.mockResolvedValue(partial); await view.retry(); await flush();
  expect(view.read().matches).toHaveLength(1);
  expect(view.read().leagueStates[0].status).toBe('partial');
  discover.mockRejectedValue(new Error('secret internal SQL error'));
  await view.retry(); await flush();
  expect(view.read().matches).toHaveLength(1);
  expect(view.read().leagueStates[0].status).toBe('error');
  expect(view.read().leagueStates[0].message).not.toContain('secret');
});

it('isolates missing/duplicate/wrong-day groups after validation, retaining independently valid leagues', async () => {
  const { watch, discover } = harness();
  const malformed = result(['A','B','C']);
  malformed.groups = [malformed.groups[0], { ...malformed.groups[1], date: '2026-10-29' }];
  discover.mockResolvedValue(malformed);
  const view = watch(['A','B','C']); await flush();
  expect(view.read().leagueStates.map(state => state.status)).toEqual(['available','error','error']);
  expect(view.read().matches.map(match => match.league)).toEqual(['A']);
});

it('splits batches at 16 and lets another batch succeed when one transport fails', async () => {
  const { watch, discover } = harness();
  discover.mockImplementation(async ({ leagueCodes }) => {
    if (leagueCodes.length === 16) throw new Error('malformed response');
    return result(leagueCodes);
  });
  const view = watch(Array.from({length:17},(_,i) => `L${String(i).padStart(2,'0')}`)); await flush();
  expect(discover.mock.calls.map(([selection]) => selection.leagueCodes.length)).toEqual([16,1]);
  expect(view.read().matches).toHaveLength(1);
  expect(view.read().leagueStates.filter(state => state.status === 'error')).toHaveLength(16);
});

it('keeps late responses under their own date and joins repeated Retry while work is in flight', async () => {
  const { watch, discover } = harness();
  let finish!: (value: Result) => void;
  discover.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const old = watch(['A']); await flush();
  const retry = old.retry(); const retryAgain = old.retry();
  const next = result(['A']);
  next.groups[0].date = '2026-10-31'; next.matches[0].id = 'new-date';
  discover.mockResolvedValueOnce(next);
  const current = watch(['A'],'2026-10-31'); await flush();
  finish(result(['A'])); await retry; await retryAgain; await flush();
  expect(current.read().matches.map(match => match.id)).toEqual(['new-date']);
  expect(current.read().leagueStates[0].status).toBe('available');
  expect(old.read().matches.map(match => match.id)).toEqual(['A']);
  expect(discover).toHaveBeenCalledTimes(2);
});

it('stops follow-ups without an observer or in the background and resumes remaining allowance on focus', async () => {
  const { watch, discover } = harness();
  discover.mockImplementation(async ({ leagueCodes }) => result(leagueCodes,'pending'));
  const view = watch(['A']); await flush();
  focusManager.setFocused(false);
  await jest.advanceTimersByTimeAsync(30_000);
  expect(discover).toHaveBeenCalledTimes(1);
  focusManager.setFocused(true); await flush();
  expect(discover).toHaveBeenCalledTimes(2);
  view.close();
  await jest.advanceTimersByTimeAsync(60_000);
  expect(discover).toHaveBeenCalledTimes(2);
});

it('collects unobserved entries after 30 minutes and keeps active entries', async () => {
  const { watch, discover, client } = harness();
  const first = watch(['A']); watch(['B']); await flush(); first.close();
  await jest.advanceTimersByTimeAsync(30*60_000+1);
  expect(client.getQueryCache().getAll().map(query => query.queryKey)).toEqual([['match-discovery',date,'B']]);
  watch(['A','B']); await flush();
  expect(discover).toHaveBeenLastCalledWith({ date, leagueCodes: ['A','B'] }); // B is retained but stale on new activity
});


it.each([
  ["server stale", { isStale: true }],
  ["future source", { lastSuccessfulCheckAt: new Date(now+1).toISOString() }],
  ["invalid source", { lastSuccessfulCheckAt: "invalid" }],
])("vetoes reuse for %s group facts", async (_label, facts) => {
  const { watch, discover } = harness();
  const response = result(['A']); Object.assign(response.groups[0],facts);
  discover.mockResolvedValue(response);
  const first = watch(['A']); await flush(); first.close();
  expect(first.read().leagueStates[0].status).toBe('outdated');
  watch(['A']); await flush();
  expect(discover).toHaveBeenCalledTimes(2);
});

it('expires at source-check +60s, without extending old facts on a later response', async () => {
  const { watch, discover } = harness();
  const response = result(['A']); discover.mockResolvedValue(response);
  const first = watch(['A']); await flush(); first.close();
  await jest.advanceTimersByTimeAsync(59_999);
  const fresh = watch(['A']); await flush(); fresh.close();
  expect(discover).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  const stale = watch(['A']); await flush();
  expect(discover).toHaveBeenCalledTimes(2);
  expect(stale.read().leagueStates[0]).toMatchObject({ status: 'available', message: null });
  await stale.retry(); await flush();
  expect(discover).toHaveBeenCalledTimes(3);
  expect(stale.read().leagueStates[0]).toMatchObject({ status: 'available', message: null });
  stale.close();
  const reopened = watch(['A']); await flush();
  expect(discover).toHaveBeenCalledTimes(4);
  expect(reopened.read().leagueStates[0]).toMatchObject({ status: 'available', message: null });
});

it('never turns metadata-only, pending or invalid group correspondence into checked empty', async () => {
  const { watch, discover } = harness();
  let finish!: (value: Result) => void;
  discover.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = watch(['A']); await flush();
  expect(view.read()).toMatchObject({ isInitialLoading: true, leagueStates: [{ status: 'initial' }] });
  const pending = result(['A'],'pending'); pending.matches = []; finish(pending); await flush();
  expect(view.read().leagueStates[0].status).toBe('pending');
  const duplicate = result(['A']); duplicate.groups.push(duplicate.groups[0]);
  discover.mockResolvedValue(duplicate); await jest.advanceTimersByTimeAsync(15_000);
  expect(view.read().leagueStates[0].status).toBe('error');
  await jest.advanceTimersByTimeAsync(120_000);
  expect(discover).toHaveBeenCalledTimes(2);
});

it('resumes a paused initial request but never refreshes a completed result on reconnect', async () => {
  const { watch, discover } = harness();
  onlineManager.setOnline(false);
  const view = watch(['A']); await flush();
  expect(discover).not.toHaveBeenCalled();
  expect(view.read().leagueStates[0].status).toBe('offline');
  onlineManager.setOnline(true); await flush();
  expect(discover).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(120_000);
  onlineManager.setOnline(false); onlineManager.setOnline(true); await flush();
  expect(discover).toHaveBeenCalledTimes(1);
  expect(view.read().matches).toHaveLength(1);
});

it('stops pending checks when all consumers become inactive, without discarding a shared in-flight result', async () => {
  const { watch, discover, discoveryQueries } = harness();
  discover.mockImplementation(async ({ leagueCodes }) => result(leagueCodes,'pending'));
  const view = watch(['A']); await flush();
  const inactive = { ...view.selection, active: false };
  view.observers[0].setOptions(discoveryQueries.createQueryOptions(inactive)[0]);
  await jest.advanceTimersByTimeAsync(30_000);
  expect(discover).toHaveBeenCalledTimes(1);
  view.observers[0].setOptions(discoveryQueries.createQueryOptions(view.selection)[0]); await flush();
  expect(discover).toHaveBeenCalledTimes(2);
});

it('retains an unobserved in-flight entry until its submitted result completes', async () => {
  const { watch, discover, client } = harness();
  let finish!: (value: Result) => void;
  discover.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = watch(['A']); await flush(); view.close();
  await jest.advanceTimersByTimeAsync(31*60_000);
  expect(client.getQueryCache().getAll()).toHaveLength(1);
  finish(result(['A'])); await flush();
  const reopened = watch(['A']); await flush();
  expect(reopened.read().matches).toHaveLength(1);
  expect(discover).toHaveBeenCalledTimes(1);
});

it('keeps transport selection validation before splitting requests', () => {
  const { watch } = harness();
  expect(() => watch(Array.from({length:129},(_,i) => `L${i}`))).toThrow();
});
