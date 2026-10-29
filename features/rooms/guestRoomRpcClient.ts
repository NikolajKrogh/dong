import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabase";
import type { Database } from "../../types/database";
import type {
  GuestRoomJoinRequest,
  GuestRoomJoinResponse,
  GuestRoomLeaveResponse,
  GuestRoomRotationResponse,
  GuestRoomSnapshot,
} from "../../types/guestRoom";
import type {
  GameplayActionResult
} from "../../types/room";
import { GameplayRpcError } from "../../types/room";
import { boundedGuestRetrySeconds, getGuestRoomErrorCode, GuestRoomAccessError } from "./guestRoomService";
import { GAMEPLAY_ERROR_MESSAGES, mapGameplayError, readGameplayResult, withRoomProcessingRetry } from "./roomRpcErrors";

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
  }): Promise<GameplayActionResult>;
  changeParticipantDrinkAsGuest(input: {
    guestToken: string;
    participantId: string;
    deltaHalfDrinks: -1 | 1;
    idempotencyKey: string;
  }): Promise<GameplayActionResult>;
}

let cachedGuestRoomRpcClient: GuestRoomRpcClient | null = null;

export const createGuestRoomRpcClient = (
  client: SupabaseClient<Database> = getSupabaseClient(),
): GuestRoomRpcClient => {
  const invoke = async (operation: string, args: Record<string, unknown>) => {
    const { data, error } = await withRoomProcessingRetry(() => client.functions.invoke("guest-room-access", {
      body: { operation, args },
    }));
    // These action parsers expect transport-style errors. The Edge boundary
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

export const getGuestRoomRpcClient = () => {
  cachedGuestRoomRpcClient ??= createGuestRoomRpcClient();

  return cachedGuestRoomRpcClient;
};
