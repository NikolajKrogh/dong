import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GameSession } from './historyTypes';
import { useAccountAuth } from '../account';
import { useGameStore } from '../../store/store';
import { getSupabaseClient, hasSupabasePublicConfig } from '../../lib/supabase';
import { getAccountScope, queryClient } from '../../lib/queryClient';
import { loadCloudHistory, mergeHistory } from './historyRepository';
import { getFootballMatchService } from '../../utils/footballMatchService';

export interface UseHistoryResult {
  history: GameSession[]; loading: boolean; error: string | null; refresh: () => Promise<void>; accountId: string | null;
}
function getRecentSavedMatchIds(history: GameSession[]): string[] {
  const ids = new Set<string>();

  for (const game of [...history].reverse()) {
    for (const match of game.matches) {
      if (match.catalogMatchId) ids.add(match.catalogMatchId);
      if (ids.size === 20) return [...ids];
    }
  }

  return [...ids];
}

export function useHistory(): UseHistoryResult {
  const { account, status } = useAccountAuth();
  const accountId = status === 'ready' ? account?.id ?? null : null;
  const enabled = accountId !== null && getAccountScope().accountId === accountId;
  const localHistory = useGameStore(state => state.history);
  // An ordinary history/home visit may capture already held details. No interval,
  // demand renewal, upload, or provider lookup is attached to this read.
  const savedIds = getRecentSavedMatchIds(localHistory);
  const savedKey = savedIds.join(',');
  const captureHeldDetails = useCallback(async (signal?: AbortSignal) => {
    if (!savedKey || !hasSupabasePublicConfig()) return;
    try {
      const result = await getFootballMatchService({ signal }).readSavedMatches(savedKey.split(','), { projection: 'history' });
      if (!signal?.aborted) useGameStore.getState().captureSavedMatches(result.matches);
    } catch { /* Uncaptured/expired detail remains unavailable; local results survive. */ }
  }, [savedKey]);
  useEffect(() => {
    const controller = new AbortController();
    void captureHeldDetails(controller.signal);
    return () => controller.abort();
  }, [captureHeldDetails]);
  const cloud = useQuery({
    queryKey: ['account', accountId, 'history'], enabled, staleTime: 60_000, retry: false,
    queryFn: ({ signal }) => {
      if (!hasSupabasePublicConfig()) throw new Error('Cloud history is not configured.');
      return loadCloudHistory(getSupabaseClient(), signal);
    },
  }, queryClient);
  const history = useMemo(() => mergeHistory(localHistory, enabled ? cloud.data?.sessions ?? [] : []), [localHistory, enabled, cloud.data]);
  const { refetch } = cloud;
  const refresh = useCallback(async () => { await Promise.all([enabled ? refetch() : Promise.resolve(), captureHeldDetails()]); }, [enabled, refetch, captureHeldDetails]);
  return { history, accountId, loading: enabled && cloud.isFetching,
    error: enabled && cloud.error ? 'Could not load cloud history. Your available history is still shown.' : null, refresh };
}
