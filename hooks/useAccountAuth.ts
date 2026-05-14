import * as Linking from "expo-linking";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";

import { getSupabaseClient, hasSupabasePublicConfig } from "../utils/supabaseClient";

const ACCOUNT_SELECT_COLUMNS =
  "id, preferred_display_name, created_at, updated_at";

export type AccountAuthStatus =
  | "loading"
  | "signedOut"
  | "needsDisplayName"
  | "ready"
  | "recoveringPassword";

interface AccountRow {
  id: string;
  preferred_display_name: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Account {
  id: string;
  preferredDisplayName: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface AccountAuthContextValue {
  status: AccountAuthStatus;
  session: Session | null;
  user: User | null;
  account: Account | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveDisplayName: (displayName: string) => Promise<void>;
  requestPasswordReset: (
    email: string,
    returnTo?: string | null,
  ) => Promise<void>;
  completePasswordRecovery: (newPassword: string) => Promise<void>;
}

const AccountAuthContext = createContext<AccountAuthContextValue | null>(null);

export const normalizeAccountDisplayName = (
  value: string | null | undefined,
) => {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue.length > 0 ? trimmedValue : null;
};

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
  route: "/auth" | "/auth/onboarding" | "/auth/reset-password",
  returnTo?: string | null,
): string => {
  const normalizedReturnTo = normalizeAccountFlowReturnTo(returnTo);

  return normalizedReturnTo
    ? `${route}?returnTo=${encodeURIComponent(normalizedReturnTo)}`
    : route;
};

const mapAccountRow = (row: AccountRow): Account => ({
  id: row.id,
  preferredDisplayName: normalizeAccountDisplayName(
    row.preferred_display_name,
  ),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

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
    return mapAccountRow(existingAccount as AccountRow);
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

  return mapAccountRow(bootstrappedAccount as AccountRow);
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
    throw updateError ?? new Error("Unable to update the account display name.");
  }

  return mapAccountRow(updatedAccount as AccountRow);
};

export const AccountAuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const isConfigured = hasSupabasePublicConfig();
  const [status, setStatus] = useState<AccountAuthStatus>(
    isConfigured ? "loading" : "signedOut",
  );
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);

  const syncAuthenticatedSession = async (
    nextSession: Session | null,
    shouldVerifyUser = false,
    authEvent?: AuthChangeEvent,
  ) => {
    const client = getSupabaseClient();

    if (!nextSession) {
      setSignedOutState(setStatus, setSession, setUser, setAccount);
      return;
    }

    let nextUser = nextSession.user ?? null;

    if (shouldVerifyUser || !nextUser) {
      const { data: userData, error: userError } = await client.auth.getUser();

      if (userError || !userData.user) {
        setSignedOutState(setStatus, setSession, setUser, setAccount);
        return;
      }

      nextUser = userData.user;
    }

    if (!nextUser) {
      setSignedOutState(setStatus, setSession, setUser, setAccount);
      return;
    }

    const nextAccount = await bootstrapAccountRow(client, nextUser.id);

    setSession(nextSession);
    setUser(nextUser);
    setAccount(nextAccount);
    let nextStatus: AccountAuthStatus;

    if (authEvent === "PASSWORD_RECOVERY") {
      nextStatus = "recoveringPassword";
    } else if (normalizeAccountDisplayName(nextAccount.preferredDisplayName)) {
      nextStatus = "ready";
    } else {
      nextStatus = "needsDisplayName";
    }

    setStatus(nextStatus);
  };

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
        setSignedOutState(setStatus, setSession, setUser, setAccount);
        return;
      }

      try {
        await syncAuthenticatedSession(sessionData.session, true);
      } catch (error) {
        if (isMounted) {
          setSignedOutState(setStatus, setSession, setUser, setAccount);
        }

        console.error(error);
      }
    };

    void restoreSession();

    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      void syncAuthenticatedSession(nextSession, false, event).catch((error) => {
        console.error(error);
        if (isMounted) {
          setSignedOutState(setStatus, setSession, setUser, setAccount);
        }
      });
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [isConfigured]);

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
      setSignedOutState(setStatus, setSession, setUser, setAccount);
      return;
    }

    await syncAuthenticatedSession(data.session, false);
  };

  const signUp = async (email: string, password: string) => {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      throw error;
    }

    if (!data.session) {
      setSignedOutState(setStatus, setSession, setUser, setAccount);
      return;
    }

    await syncAuthenticatedSession(data.session, false);
  };

  const signOut = async () => {
    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();

    if (error) {
      throw error;
    }

    setSignedOutState(setStatus, setSession, setUser, setAccount);
  };

  const saveDisplayName = async (displayName: string) => {
    const client = getSupabaseClient();

    if (!user) {
      throw new Error("Cannot save a display name without a signed-in account.");
    }

    const nextAccount = await saveAccountDisplayName(client, user.id, displayName);

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
      redirectTo: Linking.createURL(
        buildAccountAuthRoute("/auth/reset-password", returnTo),
      ),
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

  return React.createElement(
    AccountAuthContext.Provider,
    {
      value: {
        status,
        session,
        user,
        account,
        signIn,
        signUp,
        signOut,
        saveDisplayName,
        requestPasswordReset,
        completePasswordRecovery,
      },
    },
    children,
  );
};

export const useAccountAuth = () => {
  const context = useContext(AccountAuthContext);

  if (!context) {
    throw new Error("useAccountAuth must be used within an AccountAuthProvider.");
  }

  return context;
};