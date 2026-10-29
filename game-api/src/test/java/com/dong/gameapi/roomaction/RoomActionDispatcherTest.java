package com.dong.gameapi.roomaction;

import com.dong.gameapi.roomaction.idempotency.IdempotencyDecision;
import com.dong.gameapi.roomaction.idempotency.IdempotencyService;
import com.dong.gameapi.error.ApiException;
import com.dong.gameapi.error.ErrorCode;
import com.dong.gameapi.security.AuthenticatedHost;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RoomActionDispatcherTest {

    private final IdempotencyService idempotency = mock(IdempotencyService.class);
    private final AuthenticatedHost host = new AuthenticatedHost("host-1", "authenticated", "raw-jwt");

    private RoomActionHandler testHandler() {
        RoomActionHandler handler = mock(RoomActionHandler.class);
        when(handler.actionType()).thenReturn("test-action");
        when(handler.handleAction(any())).thenReturn(RoomActionResult.accepted());
        return handler;
    }

    private RoomActionContext ctx(String type) {
        return new RoomActionContext("room-1", type, "key", host, null);
    }

    @Test
    void knownTypeIsDispatchedToHandlerAndCompleted() {
        UUID key = UUID.randomUUID();
        when(idempotency.parseIdempotencyKey("key")).thenReturn(key);
        when(idempotency.reserveAction(key, "test-action", "room-1", host))
                .thenReturn(new IdempotencyDecision.Proceed());
        RoomActionDispatcher dispatcher = new RoomActionDispatcher(List.of(testHandler()), idempotency);

        RoomActionDispatcher.DispatchResult result = dispatcher.dispatchAction(ctx("test-action"));

        assertThat(result.idempotencyKey()).isEqualTo(key);
        assertThat(result.result().status()).isEqualTo(RoomActionResult.Status.ACCEPTED);
        verify(idempotency).saveActionResult(key, result.result(), host);
    }

    @Test
    void unknownTypeThrowsUnknownRoomActionWithoutTouchingIdempotencyStore() {
        when(idempotency.parseIdempotencyKey("key")).thenReturn(UUID.randomUUID());
        RoomActionDispatcher dispatcher = new RoomActionDispatcher(List.of(testHandler()), idempotency);

        assertThatThrownBy(() -> dispatcher.dispatchAction(ctx("does-not-exist")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.UNKNOWN_ROOM_ACTION);

        verify(idempotency, never()).reserveAction(any(), any(), any(), any());
    }

    @Test
    void idempotencyFailurePropagates() {
        when(idempotency.parseIdempotencyKey("key")).thenThrow(new ApiException(ErrorCode.INVALID_UUID));
        RoomActionDispatcher dispatcher = new RoomActionDispatcher(List.of(testHandler()), idempotency);

        assertThatThrownBy(() -> dispatcher.dispatchAction(ctx("test-action")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.INVALID_UUID);
    }

    @Test
    void replayShortCircuitsWithoutInvokingHandler() {
        UUID key = UUID.randomUUID();
        RoomActionResult cached = new RoomActionResult(RoomActionResult.Status.ACCEPTED, Map.of("replayed", true));
        when(idempotency.parseIdempotencyKey("key")).thenReturn(key);
        when(idempotency.reserveAction(key, "test-action", "room-1", host))
                .thenReturn(new IdempotencyDecision.Replay(cached));

        RoomActionHandler handler = mock(RoomActionHandler.class);
        when(handler.actionType()).thenReturn("test-action");
        RoomActionDispatcher dispatcher = new RoomActionDispatcher(List.of(handler), idempotency);

        RoomActionDispatcher.DispatchResult result = dispatcher.dispatchAction(ctx("test-action"));

        assertThat(result.result()).isSameAs(cached);
        verify(handler, never()).handleAction(any());
        verify(idempotency, never()).saveActionResult(any(), any(), any());
    }

    @Test
    void handlerFailureReleasesReservationAndRethrows() {
        UUID key = UUID.randomUUID();
        when(idempotency.parseIdempotencyKey("key")).thenReturn(key);
        when(idempotency.reserveAction(key, "boom", "room-1", host)).thenReturn(new IdempotencyDecision.Proceed());

        RuntimeException failure = new ApiException(ErrorCode.INVALID_ROOM_STATE);
        RoomActionHandler handler = mock(RoomActionHandler.class);
        when(handler.actionType()).thenReturn("boom");
        when(handler.handleAction(any())).thenThrow(failure);
        RoomActionDispatcher dispatcher = new RoomActionDispatcher(List.of(handler), idempotency);

        assertThatThrownBy(() -> dispatcher.dispatchAction(ctx("boom"))).isSameAs(failure);

        verify(idempotency).releaseActionReservation(key, host);
        verify(idempotency, never()).saveActionResult(any(), any(), any());
    }

    @Test
    void pendingProgressReleasesReservationWithoutCachingATerminalSuccess() {
        UUID key = UUID.randomUUID();
        when(idempotency.parseIdempotencyKey("key")).thenReturn(key);
        when(idempotency.reserveAction(key, "test-action", "room-1", host)).thenReturn(new IdempotencyDecision.Proceed());
        RoomActionHandler handler = testHandler();
        when(handler.handleAction(any())).thenReturn(new RoomActionResult(RoomActionResult.Status.ACCEPTED,
                Map.of("ok", false, "code", "room_processing_pending", "retryAfterSeconds", 1)));
        RoomActionDispatcher dispatcher = new RoomActionDispatcher(List.of(handler), idempotency);
        assertThat(dispatcher.dispatchAction(ctx("test-action")).result().detail().get("code")).isEqualTo("room_processing_pending");
        verify(idempotency).releaseActionReservation(key, host);
        verify(idempotency, never()).saveActionResult(any(), any(), any());
    }
}
