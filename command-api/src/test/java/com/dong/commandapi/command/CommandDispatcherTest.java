package com.dong.commandapi.command;

import com.dong.commandapi.command.idempotency.IdempotencyDecision;
import com.dong.commandapi.command.idempotency.IdempotencyService;
import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import com.dong.commandapi.security.AuthenticatedHost;
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

class CommandDispatcherTest {

    private final IdempotencyService idempotency = mock(IdempotencyService.class);
    private final AuthenticatedHost host = new AuthenticatedHost("host-1", "authenticated", "raw-jwt");

    private CommandContext ctx(String type) {
        return new CommandContext("room-1", type, "key", host, null);
    }

    @Test
    void knownTypeIsDispatchedToHandlerAndCompleted() {
        UUID key = UUID.randomUUID();
        when(idempotency.validate("key")).thenReturn(key);
        when(idempotency.reserve(key, EchoCommandHandler.TYPE, "room-1", host))
                .thenReturn(new IdempotencyDecision.Proceed());
        CommandDispatcher dispatcher = new CommandDispatcher(List.of(new EchoCommandHandler()), idempotency);

        CommandDispatcher.DispatchResult result = dispatcher.dispatch(ctx(EchoCommandHandler.TYPE));

        assertThat(result.idempotencyKey()).isEqualTo(key);
        assertThat(result.result().status()).isEqualTo(CommandResult.Status.ACCEPTED);
        verify(idempotency).complete(key, result.result(), host);
    }

    @Test
    void unknownTypeThrowsUnknownCommandWithoutTouchingIdempotencyStore() {
        when(idempotency.validate("key")).thenReturn(UUID.randomUUID());
        CommandDispatcher dispatcher = new CommandDispatcher(List.of(new EchoCommandHandler()), idempotency);

        assertThatThrownBy(() -> dispatcher.dispatch(ctx("does-not-exist")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.UNKNOWN_COMMAND);

        verify(idempotency, never()).reserve(any(), any(), any(), any());
    }

    @Test
    void idempotencyFailurePropagates() {
        when(idempotency.validate("key")).thenThrow(new ApiException(ErrorCode.INVALID_UUID));
        CommandDispatcher dispatcher = new CommandDispatcher(List.of(new EchoCommandHandler()), idempotency);

        assertThatThrownBy(() -> dispatcher.dispatch(ctx(EchoCommandHandler.TYPE)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.INVALID_UUID);
    }

    @Test
    void replayShortCircuitsWithoutInvokingHandler() {
        UUID key = UUID.randomUUID();
        CommandResult cached = new CommandResult(CommandResult.Status.ACCEPTED, Map.of("replayed", true));
        when(idempotency.validate("key")).thenReturn(key);
        when(idempotency.reserve(key, EchoCommandHandler.TYPE, "room-1", host))
                .thenReturn(new IdempotencyDecision.Replay(cached));

        CommandHandler handler = mock(CommandHandler.class);
        when(handler.commandType()).thenReturn(EchoCommandHandler.TYPE);
        CommandDispatcher dispatcher = new CommandDispatcher(List.of(handler), idempotency);

        CommandDispatcher.DispatchResult result = dispatcher.dispatch(ctx(EchoCommandHandler.TYPE));

        assertThat(result.result()).isSameAs(cached);
        verify(handler, never()).handle(any());
        verify(idempotency, never()).complete(any(), any(), any());
    }

    @Test
    void handlerFailureReleasesReservationAndRethrows() {
        UUID key = UUID.randomUUID();
        when(idempotency.validate("key")).thenReturn(key);
        when(idempotency.reserve(key, "boom", "room-1", host)).thenReturn(new IdempotencyDecision.Proceed());

        RuntimeException failure = new ApiException(ErrorCode.INVALID_ROOM_STATE);
        CommandHandler handler = mock(CommandHandler.class);
        when(handler.commandType()).thenReturn("boom");
        when(handler.handle(any())).thenThrow(failure);
        CommandDispatcher dispatcher = new CommandDispatcher(List.of(handler), idempotency);

        assertThatThrownBy(() -> dispatcher.dispatch(ctx("boom"))).isSameAs(failure);

        verify(idempotency).release(key, host);
        verify(idempotency, never()).complete(any(), any(), any());
    }
}
