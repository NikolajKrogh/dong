package com.dong.commandapi.command;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import com.dong.commandapi.supabase.SupabaseRestClient;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Serves command type {@code "start-game"} (US3, spec.md FR-006–FR-011). Reads
 * the room snapshot via {@code get_room_snapshot}, runs the five cross-aggregate
 * validation rules Supabase RLS/RPCs cannot enforce alone (research.md R4), and
 * on success transitions the room via {@code start_game_session}. Both RPC calls
 * are made under the host's own forwarded JWT (research.md R6) — never a
 * service-role credential.
 *
 * <p>Exactly-once processing of a repeated request is handled one layer up by
 * {@link com.dong.commandapi.command.idempotency.PersistentIdempotencyService}
 * (research.md R7) — this handler only needs to run its validation and the
 * {@code start_game_session} row-lock/state-guard once per genuinely new attempt.
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
    @SuppressWarnings("unchecked")
    public CommandResult handle(CommandContext context) {
        String token = context.host().rawToken();
        String roomId = context.roomId();

        Map<String, Object> snapshot;
        try {
            snapshot = supabaseRestClient.rpc("get_room_snapshot", Map.of("session_id", roomId), token, Map.class);
        } catch (SupabaseRestClient.SupabaseRpcException ex) {
            throw mapSupabaseError(ex);
        }

        validate(snapshot);

        UUID idempotencyKey = UUID.fromString(context.rawIdempotencyKey());
        Map<String, Object> startResult;
        try {
            startResult = supabaseRestClient.rpc(
                    "start_game_session",
                    Map.of("session_id", roomId, "idempotency_key", idempotencyKey.toString()),
                    token,
                    Map.class);
        } catch (SupabaseRestClient.SupabaseRpcException ex) {
            throw mapSupabaseError(ex);
        }

        return new CommandResult(CommandResult.Status.ACCEPTED, startResult);
    }

    /** FR-006–FR-009: the five cross-aggregate validation rules. */
    @SuppressWarnings("unchecked")
    private void validate(Map<String, Object> snapshot) {
        String state = (String) snapshot.get("state");
        if (!"joinable".equals(state)) {
            throw new ApiException(ErrorCode.INVALID_ROOM_STATE);
        }

        List<Map<String, Object>> participants = (List<Map<String, Object>>) snapshot.getOrDefault("participants", List.of());
        if (participants.isEmpty()) {
            throw new ApiException(ErrorCode.EMPTY_PARTICIPANTS);
        }

        List<Map<String, Object>> matches = (List<Map<String, Object>>) snapshot.getOrDefault("matches", List.of());
        if (matches.isEmpty()) {
            throw new ApiException(ErrorCode.EMPTY_MATCHES);
        }

        Object commonMatchId = snapshot.get("commonMatchId");
        if (commonMatchId == null) {
            throw new ApiException(ErrorCode.MISSING_COMMON_MATCH);
        }

        boolean commonMatchInPool = matches.stream()
                .anyMatch(match -> commonMatchId.toString().equals(String.valueOf(match.get("id"))));
        if (!commonMatchInPool) {
            throw new ApiException(ErrorCode.INVALID_COMMON_MATCH);
        }

        List<Map<String, Object>> assignments = (List<Map<String, Object>>) snapshot.getOrDefault("assignments", List.of());
        Set<String> assignedParticipantIds = assignments.stream()
                // FR-008: an assignment of the Common Match itself doesn't count — every
                // participant already has the Common Match; this checks for an ADDITIONAL one.
                .filter(assignment -> !commonMatchId.toString().equals(String.valueOf(assignment.get("matchId"))))
                .map(assignment -> String.valueOf(assignment.get("participantId")))
                .collect(Collectors.toSet());
        boolean anyUnassigned = participants.stream()
                .anyMatch(participant -> !assignedParticipantIds.contains(String.valueOf(participant.get("id"))));
        if (anyUnassigned) {
            throw new ApiException(ErrorCode.UNASSIGNED_PARTICIPANTS);
        }
    }

    /**
     * Maps both the {@code get_room_snapshot} and {@code start_game_session} RPC failures.
     * The {@code empty_participants}/{@code empty_matches}/{@code missing_common_match}/
     * {@code invalid_common_match}/{@code unassigned_participants} cases can only come from
     * {@code start_game_session}'s own re-validation under its row lock (the authoritative
     * backstop for {@link #validate}'s optimistic check — see that RPC's docstring) racing
     * against a concurrent room-configuration change.
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
            case "unassigned_participants" -> new ApiException(ErrorCode.UNASSIGNED_PARTICIPANTS);
            default -> new ApiException(ErrorCode.INTERNAL_ERROR, "Unexpected Supabase error: " + ex.postgresMessage());
        };
    }
}
