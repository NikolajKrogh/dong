package com.dong.commandapi.command;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import com.dong.commandapi.supabase.SupabaseRestClient;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Serves command type {@code "start-game"} (US1/US2/US4/US8,
 * specs/020-canonical-assignment-generation/spec.md — the #135 delivery
 * slice). Transitions the room via {@code start_game_session}, which now
 * performs canonical assignment generation, the shortfall/override decision,
 * and the five original cross-aggregate guards all under its own row lock
 * (research.md R1). The RPC call is made under the host's own forwarded JWT
 * (research.md R6) — never a service-role credential.
 *
 * <p>This handler no longer performs its own optimistic validation: the
 * {@code get_room_snapshot} read-then-check this class used to do (spec.md
 * FR-006–FR-009 under the old numbering) was a duplicate of {@code
 * start_game_session}'s own guards, and generating assignments requires
 * seeing the same locked roster the RPC locks — a second, earlier read could
 * race a concurrent join/leave (research.md R1, R6). The RPC is now the sole
 * authority; this handler is dispatch, auth, idempotency-key forwarding, and
 * error mapping only.
 *
 * <p>Exactly-once processing of a repeated request is handled one layer up by
 * {@link com.dong.commandapi.command.idempotency.PersistentIdempotencyService}
 * (research.md R7) — this handler only needs to call {@code
 * start_game_session} once per genuinely new attempt.
 */
@Component
public class StartGameCommandHandler implements CommandHandler {

    public static final String TYPE = "start-game";

    private final SupabaseRestClient supabaseRestClient;

    public StartGameCommandHandler(SupabaseRestClient supabaseRestClient) {
        this.supabaseRestClient = supabaseRestClient;
    }

    @Override
    public String commandType() {
        return TYPE;
    }

    @Override
    public CommandResult handle(CommandContext context) {
        String token = context.host().rawToken();
        String roomId = context.roomId();
        UUID idempotencyKey = UUID.fromString(context.rawIdempotencyKey());
        boolean relaxConstraints = readRelaxConstraints(context.payload());

        Map<String, Object> startResult;
        try {
            startResult = supabaseRestClient.rpc(
                    "start_game_session",
                    Map.of(
                            "session_id", roomId,
                            "idempotency_key", idempotencyKey.toString(),
                            "relax_constraints", relaxConstraints),
                    token,
                    Map.class);
        } catch (SupabaseRestClient.SupabaseRpcException ex) {
            throw mapSupabaseError(ex);
        }

        return new CommandResult(CommandResult.Status.ACCEPTED, startResult);
    }

    /**
     * {@code relaxConstraints} is set by the client only after the host has
     * seen the room's assignment-plan shortfall (from the polled snapshot) and
     * explicitly chosen to proceed (research.md R2) — there is no separate
     * preview/warning command. Absent or non-boolean values default to false.
     */
    private boolean readRelaxConstraints(Map<String, Object> payload) {
        if (payload == null) {
            return false;
        }
        Object value = payload.get("relaxConstraints");
        return value instanceof Boolean bool && bool;
    }

    /**
     * Maps {@code start_game_session} RPC failures. Every case below is now
     * raised solely by that RPC's own guards under its row lock — there is no
     * longer a separate optimistic check in this handler to keep in sync with.
     */
    private ApiException mapSupabaseError(SupabaseRestClient.SupabaseRpcException ex) {
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
