package com.dong.gameapi.roomaction.idempotency;

import com.dong.gameapi.roomaction.RoomActionResult;

/**
 * Outcome of {@link IdempotencyService#reserveAction}. The dispatcher only ever sees these
 * two shapes — the underlying {@code reserved}/{@code in_flight}/{@code conflict}/
 * {@code replay} outcomes from {@code reserve_command_idempotency} (research.md R7)
 * are fully resolved inside the service before returning.
 */
public sealed interface IdempotencyDecision {

    /** Fresh key (or an in-flight duplicate that resolved to the original failing and releasing): invoke the handler. */
    record Proceed() implements IdempotencyDecision {
        public static final Proceed INSTANCE = new Proceed();
    }

    /** A prior request already completed this exact action+room successfully: return the cached result, do not re-invoke the handler. */
    record Replay(RoomActionResult cachedResult) implements IdempotencyDecision {
    }
}
