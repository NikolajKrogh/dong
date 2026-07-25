package com.dong.commandapi.command;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import com.dong.commandapi.security.AuthenticatedHost;
import com.dong.commandapi.supabase.SupabaseRestClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The five cross-aggregate validation rules this handler used to run
 * optimistically (FR-006–FR-009 under the old numbering) moved into
 * {@code start_game_session} itself (research.md R1,
 * specs/020-canonical-assignment-generation) — generation needs to see the
 * same locked roster the RPC locks, so a second, earlier read-then-check would
 * race a concurrent join/leave. This handler is now dispatch, auth,
 * idempotency-key + relaxConstraints forwarding, and error mapping only; its
 * tests reflect that — no more snapshot stubbing, no more validate() coverage.
 */
class StartGameCommandHandlerTest {

    private final SupabaseRestClient supabaseRestClient = mock(SupabaseRestClient.class);
    private final StartGameCommandHandler handler = new StartGameCommandHandler(supabaseRestClient);
    private final AuthenticatedHost host = new AuthenticatedHost("host-1", "authenticated", "raw-jwt");

    private CommandContext ctx(Map<String, Object> payload) {
        return new CommandContext("room-1", StartGameCommandHandler.TYPE, UUID.randomUUID().toString(), host, payload);
    }

    @Test
    void commandTypeIsStartGame() {
        assertThat(handler.commandType()).isEqualTo("start-game");
    }

    @Test
    void validStartCallsStartGameSessionWithoutRelaxByDefault() {
        when(supabaseRestClient.rpc(eq("start_game_session"), any(), anyString(), any()))
                .thenReturn(Map.of("status", "started", "sessionId", "room-1", "relaxedConstraints", false));

        CommandResult result = handler.handle(ctx(null));

        assertThat(result.status()).isEqualTo(CommandResult.Status.ACCEPTED);
        assertThat(result.detail()).containsEntry("status", "started");
    }

    @Test
    void passesRelaxConstraintsTrueThroughToTheRpcWhenSetInThePayload() {
        when(supabaseRestClient.rpc(eq("start_game_session"), any(), anyString(), any()))
                .thenReturn(Map.of("status", "started", "sessionId", "room-1", "relaxedConstraints", true));

        handler.handle(ctx(Map.of("relaxConstraints", true)));

        verify(supabaseRestClient).rpc(
                eq("start_game_session"),
                argThat(params -> Boolean.TRUE.equals(params.get("relax_constraints"))),
                anyString(),
                any());
    }

    @Test
    void absentPayloadDefaultsRelaxConstraintsToFalse() {
        when(supabaseRestClient.rpc(eq("start_game_session"),
                argThat(params -> Boolean.FALSE.equals(params.get("relax_constraints"))),
                anyString(), any()))
                .thenReturn(Map.of("status", "started"));

        CommandResult result = handler.handle(ctx(null));

        assertThat(result.status()).isEqualTo(CommandResult.Status.ACCEPTED);
    }

    @Test
    void nonBooleanRelaxConstraintsValueDefaultsToFalse() {
        when(supabaseRestClient.rpc(eq("start_game_session"),
                argThat(params -> Boolean.FALSE.equals(params.get("relax_constraints"))),
                anyString(), any()))
                .thenReturn(Map.of("status", "started"));

        CommandResult result = handler.handle(ctx(Map.of("relaxConstraints", "yes")));

        assertThat(result.status()).isEqualTo(CommandResult.Status.ACCEPTED);
    }

    private static SupabaseRestClient.SupabaseRpcException rpcException(String postgresMessage) {
        byte[] body = ("{\"message\":\"" + postgresMessage + "\"}").getBytes(StandardCharsets.UTF_8);
        RestClientResponseException cause = new RestClientResponseException(
                "Unprocessable Entity", HttpStatusCode.valueOf(422), "Unprocessable Entity",
                HttpHeaders.EMPTY, body, StandardCharsets.UTF_8);
        return new SupabaseRestClient.SupabaseRpcException("start_game_session", cause);
    }

    /**
     * Every guard start_game_session can raise -- its own five original checks
     * plus the two new shortfall/floor guards -- must map to the matching
     * ErrorCode. unassigned_participants is retired (FR-019): assignments are
     * now a product of starting, not a precondition, so no RPC raises it and
     * no ErrorCode maps it.
     */
    @ParameterizedTest
    @CsvSource({
            "room_not_found,ROOM_NOT_FOUND",
            "not_host,FORBIDDEN",
            "forbidden,FORBIDDEN",
            "invalid_room_state,INVALID_ROOM_STATE",
            "empty_participants,EMPTY_PARTICIPANTS",
            "empty_matches,EMPTY_MATCHES",
            "missing_common_match,MISSING_COMMON_MATCH",
            "invalid_common_match,INVALID_COMMON_MATCH",
            "insufficient_match_pool,INSUFFICIENT_MATCH_POOL",
            "assignment_constraints_unsatisfiable,ASSIGNMENT_CONSTRAINTS_UNSATISFIABLE",
    })
    void mapsStartGameSessionFailuresToTheMatchingErrorCode(String postgresMessage, ErrorCode expected) {
        when(supabaseRestClient.rpc(eq("start_game_session"), any(), anyString(), any()))
                .thenThrow(rpcException(postgresMessage));

        assertThatThrownBy(() -> handler.handle(ctx(null)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(expected);
    }

    @Test
    void unrecognizedRpcErrorMapsToInternalError() {
        when(supabaseRestClient.rpc(eq("start_game_session"), any(), anyString(), any()))
                .thenThrow(rpcException("some_future_guard"));

        assertThatThrownBy(() -> handler.handle(ctx(null)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.INTERNAL_ERROR);
    }
}
