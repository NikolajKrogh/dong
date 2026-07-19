import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import type {
  GuestRoomJoinRequest,
  GuestRoomJoinResponse,
  GuestRoomSnapshot,
} from "../types/guestRoom";
import type { HostRoomCreateResponse } from "../types/hostRoom";
import type {
  AddRoomMatchRequest,
  HostLeaveResponse,
  MemberLeaveResponse,
  MyActiveRoom,
  RegisteredJoinResponse,
  RoomAssignmentInput,
  RoomSnapshot,
} from "../types/room";
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

export interface GuestRoomRpcClient {
  joinRoomAsGuest(
    request: GuestRoomJoinRequest,
  ): Promise<GuestRoomJoinResponse>;
  getGuestRoomSnapshot(guestToken: string): Promise<GuestRoomSnapshot>;
  leaveRoomAsGuest(guestToken: string): Promise<void>;
}

export interface RoomRpcClient {
  joinRoomAsRegistered(joinCode: string): Promise<RegisteredJoinResponse>;
  getRoomSnapshot(sessionId: string): Promise<RoomSnapshot>;
  getMyActiveRoom(): Promise<MyActiveRoom | null>;
  leaveRoomAsMember(sessionId: string): Promise<MemberLeaveResponse>;
  leaveRoomAsHost(
    sessionId: string,
    successorParticipantId?: string,
  ): Promise<HostLeaveResponse>;
  addRoomMatch(
    sessionId: string,
    request: AddRoomMatchRequest,
  ): Promise<string>;
  removeRoomMatch(sessionId: string, matchId: string): Promise<void>;
  setCommonMatch(sessionId: string, matchId: string): Promise<void>;
  setRoomAssignments(
    sessionId: string,
    assignments: RoomAssignmentInput[],
  ): Promise<void>;
}

/** Shared poll interval for every lobby view (host, member, guest). */
export const LOBBY_POLL_INTERVAL_MS = 4000;

export interface HostRoomRpcClient {
  createRoomAsHost(): Promise<HostRoomCreateResponse>;
}

let cachedSupabaseClient: SupabaseClient | null = null;
let cachedLegacyHistoryImportRpcClient: LegacyHistoryImportRpcClient | null =
  null;
let cachedGuestRoomRpcClient: GuestRoomRpcClient | null = null;
let cachedHostRoomRpcClient: HostRoomRpcClient | null = null;
let cachedRoomRpcClient: RoomRpcClient | null = null;

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
  cachedSupabaseClient ??= createSupabaseClient();

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
  cachedLegacyHistoryImportRpcClient ??= createLegacyHistoryImportRpcClient();

  return cachedLegacyHistoryImportRpcClient;
};

export const createGuestRoomRpcClient = (
  client: SupabaseClient = getSupabaseClient(),
): GuestRoomRpcClient => {
  return {
    async joinRoomAsGuest(request) {
      const { data, error } = await client
        .rpc("join_room_as_guest", {
          join_code: request.joinCode,
          guest_name: request.guestName,
          guest_token: request.guestToken,
        })
        .overrideTypes<GuestRoomJoinResponse, { merge: false }>();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Supabase join_room_as_guest returned no response payload.",
        );
      }

      return data;
    },

    async getGuestRoomSnapshot(guestToken) {
      const { data, error } = await client
        .rpc("get_guest_room_snapshot", {
          guest_token: guestToken,
        })
        .overrideTypes<GuestRoomSnapshot, { merge: false }>();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Supabase get_guest_room_snapshot returned no response payload.",
        );
      }

      return data;
    },

    async leaveRoomAsGuest(guestToken) {
      const { error } = await client.rpc("leave_room_as_guest", {
        guest_token: guestToken,
      });

      if (error) {
        throw error;
      }
    },
  };
};

export const getGuestRoomRpcClient = () => {
  cachedGuestRoomRpcClient ??= createGuestRoomRpcClient();

  return cachedGuestRoomRpcClient;
};

export const createHostRoomRpcClient = (
  client: SupabaseClient = getSupabaseClient(),
): HostRoomRpcClient => {
  return {
    async createRoomAsHost() {
      const { data, error } = await client
        .rpc("create_room_as_host")
        .overrideTypes<HostRoomCreateResponse, { merge: false }>();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Supabase create_room_as_host returned no response payload.",
        );
      }

      return data;
    },
  };
};

export const getHostRoomRpcClient = () => {
  cachedHostRoomRpcClient ??= createHostRoomRpcClient();

  return cachedHostRoomRpcClient;
};

export const createRoomRpcClient = (
  client: SupabaseClient = getSupabaseClient(),
): RoomRpcClient => {
  return {
    async joinRoomAsRegistered(joinCode) {
      const { data, error } = await client
        .rpc("join_room_as_registered", { join_code: joinCode })
        .overrideTypes<RegisteredJoinResponse, { merge: false }>();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Supabase join_room_as_registered returned no response payload.",
        );
      }

      return data;
    },

    async getRoomSnapshot(sessionId) {
      const { data, error } = await client
        .rpc("get_room_snapshot", { session_id: sessionId })
        .overrideTypes<RoomSnapshot, { merge: false }>();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Supabase get_room_snapshot returned no response payload.",
        );
      }

      return data;
    },

    async getMyActiveRoom() {
      const { data, error } = await client
        .rpc("get_my_active_room")
        .overrideTypes<MyActiveRoom | null, { merge: false }>();

      if (error) {
        throw error;
      }

      return data ?? null;
    },

    async leaveRoomAsMember(sessionId) {
      const { data, error } = await client
        .rpc("leave_room_as_member", { session_id: sessionId })
        .overrideTypes<MemberLeaveResponse, { merge: false }>();

      if (error) {
        throw error;
      }

      return data ?? { sessionId, status: "left" };
    },

    async leaveRoomAsHost(sessionId, successorParticipantId) {
      const { data, error } = await client
        .rpc("leave_room_as_host", {
          session_id: sessionId,
          successor_participant_id: successorParticipantId ?? null,
        })
        .overrideTypes<HostLeaveResponse, { merge: false }>();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Supabase leave_room_as_host returned no response payload.",
        );
      }

      return data;
    },

    async addRoomMatch(sessionId, request) {
      const { data, error } = await client.rpc("add_room_match", {
        session_id: sessionId,
        source_provider: request.sourceProvider,
        source_match_id: request.sourceMatchId,
        home_team_name: request.homeTeamName,
        away_team_name: request.awayTeamName,
        kickoff_at: request.kickoffAt,
      });

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("Supabase add_room_match returned no response payload.");
      }

      return data as string;
    },

    async removeRoomMatch(sessionId, matchId) {
      const { error } = await client.rpc("remove_room_match", {
        session_id: sessionId,
        match_id: matchId,
      });

      if (error) {
        throw error;
      }
    },

    async setCommonMatch(sessionId, matchId) {
      const { error } = await client.rpc("set_common_match", {
        session_id: sessionId,
        match_id: matchId,
      });

      if (error) {
        throw error;
      }
    },

    async setRoomAssignments(sessionId, assignments) {
      const { error } = await client.rpc("set_room_assignments", {
        session_id: sessionId,
        assignments: assignments.map((assignment) => ({
          participantId: assignment.participantId,
          matchId: assignment.matchId,
        })),
      });

      if (error) {
        throw error;
      }
    },
  };
};

export const getRoomRpcClient = () => {
  cachedRoomRpcClient ??= createRoomRpcClient();

  return cachedRoomRpcClient;
};
