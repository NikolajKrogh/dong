import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import type {
  ImportLegacyHistoryRpcRequest,
  ImportLegacyHistoryRpcResponse,
} from "../types/legacyHistoryImport";

export interface SupabasePublicConfig {
  url: string;
  apiKey: string;
}

export interface LegacyHistoryImportRpcClient {
  importLegacyHistory(
    request: ImportLegacyHistoryRpcRequest,
  ): Promise<ImportLegacyHistoryRpcResponse>;
}

let cachedSupabaseClient: SupabaseClient | null = null;
let cachedLegacyHistoryImportRpcClient: LegacyHistoryImportRpcClient | null =
  null;

const readTrimmedEnvValue = (value: string | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
};

const readSupabaseUrl = () => {
  return readTrimmedEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
};

const readSupabaseApiKey = () => {
  return (
    readTrimmedEnvValue(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    readTrimmedEnvValue(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
  );
};

export const hasSupabasePublicConfig = () => {
  return Boolean(readSupabaseUrl() && readSupabaseApiKey());
};

export const getSupabasePublicConfig = (): SupabasePublicConfig => {
  const url = readSupabaseUrl();
  const apiKey = readSupabaseApiKey();

  if (!url || !apiKey) {
    throw new Error(
      "Missing Supabase public configuration. Set EXPO_PUBLIC_SUPABASE_URL and either EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY, or run `npm run auth:env` to bootstrap .env.local from the linked Supabase project.",
    );
  }

  return { url, apiKey };
};

export const createSupabaseClient = (
  config: SupabasePublicConfig = getSupabasePublicConfig(),
) => {
  return createClient(config.url, config.apiKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === "web",
      persistSession: true,
      storage: AsyncStorage,
    },
  });
};

export const getSupabaseClient = () => {
  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createSupabaseClient();
  }

  return cachedSupabaseClient;
};

export const createLegacyHistoryImportRpcClient = (
  client: SupabaseClient = getSupabaseClient(),
): LegacyHistoryImportRpcClient => {
  return {
    async importLegacyHistory(request) {
      const { data, error } = await client
        .rpc("import_legacy_history", {
          claimed_local_participant_id: request.claimedLocalParticipantId,
          sessions: request.sessions,
        })
        .overrideTypes<ImportLegacyHistoryRpcResponse, { merge: false }>();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Supabase import_legacy_history returned no response payload.",
        );
      }

      return data;
    },
  };
};

export const getLegacyHistoryImportRpcClient = () => {
  if (!cachedLegacyHistoryImportRpcClient) {
    cachedLegacyHistoryImportRpcClient = createLegacyHistoryImportRpcClient();
  }

  return cachedLegacyHistoryImportRpcClient;
};
