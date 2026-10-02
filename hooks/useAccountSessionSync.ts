import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

import {
  applySyncedPreferenceState,
  getCurrentSyncedPreferenceState,
} from "../store/store";
import {
  bootstrapAccountRow,
  buildSyncedPreferenceSignature,
  loadAccountSyncedSettings,
  saveAccountSyncedSettings,
  type Account,
} from "../features/account";
import { normalizeAccountUsername } from "../features/account";
import type { Database } from "../types/database";
import { getAccountScope, isCurrentAccountScope, setAccountScope } from '../lib/queryClient';
import { getSupabaseClient } from "../lib/supabase";
import type { AccountAuthStatus } from "./useAccountAuth";

interface UseAccountSessionSyncParams {
  isConfigured: boolean;
  sessionExpiredMessage: string;
  activeSettingsUserIdRef: MutableRefObject<string | null>;
  lastSyncedPreferenceSignatureRef: MutableRefObject<string | null>;
  pendingManualSignOutRef: MutableRefObject<boolean>;
  setStatus: (status: AccountAuthStatus) => void;
  setSession: (session: Session | null) => void;
  setSessionNotice: (notice: string | null) => void;
  setUser: (user: User | null) => void;
  setAccount: (account: Account | null) => void;
}

interface UseAccountSessionSyncResult {
  clearAuthenticatedState: (nextSessionNotice?: string | null) => void;
  syncAuthenticatedSession: (
    nextSession: Session | null,
    shouldVerifyUser?: boolean,
    authEvent?: AuthChangeEvent,
  ) => Promise<void>;
}

const setSignedOutState = (
  setStatus: (status: AccountAuthStatus) => void,
  setSession: (session: Session | null) => void,
  setUser: (user: User | null) => void,
  setAccount: (account: Account | null) => void,
) => {
  setStatus("signedOut");
  setSession(null);
  setUser(null);
  setAccount(null);
};

const resolveAccountStatus = (
  nextAccount: Account,
  authEvent?: AuthChangeEvent,
): AccountAuthStatus => {
  if (authEvent === "PASSWORD_RECOVERY") {
    return "recoveringPassword";
  }

  return normalizeAccountUsername(nextAccount.username)
    ? "ready"
    : "needsUsername";
};

