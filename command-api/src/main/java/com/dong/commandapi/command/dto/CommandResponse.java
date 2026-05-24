package com.dong.commandapi.command.dto;

import java.time.Instant;

/**
 * Wire-out acknowledgement envelope. Mapped from {@code CommandResult} by the
 * controller — handler internals are not exposed.
 *
 * @param commandType    echoed from the path
 * @param roomId         echoed from the path
 * @param idempotencyKey echoed validated key
 * @param status         outcome (e.g. {@code ACCEPTED})
 * @param timestamp      server time of receipt (ISO-8601)
 */
public record CommandResponse(
        String commandType,
        String roomId,
        String idempotencyKey,
        String status,
        Instant timestamp
) {
}
