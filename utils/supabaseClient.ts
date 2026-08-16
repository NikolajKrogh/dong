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
  AssignmentMode,
  BatchRoomMatchResult,
  EndGameSessionResponse,
  ReassignParticipantMatchesInput,
  ReassignParticipantMatchesResponse,
  ReassignmentErrorCode,
  HostLeaveResponse,
  MemberLeaveResponse,
  MyActiveRoom,
  RegisteredJoinResponse,
  RoomAssignmentInput,
  RoomAssignmentSettingsRequest,
  RoomSnapshot,
} from "../types/room";
import { ReassignmentRpcError } from "../types/room";
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
  /**
   * The guest counterpart of `RoomRpcClient.setMyRoomPicks` (FR-038a). A
   * session-scoped guest has no `auth.uid()`, so the room-scoped token both
   * authenticates them and identifies which participant — and which room — the
   * picks belong to. Same replace-all semantics.
   */
  setMyRoomPicksAsGuest(guestToken: string, matchIds: string[]): Promise<void>;
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
  /**
   * Ends a running game for everyone, moving the room to `completed`.
   *
   * Distinct from {@link leaveRoomAsHost}: that hands a still-running game to a
   * successor (or closes it if there is nobody), while this finishes the game
   * itself. Host-only, `in_progress`-only, and idempotent once the room is
   * already terminal, so a double tap or two racing devices are both safe.
   */
  endGameSession(sessionId: string): Promise<EndGameSessionResponse>;
  reassignParticipantMatches(
    input: ReassignParticipantMatchesInput,
  ): Promise<ReassignParticipantMatchesResponse>;
  addRoomMatch(
    sessionId: string,
    request: AddRoomMatchRequest,
  ): Promise<string>;
  /**
   * Adds many fixtures in one round trip. Returns how many landed and how many
   * were already in the pool — a repeat is a skip, not a failure, matching
   * {@link addRoomMatch}. Prefer this over looping `addRoomMatch`: each single
   * add takes the room row's lock and triggers its own snapshot refresh.
   */
  addRoomMatches(
    sessionId: string,
    requests: AddRoomMatchRequest[],
  ): Promise<BatchRoomMatchResult>;
  removeRoomMatch(sessionId: string, matchId: string): Promise<void>;
  /** Removes many fixtures in one round trip, cascading exactly as the singular form does. */
  removeRoomMatches(sessionId: string, matchIds: string[]): Promise<void>;
  setCommonMatch(sessionId: string, matchId: string): Promise<void>;
  setRoomAssignments(
    sessionId: string,
    assignments: RoomAssignmentInput[],
  ): Promise<void>;
  setRoomAssignmentSettings(
    sessionId: string,
    settings: RoomAssignmentSettingsRequest,
  ): Promise<void>;
  setRoomAssignmentMode(
    sessionId: string,
    mode: AssignmentMode,
  ): Promise<void>;
  /**
   * Replaces the *calling* participant's own player-picked selections (FR-038).
   * Replace-all: the submitted array becomes the participant's complete set, so
   * releasing a pick means resubmitting without it. The server derives which
   * participant this is from the caller's own JWT — there is deliberately no
   * participant id to pass (FR-038a, FR-039).
   */
  setMyRoomPicks(sessionId: string, matchIds: string[]): Promise<void>;
}

/** Shared poll interval for every lobby view (host, member, guest). */
export const LOBBY_POLL_INTERVAL_MS = 4000;

const REASSIGNMENT_ERROR_MESSAGES: Record<ReassignmentErrorCode, string> = {
  not_authenticated: "Sign-in is required to change assignments.",
  room_not_found: "The room no longer exists.",
  not_host: "Only the host can change assignments.",
  host_participant_not_found:
    "The host identity is out of date. Refresh the room and try again.",
  invalid_reassignment_input:
    "Choose a valid, duplicate-free set of matches and try again.",
  game_not_in_progress: "Assignments can only change while the game is running.",
  participant_not_in_room: "That player is no longer in the room.",
  cannot_reassign_common_match:
    "The common match belongs to everyone and cannot be changed here.",
  match_not_in_room_pool: "That match is not part of this room.",
  assignment_count_mismatch:
    "Replace every existing match slot; the number of slots cannot change.",
  idempotency_key_reused:
    "This request key was already used for a different assignment change.",
};

const REASSIGNMENT_ERROR_CODES = new Set<ReassignmentErrorCode>(
  Object.keys(REASSIGNMENT_ERROR_MESSAGES) as ReassignmentErrorCode[],
);

const mapReassignmentError = (error: unknown) => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  if (!REASSIGNMENT_ERROR_CODES.has(message as ReassignmentErrorCode)) {
    return null;
  }

  const code = message as ReassignmentErrorCode;
  return new ReassignmentRpcError(code, REASSIGNMENT_ERROR_MESSAGES[code]);
};

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

    async setMyRoomPicksAsGuest(guestToken, matchIds) {
      const { error } = await client.rpc("set_my_room_picks_as_guest", {
        guest_token: guestToken,
        match_ids: matchIds,
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

    async endGameSession(sessionId) {
      const { data, error } = await client
        .rpc("end_game_session", { session_id: sessionId })
        .overrideTypes<EndGameSessionResponse, { merge: false }>();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Supabase end_game_session returned no response payload.",
        );
      }

      return data;
    },

    async reassignParticipantMatches(input) {
      const { data, error } = await client
        .rpc("reassign_participant_matches", {
          session_id: input.sessionId,
          participant_id: input.participantId,
          match_ids: input.matchIds,
          idempotency_key: input.idempotencyKey,
        })
        .overrideTypes<ReassignParticipantMatchesResponse, { merge: false }>();

      if (error) {
        throw mapReassignmentError(error) ?? error;
      }

      if (!data) {
        throw new Error(
          "Supabase reassign_participant_matches returned no response payload.",
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

    async addRoomMatches(sessionId, requests) {
      // camelCase keys: the RPC reads the payload with ->> using these exact
      // names, so the request objects travel verbatim.
      const { data, error } = await client.rpc("add_room_matches", {
        session_id: sessionId,
        matches: requests,
      });

      if (error) {
        throw error;
      }

      const result = (data ?? {}) as Partial<BatchRoomMatchResult>;
      return { added: result.added ?? 0, skipped: result.skipped ?? 0 };
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

    async removeRoomMatches(sessionId, matchIds) {
      const { error } = await client.rpc("remove_room_matches", {
        session_id: sessionId,
        match_ids: matchIds,
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

    async setRoomAssignmentSettings(sessionId, settings) {
      const { error } = await client.rpc("set_room_assignment_settings", {
        session_id: sessionId,
        matches_per_player: settings.matchesPerPlayer,
        shared_matches_per_pair: settings.sharedMatchesPerPair,
      });

      if (error) {
        throw error;
      }
    },

    async setRoomAssignmentMode(sessionId, mode) {
      const { error } = await client.rpc("set_room_assignment_mode", {
        session_id: sessionId,
        mode,
      });

      if (error) {
        throw error;
      }
    },

    async setMyRoomPicks(sessionId, matchIds) {
      const { error } = await client.rpc("set_my_room_picks", {
        session_id: sessionId,
        match_ids: matchIds,
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
