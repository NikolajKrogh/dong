package com.dong.commandapi.command;

import java.util.Map;

/**
 * Handler output (internal). May carry domain detail; the controller maps it to
 * the wire {@code CommandResponse}. Handler internals never leak to clients
 * (boundary rule, plan.md).
 */
public record CommandResult(Status status, Map<String, Object> detail) {

    public enum Status { ACCEPTED }

    public static CommandResult accepted() {
        return new CommandResult(Status.ACCEPTED, Map.of());
    }
}
