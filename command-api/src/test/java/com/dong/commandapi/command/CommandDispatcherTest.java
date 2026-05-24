package com.dong.commandapi.command;

import com.dong.commandapi.command.idempotency.IdempotencyService;
import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import com.dong.commandapi.security.AuthenticatedHost;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CommandDispatcherTest {

    private final IdempotencyService idempotency = mock(IdempotencyService.class);

    private CommandContext ctx(String type) {
        return new CommandContext("room-1", type, "key", new AuthenticatedHost("host-1", "authenticated"), null);
    }

    @Test
    void knownTypeIsDispatchedToHandler() {
        UUID key = UUID.randomUUID();
        when(idempotency.validate("key")).thenReturn(key);
        CommandDispatcher dispatcher = new CommandDispatcher(List.of(new EchoCommandHandler()), idempotency);

        CommandDispatcher.DispatchResult result = dispatcher.dispatch(ctx(EchoCommandHandler.TYPE));

        assertThat(result.idempotencyKey()).isEqualTo(key);
        assertThat(result.result().status()).isEqualTo(CommandResult.Status.ACCEPTED);
    }

    @Test
    void unknownTypeThrowsUnknownCommand() {
        when(idempotency.validate("key")).thenReturn(UUID.randomUUID());
        CommandDispatcher dispatcher = new CommandDispatcher(List.of(new EchoCommandHandler()), idempotency);

        assertThatThrownBy(() -> dispatcher.dispatch(ctx("does-not-exist")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.UNKNOWN_COMMAND);
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
}
