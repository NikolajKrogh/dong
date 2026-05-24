package com.dong.commandapi;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * US1 — API discoverability. The OpenAPI document and explorer are reachable
 * without credentials.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "supabase.jwt-secret=test-secret-which-is-at-least-thirty-two-bytes-long",
                "supabase.url=http://localhost:9"
        }
)
class ApiDiscoverabilityTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void apiDocsAreReachableWithoutCredentials() {
        ResponseEntity<String> response = restTemplate.getForEntity("/v3/api-docs", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"paths\"");
    }

    @Test
    void swaggerUiIsReachableWithoutCredentials() {
        ResponseEntity<String> response = restTemplate.getForEntity("/swagger-ui.html", String.class);

        // springdoc redirects /swagger-ui.html → /swagger-ui/index.html; both are non-auth.
        assertThat(response.getStatusCode().is2xxSuccessful() || response.getStatusCode().is3xxRedirection())
                .isTrue();
    }
}
