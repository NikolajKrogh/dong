package com.dong.gameapi.roomaction;

import com.dong.gameapi.security.AuthenticatedHost;

import java.util.Map;

/**
 * Handler input (internal). Built by {@code RoomActionController}, passed through
 * {@code RoomActionDispatcher} to the resolved {@link RoomActionHandler}.
 *
 * @param roomId            target room (from path)
 * @param actionType        action type (from path)
 * @param rawIdempotencyKey raw {@code Idempotency-Key} header (validated by the dispatcher's idempotency seam)
 * @param host              authenticated caller
 * @param payload           action-specific fields extracted from the request body's payload
 */
public record RoomActionContext(
        String roomId,
        String actionType,
        String rawIdempotencyKey,
        AuthenticatedHost host,
        Map<String, Object> payload
) {
}
