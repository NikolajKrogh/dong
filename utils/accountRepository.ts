import type { SupabaseClient } from "@supabase/supabase-js";

import {
  hydrateSyncedPreferenceState,
  serializeSyncedPreferenceState,
  type SyncedPreferenceState,
} from "../store/store";
import { normalizeAccountDisplayName } from "./accountAuthRoutes";

const ACCOUNT_SELECT_COLUMNS =
  "id, preferred_display_name, created_at, updated_at";
const SETTINGS_SELECT_COLUMNS =
  "account_id, settings_data, created_at, updated_at";

interface AccountRow {
  id: string;
  preferred_display_name: string | null;
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
  createdAt: string;
  updatedAt: string | null;
}

export interface AccountSyncedSettings {
  accountId: string;
  settings: SyncedPreferenceState;
  createdAt: string;
  updatedAt: string;
}

const mapAccountRow = (row: AccountRow): Account => ({
  id: row.id,
  preferredDisplayName: normalizeAccountDisplayName(row.preferred_display_name),
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
