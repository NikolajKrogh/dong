package com.dong.gameapi.supabase;

import com.dong.gameapi.error.ApiException;
import com.dong.gameapi.error.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.Map;

/**
 * Calls Supabase PostgREST RPC endpoints under a specific host's own forwarded JWT
 * (research.md R6) — distinct from {@link HttpSupabaseHealthProbe}, which only
 * performs the unauthenticated health probe. Every call carries the project's
 * {@code apikey} header (required by the API gateway in front of PostgREST) plus
 * the host's {@code Authorization: Bearer <token>}, so Postgres RLS evaluates the
 * request as that user — never a {@code service_role} credential.
 *
 * <p>Used by {@code StartGameActionHandler} (room RPCs) and
 * {@code PersistentIdempotencyService} (the {@code command_idempotency} RPCs).
 */
@Component
public class SupabaseRpcClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final int ROOM_PROCESSING_MAX_ATTEMPTS = 3;

    private final RestClient restClient;
    private final String anonKey;
    private final Runnable pendingDelay;

    @Autowired
    public SupabaseRpcClient(SupabaseProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) TIMEOUT.toMillis());
        factory.setReadTimeout((int) TIMEOUT.toMillis());
        this.restClient = RestClient.builder()
                .baseUrl(properties.url() + "/rest/v1")
                .requestFactory(factory)
                .build();
        this.anonKey = properties.anonKey();
        this.pendingDelay = () -> {
            try {
                Thread.sleep(1_000);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE);
            }
        };
    }

    SupabaseRpcClient(RestClient restClient, String anonKey, Runnable pendingDelay) {
        this.restClient = restClient;
        this.anonKey = anonKey;
        this.pendingDelay = pendingDelay;
    }

    /**
     * Invokes {@code POST /rest/v1/rpc/{functionName}} with {@code params} as the
     * JSON body, authenticated as {@code hostBearerToken}.
     * Pending room processing retries the same payload and replay key up to three
     * attempts, then throws {@link RoomProcessingPendingException}.
     *
     * @param responseType the RPC's declared return shape ({@code Map} for a
     *                      {@code jsonb} object, {@code String}/{@code UUID}-typed
     *                      wrappers are not auto-unwrapped by PostgREST; scalar
     *                      returns are read as their raw JSON representation)
     */
    public <T> T invokeRpc(String functionName, Map<String, Object> params, String hostBearerToken, Class<T> responseType) {
        requireApiKey();
        try {
            for (int attempt = 1; attempt <= ROOM_PROCESSING_MAX_ATTEMPTS; attempt++) {
                T result = restClient.post()
                    .uri("/rpc/{fn}", functionName)
                    .header("apikey", anonKey)
                    .header("Authorization", "Bearer " + hostBearerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(params)
                    .retrieve()
                    .body(responseType);
                if (!isRoomProcessingPending(result)) return result;
                if (attempt < ROOM_PROCESSING_MAX_ATTEMPTS) {
                    // Retry the original params and key. Accepted score processing may have
                    // advanced the sequence; do not silently refresh that precondition.
                    pendingDelay.run();
                }
            }
            throw new RoomProcessingPendingException();
        } catch (RestClientResponseException ex) {
            throw new SupabaseRpcException(functionName, ex);
        }
    }

    public static boolean isRoomProcessingPending(Object value) {
        return value instanceof Map<?, ?> result && Boolean.FALSE.equals(result.get("ok"))
                && "room_processing_pending".equals(result.get("code"));
    }

    /** Builds the retryable response used when accepted room updates are still processing. */
    public static Map<String, Object> createRoomProcessingPendingResponse() {
        return Map.of("ok", false, "code", "room_processing_pending", "retryAfterSeconds", 1);
    }

    public static final class RoomProcessingPendingException extends RuntimeException {
        public RoomProcessingPendingException() { super("room_processing_pending"); }
    }

    /** Invokes a {@code void}-returning RPC (no response body expected). */
    public void invokeRpcWithoutResponse(String functionName, Map<String, Object> params, String hostBearerToken) {
        requireApiKey();
        try {
            restClient.post()
                    .uri("/rpc/{fn}", functionName)
                    .header("apikey", anonKey)
                    .header("Authorization", "Bearer " + hostBearerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(params)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            throw new SupabaseRpcException(functionName, ex);
        }
    }

    private void requireApiKey() {
        if (!StringUtils.hasText(anonKey)) {
            throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE,
                    "Supabase anon key is not configured (SUPABASE_ANON_KEY); cannot call authenticated RPCs.");
        }
    }

    /**
     * Wraps a non-2xx PostgREST response, exposing the underlying Postgres
     * {@code RAISE EXCEPTION} message (e.g. {@code not_host}, {@code invalid_room_state})
     * that handlers switch on to map to a domain {@link ErrorCode}.
     */
    public static final class SupabaseRpcException extends RuntimeException {
        private static final ObjectMapper MAPPER = new ObjectMapper();

        private final int statusCode;
        private final String postgresMessage;

        public SupabaseRpcException(String functionName, RestClientResponseException cause) {
            super("Supabase RPC '" + functionName + "' failed (" + cause.getStatusCode() + "): "
                    + cause.getResponseBodyAsString(), cause);
            this.statusCode = cause.getStatusCode().value();
            this.postgresMessage = extractPostgresMessage(cause.getResponseBodyAsString());
        }

        private static String extractPostgresMessage(String body) {
            if (!StringUtils.hasText(body)) {
                return "";
            }
            try {
                JsonNode node = MAPPER.readTree(body);
                JsonNode message = node.get("message");
                return message != null ? message.asText("") : "";
            } catch (Exception ex) {
                return "";
            }
        }

        public int statusCode() {
            return statusCode;
        }

        /** The plain {@code RAISE EXCEPTION 'xxx'} message text, or empty if the body wasn't the usual PostgREST error shape. */
        public String postgresMessage() {
            return postgresMessage;
        }
    }
}
