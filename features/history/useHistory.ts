import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GameSession } from '../../components/history/historyTypes';
import { useAccountAuth } from '../../hooks/useAccountAuth';
import { useGameStore } from '../../store/store';
import { getSupabaseClient, hasSupabasePublicConfig } from '../../lib/supabase';
import { getAccountScope, queryClient } from '../../lib/queryClient';
import { loadCloudHistory, mergeHistory } from './historyRepository';

export interface UseHistoryResult {
  history: GameSession[]; loading: boolean; error: string | null; refresh: () => Promise<void>; accountId: string | null;
}
export function useHistory(): UseHistoryResult {
  const { account, status } = useAccountAuth();
  const accountId = status === 'ready' ? account?.id ?? null : null;
  const enabled = accountId !== null && getAccountScope().accountId === accountId;
  const localHistory = useGameStore(state => state.history);
  const cloud = useQuery({
    queryKey: ['account', accountId, 'history'], enabled, staleTime: 60_000, retry: false,
    queryFn: ({ signal }) => {
      if (!hasSupabasePublicConfig()) throw new Error('Cloud history is not configured.');
      return loadCloudHistory(getSupabaseClient(), signal);
    },
  }, queryClient);
  const history = useMemo(() => mergeHistory(localHistory, enabled ? cloud.data?.sessions ?? [] : []), [localHistory, enabled, cloud.data]);
  const { refetch } = cloud;
  const refresh = useCallback(async () => { if (enabled) await refetch(); }, [enabled, refetch]);
  return { history, accountId, loading: enabled && cloud.isFetching,
    error: enabled && cloud.error ? 'Could not load cloud history. Your available history is still shown.' : null, refresh };
}
