import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { GameSession } from "../components/history/historyTypes";
import { useGameStore } from "../store/store";
import { useAccountAuth } from "./useAccountAuth";
import { loadCloudHistory, mergeHistory, type HistoryImportLink } from "../utils/historyRepository";
import { getSupabaseClient, hasSupabasePublicConfig } from "../utils/supabaseClient";

interface CloudHistoryState {
  accountId: string | null;
  sessions: GameSession[];
  importLinks: HistoryImportLink[];
  loading: boolean;
  error: string | null;
}

export interface UseHistoryResult {
  history: GameSession[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  accountId: string | null;
}

const EMPTY_CLOUD_HISTORY: CloudHistoryState = {
  accountId: null,
  sessions: [],
  importLinks: [],
  loading: false,
  error: null,
};

const CLOUD_HISTORY_ERROR =
  "Could not load cloud history. Your available history is still shown.";

export const useHistory = (): UseHistoryResult => {
  const { account } = useAccountAuth();
  const accountId = account?.id ?? null;
  const localHistory = useGameStore((state) => state.history);
  const [cloudState, setCloudState] = useState<CloudHistoryState>(EMPTY_CLOUD_HISTORY);
  const currentAccountIdRef = useRef(accountId);
  const requestVersionRef = useRef(0);
  const mountedRef = useRef(true);

  // Reset account-scoped rows during the render for a new identity. Visible
  // history is also masked below, so no previous account rows can render.
  if (cloudState.accountId !== accountId) {
    setCloudState({
      accountId,
      sessions: [],
      importLinks: [],
      loading: accountId !== null,
      error: null,
    });
  }

  // Invalidate pending work on every identity transition, including A → signed
  // out → A when a blurred screen did not issue an intermediate refresh.
  useLayoutEffect(() => {
    if (currentAccountIdRef.current === accountId) return;
    currentAccountIdRef.current = accountId;
    requestVersionRef.current += 1;
  }, [accountId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestVersionRef.current += 1;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (accountId === null) {
      requestVersionRef.current += 1;
      setCloudState(EMPTY_CLOUD_HISTORY);
      return;
    }

    const requestVersion = ++requestVersionRef.current;
    setCloudState((current) => ({
      accountId,
      sessions: current.accountId === accountId ? current.sessions : [],
      importLinks: current.accountId === accountId ? current.importLinks : [],
      loading: true,
      error: null,
    }));

    try {
      if (hasSupabasePublicConfig() === false) {
        throw new Error("Cloud history is not configured for this build.");
      }

      const dataset = await loadCloudHistory(getSupabaseClient());
      if (
        mountedRef.current === false ||
        requestVersion !== requestVersionRef.current ||
        currentAccountIdRef.current !== accountId
      ) {
        return;
      }

      // Publish summaries and their dedupe links in one state update.
      setCloudState({
        accountId,
        sessions: dataset.sessions,
        importLinks: dataset.importLinks,
        loading: false,
        error: null,
      });
    } catch {
      if (
        mountedRef.current === false ||
        requestVersion !== requestVersionRef.current ||
        currentAccountIdRef.current !== accountId
      ) {
        return;
      }

      setCloudState((current) => ({
        accountId,
        sessions: current.accountId === accountId ? current.sessions : [],
        importLinks: current.accountId === accountId ? current.importLinks : [],
        loading: false,
        error: CLOUD_HISTORY_ERROR,
      }));
    }
  }, [accountId]);

  const hasCurrentAccountData = accountId !== null && cloudState.accountId === accountId;
  const history = useMemo(
    () =>
      mergeHistory(
        localHistory,
        hasCurrentAccountData ? cloudState.sessions : [],
        hasCurrentAccountData ? cloudState.importLinks : [],
      ),
    [
      cloudState.importLinks,
      cloudState.sessions,
      hasCurrentAccountData,
      localHistory,
    ],
  );

  return {
    history,
    loading:
      accountId !== null &&
      (hasCurrentAccountData ? cloudState.loading : true),
    error: hasCurrentAccountData ? cloudState.error : null,
    refresh,
    accountId,
  };
};
