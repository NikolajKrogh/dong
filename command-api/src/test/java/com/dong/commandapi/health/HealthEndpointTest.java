package com.dong.commandapi.health;

import com.dong.commandapi.supabase.SupabaseClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * US3 — health reporting. Health accurately reflects Supabase reachability and
 * is publicly accessible.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "supabase.jwt-secret=test-secret-which-is-at-least-thirty-two-bytes-long",
                "supabase.url=http://localhost:9",
                "command-api.health.supabase.cache-ttl=0s",
                "management.endpoint.health.show-details=always"
        }
)
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
