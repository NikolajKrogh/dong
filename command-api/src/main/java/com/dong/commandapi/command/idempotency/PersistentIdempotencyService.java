package com.dong.commandapi.command.idempotency;

import com.dong.commandapi.command.CommandResult;
import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import com.dong.commandapi.security.AuthenticatedHost;
import com.dong.commandapi.supabase.SupabaseRestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Persistent, Postgres-backed idempotency store (research.md R7), replacing the
 * bootstrap {@code NoOpIdempotencyService}. Backed by {@code public.command_idempotency}
 * via {@code reserve_command_idempotency} / {@code complete_command_idempotency} /
 * {@code release_command_idempotency}, called under the host's own forwarded JWT
 * (R6) — never a {@code service_role} credential.
 */
@Service
public class PersistentIdempotencyService implements IdempotencyService {

    private static final Logger log = LoggerFactory.getLogger(PersistentIdempotencyService.class);

    /** Sub-second polling budget for an in-flight duplicate (data-model.md: ~5 attempts / ~500ms total). */
    private static final int IN_FLIGHT_MAX_ATTEMPTS = 5;
    private static final long IN_FLIGHT_POLL_DELAY_MS = 100L;

    private final SupabaseRestClient supabaseRestClient;

    public PersistentIdempotencyService(SupabaseRestClient supabaseRestClient) {
        this.supabaseRestClient = supabaseRestClient;
    }

    @Override
    public UUID validate(String rawHeader) {
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
    public IdempotencyDecision reserve(UUID idempotencyKey, String commandType, String roomId, AuthenticatedHost host) {
        for (int attempt = 1; attempt <= IN_FLIGHT_MAX_ATTEMPTS; attempt++) {
            Map<String, Object> response = supabaseRestClient.rpc(
                    "reserve_command_idempotency",
                    Map.of("idempotency_key", idempotencyKey.toString(), "command_type", commandType, "room_id", roomId),
                    host.rawToken(),
                    Map.class);

            String outcome = String.valueOf(response.get("outcome"));
            switch (outcome) {
                case "reserved" -> {
                    return new IdempotencyDecision.Proceed();
                }
                case "replay" -> {
                    CommandResult.Status status = CommandResult.Status.valueOf((String) response.get("responseStatus"));
                    Map<String, Object> detail = (Map<String, Object>) response.getOrDefault("responseDetail", Map.of());
                    return new IdempotencyDecision.Replay(new CommandResult(status, detail));
                }
                case "conflict" -> throw new ApiException(ErrorCode.IDEMPOTENCY_KEY_REUSE);
                case "in_flight" -> {
                    if (attempt == IN_FLIGHT_MAX_ATTEMPTS) {
                        break;
                    }
                    sleep();
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
    public void complete(UUID idempotencyKey, CommandResult result, AuthenticatedHost host) {
        Map<String, Object> params = new HashMap<>();
        params.put("idempotency_key", idempotencyKey.toString());
        params.put("response_status", result.status().name());
        params.put("response_detail", result.detail());
        try {
            supabaseRestClient.call("complete_command_idempotency", params, host.rawToken());
        } catch (RuntimeException ex) {
            // The handler already succeeded (its mutation is durable) — a failure to persist the
            // replay cache must not turn a successful command into a 500 for this caller. It does
            // leave the reservation row unresolved (a same-key retry will see it as in-flight and
            // eventually time out rather than replay), but that's the same accepted trade-off as
            // release()'s best-effort cleanup below, not a new one.
            log.warn("Failed to persist idempotency completion for key {}: {}", idempotencyKey, ex.getMessage());
        }
    }

    @Override
    public void release(UUID idempotencyKey, AuthenticatedHost host) {
        try {
            supabaseRestClient.call("release_command_idempotency",
                    Map.of("idempotency_key", idempotencyKey.toString()), host.rawToken());
        } catch (RuntimeException ex) {
            // Best-effort cleanup: a failed release just leaves a stale reservation behind
            // (reclaimable later) — it must never mask the original handler failure being rethrown.
            log.warn("Failed to release idempotency key {} after a handler failure: {}", idempotencyKey, ex.getMessage());
        }
    }

    private static void sleep() {
        try {
            Thread.sleep(IN_FLIGHT_POLL_DELAY_MS);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE, "Interrupted while waiting on a concurrent request.");
        }
    }
}
