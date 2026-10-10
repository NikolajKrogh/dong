import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
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
const socialHistoryTargetQueryKey = (accountId: string, targetId: string) =>
  [...socialHistoryQueryKey(accountId), targetId] as const;
const COPLAYER_CONTEXT_BATCH_SIZE = 100;
const COPLAYER_CONTEXT_MAX_CONCURRENT_BATCHES = 4;

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
type SocialHistoryTargetQueryKey = ReturnType<typeof socialHistoryTargetQueryKey>;
type SocialHistoryDisplaySetter = Dispatch<SetStateAction<Display | null>>;

interface SocialHistoryDisplayState {
  current: Display | null;
  getQueryKey: () => SocialHistoryTargetQueryKey;
  pageController: MutableRefObject<AbortController | null>;
  refresh: () => Promise<void>;
  serial: MutableRefObject<number>;
  setDisplay: SocialHistoryDisplaySetter;
}

interface SocialHistoryPageOptions {
  accountId: string;
  current: Display | null;
  getQueryKey: () => SocialHistoryTargetQueryKey;
  pageController: MutableRefObject<AbortController | null>;
  serial: MutableRefObject<number>;
  setDisplay: SocialHistoryDisplaySetter;
}

function isSocialHistoryTargetAllowed(targetId: string, accountId: string, scopedAccountId: string | null): boolean {
  return isAccountId(targetId)
    && !!accountId
    && targetId !== accountId
    && scopedAccountId === accountId;
}

function getSocialHistoryDisplayError(enabled: boolean, accountId: string, current: Display | null): string | null {
  if (enabled) return current?.error ?? null;
  return accountId ? 'This shared history link is invalid.' : 'Sign in to view shared history.';
}

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

function useSocialHistoryDisplay(accountId: string, targetId: string, enabled: boolean): SocialHistoryDisplayState {
  const scope = getAccountScope();
  const [display, setDisplay] = useState<Display | null>(null);
  const serial = useRef(0);
  const focused = useRef(false);
  const pageController = useRef<AbortController | null>(null);
  const getQueryKey = useCallback(
    () => socialHistoryTargetQueryKey(accountId, targetId),
    [accountId, targetId],
  );

  // Observe invalidations without rendering query-cache data.
  useQuery({
    queryKey: getQueryKey(),
    enabled: false,
    gcTime: 0,
    retry: false,
    networkMode: 'always',
    queryFn: ({ signal }) => loadSocialHistory(getSupabaseClient(), accountId, targetId, signal),
  }, queryClient);

  const invalidateCurrentRequest = useCallback(() => {
    serial.current++;
    pageController.current?.abort();
    pageController.current = null;
    void queryClient.cancelQueries({ queryKey: getQueryKey() });
  }, [getQueryKey]);

  const hide = useCallback(() => {
    invalidateCurrentRequest();
    setDisplay(null);
  }, [invalidateCurrentRequest]);

  const refresh = useCallback(async () => {
    const start = getAccountScope();
    const revision = ++serial.current;
    pageController.current?.abort();
    pageController.current = null;

    if (!enabled || start.accountId !== accountId) {
      return;
    }

    const checkingDisplay: Display = {
      accountId,
      generation: start.generation,
      targetId,
      status: 'checking',
      data: null,
      error: null,
      timeline: null,
      paging: false,
    };
    setDisplay(checkingDisplay);

    await queryClient.cancelQueries({ queryKey: getQueryKey() });
    if (serial.current !== revision || !isCurrentAccountScope(start)) return;

    try {
      const data = await queryClient.fetchQuery({
        queryKey: getQueryKey(),
        staleTime: 0,
        gcTime: 0,
        retry: false,
        networkMode: 'always',
        queryFn: ({ signal }) => loadSocialHistory(getSupabaseClient(), accountId, targetId, signal),
      });

      if (serial.current === revision && isCurrentAccountScope(start)) {
        setDisplay({ ...checkingDisplay, status: 'ready', data });
      }
    } catch (error) {
      if (serial.current !== revision || !isCurrentAccountScope(start)) return;

      queryClient.removeQueries({ queryKey: getQueryKey() });
      setDisplay({
        ...checkingDisplay,
        status: 'error',
        error: getSocialHistoryErrorMessage(error),
      });
    }
  }, [accountId, enabled, getQueryKey, targetId]);

  const { isInteractive } = useAppVisibility();
  useFocusEffect(useCallback(() => {
    if (!isInteractive) {
      focused.current = false;
      return;
    }

    focused.current = true;
    void refresh();

    return () => {
      focused.current = false;
      hide();
    };
  }, [hide, isInteractive, refresh]));

  useEffect(() => queryClient.getQueryCache().subscribe(event => {
    const queryKey = event.query.queryKey;
    const isThisTargetInvalidated = event.type === 'updated'
      && event.action.type === 'invalidate'
      && queryKey[1] === accountId
      && queryKey[2] === 'social-history'
      && queryKey[3] === targetId;

    if (isThisTargetInvalidated) {
      hide();
      if (focused.current && isInteractive) void refresh();
    }
  }), [accountId, hide, isInteractive, refresh, targetId]);

  const isCurrentDisplay = display?.accountId === accountId
    && display.generation === scope.generation
    && display.targetId === targetId
    && enabled
    && isInteractive;

  return {
    current: isCurrentDisplay ? display : null,
    getQueryKey,
    pageController,
    refresh,
    serial,
    setDisplay,
  };
}

