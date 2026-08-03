package com.dong.commandapi.health;

import com.dong.commandapi.supabase.SupabaseClient;
import com.dong.commandapi.testsupport.JwksTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * US3 — health reporting. Health accurately reflects Supabase reachability and
 * is publicly accessible.
 *
 * <p>A resolvable JWK set is injected so these assertions stay about the
 * {@code supabase} component: {@code SupabaseJwksHealthIndicator} is a second
 * contributor to the aggregate status, and left pointing at the unreachable URL
 * below it would drag the aggregate DOWN regardless of Supabase reachability.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "supabase.jwks-url=https://example.invalid/.well-known/jwks.json",
                "supabase.url=http://localhost:9",
                "command-api.health.supabase.cache-ttl=0s",
                "management.endpoint.health.show-details=always"
        }
)
@Import(JwksTestSupport.TestJwksConfig.class)
class HealthEndpointTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @MockBean
    private SupabaseClient supabaseClient;

    @Test
    void healthIsUpWhenSupabaseReachable() {
        when(supabaseClient.isReachable()).thenReturn(true);

        ResponseEntity<String> res = restTemplate.getForEntity("/actuator/health", String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).contains("\"status\":\"UP\"");
        assertThat(res.getBody()).contains("supabase");
    }

    @Test
    void healthIsDownWhenSupabaseUnreachable() {
        when(supabaseClient.isReachable()).thenReturn(false);

        ResponseEntity<String> res = restTemplate.getForEntity("/actuator/health", String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(res.getBody()).contains("\"status\":\"DOWN\"");
    }
}
