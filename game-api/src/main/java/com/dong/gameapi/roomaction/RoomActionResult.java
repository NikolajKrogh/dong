package com.dong.gameapi.roomaction;

import java.util.Map;

/**
 * Internal handler outcome, including details required for replay and pending-work detection.
 * The controller emits the acknowledgement fields, or a pending-processing response,
 * rather than serializing this record directly.
 */
public record RoomActionResult(Status status, Map<String, Object> detail) {

    public enum Status { ACCEPTED }

    public static RoomActionResult accepted() {
        return new RoomActionResult(Status.ACCEPTED, Map.of());
    }
}
