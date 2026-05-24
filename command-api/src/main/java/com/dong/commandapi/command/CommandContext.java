package com.dong.commandapi.command;

import com.dong.commandapi.security.AuthenticatedHost;

import java.util.Map;

/**
 * Handler input (internal). Built by {@code CommandController}, passed through
 * {@code CommandDispatcher} to the resolved {@link CommandHandler}.
 *
 * @param roomId            target room (from path)
 * @param commandType       command type (from path)
 * @param rawIdempotencyKey raw {@code Idempotency-Key} header (validated by the dispatcher's idempotency seam)
 * @param host              authenticated caller
 * @param payload           optional request body
 */
public record CommandContext(
        String roomId,
        String commandType,
        String rawIdempotencyKey,
        AuthenticatedHost host,
        Map<String, Object> payload
) {
}
