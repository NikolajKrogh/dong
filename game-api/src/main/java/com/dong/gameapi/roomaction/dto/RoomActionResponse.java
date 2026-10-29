package com.dong.gameapi.roomaction.dto;

import java.time.Instant;

/**
 * Acknowledgement for an accepted room action; detailed room state is read separately.
 *
 * @param actionType action selected by the request path
 * @param roomId target room
 * @param idempotencyKey validated replay key
 * @param status action outcome, currently {@code ACCEPTED}
 * @param timestamp time the acknowledgement was created
 */
public record RoomActionResponse(
        String actionType,
        String roomId,
        String idempotencyKey,
        String status,
        Instant timestamp
) {
}
