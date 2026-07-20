import type { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  saveAccountDisplayName,
  type Account,
} from "../utils/accountRepository";
import { buildAccountAuthRedirectUrl } from "../utils/accountAuthRoutes";
import {
  getSupabaseClient,
  getSupabasePublicConfig,
  hasSupabasePublicConfig,
} from "../utils/supabaseClient";
import { useAccountSessionSync } from "./useAccountSessionSync";
import { useAccountSettingsSync } from "./useAccountSettingsSync";

export type { Account, AccountSyncedSettings } from "../utils/accountRepository";
export {
  bootstrapAccountRow,
  loadAccountSyncedSettings,
  saveAccountDisplayName,
  saveAccountSyncedSettings,
} from "../utils/accountRepository";
export {
  buildAccountAuthRedirectUrl,
  buildAccountAuthRoute,
  normalizeAccountDisplayName,
  normalizeAccountFlowReturnTo,
} from "../utils/accountAuthRoutes";

export type AccountAuthStatus =
  | "loading"
  | "signedOut"
  | "needsDisplayName"
  | "ready"
  | "recoveringPassword";

export const SESSION_EXPIRED_MESSAGE =
  "Your session ended. Sign in again to keep managing your profile and synced settings.";

export interface AccountAuthContextValue {
  status: AccountAuthStatus;
  session: Session | null;
  sessionNotice: string | null;
  user: User | null;
  account: Account | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    returnTo?: string | null,
  ) => Promise<void>;
  verifySignupOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveDisplayName: (displayName: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  requestPasswordReset: (
    email: string,
    returnTo?: string | null,
  ) => Promise<void>;
  completePasswordRecovery: (newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AccountAuthContext = createContext<AccountAuthContextValue | null>(null);

export const AccountAuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const isConfigured = hasSupabasePublicConfig();
  const [status, setStatus] = useState<AccountAuthStatus>(
    isConfigured ? "loading" : "signedOut",
  );
  const [session, setSession] = useState<Session | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const activeSettingsUserIdRef = useRef<string | null>(null);
  const lastSyncedPreferenceSignatureRef = useRef<string | null>(null);
  const pendingManualSignOutRef = useRef(false);

  const { clearAuthenticatedState, syncAuthenticatedSession } =
    useAccountSessionSync({
      isConfigured,
      sessionExpiredMessage: SESSION_EXPIRED_MESSAGE,
      activeSettingsUserIdRef,
      lastSyncedPreferenceSignatureRef,
      pendingManualSignOutRef,
      setStatus,
      setSession,
      setSessionNotice,
      setUser,
      setAccount,
    });

  useAccountSettingsSync({
    isConfigured,
    user,
    activeSettingsUserIdRef,
    lastSyncedPreferenceSignatureRef,
  });

  useEffect(() => {
    if (!isConfigured || !globalThis.window) {
      return;
    }

    const browserWindow = globalThis.window as Window & {
      __DONG_E2E__?: boolean;
    };

    if (!browserWindow.__DONG_E2E__) {
      return;
    }

    const handleSessionExpired = () => {
      if (!activeSettingsUserIdRef.current) {
        return;
      }

      clearAuthenticatedState(SESSION_EXPIRED_MESSAGE);
    };

    globalThis.window.addEventListener(
      "dong:e2e:session-expired",
      handleSessionExpired,
    );

    return () => {
      globalThis.window.removeEventListener(
        "dong:e2e:session-expired",
        handleSessionExpired,
      );
    };
  }, [clearAuthenticatedState, isConfigured]);

  const signIn = async (email: string, password: string) => {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw error;
    }

    if (!data.session) {
      clearAuthenticatedState();
      return;
    }

    await syncAuthenticatedSession(data.session, false);
  };

  const signUp = async (
    email: string,
    password: string,
    returnTo?: string | null,
  ) => {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: buildAccountAuthRedirectUrl("/auth", returnTo),
      },
    });

    if (error) {
      throw error;
    }

    if (!data.session) {
      clearAuthenticatedState();
      return;
    }

    await syncAuthenticatedSession(data.session, false);
  };

  const verifySignupOtp = async (email: string, token: string) => {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: "signup",
    });

    if (error) {
      throw error;
    }

    if (data.session) {
      await syncAuthenticatedSession(data.session, false);
    }
  };

  const signOut = async () => {
    const client = getSupabaseClient();
    pendingManualSignOutRef.current = true;
    const { error } = await client.auth.signOut();

    if (error) {
      pendingManualSignOutRef.current = false;
      throw error;
    }

    clearAuthenticatedState();
  };

  const saveDisplayName = async (displayName: string) => {
    const client = getSupabaseClient();

    if (!user) {
      throw new Error(
        "Cannot save a display name without a signed-in account.",
      );
    }

    const nextAccount = await saveAccountDisplayName(
      client,
      user.id,
      displayName,
    );

    setAccount(nextAccount);
    setStatus("ready");
  };

  const requestPasswordReset = async (
    email: string,
    returnTo?: string | null,
  ) => {
    const client = getSupabaseClient();

    setStatus("recoveringPassword");

    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: buildAccountAuthRedirectUrl("/auth/reset-password", returnTo),
    });

    setStatus("signedOut");

    if (error) {
      throw error;
    }
  };

  const completePasswordRecovery = async (newPassword: string) => {
    const client = getSupabaseClient();
    const trimmedPassword = newPassword.trim();

    if (!trimmedPassword) {
      throw new Error("Password cannot be blank.");
    }

    if (!user) {
      throw new Error(
        "Cannot complete password recovery without an authenticated account.",
      );
    }

    const { error: updateError } = await client.auth.updateUser({
      password: trimmedPassword,
    });

    if (updateError) {
      throw updateError;
    }

    await signOut();
  };

  const changePassword = async (newPassword: string) => {
    const client = getSupabaseClient();
    const trimmedPassword = newPassword.trim();

    if (!trimmedPassword) {
      throw new Error("Password cannot be blank.");
    }

    const { error } = await client.auth.updateUser({
      password: trimmedPassword,
    });

    if (error) {
      throw error;
    }
  };

  const deleteAccount = async () => {
    if (!session) {
      throw new Error("Cannot delete account without an active session.");
    }

    const config = getSupabasePublicConfig();
    const response = await fetch(`${config.url}/functions/v1/delete-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(body.error ?? "Failed to delete account.");
    }

    clearAuthenticatedState();
  };

  return React.createElement(
    AccountAuthContext.Provider,
    {
      value: {
        status,
        session,
        sessionNotice,
        user,
        account,
        signIn,
        signUp,
        verifySignupOtp,
        signOut,
        saveDisplayName,
        changePassword,
        requestPasswordReset,
        completePasswordRecovery,
        deleteAccount,
      },
    },
    children,
  );
};

export const useAccountAuth = () => {
  const context = useContext(AccountAuthContext);

  if (!context) {
    throw new Error(
      "useAccountAuth must be used within an AccountAuthProvider.",
    );
  }

  return context;
};
