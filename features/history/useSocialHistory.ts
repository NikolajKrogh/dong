import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAccountAuth } from '../../hooks/useAccountAuth';
import { getSupabaseClient } from '../../lib/supabase';
import { getAccountScope, isCurrentAccountScope, queryClient } from '../../lib/queryClient';
import { useAppVisibility } from '../../platform/visibility';
import {
  isAccountId,
  loadCoplayerContext,
  loadPersonalHistoryStats,
  loadSharedGames,
  loadSharedTimeline,
  loadSocialHistory,
  SOCIAL_HISTORY_CONNECTION_ERROR,
  SocialHistoryError,
  type SocialHistory,
  type SocialPage,
  type TimelinePoint,
} from './socialHistoryRepository';
import type { Person } from '../friends';
import { useQuery } from '@tanstack/react-query';

const accountQueryKey = (accountId: string) => ['account', accountId] as const;
const socialHistoryQueryKey = (accountId: string) => [...accountQueryKey(accountId), 'social-history'] as const;
const personalHistoryStatsQueryKey = (accountId: string) => [...accountQueryKey(accountId), 'history-stats'] as const;
const coplayerContextQueryKey = (accountId: string, targetIds: string) =>
  [...socialHistoryQueryKey(accountId), 'coplayers', targetIds] as const;

export function usePersonalHistoryStats() {
  const { account, status } = useAccountAuth();
  const accountId = status === 'ready' ? account?.id ?? '' : '';
  const enabled = !!accountId && getAccountScope().accountId === accountId;
  const query = useQuery({
    queryKey: personalHistoryStatsQueryKey(accountId),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) => loadPersonalHistoryStats(getSupabaseClient(), accountId, signal),
  }, queryClient);
  const { refetch } = query;
  const refresh = useCallback(async () => {
    if (enabled) await refetch();
  }, [enabled, refetch]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const { isInteractive } = useAppVisibility();
  const previousInteractive = useRef(isInteractive);
  useEffect(() => {
    if (isInteractive && !previousInteractive.current) {
      void refresh();
    }
    previousInteractive.current = isInteractive;
  }, [isInteractive, refresh]);

  return {
    data: enabled ? query.data ?? null : null,
    loading: enabled && query.isFetching,
    error: enabled && query.error ? 'Your statistics could not load.' : null,
    enabled,
    refresh,
  };
}

export function invalidateSocialHistory(accountId: string) {
  // Invalidation observers hide displayed results before rechecking authorization.
  const queryKey = socialHistoryQueryKey(accountId);
  void queryClient.cancelQueries({ queryKey });
  return queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
}

interface Display {
  accountId: string;
  generation: number;
  targetId: string;
  status: 'checking' | 'ready' | 'error';
  data: SocialHistory | null;
  error: string | null;
  timeline: SocialPage<TimelinePoint> | null;
  paging: boolean;
}

const getSocialHistoryErrorMessage = (error: unknown): string =>
  error instanceof SocialHistoryError ? error.message : SOCIAL_HISTORY_CONNECTION_ERROR;

type SocialPageLoader<T> = (signal: AbortSignal) => Promise<SocialPage<T>>;
type SocialPageUpdater<T> = (display: Display, page: SocialPage<T>) => Display;

const appendGamePage: SocialPageUpdater<SocialHistory['games']['items'][number]> = (display, page) => {
  if (!display.data) return { ...display, paging: false };

  const gamesById = new Map(
    [...display.data.games.items, ...page.items].map(game => [game.id, game] as const),
  );

  return {
    ...display,
    paging: false,
    data: {
      ...display.data,
      games: {
        items: [...gamesById.values()],
        next_cursor: page.next_cursor,
      },
    },
  };
};

const appendTimelinePage: SocialPageUpdater<TimelinePoint> = (display, page) => {
  const timelineBySessionId = new Map(
    [...(display.timeline?.items ?? []), ...page.items]
      .map(point => [point.session_id, point] as const),
  );
  const items = [...timelineBySessionId.values()].sort((left, right) =>
    left.completed_at.localeCompare(right.completed_at)
    || left.session_id.localeCompare(right.session_id));

  return {
    ...display,
    paging: false,
    timeline: {
      items,
      next_cursor: page.next_cursor,
    },
  };
};

