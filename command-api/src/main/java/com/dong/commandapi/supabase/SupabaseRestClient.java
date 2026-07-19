package com.dong.commandapi.supabase;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * (research.md R6) — distinct from {@link RestClientSupabaseClient}, which only
 * performs the unauthenticated health probe. Every call carries the project's
 * {@code apikey} header (required by the API gateway in front of PostgREST) plus
 * the host's {@code Authorization: Bearer <token>}, so Postgres RLS evaluates the
 * request as that user — never a {@code service_role} credential.
 *
 * <p>Used by {@code StartGameCommandHandler} (room RPCs) and
 * {@code PersistentIdempotencyService} (the {@code command_idempotency} RPCs).
 */
@Component
public class SupabaseRestClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final RestClient restClient;
    private final String anonKey;

    public SupabaseRestClient(SupabaseProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) TIMEOUT.toMillis());
        factory.setReadTimeout((int) TIMEOUT.toMillis());
        this.restClient = RestClient.builder()
                .baseUrl(properties.url() + "/rest/v1")
                .requestFactory(factory)
                .build();
        this.anonKey = properties.anonKey();
    }

    /**
     * Invokes {@code POST /rest/v1/rpc/{functionName}} with {@code params} as the
     * JSON body, authenticated as {@code hostBearerToken}.
     *
     * @param responseType the RPC's declared return shape ({@code Map} for a
     *                      {@code jsonb} object, {@code String}/{@code UUID}-typed
     *                      wrappers are not auto-unwrapped by PostgREST scalar
     *                      returns are read as their raw JSON representation)
     */
    public <T> T rpc(String functionName, Map<String, Object> params, String hostBearerToken, Class<T> responseType) {
        if (!StringUtils.hasText(anonKey)) {
            throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE,
                    "Supabase anon key is not configured (SUPABASE_ANON_KEY); cannot call authenticated RPCs.");
        }
        try {
            return restClient.post()
                    .uri("/rpc/{fn}", functionName)
                    .header("apikey", anonKey)
                    .header("Authorization", "Bearer " + hostBearerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(params)
                    .retrieve()
                    .body(responseType);
        } catch (RestClientResponseException ex) {
            throw new SupabaseRpcException(functionName, ex);
        }
    }

    /** Invokes a {@code void}-returning RPC (no response body expected). */
    public void call(String functionName, Map<String, Object> params, String hostBearerToken) {
        if (!StringUtils.hasText(anonKey)) {
            throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE,
                    "Supabase anon key is not configured (SUPABASE_ANON_KEY); cannot call authenticated RPCs.");
        }
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
            this.postgresMessage = extractMessage(cause.getResponseBodyAsString());
        }

        private static String extractMessage(String body) {
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
