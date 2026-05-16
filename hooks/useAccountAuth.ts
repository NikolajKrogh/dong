import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import {
  applySyncedPreferenceState,
  getCurrentSyncedPreferenceState,
  hydrateSyncedPreferenceState,
  serializeSyncedPreferenceState,
  type SyncedPreferenceState,
  useGameStore,
} from "../store/store";
import {
  getSupabaseClient,
  getSupabasePublicConfig,
  hasSupabasePublicConfig,
} from "../utils/supabaseClient";

const ACCOUNT_SELECT_COLUMNS =
  "id, preferred_display_name, username, created_at, updated_at";
const SETTINGS_SELECT_COLUMNS =
  "account_id, settings_data, created_at, updated_at";

export type AccountAuthStatus =
  | "loading"
  | "signedOut"
  | "needsDisplayName"
  | "ready"
  | "recoveringPassword";

export const SESSION_EXPIRED_MESSAGE =
  "Your session ended. Sign in again to keep managing your profile and synced settings.";

interface AccountRow {
  id: string;
  preferred_display_name: string | null;
  username: string | null;
  created_at: string;
  updated_at: string | null;
}

interface AccountSyncedSettingsRow {
  account_id: string;
  settings_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  preferredDisplayName: string | null;
  username: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface AccountSyncedSettings {
  accountId: string;
  settings: SyncedPreferenceState;
  createdAt: string;
  updatedAt: string;
}

export interface AccountProfileInput {
  displayName: string;
  username: string;
}

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
  saveProfile: (profile: AccountProfileInput) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  requestPasswordReset: (
    email: string,
    returnTo?: string | null,
  ) => Promise<void>;
  completePasswordRecovery: (newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AccountAuthContext = createContext<AccountAuthContextValue | null>(null);

const normalizeOptionalAccountText = (value: string | null | undefined) => {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue.length > 0 ? trimmedValue : null;
};

export const normalizeAccountDisplayName = (
  value: string | null | undefined,
) => normalizeOptionalAccountText(value);

export const normalizeAccountUsername = (
  value: string | null | undefined,
) => normalizeOptionalAccountText(value);

export const normalizeAccountFlowReturnTo = (
  value: string | string[] | null | undefined,
): string | null => {
  if (Array.isArray(value)) {
    return normalizeAccountFlowReturnTo(value[0]);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.startsWith("/") ? trimmedValue : null;
};

export const buildAccountAuthRoute = (
  route:
    | "/auth"
    | "/auth/onboarding"
    | "/auth/reset-password"
    | "/auth/change-password",
  returnTo?: string | null,
  extraParams?: Record<string, string>,
): string => {
  const normalizedReturnTo = normalizeAccountFlowReturnTo(returnTo);
  const params: string[] = [];
  if (normalizedReturnTo) {
    params.push(`returnTo=${encodeURIComponent(normalizedReturnTo)}`);
  }
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return params.length > 0 ? `${route}?${params.join("&")}` : route;
};

export const buildAccountAuthRedirectUrl = (
  route:
    | "/auth"
    | "/auth/onboarding"
    | "/auth/reset-password"
    | "/auth/change-password",
  returnTo?: string | null,
) => Linking.createURL(buildAccountAuthRoute(route, returnTo));

const mapAccountRow = (row: AccountRow): Account => ({
  id: row.id,
  preferredDisplayName: normalizeAccountDisplayName(row.preferred_display_name),
  username: normalizeAccountUsername(row.username),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapAccountSyncedSettingsRow = (
  row: AccountSyncedSettingsRow,
): AccountSyncedSettings => ({
  accountId: row.account_id,
  settings: hydrateSyncedPreferenceState(row.settings_data),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildSyncedPreferenceSignature = (settings: SyncedPreferenceState) =>
  JSON.stringify(serializeSyncedPreferenceState(settings));

const setSignedOutState = (
  setStatus: React.Dispatch<React.SetStateAction<AccountAuthStatus>>,
  setSession: React.Dispatch<React.SetStateAction<Session | null>>,
  setUser: React.Dispatch<React.SetStateAction<User | null>>,
  setAccount: React.Dispatch<React.SetStateAction<Account | null>>,
) => {
  setStatus("signedOut");
  setSession(null);
  setUser(null);
  setAccount(null);
};

export const bootstrapAccountRow = async (
  client: SupabaseClient,
  userId: string,
) => {
  const { data: existingAccount, error: fetchError } = await client
    .from("accounts")
    .select(ACCOUNT_SELECT_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (existingAccount) {
    return mapAccountRow(existingAccount);
  }

  const { error: insertError } = await client.from("accounts").insert({
    id: userId,
  });

  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }

  const { data: bootstrappedAccount, error: refetchError } = await client
    .from("accounts")
    .select(ACCOUNT_SELECT_COLUMNS)
    .eq("id", userId)
    .single();

  if (refetchError || !bootstrappedAccount) {
    throw refetchError ?? new Error("Unable to bootstrap the account.");
  }

  return mapAccountRow(bootstrappedAccount);
};

export const saveAccountDisplayName = async (
  client: SupabaseClient,
  userId: string,
  displayName: string,
) => {
  const trimmedDisplayName = normalizeAccountDisplayName(displayName);

  if (!trimmedDisplayName) {
    throw new Error("Account display name cannot be blank.");
  }

  const { data: updatedAccount, error: updateError } = await client
    .from("accounts")
    .update({
      preferred_display_name: trimmedDisplayName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select(ACCOUNT_SELECT_COLUMNS)
    .single();

  if (updateError || !updatedAccount) {
    throw (
      updateError ?? new Error("Unable to update the account display name.")
    );
  }

  return mapAccountRow(updatedAccount);
};

export const saveAccountProfile = async (
  client: SupabaseClient,
  userId: string,
  profile: AccountProfileInput,
) => {
  const trimmedDisplayName = normalizeAccountDisplayName(profile.displayName);

  if (!trimmedDisplayName) {
    throw new Error("Account display name cannot be blank.");
  }

  const trimmedUsername = normalizeAccountUsername(profile.username);

  if (!trimmedUsername) {
    throw new Error("Account username cannot be blank.");
  }

  const { data: updatedAccount, error: updateError } = await client
    .from("accounts")
    .update({
      preferred_display_name: trimmedDisplayName,
      username: trimmedUsername,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select(ACCOUNT_SELECT_COLUMNS)
    .single();

  if (updateError || !updatedAccount) {
    throw updateError ?? new Error("Unable to update the account profile.");
  }

  return mapAccountRow(updatedAccount);
};

export const loadAccountSyncedSettings = async (
  client: SupabaseClient,
  userId: string,
) => {
  const { data: existingSettings, error: fetchError } = await client
    .from("settings")
    .select(SETTINGS_SELECT_COLUMNS)
    .eq("account_id", userId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!existingSettings) {
    return null;
  }

  return mapAccountSyncedSettingsRow(existingSettings);
};

export const saveAccountSyncedSettings = async (
  client: SupabaseClient,
  userId: string,
  settings: SyncedPreferenceState,
) => {
  const { data: updatedSettings, error: updateError } = await client
    .from("settings")
    .upsert(
      {
        account_id: userId,
        settings_data: serializeSyncedPreferenceState(settings),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" },
    )
    .select(SETTINGS_SELECT_COLUMNS)
    .single();

  if (updateError || !updatedSettings) {
    throw updateError ?? new Error("Unable to update the account settings.");
  }

  return mapAccountSyncedSettingsRow(updatedSettings);
};

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

  const clearAuthenticatedState = useCallback((nextSessionNotice: string | null = null) => {
    pendingManualSignOutRef.current = false;
    activeSettingsUserIdRef.current = null;
    lastSyncedPreferenceSignatureRef.current = null;
    setSessionNotice(nextSessionNotice);
    setSignedOutState(setStatus, setSession, setUser, setAccount);
  }, []);

  const getSignedOutSessionNotice = useCallback(() =>
    !pendingManualSignOutRef.current && activeSettingsUserIdRef.current !== null
      ? SESSION_EXPIRED_MESSAGE
      : null, []);

  const resolveAuthenticatedUser = useCallback(async (
    client: SupabaseClient,
    nextSession: Session,
    shouldVerifyUser: boolean,
  ) => {
    let nextUser = nextSession.user ?? null;

    if (shouldVerifyUser || !nextUser) {
      const { data: userData, error: userError } = await client.auth.getUser();

      if (userError || !userData.user) {
        return null;
      }

      nextUser = userData.user;
    }

    return nextUser;
  }, []);

  const syncAuthenticatedSettings = useCallback(async (
    client: SupabaseClient,
    userId: string,
  ) => {
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

      lastSyncedPreferenceSignatureRef.current = buildSyncedPreferenceSignature(
        appliedSyncedPreferences,
      );
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
  }, []);

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

  const syncAuthenticatedSession = useCallback(async (
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
  }, [
    clearAuthenticatedState,
    getSignedOutSessionNotice,
    resolveAuthenticatedUser,
    syncAuthenticatedSettings,
  ]);

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

  useEffect(() => {
    if (!isConfigured || !user || !activeSettingsUserIdRef.current) {
      return;
    }

    const client = getSupabaseClient();

    return useGameStore.subscribe((state) => {
      if (activeSettingsUserIdRef.current !== user.id) {
        return;
      }

      const nextPreferences = serializeSyncedPreferenceState(state);
      const nextPreferenceSignature = buildSyncedPreferenceSignature(
        nextPreferences,
      );

      if (nextPreferenceSignature === lastSyncedPreferenceSignatureRef.current) {
        return;
      }

      const previousPreferenceSignature =
        lastSyncedPreferenceSignatureRef.current;

      lastSyncedPreferenceSignatureRef.current = nextPreferenceSignature;

      void saveAccountSyncedSettings(client, user.id, nextPreferences).catch(
        (error) => {
          lastSyncedPreferenceSignatureRef.current = previousPreferenceSignature;
          console.error(error);
        },
      );
    });
  }, [isConfigured, user]);

  useEffect(() => {
    if (!isConfigured || typeof window === "undefined") {
      return;
    }

    const browserWindow = window as Window & { __DONG_E2E__?: boolean };

    if (!browserWindow.__DONG_E2E__) {
      return;
    }

    const handleSessionExpired = () => {
      if (!activeSettingsUserIdRef.current) {
        return;
      }

      clearAuthenticatedState(SESSION_EXPIRED_MESSAGE);
    };

    window.addEventListener("dong:e2e:session-expired", handleSessionExpired);

    return () => {
      window.removeEventListener(
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

  const saveProfile = async (profile: AccountProfileInput) => {
    const client = getSupabaseClient();

    if (!user) {
      throw new Error(
        "Cannot save an account profile without a signed-in account.",
      );
    }

    const nextAccount = await saveAccountProfile(client, user.id, profile);

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
    const response = await fetch(
      `${config.url}/functions/v1/delete-account`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
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
        saveProfile,
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
