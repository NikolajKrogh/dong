package com.dong.commandapi.command;

/**
 * Strategy port (ADR-1). One {@code @Component} per command type. The
 * dispatcher auto-collects every bean into a registry keyed by
 * {@link #commandType()}.
 *
 * <p>#133 adds real commands by dropping new implementations into their feature
 * package (e.g. {@code match/}) — zero edits to the controller or dispatcher.
 */
public interface CommandHandler {

    /** The command type this handler serves (the path {@code {commandType}}). */
    String commandType();

    CommandResult handle(CommandContext context);
}
