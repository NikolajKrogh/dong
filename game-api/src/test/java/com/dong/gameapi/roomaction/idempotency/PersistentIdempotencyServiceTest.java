package com.dong.gameapi.roomaction.idempotency;

import com.dong.gameapi.roomaction.RoomActionResult;
import com.dong.gameapi.error.ApiException;
import com.dong.gameapi.error.ErrorCode;
import com.dong.gameapi.security.AuthenticatedHost;
import com.dong.gameapi.supabase.SupabaseRpcClient;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PersistentIdempotencyServiceTest {

    @Test
    void pendingCannotBeCompletedEvenWhenCalledDirectly() {
        SupabaseRpcClient rpc = mock(SupabaseRpcClient.class);
        PersistentIdempotencyService service = new PersistentIdempotencyService(rpc);
        UUID key = UUID.randomUUID();
        AuthenticatedHost host = new AuthenticatedHost("host", "authenticated", "token");
        service.saveActionResult(key, new RoomActionResult(RoomActionResult.Status.ACCEPTED,
                Map.of("ok", false, "code", "room_processing_pending", "retryAfterSeconds", 1)), host);
        verify(rpc).invokeRpcWithoutResponse(eq("release_command_idempotency"), eq(Map.of("idempotency_key", key.toString())), eq("token"));
        verify(rpc, never()).invokeRpcWithoutResponse(eq("complete_command_idempotency"), any(), anyString());
    }

    private final SupabaseRpcClient supabaseRpcClient = mock(SupabaseRpcClient.class);
    private final PersistentIdempotencyService service = new PersistentIdempotencyService(supabaseRpcClient);
    private final AuthenticatedHost host = new AuthenticatedHost("host-1", "authenticated", "raw-jwt");

    @Test
    void validateRejectsMissingHeader() {
        assertThatThrownBy(() -> service.parseIdempotencyKey(null))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.MISSING_IDEMPOTENCY_KEY);
    }

    @Test
    void validateRejectsNonUuid() {
        assertThatThrownBy(() -> service.parseIdempotencyKey("not-a-uuid"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.INVALID_UUID);
    }

    @Test
    void validateAcceptsUuidV4() {
        UUID key = UUID.randomUUID();
        assertThat(service.parseIdempotencyKey(key.toString())).isEqualTo(key);
    }

    @SafeVarargs
    private final void stubReserveOutcome(Map<String, Object> first, Map<String, Object>... rest) {
        when(supabaseRpcClient.invokeRpc(eq("reserve_command_idempotency"), any(), anyString(), any()))
                .thenReturn(first, (Object[]) rest);
    }

    @Test
    void reserveReturnsProceedForFreshKey() {
        stubReserveOutcome(Map.of("outcome", "reserved"));

        IdempotencyDecision decision = service.reserveAction(UUID.randomUUID(), "start-game", "room-1", host);

        assertThat(decision).isInstanceOf(IdempotencyDecision.Proceed.class);
    }

    @Test
    void reserveReturnsReplayWithCachedResult() {
        stubReserveOutcome(Map.of(
                "outcome", "replay",
                "responseStatus", "ACCEPTED",
                "responseDetail", Map.of("sessionId", "room-1")));

        IdempotencyDecision decision = service.reserveAction(UUID.randomUUID(), "start-game", "room-1", host);

        assertThat(decision).isInstanceOf(IdempotencyDecision.Replay.class);
        RoomActionResult cached = ((IdempotencyDecision.Replay) decision).cachedResult();
        assertThat(cached.status()).isEqualTo(RoomActionResult.Status.ACCEPTED);
        assertThat(cached.detail()).containsEntry("sessionId", "room-1");
    }

    @Test
    void reserveThrowsConflictForCrossActionKeyReuse() {
        stubReserveOutcome(Map.of("outcome", "conflict"));

        assertThatThrownBy(() -> service.reserveAction(UUID.randomUUID(), "start-game", "room-1", host))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.IDEMPOTENCY_KEY_REUSE);
    }

    @Test
    void reserveResolvesInFlightToReplayOnceTheOriginalCompletes() {
        stubReserveOutcome(
                Map.of("outcome", "in_flight"),
                Map.of("outcome", "replay", "responseStatus", "ACCEPTED", "responseDetail", Map.of()));

        IdempotencyDecision decision = service.reserveAction(UUID.randomUUID(), "start-game", "room-1", host);

        assertThat(decision).isInstanceOf(IdempotencyDecision.Replay.class);
        verify(supabaseRpcClient, times(2)).invokeRpc(eq("reserve_command_idempotency"), any(), anyString(), any());
    }

    @Test
    void reserveGivesUpAfterExhaustingInFlightBackoff() {
        stubReserveOutcome(Map.of("outcome", "in_flight"));

        assertThatThrownBy(() -> service.reserveAction(UUID.randomUUID(), "start-game", "room-1", host))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.SERVICE_UNAVAILABLE);
    }

    @Test
    void completeSendsSuccessStatusAndDetail() {
        UUID key = UUID.randomUUID();
        RoomActionResult result = new RoomActionResult(RoomActionResult.Status.ACCEPTED, Map.of("sessionId", "room-1"));

        service.saveActionResult(key, result, host);

        verify(supabaseRpcClient).invokeRpcWithoutResponse(eq("complete_command_idempotency"), eq(Map.of(
                "idempotency_key", key.toString(),
                "response_status", "ACCEPTED",
                "response_detail", Map.of("sessionId", "room-1"))), eq("raw-jwt"));
    }

    @Test
    void releaseSwallowsFailuresInsteadOfMaskingTheOriginalException() {
        UUID key = UUID.randomUUID();
        doThrow(new RuntimeException("network blip"))
                .when(supabaseRpcClient).invokeRpcWithoutResponse(anyString(), any(), anyString());

        service.releaseActionReservation(key, host);

        verify(supabaseRpcClient).invokeRpcWithoutResponse(eq("release_command_idempotency"), eq(Map.of("idempotency_key", key.toString())), eq("raw-jwt"));
    }

    @Test
    void completeSwallowsFailuresInsteadOfFailingAnAlreadySuccessfulCommand() {
        UUID key = UUID.randomUUID();
        RoomActionResult result = new RoomActionResult(RoomActionResult.Status.ACCEPTED, Map.of("sessionId", "room-1"));
        doThrow(new RuntimeException("network blip"))
                .when(supabaseRpcClient).invokeRpcWithoutResponse(anyString(), any(), anyString());

        service.saveActionResult(key, result, host);

        verify(supabaseRpcClient).invokeRpcWithoutResponse(eq("complete_command_idempotency"), any(), eq("raw-jwt"));
    }
}
