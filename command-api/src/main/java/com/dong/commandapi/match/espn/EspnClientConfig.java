package com.dong.commandapi.match.espn;

import com.dong.commandapi.match.MatchDiscoveryProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * Builds the {@link RestClient} used to talk to the ESPN scoreboard API.
 *
 * <p>Kept separate from {@link RestClientEspnClient} so tests can supply their
 * own {@code RestClient} (e.g. bound to a {@code MockRestServiceServer}) instead
 * of the real, timeout-configured, base-URL'd production client.
 */
@Configuration
class EspnClientConfig {

    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    @Bean
    RestClient espnRestClient(MatchDiscoveryProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) TIMEOUT.toMillis());
        factory.setReadTimeout((int) TIMEOUT.toMillis());
        return RestClient.builder()
                .baseUrl(properties.espnBaseUrl())
                .requestFactory(factory)
                .build();
    }
}
