import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import { useCallback, useEffect, type MutableRefObject } from "react";

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
} from "../utils/accountRepository";
import { normalizeAccountDisplayName } from "../utils/accountAuthRoutes";
import { getSupabaseClient } from "../utils/supabaseClient";
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

  return normalizeAccountDisplayName(nextAccount.preferredDisplayName)
    ? "ready"
    : "needsDisplayName";
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
  const clearAuthenticatedState = useCallback(
    (nextSessionNotice: string | null = null) => {
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
      client: SupabaseClient,
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
    async (client: SupabaseClient, userId: string) => {
      const localSyncedPreferences = getCurrentSyncedPreferenceState();
      const persistedSyncedSettings = await loadAccountSyncedSettings(
        client,
        userId,
      );

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

      if (!nextSession) {
        clearAuthenticatedState(signedOutSessionNotice);
        return;
      }

      const nextUser = await resolveAuthenticatedUser(
        client,
        nextSession,
        shouldVerifyUser,
      );

      if (!nextUser) {
        clearAuthenticatedState(signedOutSessionNotice);
        return;
      }

      const nextAccount = await bootstrapAccountRow(client, nextUser.id);
      await syncAuthenticatedSettings(client, nextUser.id);

      activeSettingsUserIdRef.current = nextUser.id;
      setSessionNotice(null);

      setSession(nextSession);
      setUser(nextUser);
      setAccount(nextAccount);
      setStatus(resolveAccountStatus(nextAccount, authEvent));
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
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError || !sessionData.session) {
        clearAuthenticatedState();
        return;
      }

      try {
        await syncAuthenticatedSession(sessionData.session, true);
      } catch (error) {
        if (isMounted) {
          clearAuthenticatedState();
        }

        console.error(error);
      }
    };

    void restoreSession();

    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      void syncAuthenticatedSession(nextSession, false, event).catch(
        (error) => {
          console.error(error);
          if (isMounted) {
            clearAuthenticatedState();
          }
        },
      );
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [clearAuthenticatedState, isConfigured, syncAuthenticatedSession]);

  return { clearAuthenticatedState, syncAuthenticatedSession };
};