async function requestSocialHistoryPage<T>(
  options: SocialHistoryPageOptions,
  load: SocialPageLoader<T>,
  updateDisplay: SocialPageUpdater<T>,
): Promise<void> {
  const { accountId, current, getQueryKey, pageController, serial, setDisplay } = options;
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

    queryClient.removeQueries({ queryKey: getQueryKey() });
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
}

function useSocialHistoryPages(options: SocialHistoryPageOptions, targetId: string) {
  const { accountId, current, getQueryKey, pageController, serial, setDisplay } = options;
  const requestPage = useCallback(async <T,>(
    load: SocialPageLoader<T>,
    updateDisplay: SocialPageUpdater<T>,
  ) => requestSocialHistoryPage({
    accountId,
    current,
    getQueryKey,
    pageController,
    serial,
    setDisplay,
  }, load, updateDisplay), [accountId, current, getQueryKey, pageController, serial, setDisplay]);

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

  return { loadGames, loadTimeline };
}

export function useSocialHistory(targetId: string) {
  const { account, status } = useAccountAuth();
  const accountId = status === 'ready' ? account?.id ?? '' : '';
  const enabled = isSocialHistoryTargetAllowed(targetId, accountId, getAccountScope().accountId);
  const display = useSocialHistoryDisplay(accountId, targetId, enabled);
  const { loadGames, loadTimeline } = useSocialHistoryPages({
    accountId,
    current: display.current,
    getQueryKey: display.getQueryKey,
    pageController: display.pageController,
    serial: display.serial,
    setDisplay: display.setDisplay,
  }, targetId);
  const error = getSocialHistoryDisplayError(enabled, accountId, display.current);

  return {
    data: display.current?.status === 'ready' ? display.current.data : null,
    timeline: display.current?.timeline ?? null,
    checking: enabled && (!display.current || display.current.status === 'checking'),
    paging: display.current?.paging ?? false,
    error,
    refresh: display.refresh,
    loadGames,
    loadTimeline,
  };
}

function createAbortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function loadCoplayerBatchWorker(
  batches: string[][],
  batchIndex: number,
  results: Person[][],
  signal: AbortSignal,
): Promise<void> {
  const batch = batches[batchIndex];
  if (!batch || signal.aborted) return Promise.resolve();

  return loadCoplayerContext(getSupabaseClient(), batch, signal).then(people => {
    if (signal.aborted) return;
    results[batchIndex] = people;

    return loadCoplayerBatchWorker(
      batches,
      batchIndex + COPLAYER_CONTEXT_MAX_CONCURRENT_BATCHES,
      results,
      signal,
    );
  });
}

