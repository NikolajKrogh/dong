package com.dong.commandapi.command;

import org.springframework.stereotype.Component;

/**
 * The only handler shipped in the bootstrap (issue #132). Serves command type
 * {@code "echo"} and acknowledges with {@code ACCEPTED}, demonstrating the
 * standard envelope. Real commands (e.g. {@code start-round}) arrive in #133 as
 * their own handlers — an unknown type correctly yields {@code UNKNOWN_COMMAND}.
 */
@Component
public class EchoCommandHandler implements CommandHandler {

    public static final String TYPE = "echo";

    @Override
    public String commandType() {
        return TYPE;
    }

    @Override
    public CommandResult handle(CommandContext context) {
        return CommandResult.accepted();
    }
}