/** Restores the Supabase session on mount and keeps account/synced-settings state in sync with auth changes. */
export const useAccountSessionSync = ({
  isConfigured,
  sessionExpiredMessage,
  activeSettingsUserIdRef,
  lastSyncedPreferenceSignatureRef,
  pendingManualSignOutRef,
  setStatus,
  setSession,
  setSessionNotice,
  setUser,
  setAccount,
}: UseAccountSessionSyncParams): UseAccountSessionSyncResult => {
  const syncVersion = useRef(0);
  const clearAuthenticatedState = useCallback(
    (nextSessionNotice: string | null = null) => {
      syncVersion.current += 1;
      setAccountScope(null);
      pendingManualSignOutRef.current = false;
      activeSettingsUserIdRef.current = null;
      lastSyncedPreferenceSignatureRef.current = null;
      setSessionNotice(nextSessionNotice);
      setSignedOutState(setStatus, setSession, setUser, setAccount);
    },
    [
      activeSettingsUserIdRef,
      lastSyncedPreferenceSignatureRef,
      pendingManualSignOutRef,
      setAccount,
      setSession,
      setSessionNotice,
      setStatus,
      setUser,
    ],
  );

  const getSignedOutSessionNotice = useCallback(
    () =>
      !pendingManualSignOutRef.current &&
      activeSettingsUserIdRef.current !== null
        ? sessionExpiredMessage
        : null,
    [activeSettingsUserIdRef, pendingManualSignOutRef, sessionExpiredMessage],
  );

  const resolveAuthenticatedUser = useCallback(
    async (
      client: SupabaseClient<Database>,
      nextSession: Session,
      shouldVerifyUser: boolean,
    ) => {
      let nextUser = nextSession.user ?? null;

      if (shouldVerifyUser || !nextUser) {
        const { data: userData, error: userError } =
          await client.auth.getUser();

        if (userError || !userData.user) {
          return null;
        }

        nextUser = userData.user;
      }

      return nextUser;
    },
    [],
  );

  const syncAuthenticatedSettings = useCallback(
    async (client: SupabaseClient<Database>, userId: string) => {
      const scope = getAccountScope();
      const localSyncedPreferences = getCurrentSyncedPreferenceState();
      const persistedSyncedSettings = await loadAccountSyncedSettings(
        client,
        userId,
      );

      if (!isCurrentAccountScope(scope) || scope.accountId !== userId) return;

      if (persistedSyncedSettings) {
        const appliedSyncedPreferences = applySyncedPreferenceState(
          persistedSyncedSettings.settings,
          localSyncedPreferences,
        );

        lastSyncedPreferenceSignatureRef.current =
          buildSyncedPreferenceSignature(appliedSyncedPreferences);
        return;
      }

      const seededSyncedSettings = await saveAccountSyncedSettings(
        client,
        userId,
        localSyncedPreferences,
      );
      if (!isCurrentAccountScope(scope)) return;

      lastSyncedPreferenceSignatureRef.current = buildSyncedPreferenceSignature(
        seededSyncedSettings.settings,
      );
    },
    [lastSyncedPreferenceSignatureRef],
  );

  const syncAuthenticatedSession = useCallback(
    async (
      nextSession: Session | null,
      shouldVerifyUser = false,
      authEvent?: AuthChangeEvent,
    ) => {
      const client = getSupabaseClient();
      const signedOutSessionNotice = getSignedOutSessionNotice();
      const version = ++syncVersion.current;

      if (!nextSession) {
        clearAuthenticatedState(signedOutSessionNotice);
        return;
      }

      const scope = setAccountScope(nextSession.user.id);
      const current = () => version === syncVersion.current && isCurrentAccountScope(scope);
      if (activeSettingsUserIdRef.current !== nextSession.user.id) {
        activeSettingsUserIdRef.current = null;
        setStatus('loading');
        setAccount(null);
        setUser(null);
      }

      try {
      const nextUser = await resolveAuthenticatedUser(
        client,
        nextSession,
        shouldVerifyUser,
      );
      if (!current()) return;

      if (!nextUser) {
        clearAuthenticatedState(signedOutSessionNotice);
        return;
      }

      const nextAccount = await bootstrapAccountRow(client, nextUser.id);
      if (!current()) return;
      await syncAuthenticatedSettings(client, nextUser.id);
      if (!current()) return;

      activeSettingsUserIdRef.current = nextUser.id;
      setSessionNotice(null);

      setSession(nextSession);
      setUser(nextUser);
      setAccount(nextAccount);
      setStatus(resolveAccountStatus(nextAccount, authEvent));
      } catch (error) {
        if (current()) {
          clearAuthenticatedState();
          throw error;
        }
      }
    },
    [
      activeSettingsUserIdRef,
      clearAuthenticatedState,
      getSignedOutSessionNotice,
      resolveAuthenticatedUser,
      setAccount,
      setSession,
      setSessionNotice,
      setStatus,
      setUser,
      syncAuthenticatedSettings,
    ],
  );

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    const client = getSupabaseClient();
    let isMounted = true;

    const restoreSession = async () => {
      const version = syncVersion.current;
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (!isMounted || version !== syncVersion.current) {
        return;
      }

      if (sessionError || !sessionData.session) {
        clearAuthenticatedState();
        return;
      }

      try {
        await syncAuthenticatedSession(sessionData.session, true);
      } catch (error) {
        console.error(error);
      }
    };

    void restoreSession();

    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      void syncAuthenticatedSession(nextSession, false, event).catch(
        (error) => {
          console.error(error);
        },
      );
    });

    return () => {
      isMounted = false;
      syncVersion.current += 1;
      data.subscription.unsubscribe();
    };
  }, [clearAuthenticatedState, isConfigured, syncAuthenticatedSession]);

  return { clearAuthenticatedState, syncAuthenticatedSession };
};
