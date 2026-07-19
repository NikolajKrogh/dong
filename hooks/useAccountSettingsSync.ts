import type { User } from "@supabase/supabase-js";
import { useEffect, type MutableRefObject } from "react";

import { serializeSyncedPreferenceState, useGameStore } from "../store/store";
import {
  buildSyncedPreferenceSignature,
  saveAccountSyncedSettings,
} from "../utils/accountRepository";
import { getSupabaseClient } from "../utils/supabaseClient";

interface UseAccountSettingsSyncParams {
  isConfigured: boolean;
  user: User | null;
  activeSettingsUserIdRef: MutableRefObject<string | null>;
  lastSyncedPreferenceSignatureRef: MutableRefObject<string | null>;
}

/** Subscribes to store changes and persists them to the account's synced settings row. */
export const useAccountSettingsSync = ({
  isConfigured,
  user,
  activeSettingsUserIdRef,
  lastSyncedPreferenceSignatureRef,
}: UseAccountSettingsSyncParams) => {
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
      const nextPreferenceSignature =
        buildSyncedPreferenceSignature(nextPreferences);

      if (
        nextPreferenceSignature === lastSyncedPreferenceSignatureRef.current
      ) {
        return;
      }

      const previousPreferenceSignature =
        lastSyncedPreferenceSignatureRef.current;

      lastSyncedPreferenceSignatureRef.current = nextPreferenceSignature;

      void saveAccountSyncedSettings(client, user.id, nextPreferences).catch(
        (error) => {
          lastSyncedPreferenceSignatureRef.current =
            previousPreferenceSignature;
          console.error(error);
        },
      );
    });
  }, [
    isConfigured,
    user,
    activeSettingsUserIdRef,
    lastSyncedPreferenceSignatureRef,
  ]);
};
