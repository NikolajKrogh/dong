package com.dong.gameapi.roomaction;

import com.dong.gameapi.roomaction.idempotency.IdempotencyDecision;
import com.dong.gameapi.roomaction.idempotency.IdempotencyService;
import com.dong.gameapi.error.ApiException;
import com.dong.gameapi.error.ErrorCode;
import com.dong.gameapi.supabase.SupabaseRpcClient;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Routes a room action to its registered handler and coordinates duplicate requests.
 * A completed request returns its saved result. Handler failures and pending room
 * processing release the reservation so the same request can be retried.
 * Register a {@link RoomActionHandler} bean to support another action type.
 */
@Component
public class RoomActionDispatcher {

    private final Map<String, RoomActionHandler> registry;
    private final IdempotencyService idempotencyService;

    public RoomActionDispatcher(List<RoomActionHandler> handlers, IdempotencyService idempotencyService) {
        this.registry = handlers.stream()
                .collect(Collectors.toUnmodifiableMap(RoomActionHandler::actionType, Function.identity()));
        this.idempotencyService = idempotencyService;
    }

    /** Validates the replay key, resolves duplicates, then invokes the matching action handler. */
    public DispatchResult dispatchAction(RoomActionContext context) {
        UUID idempotencyKey = idempotencyService.parseIdempotencyKey(context.rawIdempotencyKey());

        RoomActionHandler handler = registry.get(context.actionType());
        if (handler == null) {
            throw new ApiException(ErrorCode.UNKNOWN_ROOM_ACTION,
                    "No handler registered for action type '" + context.actionType() + "'");
        }

        IdempotencyDecision decision = idempotencyService.reserveAction(
                idempotencyKey, context.actionType(), context.roomId(), context.host());
        if (decision instanceof IdempotencyDecision.Replay replay) {
            return new DispatchResult(idempotencyKey, replay.cachedResult());
        }

        RoomActionResult result;
        try {
            result = handler.handleAction(context);
        } catch (RuntimeException ex) {
            idempotencyService.releaseActionReservation(idempotencyKey, context.host());
            throw ex;
        }

        if (SupabaseRpcClient.isRoomProcessingPending(result.detail())) {
            idempotencyService.releaseActionReservation(idempotencyKey, context.host());
        } else {
            idempotencyService.saveActionResult(idempotencyKey, result, context.host());
        }
        return new DispatchResult(idempotencyKey, result);
    }

    /** Carries the validated key (for the response envelope) + the handler result. */
    public record DispatchResult(UUID idempotencyKey, RoomActionResult result) {
    }
}
