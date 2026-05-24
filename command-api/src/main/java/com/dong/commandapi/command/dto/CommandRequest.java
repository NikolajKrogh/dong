package com.dong.commandapi.command.dto;

import java.util.Map;

/**
 * Wire-in DTO. Optional free-form payload; ignored by the stub handler,
 * reserved for real commands (#133). Kept as a DTO (never an entity) per the
 * java-springboot skill.
 *
 * @param payload optional command-specific body
 */
public record CommandRequest(Map<String, Object> payload) {
}
