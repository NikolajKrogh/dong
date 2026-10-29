package com.dong.gameapi.roomaction;

import com.dong.gameapi.error.ApiException;
import com.dong.gameapi.error.ErrorCode;
import com.dong.gameapi.supabase.SupabaseRpcClient;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Starts a room through {@code start_game_session}, forwarding the host's JWT and replay key.
 * Postgres owns room validation, assignment generation and the state transition in
 * one transaction. This handler forwards the request and maps database errors;
 * {@link com.dong.gameapi.roomaction.idempotency.PersistentIdempotencyService}
 * coordinates retries at the HTTP request level.
 */
@Component
public class StartGameActionHandler implements RoomActionHandler {

    public static final String TYPE = "start-game";

    private final SupabaseRpcClient supabaseRpcClient;

    public StartGameActionHandler(SupabaseRpcClient supabaseRpcClient) {
        this.supabaseRpcClient = supabaseRpcClient;
    }

    @Override
    public String actionType() {
        return TYPE;
    }

    @Override
    public RoomActionResult handleAction(RoomActionContext context) {
        String token = context.host().rawToken();
        String roomId = context.roomId();
        UUID idempotencyKey = UUID.fromString(context.rawIdempotencyKey());
        boolean relaxConstraints = readRelaxConstraints(context.payload());

        Map<String, Object> startResult;
        try {
            startResult = supabaseRpcClient.invokeRpc(
                    "start_game_session",
                    Map.of(
                            "session_id", roomId,
                            "idempotency_key", idempotencyKey.toString(),
                            "relax_constraints", relaxConstraints),
                    token,
                    Map.class);
        } catch (SupabaseRpcClient.SupabaseRpcException ex) {
            throw mapSupabaseError(ex);
        }

        return new RoomActionResult(RoomActionResult.Status.ACCEPTED, startResult);
    }

    /**
     * {@code relaxConstraints} is set by the client only after the host has
     * seen the room's assignment-plan shortfall (from the polled snapshot) and
     * explicitly chosen to proceed (research.md R2) — there is no separate
     * preview/warning action. Absent or non-boolean values default to false.
     */
    private boolean readRelaxConstraints(Map<String, Object> payload) {
        if (payload == null) {
            return false;
        }
        Object value = payload.get("relaxConstraints");
        return value instanceof Boolean bool && bool;
    }

    /**
     * Maps database room/assignment validation failures to public HTTP error codes.
     * The RPC performs validation under its room lock; the handler does not repeat it.
     */
    private ApiException mapSupabaseError(SupabaseRpcClient.SupabaseRpcException ex) {
        return switch (ex.postgresMessage()) {
            case "room_not_found" -> new ApiException(ErrorCode.ROOM_NOT_FOUND);
            case "forbidden", "not_host" -> new ApiException(ErrorCode.FORBIDDEN);
            case "invalid_room_state" -> new ApiException(ErrorCode.INVALID_ROOM_STATE);
            case "empty_participants" -> new ApiException(ErrorCode.EMPTY_PARTICIPANTS);
            case "empty_matches" -> new ApiException(ErrorCode.EMPTY_MATCHES);
            case "missing_common_match" -> new ApiException(ErrorCode.MISSING_COMMON_MATCH);
            case "invalid_common_match" -> new ApiException(ErrorCode.INVALID_COMMON_MATCH);
            case "insufficient_match_pool" -> new ApiException(ErrorCode.INSUFFICIENT_MATCH_POOL);
            case "assignment_constraints_unsatisfiable" -> new ApiException(ErrorCode.ASSIGNMENT_CONSTRAINTS_UNSATISFIABLE);
            default -> new ApiException(ErrorCode.INTERNAL_ERROR, "Unexpected Supabase error: " + ex.postgresMessage());
        };
    }
}
