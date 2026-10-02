package com.dong.commandapi.testsupport;

import com.dong.commandapi.command.CommandContext;
import com.dong.commandapi.command.CommandHandler;
import com.dong.commandapi.command.CommandResult;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/** Envelope fixture registered only by tests, never by the production component scan. */
@TestConfiguration
public class TestCommandConfig {
    @Bean
    CommandHandler envelopeTestCommand() {
        return new CommandHandler() {
            public String commandType() { return "test-command"; }
            public CommandResult handle(CommandContext context) { return CommandResult.accepted(); }
        };
    }
}
