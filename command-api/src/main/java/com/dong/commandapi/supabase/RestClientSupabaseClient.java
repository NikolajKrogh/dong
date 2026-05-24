package com.dong.commandapi.supabase;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * {@link SupabaseClient} adapter using Spring {@link RestClient} (bundled in
 * spring-web, Boot 3.2+ — no extra dependency). A short timeout keeps the
 * health check cheap.
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
        this.restClient = RestClient.builder()
                .baseUrl(properties.url())
                .requestFactory(factory)
                .build();
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
