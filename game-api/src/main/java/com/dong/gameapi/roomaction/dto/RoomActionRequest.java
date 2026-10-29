package com.dong.gameapi.roomaction.dto;

import java.util.Map;

/**
 * Request body for a room action.
 *
 * @param payload optional action-specific fields, such as {@code relaxConstraints} for start-game
 */
public record RoomActionRequest(Map<String, Object> payload) {
}