export function useSocialHistory(targetId: string) {
  const { account, status } = useAccountAuth();
  const accountId = status === 'ready' ? account?.id ?? '' : '';
  const scope = getAccountScope();
  const enabled = isAccountId(targetId)
    && !!accountId
    && targetId !== accountId
    && scope.accountId === accountId;
  const [display, setDisplay] = useState<Display | null>(null);
  const serial = useRef(0);
  const focused = useRef(false);
  const pageController = useRef<AbortController | null>(null);
  const key = useCallback(
    () => [...socialHistoryQueryKey(accountId), targetId],
    [accountId, targetId],
  );

  // Keep an invalidation observer for the lifetime of the view, without rendering its cached data.
  useQuery({
    queryKey: key(),
    enabled: false,
    gcTime: 0,
    retry: false,
    networkMode: 'always',
    queryFn: ({ signal }) => loadSocialHistory(getSupabaseClient(), accountId, targetId, signal),
  }, queryClient);

  const hide = useCallback(() => {
    serial.current++;
    pageController.current?.abort();
    pageController.current = null;
    setDisplay(null);
    void queryClient.cancelQueries({ queryKey: key() });
  }, [key]);

  const refresh = useCallback(async () => {
    const start = getAccountScope();
    const revision = ++serial.current;
    pageController.current?.abort();
    pageController.current = null;

    if (!enabled || start.accountId !== accountId) {
      setDisplay(null);
      return;
    }

    const emptyDisplay: Display = {
      accountId,
      generation: start.generation,
      targetId,
      status: 'checking',
      data: null,
      error: null,
      timeline: null,
      paging: false,
    };
    setDisplay(emptyDisplay);

    await queryClient.cancelQueries({ queryKey: key() });
    if (serial.current !== revision || !isCurrentAccountScope(start)) return;

    try {
      const data = await queryClient.fetchQuery({
        queryKey: key(),
        staleTime: 0,
        gcTime: 0,
        retry: false,
        networkMode: 'always',
        queryFn: ({ signal }) => loadSocialHistory(getSupabaseClient(), accountId, targetId, signal),
      });

      if (serial.current === revision && isCurrentAccountScope(start)) {
        setDisplay({ ...emptyDisplay, status: 'ready', data });
      }
    } catch (error) {
      if (serial.current !== revision || !isCurrentAccountScope(start)) return;

      queryClient.removeQueries({ queryKey: key() });
      setDisplay({
        ...emptyDisplay,
        status: 'error',
        error: getSocialHistoryErrorMessage(error),
      });
    }
  }, [accountId, enabled, key, targetId]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    void refresh();

    return () => {
      focused.current = false;
      hide();
    };
  }, [hide, refresh]));

  const { isInteractive } = useAppVisibility();
  const previousInteractive = useRef(isInteractive);
  useEffect(() => {
    if (!isInteractive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Foreground transitions must clear authorization before showing cached data.
      hide();
    } else if (!previousInteractive.current && focused.current) {
      void refresh();
    }

    previousInteractive.current = isInteractive;
  }, [hide, isInteractive, refresh]);

  useEffect(() => queryClient.getQueryCache().subscribe(event => {
    const queryKey = event.query.queryKey;
    const isThisTargetInvalidated = event.type === 'updated'
      && event.action.type === 'invalidate'
      && queryKey[1] === accountId
      && queryKey[2] === 'social-history'
      && queryKey[3] === targetId;

    if (isThisTargetInvalidated) {
      hide();
      if (focused.current) void refresh();
    }
  }), [accountId, hide, refresh, targetId]);

  const current = display?.accountId === accountId
    && display.generation === scope.generation
    && display.targetId === targetId
    && enabled
    && isInteractive
    ? display
    : null;

  const requestPage = useCallback(async <T,>(
    load: SocialPageLoader<T>,
    updateDisplay: SocialPageUpdater<T>,
  ) => {
    if (!current || current.status !== 'ready' || !current.data || pageController.current) return;

    const start = getAccountScope();
    if (start.accountId !== accountId) return;

    const revision = serial.current;
    const controller = new AbortController();
    pageController.current = controller;
    setDisplay(previous => previous ? { ...previous, paging: true } : previous);

    try {
      const page = await load(controller.signal);
      if (serial.current !== revision || !isCurrentAccountScope(start)) return;

      setDisplay(previous => previous ? updateDisplay(previous, page) : previous);
    } catch (error) {
      if (serial.current !== revision || !isCurrentAccountScope(start)) return;

      queryClient.removeQueries({ queryKey: key() });
      setDisplay({
        ...current,
        status: 'error',
        data: null,
        timeline: null,
        paging: false,
        error: getSocialHistoryErrorMessage(error),
      });
    } finally {
      if (pageController.current === controller) {
        pageController.current = null;
      }
    }
  }, [accountId, current, key]);

  const loadGames = useCallback(async () => {
    const cursor = current?.data?.games.next_cursor;
    if (!current || current.status !== 'ready' || !cursor) return;

    await requestPage(
      signal => loadSharedGames(getSupabaseClient(), accountId, targetId, cursor, signal),
      appendGamePage,
    );
  }, [accountId, current, requestPage, targetId]);

  const loadTimeline = useCallback(async () => {
    if (!current || current.status !== 'ready' || !current.data) return;
    if (current.timeline && !current.timeline.next_cursor) return;

    const cursor = current.timeline?.next_cursor ?? null;
    await requestPage(
      signal => loadSharedTimeline(getSupabaseClient(), targetId, cursor, signal),
      appendTimelinePage,
    );
  }, [current, requestPage, targetId]);

  let error = current?.error ?? null;
  if (!enabled) {
    error = 'This shared history link is invalid.';
    if (!accountId) error = 'Sign in to view shared history.';
  }

  return {
    data: current?.status === 'ready' ? current.data : null,
    timeline: current?.timeline ?? null,
    checking: enabled && (!current || current.status === 'checking'),
    paging: current?.paging ?? false,
    error,
    refresh,
    loadGames,
    loadTimeline,
  };
}

