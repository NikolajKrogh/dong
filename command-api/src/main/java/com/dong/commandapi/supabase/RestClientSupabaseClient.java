package com.dong.commandapi.supabase;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * {@link SupabaseClient} adapter using Spring {@link RestClient} (bundled in
 * spring-web, Boot 3.2+ — no extra dependency). A short timeout keeps the
 * health check cheap.
 *
 * <p>The {@code apikey} header is required: Supabase's hosted API gateway sits in
 * front of every {@code /auth/v1} and {@code /rest/v1} route and answers
 * {@code 401 "No API key found in request"} without it. Omitting it made
 * {@link #isReachable()} return false unconditionally against a cloud project, so
 * the {@code supabase} health component — and with it {@code /actuator/health} and
 * the readiness group — was permanently DOWN regardless of Supabase's real state.
 */
@Component
public class RestClientSupabaseClient implements SupabaseClient {

    private static final Logger log = LoggerFactory.getLogger(RestClientSupabaseClient.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private final RestClient restClient;

    public RestClientSupabaseClient(SupabaseProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) TIMEOUT.toMillis());
        factory.setReadTimeout((int) TIMEOUT.toMillis());
        RestClient.Builder builder = RestClient.builder()
                .baseUrl(properties.url())
                .requestFactory(factory);
        // Tolerate a blank key rather than failing construction: SupabaseProperties
        // deliberately allows it (deployments that never call an authenticated RPC),
        // and a local Supabase stack does not enforce the gateway check.
        if (StringUtils.hasText(properties.anonKey())) {
            builder.defaultHeader("apikey", properties.anonKey());
        }
        this.restClient = builder.build();
    }

    @Override
    public boolean isReachable() {
        try {
            return restClient.get()
                    .uri("/auth/v1/health")
                    .retrieve()
                    .toBodilessEntity()
                    .getStatusCode()
                    .is2xxSuccessful();
        } catch (RuntimeException ex) {
            log.warn("Supabase health probe failed: {}", ex.getMessage());
            return false;
        }
    }
}
