package com.dong.commandapi.command;

import com.dong.commandapi.command.idempotency.IdempotencyDecision;
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
 * (ADR-7) both before AND after invoking the resolved handler: a fresh key
 * reserves and proceeds; a replay short-circuits to the cached result without
 * re-invoking the handler; a handler failure releases the reservation so the
 * same key can be retried from scratch (research.md R7).
 *
 * <p>A new handler bean self-registers here — no edits to this class.
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

        IdempotencyDecision decision = idempotencyService.reserve(
                idempotencyKey, context.commandType(), context.roomId(), context.host());
        if (decision instanceof IdempotencyDecision.Replay replay) {
            return new DispatchResult(idempotencyKey, replay.cachedResult());
        }

        CommandResult result;
        try {
            result = handler.handle(context);
        } catch (RuntimeException ex) {
            idempotencyService.release(idempotencyKey, context.host());
            throw ex;
        }

        idempotencyService.complete(idempotencyKey, result, context.host());
        return new DispatchResult(idempotencyKey, result);
    }

    /** Carries the validated key (for the response envelope) + the handler result. */
    public record DispatchResult(UUID idempotencyKey, CommandResult result) {
    }
}