async function loadCoplayerContextBatches(stableIds: string, signal: AbortSignal): Promise<Person[]> {
  const targets = stableIds ? stableIds.split(',') : [];
  const batches = Array.from(
    { length: Math.ceil(targets.length / COPLAYER_CONTEXT_BATCH_SIZE) },
    (_, index) => targets.slice(
      index * COPLAYER_CONTEXT_BATCH_SIZE,
      (index + 1) * COPLAYER_CONTEXT_BATCH_SIZE,
    ),
  );
  const results = new Array<Person[]>(batches.length);
  const workerCount = Math.min(COPLAYER_CONTEXT_MAX_CONCURRENT_BATCHES, batches.length);
  const workersController = new AbortController();
  const abortWorkers = () => workersController.abort();
  let failed = false;
  let failureReason: unknown;

  signal.addEventListener('abort', abortWorkers, { once: true });
  if (signal.aborted) abortWorkers();

  const runWorker = async (workerIndex: number) => {
    try {
      await loadCoplayerBatchWorker(batches, workerIndex, results, workersController.signal);
    } catch (error) {
      if (!workersController.signal.aborted) {
        failed = true;
        failureReason = error;
        workersController.abort();
      }
      throw error;
    }
  };

  try {
    const settledWorkers = await Promise.allSettled(Array.from(
      { length: workerCount },
      (_, workerIndex) => runWorker(workerIndex),
    ));

    if (failed) throw failureReason;
    if (signal.aborted) throw createAbortError();

    const failedWorker = settledWorkers.find(result => result.status === 'rejected');
    if (failedWorker?.status === 'rejected') throw failedWorker.reason;
  } finally {
    signal.removeEventListener('abort', abortWorkers);
  }

  return results.flat();
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
  const focused = useRef(false);

  const loadPeople = useCallback(
    (signal: AbortSignal) => loadCoplayerContextBatches(stableIds, signal),
    [stableIds],
  );

  useQuery({
    queryKey: coplayerContextQueryKey(accountId, stableIds),
    enabled: false,
    gcTime: 0,
    queryFn: ({ signal }) => loadPeople(signal),
  }, queryClient);

  const refresh = useCallback(() => {
    const requestRevision = ++revision.current;
    const start = getAccountScope();

    if (!accountId || start.accountId !== accountId || !stableIds) return;

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
        && isCurrentAccountScope(start)
      ) {
        setResult({ accountId, generation: start.generation, ids: stableIds, people });
      }
    }).catch(() => {
      if (revision.current === requestRevision && isCurrentAccountScope(start)) {
        setResult(null);
      }
    });
  }, [accountId, loadPeople, stableIds]);

  const cancelRefresh = useCallback(() => {
    revision.current++;
    void queryClient.cancelQueries({ queryKey: coplayerContextQueryKey(accountId, stableIds) });
    setResult(null);
  }, [accountId, stableIds]);

  const { isInteractive } = useAppVisibility();
  useFocusEffect(useCallback(() => {
    if (!isInteractive) {
      focused.current = false;
      return;
    }

    focused.current = true;
    refresh();
    return () => {
      focused.current = false;
      cancelRefresh();
    };
  }, [cancelRefresh, isInteractive, refresh]));

  useEffect(() => queryClient.getQueryCache().subscribe(event => {
    const queryKey = event.query.queryKey;
    const isCoplayerQueryInvalidated = event.type === 'updated'
      && event.action.type === 'invalidate'
      && queryKey[1] === accountId
      && queryKey[2] === 'social-history'
      && queryKey[3] === 'coplayers';

    if (isCoplayerQueryInvalidated) {
      setResult(null);
      if (focused.current && isInteractive) refresh();
    }
  }), [accountId, isInteractive, refresh]);

  const hasCurrentResult = result?.accountId === accountId
    && result.generation === scope.generation
    && result.ids === stableIds
    && isInteractive;

  return hasCurrentResult ? result.people : [];
}
