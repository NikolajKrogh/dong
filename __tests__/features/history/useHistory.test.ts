import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useHistory } from '../../../features/history/useHistory';
import { loadCloudHistory } from '../../../features/history/historyRepository';
import { getAccountScope, queryClient, setAccountScope } from '../../../lib/queryClient';
import { useAccountAuth } from '../../../features/account';
import { useGameStore } from '../../../store/store';

jest.mock('../../../features/account', () => ({ useAccountAuth: jest.fn() }));
jest.mock('../../../lib/supabase', () => ({ getSupabaseClient: jest.fn(() => ({})), hasSupabasePublicConfig: () => true }));
jest.mock('../../../features/history/historyRepository', () => ({
  ...jest.requireActual('../../../features/history/historyRepository'), loadCloudHistory: jest.fn(),
}));
const session = (id: string) => ({ id, date: '', players: [], matches: [], commonMatchId: null, playerAssignments: {}, matchesPerPlayer: 1 });
const mockReadSavedMatches = jest.fn();
jest.mock('../../../features/football-matches/footballMatchService', () => ({ getFootballMatchService: () => ({ readSavedMatches: mockReadSavedMatches }) }));
const renderers: TestRenderer.ReactTestRenderer[] = [];
function renderHook<T>(hook: () => T) {
  const result = { current: undefined as T };
  const Probe = () => { result.current = hook(); return null; };
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Probe)); });
  renderers.push(renderer);
  return { result, rerender: (_props: object) => TestRenderer.act(() => renderer.update(React.createElement(Probe))) };
}
async function waitFor(assertion: () => void) {
  const deadline = Date.now() + 2000;
  while (true) {
    try { assertion(); return; } catch (error) { if (Date.now() > deadline) throw error; }
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  }
}
const auth = (id: string | null) => {
  setAccountScope(id);
  jest.mocked(useAccountAuth).mockReturnValue({ account: id ? { id } : null, status: id ? 'ready' : 'signedOut' } as ReturnType<typeof useAccountAuth>);
};
describe('account-scoped cloud history', () => {
  beforeAll(() => { queryClient.setDefaultOptions({ queries: { staleTime: 30_000, retry: false, gcTime: Infinity } }); });
  it('captures only bounded already-saved local details on ordinary access and explicit refresh', async () => {
    auth(null);
    mockReadSavedMatches.mockResolvedValue({ matches: [], missingCatalogMatchIds: [], availability: 'unavailable' });
    const matches = Array.from({ length: 24 }, (_, index) => ({
      id: `source-${index}`,
      catalogMatchId: String(index + 1),
      homeTeam: 'Home',
      awayTeam: 'Away',
      homeGoals: 1,
      awayGoals: 0,
    }));
    const local = { ...session('local'), matches };
    useGameStore.setState({ history: [local] });
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(mockReadSavedMatches).toHaveBeenCalledTimes(1));
    const firstTwentyIds = Array.from({ length: 20 }, (_, index) => String(index + 1));
    expect(mockReadSavedMatches).toHaveBeenCalledWith(firstTwentyIds, { projection: 'history' });
    await act(async () => result.current.refresh());
    expect(mockReadSavedMatches).toHaveBeenCalledTimes(2);
    expect(result.current.history[0].matches[0]).toMatchObject({ homeGoals: 1, awayGoals: 0 });
  });
  beforeEach(() => { queryClient.clear(); setAccountScope(null); useGameStore.setState({ history: [session('local')] as never }); });
  afterEach(() => { act(() => renderers.splice(0).forEach(renderer => renderer.unmount())); queryClient.clear(); setAccountScope(null); });
  it('combines local history with canonical cloud data without importer links', async () => {
    auth('A');
    jest.mocked(loadCloudHistory).mockResolvedValue({ sessions: [session('cloud')] });
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.history.map(s => s.id)).toEqual(['local','cloud']));
    expect(loadCloudHistory).toHaveBeenCalledWith(expect.anything(), expect.any(AbortSignal));
  });
  it('keeps local history when a cloud request fails', async () => {
    auth('A');
    jest.mocked(loadCloudHistory).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.error).toContain('Could not load cloud history'));
    expect(result.current.history.map(s => s.id)).toEqual(['local']);
  });
  it('does not publish delayed A results in B after cancellation', async () => {
    auth('A');
    let resolveA!: (value: { sessions: ReturnType<typeof session>[] }) => void;
    jest.mocked(loadCloudHistory).mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }))
      .mockResolvedValue({ sessions: [session('B-cloud')] });
    const { result, rerender } = renderHook(() => useHistory());
    await waitFor(() => expect(resolveA).toBeDefined());
    act(() => { auth('B'); rerender({}); });
    await waitFor(() => expect(result.current.history.map(s => s.id)).toEqual(['local','B-cloud']));
    await act(async () => { resolveA({ sessions: [session('A-private')] }); });
    expect(result.current.history.map(s => s.id)).toEqual(['local','B-cloud']);
    expect(getAccountScope().accountId).toBe('B');
  });
});
