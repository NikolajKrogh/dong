import type { User } from "@supabase/supabase-js";
import { useEffect, type MutableRefObject } from "react";

import { serializeSyncedPreferenceState, useGameStore } from "../../store/store";
import {
  buildSyncedPreferenceSignature,
  saveAccountSyncedSettings,
} from './accountRepository';
import { getSupabaseClient } from "../../lib/supabase";
import { getAccountScope, isCurrentAccountScope } from '../../lib/queryClient';

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

    const sync = (state: ReturnType<typeof useGameStore.getState>) => {
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
      const scope = getAccountScope();

      lastSyncedPreferenceSignatureRef.current = nextPreferenceSignature;

      void saveAccountSyncedSettings(client, user.id, nextPreferences).catch(
        (error) => {
          if (!isCurrentAccountScope(scope)) return;
          lastSyncedPreferenceSignatureRef.current =
            previousPreferenceSignature;
          console.error(error);
        },
      );
    };
    const unsubscribe = useGameStore.subscribe(sync);
    sync(useGameStore.getState());
    return unsubscribe;
  }, [
    isConfigured,
    user,
    activeSettingsUserIdRef,
    lastSyncedPreferenceSignatureRef,
  ]);
};
