package com.dong.commandapi.command.idempotency;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression guard, not a bootstrap tripwire anymore.
 *
 * <p>This test originally forced whoever wired the first state-mutating
 * {@code CommandHandler} to replace the bootstrap {@code NoOpIdempotencyService}
 * (format validation only, no dedup) with a persistent store in the same change —
 * see git history / research.md R7 for the migration. That work has landed
 * ({@link PersistentIdempotencyService}, backed by {@code public.command_idempotency}),
 * so the original no-op class is gone entirely. What remains is a cheap regression
 * check: the wired {@link IdempotencyService} must never silently become a no-op again.
 */
@SpringBootTest(properties = {
        "supabase.jwks-url=https://example.invalid/.well-known/jwks.json",
        "supabase.url=http://localhost:9"
})
class IdempotencyStubGuardTest {

    @Autowired
    private IdempotencyService idempotencyService;

    @Test
    void persistentIdempotencyServiceIsWired() {
        assertThat(idempotencyService)
                .as("The dispatch-layer idempotency store must be a persistent implementation "
                        + "(research.md R7) — a replayed/in-flight command relies on real dedup, "
                        + "not just Idempotency-Key format validation.")
                .isInstanceOf(PersistentIdempotencyService.class);
    }
}
