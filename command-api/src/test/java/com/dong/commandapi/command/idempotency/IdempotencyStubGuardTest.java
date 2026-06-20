package com.dong.commandapi.command.idempotency;

import com.dong.commandapi.command.CommandHandler;
import com.dong.commandapi.command.EchoCommandHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the deliberately-incomplete idempotency stub.
 *
 * <p>{@link NoOpIdempotencyService} validates the {@code Idempotency-Key} format
 * but performs NO deduplication (issue #133), so a replayed command re-executes.
 * That is only safe while every wired {@link CommandHandler} is side-effect free.
 * This test fails the moment a second handler is added, forcing whoever adds the
 * first state-mutating command to replace the no-op store in the same change.
 */
@SpringBootTest(properties = {
        "supabase.jwt-secret=test-secret-which-is-at-least-thirty-two-bytes-long",
        "supabase.url=http://localhost:9"
})
class IdempotencyStubGuardTest {

    @Autowired
    private List<CommandHandler> commandHandlers;

    @Autowired
    private IdempotencyService idempotencyService;

    @Test
    void onlyTheNonMutatingEchoHandlerIsWiredWhileIdempotencyIsANoOp() {
        assertThat(idempotencyService).isInstanceOf(NoOpIdempotencyService.class);

        assertThat(commandHandlers)
                .as("NoOpIdempotencyService performs no deduplication (#133): a replayed command "
                        + "re-executes, which is only safe while all command handlers are side-effect "
                        + "free. If you are adding a state-mutating command, replace "
                        + "NoOpIdempotencyService with a persistent idempotency store in the same change.")
                .singleElement()
                .isInstanceOf(EchoCommandHandler.class);
    }
}
