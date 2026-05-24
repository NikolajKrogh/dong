package com.dong.commandapi.command;

import com.dong.commandapi.command.idempotency.IdempotencyService;
import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Registry (ADR-1). Auto-collects every {@link CommandHandler} bean into a map
 * keyed by {@link CommandHandler#commandType()}. Consults the idempotency seam
 * (ADR-7) before invoking the resolved handler.
 *
 * <p>#133 adds a handler bean → it self-registers here. No edits to this class.
 */
@Component
public class CommandDispatcher {

    private final Map<String, CommandHandler> registry;
    private final IdempotencyService idempotencyService;

    public CommandDispatcher(List<CommandHandler> handlers, IdempotencyService idempotencyService) {
        this.registry = handlers.stream()
                .collect(Collectors.toUnmodifiableMap(CommandHandler::commandType, Function.identity()));
        this.idempotencyService = idempotencyService;
    }

    public DispatchResult dispatch(CommandContext context) {
        UUID idempotencyKey = idempotencyService.validate(context.rawIdempotencyKey());

        CommandHandler handler = registry.get(context.commandType());
        if (handler == null) {
            throw new ApiException(ErrorCode.UNKNOWN_COMMAND,
                    "No handler registered for command type '" + context.commandType() + "'");
        }

        CommandResult result = handler.handle(context);
        return new DispatchResult(idempotencyKey, result);
    }

    /** Carries the validated key (for the response envelope) + the handler result. */
    public record DispatchResult(UUID idempotencyKey, CommandResult result) {
    }
}
