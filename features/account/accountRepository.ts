import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database";

import {
  hydrateSyncedPreferenceState,
  serializeSyncedPreferenceState,
  type SyncedPreferenceState,
} from "../../store/store";
import { normalizeAccountUsername } from "./username";

const SETTINGS_SELECT_COLUMNS =
  "account_id, settings_data, created_at, updated_at";

type AccountRow = Pick<Database['public']['Tables']['accounts']['Row'], 'id' | 'username' | 'created_at' | 'updated_at'>;

type AccountSyncedSettingsRow = Database['public']['Tables']['settings']['Row'];

export interface Account {
  id: string;
  username: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AccountSyncedSettings {
  accountId: string;
  settings: SyncedPreferenceState;
  createdAt: string | null;
  updatedAt: string | null;
}

const mapAccountRow = (row: AccountRow): Account => ({
  id: row.id,
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

export const buildSyncedPreferenceSignature = (
  settings: SyncedPreferenceState,
) => JSON.stringify(serializeSyncedPreferenceState(settings));

export const bootstrapAccountRow = async (
  client: SupabaseClient<Database>,
  userId: string,
) => {
  const { data: bootstrappedAccount, error } = await client
    .rpc("bootstrap_account")
    .single();

  if (error || !bootstrappedAccount) {
    throw error ?? new Error("Unable to bootstrap the account.");
  }

  if (bootstrappedAccount.id !== userId) {
    throw new Error("Account changed. Sign in again.");
  }

  return mapAccountRow(bootstrappedAccount);
};

export const saveAccountUsername = async (
  client: SupabaseClient<Database>,
  userId: string,
  username: string,
) => {
  const normalizedUsername = normalizeAccountUsername(username);

  if (!normalizedUsername) {
    throw new Error("Username cannot be blank.");
  }

  const { data: updatedAccount, error: updateError } = await client
    .rpc("set_account_username", { requested_username: normalizedUsername })
    .single();

  if (updateError || !updatedAccount) {
    throw (
      updateError ? new Error(updateError.message === 'username_unavailable'
        ? 'That username is already taken. Choose another.'
        : updateError.message === 'invalid_username'
          ? 'Use 3–30 letters, numbers, or underscores.' : updateError.message)
        : new Error("Unable to update the username.")
    );
  }

  if (updatedAccount.id !== userId) throw new Error('Account changed. Sign in again.');
  return mapAccountRow(updatedAccount);
};

export const loadAccountSyncedSettings = async (
  client: SupabaseClient<Database>,
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
  client: SupabaseClient<Database>,
  userId: string,
  settings: SyncedPreferenceState,
) => {
  const { data: updatedSettings, error: updateError } = await client
    .from("settings")
    .upsert(
      {
        account_id: userId,
        settings_data: { ...serializeSyncedPreferenceState(settings), configuredLeagues: settings.configuredLeagues.map(league => ({ ...league })), defaultSelectedLeagues: settings.defaultSelectedLeagues.map(league => ({ ...league })) },
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
