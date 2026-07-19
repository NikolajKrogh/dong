package com.dong.commandapi.command.idempotency;

import com.dong.commandapi.command.CommandResult;
import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import com.dong.commandapi.security.AuthenticatedHost;
import com.dong.commandapi.supabase.SupabaseRestClient;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PersistentIdempotencyServiceTest {

    private final SupabaseRestClient supabaseRestClient = mock(SupabaseRestClient.class);
    private final PersistentIdempotencyService service = new PersistentIdempotencyService(supabaseRestClient);
    private final AuthenticatedHost host = new AuthenticatedHost("host-1", "authenticated", "raw-jwt");

    @Test
    void validateRejectsMissingHeader() {
        assertThatThrownBy(() -> service.validate(null))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.MISSING_IDEMPOTENCY_KEY);
    }

    @Test
    void validateRejectsNonUuid() {
        assertThatThrownBy(() -> service.validate("not-a-uuid"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.INVALID_UUID);
    }

    @Test
    void validateAcceptsUuidV4() {
        UUID key = UUID.randomUUID();
        assertThat(service.validate(key.toString())).isEqualTo(key);
    }

    @SafeVarargs
    private final void stubReserveOutcome(Map<String, Object> first, Map<String, Object>... rest) {
        when(supabaseRestClient.rpc(eq("reserve_command_idempotency"), any(), anyString(), any()))
                .thenReturn(first, rest);
    }

    @Test
    void reserveReturnsProceedForFreshKey() {
        stubReserveOutcome(Map.of("outcome", "reserved"));

        IdempotencyDecision decision = service.reserve(UUID.randomUUID(), "start-game", "room-1", host);

        assertThat(decision).isInstanceOf(IdempotencyDecision.Proceed.class);
    }

    @Test
    void reserveReturnsReplayWithCachedResult() {
        stubReserveOutcome(Map.of(
                "outcome", "replay",
                "responseStatus", "ACCEPTED",
                "responseDetail", Map.of("sessionId", "room-1")));

        IdempotencyDecision decision = service.reserve(UUID.randomUUID(), "start-game", "room-1", host);

        assertThat(decision).isInstanceOf(IdempotencyDecision.Replay.class);
        CommandResult cached = ((IdempotencyDecision.Replay) decision).cachedResult();
        assertThat(cached.status()).isEqualTo(CommandResult.Status.ACCEPTED);
        assertThat(cached.detail()).containsEntry("sessionId", "room-1");
    }

    @Test
    void reserveThrowsConflictForCrossCommandKeyReuse() {
        stubReserveOutcome(Map.of("outcome", "conflict"));

        assertThatThrownBy(() -> service.reserve(UUID.randomUUID(), "start-game", "room-1", host))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.IDEMPOTENCY_KEY_REUSE);
    }

    @Test
    void reserveResolvesInFlightToReplayOnceTheOriginalCompletes() {
        stubReserveOutcome(
                Map.of("outcome", "in_flight"),
                Map.of("outcome", "replay", "responseStatus", "ACCEPTED", "responseDetail", Map.of()));

        IdempotencyDecision decision = service.reserve(UUID.randomUUID(), "start-game", "room-1", host);

        assertThat(decision).isInstanceOf(IdempotencyDecision.Replay.class);
        verify(supabaseRestClient, times(2)).rpc(eq("reserve_command_idempotency"), any(), anyString(), any());
    }

    @Test
    void reserveGivesUpAfterExhaustingInFlightBackoff() {
        stubReserveOutcome(Map.of("outcome", "in_flight"));

        assertThatThrownBy(() -> service.reserve(UUID.randomUUID(), "start-game", "room-1", host))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.SERVICE_UNAVAILABLE);
    }

    @Test
    void completeSendsSuccessStatusAndDetail() {
        UUID key = UUID.randomUUID();
        CommandResult result = new CommandResult(CommandResult.Status.ACCEPTED, Map.of("sessionId", "room-1"));

        service.complete(key, result, host);

        verify(supabaseRestClient).call(eq("complete_command_idempotency"), eq(Map.of(
                "idempotency_key", key.toString(),
                "response_status", "ACCEPTED",
                "response_detail", Map.of("sessionId", "room-1"))), eq("raw-jwt"));
    }

    @Test
    void releaseSwallowsFailuresInsteadOfMaskingTheOriginalException() {
        UUID key = UUID.randomUUID();
        doThrow(new RuntimeException("network blip"))
                .when(supabaseRestClient).call(anyString(), any(), anyString());

        service.release(key, host);

        verify(supabaseRestClient).call(eq("release_command_idempotency"), eq(Map.of("idempotency_key", key.toString())), eq("raw-jwt"));
    }

    @Test
    void completeSwallowsFailuresInsteadOfFailingAnAlreadySuccessfulCommand() {
        UUID key = UUID.randomUUID();
        CommandResult result = new CommandResult(CommandResult.Status.ACCEPTED, Map.of("sessionId", "room-1"));
        doThrow(new RuntimeException("network blip"))
                .when(supabaseRestClient).call(anyString(), any(), anyString());

        service.complete(key, result, host);

        verify(supabaseRestClient).call(eq("complete_command_idempotency"), any(), eq("raw-jwt"));
    }
}
