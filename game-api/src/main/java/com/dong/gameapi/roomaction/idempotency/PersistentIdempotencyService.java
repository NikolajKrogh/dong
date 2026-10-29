package com.dong.gameapi.roomaction.idempotency;

import com.dong.gameapi.roomaction.RoomActionResult;
import com.dong.gameapi.error.ApiException;
import com.dong.gameapi.error.ErrorCode;
import com.dong.gameapi.security.AuthenticatedHost;
import com.dong.gameapi.supabase.SupabaseRpcClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Stores room-action reservations and results in Postgres under the host's forwarded JWT.
 * The existing {@code command_idempotency} table and its reserve/complete/release
 * RPCs retain their database names; Java exposes their room-action responsibility.
 * Duplicate requests are polled within a bounded budget before asking the caller to retry.
 */
@Service
public class PersistentIdempotencyService implements IdempotencyService {

    private static final Logger log = LoggerFactory.getLogger(PersistentIdempotencyService.class);

    /** Sub-second polling budget for an in-flight duplicate (data-model.md: ~5 attempts / ~500ms total). */
    private static final int IN_FLIGHT_MAX_ATTEMPTS = 5;
    private static final long IN_FLIGHT_POLL_DELAY_MS = 100L;

    private final SupabaseRpcClient supabaseRpcClient;

    public PersistentIdempotencyService(SupabaseRpcClient supabaseRpcClient) {
        this.supabaseRpcClient = supabaseRpcClient;
    }

    @Override
    public UUID parseIdempotencyKey(String rawHeader) {
        if (!StringUtils.hasText(rawHeader)) {
            throw new ApiException(ErrorCode.MISSING_IDEMPOTENCY_KEY);
        }
        final UUID parsed;
        try {
            parsed = UUID.fromString(rawHeader.trim());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(ErrorCode.INVALID_UUID);
        }
        if (parsed.version() != 4) {
            throw new ApiException(ErrorCode.INVALID_UUID, "Idempotency-Key must be a UUID version 4");
        }
        return parsed;
    }

    @Override
    @SuppressWarnings({"unchecked", "rawtypes"})
    public IdempotencyDecision reserveAction(UUID idempotencyKey, String actionType, String roomId, AuthenticatedHost host) {
        for (int attempt = 1; attempt <= IN_FLIGHT_MAX_ATTEMPTS; attempt++) {
            Map<String, Object> response = supabaseRpcClient.invokeRpc(
                    "reserve_command_idempotency",
                    Map.of("idempotency_key", idempotencyKey.toString(), "command_type", actionType, "room_id", roomId),
                    host.rawToken(),
                    Map.class);

            String outcome = String.valueOf(response.get("outcome"));
            switch (outcome) {
                case "reserved" -> {
                    return new IdempotencyDecision.Proceed();
                }
                case "replay" -> {
                    RoomActionResult.Status status = RoomActionResult.Status.valueOf((String) response.get("responseStatus"));
                    Map<String, Object> detail = (Map<String, Object>) response.getOrDefault("responseDetail", Map.of());
                    return new IdempotencyDecision.Replay(new RoomActionResult(status, detail));
                }
                case "conflict" -> throw new ApiException(ErrorCode.IDEMPOTENCY_KEY_REUSE);
                case "in_flight" -> {
                    if (attempt < IN_FLIGHT_MAX_ATTEMPTS) waitForOriginalRequest();
                }
                default -> throw new ApiException(ErrorCode.INTERNAL_ERROR,
                        "Unexpected reserve_command_idempotency outcome: " + outcome);
            }
        }
        log.warn("Idempotency key {} never resolved after {} attempts; asking the client to retry.",
                idempotencyKey, IN_FLIGHT_MAX_ATTEMPTS);
        throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE,
                "The original request with this Idempotency-Key has not finished yet. Please retry.");
    }

    @Override
    public void saveActionResult(UUID idempotencyKey, RoomActionResult result, AuthenticatedHost host) {
        if (SupabaseRpcClient.isRoomProcessingPending(result.detail())) {
            releaseActionReservation(idempotencyKey, host);
            return;
        }
        Map<String, Object> params = new HashMap<>();
        params.put("idempotency_key", idempotencyKey.toString());
        params.put("response_status", result.status().name());
        params.put("response_detail", result.detail());
        try {
            supabaseRpcClient.invokeRpcWithoutResponse("complete_command_idempotency", params, host.rawToken());
        } catch (RuntimeException ex) {
            // The handler already succeeded (its mutation is durable) — a failure to persist the
            // replay cache must not turn a successful action into a 500 for this caller. It does
            // leave the reservation row unresolved (a same-key retry will see it as in-flight and
            // eventually time out rather than replay), but that's the same accepted trade-off as
            // releaseActionReservation()'s best-effort cleanup below, not a new one.
            log.warn("Failed to persist idempotency completion for key {}: {}", idempotencyKey, ex.getMessage());
        }
    }

    @Override
    public void releaseActionReservation(UUID idempotencyKey, AuthenticatedHost host) {
        try {
            supabaseRpcClient.invokeRpcWithoutResponse("release_command_idempotency",
                    Map.of("idempotency_key", idempotencyKey.toString()), host.rawToken());
        } catch (RuntimeException ex) {
            // Best-effort cleanup: a failed release just leaves a stale reservation behind
            // (reclaimable later) — it must never mask the original handler failure being rethrown.
            log.warn("Failed to release idempotency key {} after a handler failure: {}", idempotencyKey, ex.getMessage());
        }
    }

    private static void waitForOriginalRequest() {
        try {
            Thread.sleep(IN_FLIGHT_POLL_DELAY_MS);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE, "Interrupted while waiting on a concurrent request.");
        }
    }
}