export function useHistoryCoplayerContext(ids: string[]) {
  const { account, status } = useAccountAuth();
  const accountId = status === 'ready' ? account?.id ?? '' : '';
  const scope = getAccountScope();
  const stableIds = [...new Set(ids.filter(isAccountId))]
    .filter(id => id !== accountId)
    .sort()
    .join(',');
  const [result, setResult] = useState<{
    accountId: string;
    generation: number;
    ids: string;
    people: Person[];
  } | null>(null);
  const revision = useRef(0);

  const loadPeople = useCallback(async (signal: AbortSignal) => {
    const targets = stableIds ? stableIds.split(',') : [];
    const people: Person[] = [];

    for (let offset = 0; offset < targets.length; offset += 100) {
      const batch = targets.slice(offset, offset + 100);
      people.push(...await loadCoplayerContext(getSupabaseClient(), batch, signal));
    }

    return people;
  }, [stableIds]);

  useQuery({
    queryKey: coplayerContextQueryKey(accountId, stableIds),
    enabled: false,
    gcTime: 0,
    queryFn: ({ signal }) => loadPeople(signal),
  }, queryClient);

  const refresh = useCallback(() => {
    const requestRevision = ++revision.current;
    const start = getAccountScope();
    const controller = new AbortController();
    setResult(null);

    if (!accountId || start.accountId !== accountId || !stableIds) {
      return () => controller.abort();
    }

    void queryClient.fetchQuery({
      queryKey: coplayerContextQueryKey(accountId, stableIds),
      staleTime: 0,
      gcTime: 0,
      retry: false,
      networkMode: 'always',
      queryFn: ({ signal }) => loadPeople(signal),
    }).then(people => {
      if (
        revision.current === requestRevision
        && !controller.signal.aborted
        && isCurrentAccountScope(start)
      ) {
        setResult({ accountId, generation: start.generation, ids: stableIds, people });
      }
    }).catch(() => {
      if (revision.current === requestRevision && !controller.signal.aborted) {
        setResult(null);
      }
    });

    return () => controller.abort();
  }, [accountId, loadPeople, stableIds]);

  useFocusEffect(refresh);
  const { isInteractive } = useAppVisibility();

  useEffect(() => {
    if (isInteractive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Lifecycle changes clear permission-dependent actions before refreshing.
      return refresh();
    }

    setResult(null);
  }, [isInteractive, refresh]);

  useEffect(() => queryClient.getQueryCache().subscribe(event => {
    const queryKey = event.query.queryKey;
    const isCoplayerQueryInvalidated = event.type === 'updated'
      && event.action.type === 'invalidate'
      && queryKey[1] === accountId
      && queryKey[2] === 'social-history'
      && queryKey[3] === 'coplayers';

    if (isCoplayerQueryInvalidated) refresh();
  }), [accountId, refresh]);

  const hasCurrentResult = result?.accountId === accountId
    && result.generation === scope.generation
    && result.ids === stableIds
    && isInteractive;

  return hasCurrentResult ? result.people : [];
}
