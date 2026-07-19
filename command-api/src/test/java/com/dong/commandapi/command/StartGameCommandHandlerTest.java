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
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StartGameCommandHandlerTest {

    private final SupabaseRestClient supabaseRestClient = mock(SupabaseRestClient.class);
    private final StartGameCommandHandler handler = new StartGameCommandHandler(supabaseRestClient);
    private final AuthenticatedHost host = new AuthenticatedHost("host-1", "authenticated", "raw-jwt");

    private CommandContext ctx() {
        return new CommandContext("room-1", StartGameCommandHandler.TYPE, UUID.randomUUID().toString(), host, null);
    }

    private static Map<String, Object> match(String id) {
        return Map.of("id", id, "homeTeamName", "A", "awayTeamName", "B");
    }

    private static Map<String, Object> participant(String id) {
        return Map.of("id", id, "displayName", "Player");
    }

    private static Map<String, Object> assignment(String participantId, String matchId) {
        return Map.of("participantId", participantId, "matchId", matchId);
    }

    private Map<String, Object> validSnapshot() {
        return Map.of(
                "state", "joinable",
                "commonMatchId", "match-1",
                "participants", List.of(participant("p-1")),
                "matches", List.of(match("match-1"), match("match-2")),
                "assignments", List.of(assignment("p-1", "match-2")));
    }

    private void stubSnapshot(Map<String, Object> snapshot) {
        when(supabaseRestClient.rpc(eq("get_room_snapshot"), any(), anyString(), any())).thenReturn(snapshot);
    }

    @Test
    void commandTypeIsStartGame() {
        assertThat(handler.commandType()).isEqualTo("start-game");
    }

    @Test
    void validConfigurationStartsTheGame() {
        stubSnapshot(validSnapshot());
        when(supabaseRestClient.rpc(eq("start_game_session"), any(), anyString(), any()))
                .thenReturn(Map.of("status", "started", "sessionId", "room-1"));

        CommandResult result = handler.handle(ctx());

        assertThat(result.status()).isEqualTo(CommandResult.Status.ACCEPTED);
        verify(supabaseRestClient).rpc(eq("start_game_session"), any(), anyString(), any());
    }

    @Test
    void rejectsWhenRoomIsNotJoinable() {
        stubSnapshot(Map.of(
                "state", "in_progress",
                "participants", List.of(participant("p-1")),
                "matches", List.of(match("match-1")),
                "commonMatchId", "match-1",
                "assignments", List.of(assignment("p-1", "match-1"))));

        assertThatThrownBy(() -> handler.handle(ctx()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.INVALID_ROOM_STATE);
    }

    @Test
    void rejectsWhenNoParticipants() {
        stubSnapshot(Map.of(
                "state", "joinable",
                "participants", List.of(),
                "matches", List.of(match("match-1")),
                "commonMatchId", "match-1",
                "assignments", List.of()));

        assertThatThrownBy(() -> handler.handle(ctx()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.EMPTY_PARTICIPANTS);
    }

    @Test
    void rejectsWhenNoMatches() {
        stubSnapshot(Map.of(
                "state", "joinable",
                "participants", List.of(participant("p-1")),
                "matches", List.of(),
                "assignments", List.of()));

        assertThatThrownBy(() -> handler.handle(ctx()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.EMPTY_MATCHES);
    }

    @Test
    void rejectsWhenNoCommonMatchDesignated() {
        stubSnapshot(Map.of(
                "state", "joinable",
                "participants", List.of(participant("p-1")),
                "matches", List.of(match("match-1")),
                "assignments", List.of(assignment("p-1", "match-1"))));

        assertThatThrownBy(() -> handler.handle(ctx()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.MISSING_COMMON_MATCH);
    }

    @Test
    void rejectsWhenCommonMatchNotInPool() {
        stubSnapshot(Map.of(
                "state", "joinable",
                "participants", List.of(participant("p-1")),
                "matches", List.of(match("match-1")),
                "commonMatchId", "match-does-not-exist",
                "assignments", List.of(assignment("p-1", "match-1"))));

        assertThatThrownBy(() -> handler.handle(ctx()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.INVALID_COMMON_MATCH);
    }

    @Test
    void rejectsWhenAParticipantHasNoAssignment() {
        stubSnapshot(Map.of(
                "state", "joinable",
                "participants", List.of(participant("p-1"), participant("p-2")),
                "matches", List.of(match("match-1")),
                "commonMatchId", "match-1",
                "assignments", List.of(assignment("p-1", "match-1"))));

        assertThatThrownBy(() -> handler.handle(ctx()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.UNASSIGNED_PARTICIPANTS);
    }

    @Test
    void anAssignmentOfOnlyTheCommonMatchDoesNotCountAsAnAdditionalAssignment() {
        stubSnapshot(Map.of(
                "state", "joinable",
                "participants", List.of(participant("p-1")),
                "matches", List.of(match("match-1")),
                "commonMatchId", "match-1",
                "assignments", List.of(assignment("p-1", "match-1"))));

        assertThatThrownBy(() -> handler.handle(ctx()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.UNASSIGNED_PARTICIPANTS);
    }

    @Test
    void doesNotCallStartGameSessionWhenValidationFails() {
        stubSnapshot(Map.of(
                "state", "in_progress",
                "participants", List.of(),
                "matches", List.of(),
                "assignments", List.of()));

        assertThatThrownBy(() -> handler.handle(ctx())).isInstanceOf(ApiException.class);

        verify(supabaseRestClient, never()).rpc(eq("start_game_session"), any(), anyString(), any());
    }

    private static SupabaseRestClient.SupabaseRpcException rpcException(String postgresMessage) {
        byte[] body = ("{\"message\":\"" + postgresMessage + "\"}").getBytes(StandardCharsets.UTF_8);
        RestClientResponseException cause = new RestClientResponseException(
                "Unprocessable Entity", HttpStatusCode.valueOf(422), "Unprocessable Entity",
                HttpHeaders.EMPTY, body, StandardCharsets.UTF_8);
        return new SupabaseRestClient.SupabaseRpcException("start_game_session", cause);
    }

    /**
     * start_game_session re-validates FR-006–FR-009 under its own row lock, as the
     * authoritative backstop for the optimistic {@link #validate} check above — closing the
     * race where the room's configuration changes between the get_room_snapshot read and this
     * call (e.g. a concurrent remove_room_match from a second device). Every backstop failure
     * string it can raise must map to the same ErrorCode the optimistic check would have used,
     * not fall through to INTERNAL_ERROR.
     */
    @ParameterizedTest
    @CsvSource({
            "empty_participants,EMPTY_PARTICIPANTS",
            "empty_matches,EMPTY_MATCHES",
            "missing_common_match,MISSING_COMMON_MATCH",
            "invalid_common_match,INVALID_COMMON_MATCH",
            "unassigned_participants,UNASSIGNED_PARTICIPANTS",
    })
    void mapsStartGameSessionBackstopFailuresToTheMatchingErrorCode(String postgresMessage, ErrorCode expected) {
        stubSnapshot(validSnapshot());
        when(supabaseRestClient.rpc(eq("start_game_session"), any(), anyString(), any()))
                .thenThrow(rpcException(postgresMessage));

        assertThatThrownBy(() -> handler.handle(ctx()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(expected);
    }
}
