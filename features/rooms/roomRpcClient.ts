import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabase";
import type { Database } from "../../types/database";
import type { Json } from "../../types/database.types";
import { createRoomGameplayOperations } from "./roomGameplayOperations";
import { withRoomProcessingRetry } from "./roomRpcErrors";

import type {
  AddRoomMatchRequest,
  AssignmentMode,
  BatchRoomMatchResult,
  EndGameSessionResponse,
  GameplayActionResult,
  HostLeaveResponse,
  MemberLeaveResponse,
  MyActiveRoom,
  ReassignParticipantMatchesInput,
  ReassignParticipantMatchesResponse,
  RegisteredJoinResponse,
  RoomAssignmentInput,
  RoomAssignmentSettingsRequest,
  RoomSnapshot,
  SaveRunningGameInput
} from "../../types/room";

export interface RoomRpcClient {
  saveRunningGameConfiguration(input: SaveRunningGameInput): Promise<RoomSnapshot>;
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
  changeManualScore(input: {
    sessionId: string;
    matchId: string;
    team: "home" | "away";
    deltaGoals: -1 | 1;
    idempotencyKey: string;
  }): Promise<GameplayActionResult>;
  changeParticipantDrink(input: {
    sessionId: string;
    participantId: string;
    deltaHalfDrinks: -1 | 1;
    idempotencyKey: string;
  }): Promise<GameplayActionResult>;
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
let cachedRoomRpcClient: RoomRpcClient | null = null;

export const createRoomRpcClient = (
  client: SupabaseClient<Database> = getSupabaseClient(),
): RoomRpcClient => {
  return {
 ...createRoomGameplayOperations(client),
    async joinRoomAsRegistered(joinCode) {
      const { data, error } = await client
        .rpc("join_room_as_registered", { join_code: joinCode })
        .overrideTypes<RegisteredJoinResponse, { merge: false }>();

      if (error) {
        throw error;
      }

      if (!data || typeof data !== "object" || Array.isArray(data) || "Error" in data) {
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

      if (!data || typeof data !== "object" || Array.isArray(data) || "Error" in data) {
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

      if (data && (typeof data !== "object" || Array.isArray(data) || "Error" in data)) {
        throw new Error("Invalid active room response.");
      }
      return data ?? null;
    },

    async leaveRoomAsMember(sessionId) {
      const { data, error } = await withRoomProcessingRetry(() => client
        .rpc("leave_room_as_member", { session_id: sessionId })
        .overrideTypes<MemberLeaveResponse, { merge: false }>());

      if (error) {
        throw error;
      }

      if (data && (typeof data !== "object" || Array.isArray(data) || "Error" in data)) {
        throw new Error("Invalid member departure response.");
      }
      return data ?? { sessionId, status: "left" };
    },

    async leaveRoomAsHost(sessionId, successorParticipantId) {
      const { data, error } = await withRoomProcessingRetry(() => client
        .rpc("leave_room_as_host", {
          session_id: sessionId,
          successor_participant_id: successorParticipantId ?? undefined,
        })
        .overrideTypes<HostLeaveResponse, { merge: false }>());

      if (error) {
        throw error;
      }

      if (!data || typeof data !== "object" || Array.isArray(data) || "Error" in data) {
        throw new Error(
          "Supabase leave_room_as_host returned no response payload.",
        );
      }

      return data;
    },

    async endGameSession(sessionId) {
      const { data, error } = await withRoomProcessingRetry(() => client
        .rpc("end_game_session", { session_id: sessionId })
        .overrideTypes<EndGameSessionResponse, { merge: false }>());

      if (error) {
        throw error;
      }

      if (!data || typeof data !== "object" || Array.isArray(data) || "Error" in data) {
        throw new Error(
          "Supabase end_game_session returned no response payload.",
        );
      }

      return data;
    },

    async saveRunningGameConfiguration(input) {
      const { data, error } = await withRoomProcessingRetry(() => client.rpc("save_running_game_configuration", {
        session_id: input.sessionId,
        configuration: input.configuration as unknown as Json,
        expected_token: input.expectedToken,
        idempotency_key: input.idempotencyKey,
      }).overrideTypes<RoomSnapshot, { merge: false }>());
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data) || "Error" in data) {
        throw new Error("No saved room configuration was returned.");
      }
      return data;
    },

    async addRoomMatch(sessionId, request) {
      const args = {
        session_id: sessionId,
        source_provider: request.sourceProvider,
        source_match_id: request.sourceMatchId,
        home_team_name: request.homeTeamName,
        away_team_name: request.awayTeamName,
        kickoff_at: request.kickoffAt,
        ...(request.sourceLeagueCode
          ? { source_league_code: request.sourceLeagueCode }
          : {}),
      };
      const { data, error } = await withRoomProcessingRetry(() => (request.sourceLeagueCode
        ? client.rpc("add_room_match_v2", { ...args, source_league_code: request.sourceLeagueCode })
        : client.rpc("add_room_match", args)));

      if (error) {
        throw error;
      }

      if (typeof data !== "string" || !data) {
        throw new Error("Supabase add_room_match returned no response payload.");
      }

      return data as string;
    },

    async addRoomMatches(sessionId, requests) {
      // camelCase keys: the RPC reads the payload with ->> using these exact
      // names, so the request objects travel verbatim.
      const { data, error } = await withRoomProcessingRetry(() => client.rpc("add_room_matches", {
        session_id: sessionId,
        matches: requests.map((request) => ({ ...request })),
      }));

      if (error) {
        throw error;
      }

      const result = (data ?? {}) as Partial<BatchRoomMatchResult>;
      return { added: result.added ?? 0, skipped: result.skipped ?? 0 };
    },

    async removeRoomMatch(sessionId, matchId) {
      const { error } = await withRoomProcessingRetry(() => client.rpc("remove_room_match", {
        session_id: sessionId,
        match_id: matchId,
      }));

      if (error) {
        throw error;
      }
    },

    async removeRoomMatches(sessionId, matchIds) {
      const { error } = await withRoomProcessingRetry(() => client.rpc("remove_room_matches", {
        session_id: sessionId,
        match_ids: matchIds,
      }));

      if (error) {
        throw error;
      }
    },

    async setCommonMatch(sessionId, matchId) {
      const { error } = await withRoomProcessingRetry(() => client.rpc("set_common_match", {
        session_id: sessionId,
        match_id: matchId,
      }));

      if (error) {
        throw error;
      }
    },

    async setRoomAssignments(sessionId, assignments) {
      const { error } = await withRoomProcessingRetry(() => client.rpc("set_room_assignments", {
        session_id: sessionId,
        assignments: assignments.map((assignment) => ({
          participantId: assignment.participantId,
          matchId: assignment.matchId,
        })),
      }));

      if (error) {
        throw error;
      }
    },

    async setRoomAssignmentSettings(sessionId, settings) {
      const { error } = await withRoomProcessingRetry(() => client.rpc("set_room_assignment_settings", {
        session_id: sessionId,
        matches_per_player: settings.matchesPerPlayer,
        shared_matches_per_pair: settings.sharedMatchesPerPair,
      }));

      if (error) {
        throw error;
      }
    },

    async setRoomAssignmentMode(sessionId, mode) {
      const { error } = await withRoomProcessingRetry(() => client.rpc("set_room_assignment_mode", {
        session_id: sessionId,
        mode,
      }));

      if (error) {
        throw error;
      }
    },

    async setMyRoomPicks(sessionId, matchIds) {
      const { error } = await withRoomProcessingRetry(() => client.rpc("set_my_room_picks", {
        session_id: sessionId,
        match_ids: matchIds,
      }));

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

export { createGuestRoomRpcClient, getGuestRoomRpcClient } from "./guestRoomRpcClient";
export type { GuestRoomRpcClient } from "./guestRoomRpcClient";
export { getHostRoomRpcClient } from "./hostRoomRpcClient";
export { mapGameplayError } from "./roomRpcErrors";
