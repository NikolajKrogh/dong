import type { Database } from "../types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";
import { boundedGuestRetrySeconds, getGuestRoomErrorCode, GuestRoomAccessError } from "./guestRoom";

import type {
  GuestRoomJoinRequest,
  GuestRoomJoinResponse,
  GuestRoomLeaveResponse,
  GuestRoomRotationResponse,
  GuestRoomSnapshot,
} from "../types/guestRoom";
import type { HostRoomCreateResponse } from "../types/hostRoom";
import type {
  AddRoomMatchRequest,
  AssignmentMode,
  BatchRoomMatchResult,
  EndGameSessionResponse,
  GameplayCommandResult,
  GameplayErrorCode,
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
import { GameplayRpcError, ReassignmentRpcError } from "../types/room";
export interface GuestRoomRpcClient {
  joinRoomAsGuest(
    request: GuestRoomJoinRequest,
  ): Promise<GuestRoomJoinResponse>;
  getGuestRoomSnapshot(guestToken: string): Promise<GuestRoomSnapshot>;
  leaveRoomAsGuest(guestToken: string): Promise<GuestRoomLeaveResponse>;
  rotateGuestRoomGrant(oldToken: string, newToken: string, operationId: string): Promise<GuestRoomRotationResponse>;
  /**
   * The guest counterpart of `RoomRpcClient.setMyRoomPicks` (FR-038a). A
   * session-scoped guest has no `auth.uid()`, so the room-scoped token both
   * authenticates them and identifies which participant — and which room — the
   * picks belong to. Same replace-all semantics.
   */
  setMyRoomPicksAsGuest(guestToken: string, matchIds: string[]): Promise<void>;
  changeManualScoreAsGuest(input: {
    guestToken: string;
    matchId: string;
    team: "home" | "away";
    deltaGoals: -1 | 1;
    idempotencyKey: string;
  }): Promise<GameplayCommandResult>;
  changeParticipantDrinkAsGuest(input: {
    guestToken: string;
    participantId: string;
    deltaHalfDrinks: -1 | 1;
    idempotencyKey: string;
  }): Promise<GameplayCommandResult>;
}

interface ProviderScoreRefreshResult {
  matchId: string;
  sourceMatchId: string;
  provider: "espn";
  homeScore: number;
  awayScore: number;
  sequenceNumber: number;
  changed: boolean;
  replayed: boolean;
}

interface ProviderScoreRefreshResponse {
  sessionId: string;
  requestId: string;
  status: "updated" | "partial" | "not_due";
  refreshedAt: string | null;
  results: ProviderScoreRefreshResult[];
  warnings: {
    leagueCode?: string;
    code:
      | "provider_unavailable"
      | "invalid_provider_response"
      | "match_not_found";
  }[];
}

export interface ProviderScoreRefreshClient {
  refreshProviderScores(
    sessionId: string,
    idempotencyKey: string,
  ): Promise<ProviderScoreRefreshResponse>;
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
  changeManualScore(input: {
    sessionId: string;
    matchId: string;
    team: "home" | "away";
    deltaGoals: -1 | 1;
    idempotencyKey: string;
  }): Promise<GameplayCommandResult>;
  changeParticipantDrink(input: {
    sessionId: string;
    participantId: string;
    deltaHalfDrinks: -1 | 1;
    idempotencyKey: string;
  }): Promise<GameplayCommandResult>;
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

const GAMEPLAY_ERROR_MESSAGES: Record<GameplayErrorCode, string> = {
  not_authenticated: "Sign-in is required for this action.",
  not_room_participant: "You are no longer an active participant in this room.",
  participant_inactive: "That participant is no longer active.",
  target_inactive: "That participant is no longer active.",
  room_not_found: "The room no longer exists.",
  match_not_in_room: "That match is not part of this room.",
  invalid_room_state: "The game is no longer accepting gameplay changes.",
  game_not_in_progress: "The game is no longer running.",
  manual_score_required: "Only manual matches accept participant score changes.",
  provider_score_required: "Provider-controlled scores cannot be edited manually.",
  provider_match_mismatch: "The provider match identity no longer matches the room.",
  invalid_provider_score: "The provider returned an invalid score.",
  invalid_delta: "That gameplay change is invalid.",
  negative_result: "A score or drink total cannot become negative.",
  idempotency_conflict: "That request has already been used for a different action.",
  idempotency_key_reused: "That request has already been used for a different action.",
  not_host: "Only the current host can perform this action.",
  forbidden: "You do not have access to this room.",
  guest_token_expired: "The guest room session has expired.",
  service_unavailable: "The shared game service is unavailable. Reconnect and refresh.",
  unknown_error: "The shared game could not accept that action.",
};

const GAMEPLAY_ERROR_CODES = new Set<GameplayErrorCode>(
  Object.keys(GAMEPLAY_ERROR_MESSAGES) as GameplayErrorCode[],
);

export const mapGameplayError = (error: unknown) => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const code = GAMEPLAY_ERROR_CODES.has(message as GameplayErrorCode)
    ? (message as GameplayErrorCode)
    : null;
  return code ? new GameplayRpcError(code, GAMEPLAY_ERROR_MESSAGES[code]) : null;
};

const readGameplayResult = (
  data: unknown,
  functionName: string,
): GameplayCommandResult => {
  if (!data || typeof data !== "object") {
    throw new Error(`Supabase ${functionName} returned no response payload.`);
  }
  const result = data as Partial<GameplayCommandResult>;
  return {
    ...result,
    sessionId: String(result.sessionId ?? ""),
    sequenceNumber:
      typeof result.sequenceNumber === "number" ? result.sequenceNumber : null,
    eventId: typeof result.eventId === "string" ? result.eventId : null,
    replayed: result.replayed === true,
  } as GameplayCommandResult;
};

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

let cachedGuestRoomRpcClient: GuestRoomRpcClient | null = null;
let cachedHostRoomRpcClient: HostRoomRpcClient | null = null;
let cachedRoomRpcClient: RoomRpcClient | null = null;
let cachedProviderScoreRefreshClient: ProviderScoreRefreshClient | null = null;

export const createGuestRoomRpcClient = (
  client: SupabaseClient<Database> = getSupabaseClient(),
): GuestRoomRpcClient => {
  const invoke = async (operation: string, args: Record<string, unknown>) => {
    const { data, error } = await client.functions.invoke("guest-room-access", {
      body: { operation, args },
    });
    // These command parsers expect transport-style errors. The Edge boundary
    // returns only safe codes, never upstream messages or request payloads.
    if (!error && data?.ok === false && ["set_my_room_picks_as_guest", "change_manual_score_as_guest", "change_participant_drink_as_guest"].includes(operation)) {
      return { data: null, error: { message: data.code } };
    }
    return { data, error };
  };
  return {
    async joinRoomAsGuest(request) {
      const { data, error } = await invoke("join_room_as_guest", {
          join_code: request.joinCode,
          guest_name: request.guestName,
          guest_token: request.guestToken,
        });

      if (error) {
        throw new Error(getGuestRoomErrorCode(error));
      }

      if (!data || typeof data !== "object") throw new Error("unknown_error");
      const payload = data as Record<string, unknown>;
      if (payload.ok === false) {
        throw new GuestRoomAccessError(getGuestRoomErrorCode(payload.code),
          boundedGuestRetrySeconds(payload.retryAfterSeconds));
      }
      if (
        typeof payload.guestToken !== "string" ||
        payload.guestToken !== request.guestToken ||
        typeof payload.participantId !== "string" ||
        typeof payload.sessionId !== "string" ||
        typeof payload.joinCode !== "string" ||
        typeof payload.displayName !== "string" ||
        !payload.snapshot || typeof payload.snapshot !== "object"
      ) throw new Error("unknown_error");

      return data as GuestRoomJoinResponse;
    },

    async getGuestRoomSnapshot(guestToken) {
      const { data, error } = await invoke("get_guest_room_snapshot", {
          guest_token: guestToken,
        });

      if (error) {
        throw new Error(getGuestRoomErrorCode(error));
      }

      if (!data || typeof data !== "object") throw new Error("unknown_error");
      if ((data as Record<string, unknown>).ok === false) {
        const payload = data as Record<string, unknown>;
        throw new GuestRoomAccessError(getGuestRoomErrorCode(payload.code),
          boundedGuestRetrySeconds(payload.retryAfterSeconds));
      }
      return data as GuestRoomSnapshot;
    },

    async leaveRoomAsGuest(guestToken) {
      const { data, error } = await invoke("leave_room_as_guest", {
        guest_token: guestToken,
      });

      if (error) throw new Error(getGuestRoomErrorCode(error));
      if (!data || typeof data !== "object") throw new Error("unknown_error");
      const payload = data as Record<string, unknown>;
      if (payload.ok === true && (payload.status === "confirmed" || payload.status === "already_invalid")) {
        return payload as GuestRoomLeaveResponse;
      }
      if (payload.ok === false && (payload.code === "not_permitted" || payload.code === "rate_limited")) {
        return payload as GuestRoomLeaveResponse;
      }
      throw new Error("unknown_error");
    },

    async rotateGuestRoomGrant(oldToken, newToken, operationId) {
      const { data, error } = await invoke("rotate_guest_room_grant", {
        old_token: oldToken, new_token: newToken, operation_id: operationId,
      });
      if (error) throw new Error(getGuestRoomErrorCode(error));
      if (!data || typeof data !== "object") throw new Error("unknown_error");
      const payload = data as Record<string, unknown>;
      if (payload.ok === true && typeof payload.participantId === "string"
          && typeof payload.grantExpiresAt === "string" && typeof payload.replayed === "boolean") {
        return payload as GuestRoomRotationResponse;
      }
      if (payload.ok === false && typeof payload.code === "string") {
        return { ok: false, code: getGuestRoomErrorCode(payload.code) } as GuestRoomRotationResponse;
      }
      throw new Error("unknown_error");
    },

    async setMyRoomPicksAsGuest(guestToken, matchIds) {
      const { error } = await invoke("set_my_room_picks_as_guest", {
        guest_token: guestToken,
        match_ids: matchIds,
      });

      if (error) {
        throw new Error(getGuestRoomErrorCode(error));
      }
    },

    async changeManualScoreAsGuest(input) {
      const { data, error } = await invoke("change_manual_score_as_guest", {
          guest_token: input.guestToken,
          match_id: input.matchId,
          team: input.team,
          delta_goals: input.deltaGoals,
          idempotency_key: input.idempotencyKey,
        });

      if (error) {
        throw mapGameplayError(error) ?? new GameplayRpcError("unknown_error", GAMEPLAY_ERROR_MESSAGES.unknown_error);
      }
      return readGameplayResult(data, "change_manual_score_as_guest");
    },

    async changeParticipantDrinkAsGuest(input) {
      const { data, error } = await invoke("change_participant_drink_as_guest", {
          guest_token: input.guestToken,
          participant_id: input.participantId,
          delta_half_drinks: input.deltaHalfDrinks,
          idempotency_key: input.idempotencyKey,
        });

      if (error) {
        throw mapGameplayError(error) ?? new GameplayRpcError("unknown_error", GAMEPLAY_ERROR_MESSAGES.unknown_error);
      }
      return readGameplayResult(data, "change_participant_drink_as_guest");
    },
  };
};

export const createProviderScoreRefreshClient = (
  client: SupabaseClient<Database> = getSupabaseClient(),
): ProviderScoreRefreshClient => ({
  async refreshProviderScores(sessionId, idempotencyKey) {
    const { data, error } = await client.functions.invoke(
      "refresh-provider-scores",
      {
        body: { sessionId },
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    if (error) throw error;
    if (!data || typeof data !== "object") {
      throw new Error(
        "Supabase refresh-provider-scores returned no response payload.",
      );
    }
    return data as ProviderScoreRefreshResponse;
  },
});

export const getProviderScoreRefreshClient = () => {
  cachedProviderScoreRefreshClient ??= createProviderScoreRefreshClient();
  return cachedProviderScoreRefreshClient;
};

export const getGuestRoomRpcClient = () => {
  cachedGuestRoomRpcClient ??= createGuestRoomRpcClient();

  return cachedGuestRoomRpcClient;
};

const createHostRoomRpcClient = (
  client: SupabaseClient<Database> = getSupabaseClient(),
): HostRoomRpcClient => {
  return {
    async createRoomAsHost() {
      const { data, error } = await client
        .rpc("create_room_as_host")
        .overrideTypes<HostRoomCreateResponse, { merge: false }>();

      if (error) {
        throw error;
      }

      if (!data || typeof data !== "object" || Array.isArray(data) || "Error" in data) {
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
  client: SupabaseClient<Database> = getSupabaseClient(),
): RoomRpcClient => {
  return {
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
      const { data, error } = await client
        .rpc("leave_room_as_member", { session_id: sessionId })
        .overrideTypes<MemberLeaveResponse, { merge: false }>();

      if (error) {
        throw error;
      }

      if (data && (typeof data !== "object" || Array.isArray(data) || "Error" in data)) {
        throw new Error("Invalid member departure response.");
      }
      return data ?? { sessionId, status: "left" };
    },

    async leaveRoomAsHost(sessionId, successorParticipantId) {
      const { data, error } = await client
        .rpc("leave_room_as_host", {
          session_id: sessionId,
          successor_participant_id: successorParticipantId ?? undefined,
        })
        .overrideTypes<HostLeaveResponse, { merge: false }>();

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
      const { data, error } = await client
        .rpc("end_game_session", { session_id: sessionId })
        .overrideTypes<EndGameSessionResponse, { merge: false }>();

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

      if (!data || typeof data !== "object" || Array.isArray(data) || "Error" in data) {
        throw new Error(
          "Supabase reassign_participant_matches returned no response payload.",
        );
      }

      return data;
    },

    async changeManualScore(input) {
      const { data, error } = await client
        .rpc("change_manual_score", {
          session_id: input.sessionId,
          match_id: input.matchId,
          team: input.team,
          delta_goals: input.deltaGoals,
          idempotency_key: input.idempotencyKey,
        })
        .overrideTypes<GameplayCommandResult, { merge: false }>();

      if (error) {
        throw mapGameplayError(error) ?? error;
      }
      return readGameplayResult(data, "change_manual_score");
    },

    async changeParticipantDrink(input) {
      const { data, error } = await client
        .rpc("change_participant_drink", {
          session_id: input.sessionId,
          participant_id: input.participantId,
          delta_half_drinks: input.deltaHalfDrinks,
          idempotency_key: input.idempotencyKey,
        })
        .overrideTypes<GameplayCommandResult, { merge: false }>();

      if (error) {
        throw mapGameplayError(error) ?? error;
      }
      return readGameplayResult(data, "change_participant_drink");
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
      const { data, error } = await (request.sourceLeagueCode
        ? client.rpc("add_room_match_v2", { ...args, source_league_code: request.sourceLeagueCode })
        : client.rpc("add_room_match", args));

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
      const { data, error } = await client.rpc("add_room_matches", {
        session_id: sessionId,
        matches: requests.map((request) => ({ ...request })),
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
