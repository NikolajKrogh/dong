package com.dong.commandapi;

import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static io.jsonwebtoken.security.Keys.hmacShaKeyFor;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Coarse latency guard (SC-002 reject &lt;100ms, SC-007 authenticated &lt;500ms).
 * Generous bounds — catches a misconfigured filter doing blocking I/O, not a
 * micro-benchmark. Warms up first to exclude JIT/context cost.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "supabase.jwt-secret=" + PerformanceSmokeTest.SECRET,
                "supabase.url=http://localhost:9"
        }
)
class PerformanceSmokeTest {

    static final String SECRET = "test-secret-which-is-at-least-thirty-two-bytes-long";
    private static final SecretKey KEY = hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));

    @Autowired
    private TestRestTemplate restTemplate;

    private HttpEntity<String> body(boolean auth) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        if (auth) {
            h.setBearerAuth(Jwts.builder()
                    .subject("host-1").claim("role", "authenticated")
                    .expiration(Date.from(Instant.now().plusSeconds(300)))
                    .signWith(KEY).compact());
            h.set("Idempotency-Key", UUID.randomUUID().toString());
        }
        return new HttpEntity<>(null, h);
    }

    private long timeMillisRejected() {
        // GET avoids HttpURLConnection streaming-mode limitation when reading 401 responses.
        long start = System.nanoTime();
        restTemplate.exchange("/v1/rooms/r/commands/echo", HttpMethod.GET, null, String.class);
        return (System.nanoTime() - start) / 1_000_000;
    }

    private long timeMillis(boolean auth) {
        long start = System.nanoTime();
        restTemplate.exchange("/v1/rooms/r/commands/echo", HttpMethod.POST, body(auth), String.class);
        return (System.nanoTime() - start) / 1_000_000;
    }

    @Test
    void rejectedRequestIsFast() {
        timeMillisRejected(); // warmup
        assertThat(timeMillisRejected()).isLessThan(100L);
    }

    @Test
    void authenticatedRequestIsWithinBudget() {
        timeMillis(true); // warmup
        assertThat(timeMillis(true)).isLessThan(500L);
    }
}
