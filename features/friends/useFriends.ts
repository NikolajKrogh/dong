import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccountAuth } from '../../hooks/useAccountAuth';
import { getSupabaseClient } from '../../lib/supabase';
import { getAccountScope, isCurrentAccountScope, queryClient } from '../../lib/queryClient';
import { useAppVisibility } from '../../platform/visibility';
import { normalizeAccountUsername } from '../account';
import { actOnFriend, listFriends, searchFriends, SocialError, type FriendAction, type Person, type ListKind, type SocialPage } from './friendsRepository';
import { friendKeys } from './queryKeys';

const refreshes = new Map<string, Promise<void>>();
export function refreshFriends(accountId: string) {
  const key = `${getAccountScope().generation}:${accountId}`;
  const existing = refreshes.get(key);
  if (existing) return existing;
  const promise = queryClient.refetchQueries({ queryKey: friendKeys.all(accountId), type: 'active' }, { cancelRefetch: false })
    .finally(() => { refreshes.delete(key); });
  refreshes.set(key, promise);
  return promise;
}
export function useFriends(kind: ListKind, prefix = '') {
  const { account, status } = useAccountAuth();
  const id = status === 'ready' ? account?.id ?? '' : '';
  const normalized = normalizeAccountUsername(prefix) ?? '';
  const enabled = !!id && getAccountScope().accountId === id;
  const policy = { enabled, refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: false } as const;
  const list = useInfiniteQuery({
    ...policy, queryKey: friendKeys.list(id, kind), initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listFriends(getSupabaseClient(), kind, pageParam, signal),
    getNextPageParam: page => page.next_cursor ?? undefined,
  });
  const search = useQuery({
    ...policy, enabled: enabled && [...normalized].length >= 3,
    queryKey: friendKeys.search(id, prefix),
    queryFn: ({ signal }) => searchFriends(getSupabaseClient(), prefix, signal),
  });
  const focused = useRef(false);
  const refresh = useCallback(() => id ? refreshFriends(id) : Promise.resolve(), [id]);
  useFocusEffect(useCallback(() => { focused.current = true; void refresh(); return () => { focused.current = false; }; }, [refresh]));
  const { isInteractive } = useAppVisibility();
  const previousInteractive = useRef(isInteractive);
  useEffect(() => {
    if (isInteractive && !previousInteractive.current && focused.current) void refresh();
    previousInteractive.current = isInteractive;
  }, [isInteractive, refresh]);
  const intents = useRef(new Map<string, string>());
  const running = useRef(false);
  const generation = getAccountScope().generation;
  useEffect(() => { intents.current.clear(); running.current = false; }, [generation]);
  const [mutationState, setMutationState] = useState<{ generation: number; busy: string | null; error: string | null }>({ generation: -1, busy: null, error: null });
  const scope = getAccountScope();
  const act = async (action: FriendAction, person: Person) => {
    const start = getAccountScope();
    if (!enabled || start.accountId !== id || running.current) return;
    running.current = true;
    const key = JSON.stringify([start.generation, action, person.account_id, person.username, person.request_id, person.block_id]);
    const operationId = intents.current.get(key) ?? Crypto.randomUUID();
    intents.current.set(key, operationId);
    setMutationState({ generation: start.generation, busy: person.account_id, error: null });
    try {
      const confirmed = await actOnFriend(getSupabaseClient(), action, person, operationId);
      if (!isCurrentAccountScope(start)) return;
      intents.current.delete(key);
      await queryClient.cancelQueries({ queryKey: friendKeys.all(id) });
      if (!isCurrentAccountScope(start)) return;
      // Apply only the server-confirmed projection before refreshing. A failed read
      // must not turn a confirmed request back into a Send button.
      for (const [cacheKey] of queryClient.getQueriesData({ queryKey: friendKeys.all(id) })) {
        if (cacheKey[3] === 'search') {
          queryClient.setQueryData<Person[]>(cacheKey, rows => rows?.flatMap(row => row.account_id !== person.account_id
            ? [row] : confirmed.person.relationship === 'unavailable' ? [] : [confirmed.person]));
        } else {
          const matches = cacheKey[4] === 'blocks' ? !!confirmed.person.block_id : cacheKey[4] === confirmed.person.relationship;
          queryClient.setQueryData<InfiniteData<SocialPage>>(cacheKey, data => data ? { ...data, pages: data.pages.map(page => ({ ...page,
            items: page.items.flatMap(row => row.account_id !== person.account_id ? [row] : matches ? [confirmed.person] : []) })) } : data);
        }
      }
      await refresh();
    } catch (error) {
      if (!isCurrentAccountScope(start)) return;
      if (error instanceof SocialError && error.code in { target_changed: 1, request_conflict: 1, request_not_allowed: 1, target_unavailable: 1, invalid_input: 1, idempotency_conflict: 1 }) intents.current.delete(key);
      setMutationState({ generation: start.generation, busy: null, error: error instanceof Error ? error.message : 'Unable to complete the action.' });
      await refresh();
      return;
    } finally {
      if (isCurrentAccountScope(start)) running.current = false;
    }
    if (isCurrentAccountScope(start)) setMutationState({ generation: start.generation, busy: null, error: null });
  };
  return { id, enabled, list, search, refresh, act,
    items: enabled ? list.data?.pages.flatMap(page => page.items) ?? [] : [],
    results: enabled && [...normalized].length >= 3 ? search.data ?? [] : [],
    busy: mutationState.generation === scope.generation ? mutationState.busy : null,
    actionError: mutationState.generation === scope.generation ? mutationState.error : null };
}
