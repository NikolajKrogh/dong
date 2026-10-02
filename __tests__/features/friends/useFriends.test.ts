/* eslint-disable react-hooks/globals -- The test probe exposes its latest hook value to assertions. */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFriends, refreshFriends } from '../../../features/friends/useFriends';
import { actOnFriend, listFriends } from '../../../features/friends/friendsRepository';
import { useAccountAuth } from '../../../hooks/useAccountAuth';
import { queryClient, setAccountScope } from '../../../lib/queryClient';

// Cache cleanup is explicit in this suite; avoid React Query's five-minute GC timer.
beforeAll(() => queryClient.setDefaultOptions({ queries: { staleTime: 30_000, retry: false, gcTime: Infinity }, mutations: { retry: false, networkMode: 'always' } }));

jest.mock('../../../hooks/useAccountAuth', () => ({ useAccountAuth: jest.fn() }));
jest.mock('../../../lib/supabase', () => ({ getSupabaseClient: () => ({}) }));
jest.mock('../../../platform/visibility', () => ({ useAppVisibility: () => ({ isInteractive: true }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('expo-crypto', () => { let sequence = 0; return { randomUUID: () => `operation-${++sequence}` }; });
jest.mock('../../../features/friends/friendsRepository', () => ({
  ...jest.requireActual('../../../features/friends/friendsRepository'), listFriends: jest.fn(), actOnFriend: jest.fn(),
}));
const person = { account_id: 'target', username: 'Target', relationship: 'none' as const, request_id: null };
let tree: TestRenderer.ReactTestRenderer;
let current: ReturnType<typeof useFriends>;
const Probe = () => { current = useFriends('friends'); return null; };
const auth = (id: string) => {
  setAccountScope(id);
  jest.mocked(useAccountAuth).mockReturnValue({ account: { id }, status: 'ready' } as ReturnType<typeof useAccountAuth>);
};
const render = () => React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Probe));
beforeEach(async () => {
  jest.clearAllMocks(); queryClient.clear(); setAccountScope(null); auth('A');
  jest.mocked(listFriends).mockResolvedValue({ items: [], next_cursor: null });
  jest.mocked(actOnFriend).mockResolvedValue({ person: { ...person, relationship: 'outgoing', request_id: 'request' } });
  await act(async () => { tree = TestRenderer.create(render()); });
});
afterEach(() => { act(() => tree.unmount()); queryClient.clear(); setAccountScope(null); });
it('reuses the operation after an uncertain failure and creates a new intent after success', async () => {
  jest.mocked(actOnFriend).mockRejectedValueOnce(new Error('Network lost'));
  await act(async () => { await current.act('send', person); });
  expect(current.actionError).toBe('Network lost');
  await act(async () => { await current.act('send', person); });
  await act(async () => { await current.act('send', person); });
  const calls = jest.mocked(actOnFriend).mock.calls;
  expect(calls[0][3]).toBe(calls[1][3]);
  expect(calls[2][3]).not.toBe(calls[1][3]);
});
it('suppresses a late mutation failure after A logs out and signs in again', async () => {
  let reject!: (error: Error) => void;
  jest.mocked(actOnFriend).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  let pending!: Promise<void>;
  act(() => { pending = current.act('send', person); });
  setAccountScope(null); auth('A');
  await act(async () => { tree.update(render()); });
  await act(async () => { reject(new Error('Old account failure')); await pending; });
  expect(current.actionError).toBeNull();
  expect(current.busy).toBeNull();
});
it('coalesces overlapping refresh triggers', async () => {
  let resolve!: () => void;
  const spy = jest.spyOn(queryClient, 'refetchQueries').mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
  const first = refreshFriends('A');
  expect(refreshFriends('A')).toBe(first);
  resolve(); await first; spy.mockRestore();
});
it('keeps a confirmed Pending projection when the follow-up read fails', async () => {
  const key = ['account', 'A', 'friends', 'search', 'Tar'];
  queryClient.setQueryData(key, [person]);
  jest.mocked(listFriends).mockRejectedValueOnce(new Error('Read failed'));
  await act(async () => { await current.act('send', person); });
  expect(queryClient.getQueryData(key)).toEqual([expect.objectContaining({ relationship: 'outgoing', request_id: 'request' })]);
});
