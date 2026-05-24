package com.dong.commandapi.command;

import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static io.jsonwebtoken.security.Keys.hmacShaKeyFor;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * US4 — command envelope demonstration. Drives the full chain (auth + dispatch
 * + idempotency seam) with a real signed JWT.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "supabase.jwt-secret=" + CommandControllerTest.SECRET,
                "supabase.url=http://localhost:9"
        }
)
class CommandControllerTest {

    static final String SECRET = "test-secret-which-is-at-least-thirty-two-bytes-long";
    private static final SecretKey KEY = hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));

    @Autowired
    private TestRestTemplate restTemplate;

    private String validJwt() {
        return Jwts.builder()
                .subject("host-1")
                .claim("role", "authenticated")
                .expiration(Date.from(Instant.now().plusSeconds(300)))
                .signWith(KEY)
                .compact();
    }

    private ResponseEntity<String> post(String type, String idempotencyKey, boolean auth) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (auth) {
            headers.setBearerAuth(validJwt());
        }
        if (idempotencyKey != null) {
            headers.set("Idempotency-Key", idempotencyKey);
        }
        return restTemplate.exchange(
                "/v1/rooms/room-test/commands/" + type,
                HttpMethod.POST,
                new HttpEntity<>(null, headers),
                String.class);
    }

    @Test
    void validRequestReturnsAcceptedEnvelope() {
        ResponseEntity<String> res = post("echo", UUID.randomUUID().toString(), true);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).contains("\"commandType\":\"echo\"");
        assertThat(res.getBody()).contains("\"roomId\":\"room-test\"");
        assertThat(res.getBody()).contains("\"status\":\"ACCEPTED\"");
        assertThat(res.getBody()).contains("\"timestamp\"");
    }

    @Test
    void missingIdempotencyKeyIsRejected() {
        ResponseEntity<String> res = post("echo", null, true);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(res.getBody()).contains("MISSING_IDEMPOTENCY_KEY");
    }

    @Test
    void nonUuidIdempotencyKeyIsRejected() {
        ResponseEntity<String> res = post("echo", "not-a-uuid", true);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(res.getBody()).contains("INVALID_UUID");
    }

    @Test
    void unknownCommandTypeIsRejected() {
        ResponseEntity<String> res = post("start-round", UUID.randomUUID().toString(), true);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(res.getBody()).contains("UNKNOWN_COMMAND");
    }

    @Test
    void unauthenticatedRequestIsRejected() {
        // GET avoids HttpURLConnection streaming-mode limitation when reading a 401 response.
        ResponseEntity<String> res = restTemplate.exchange(
                "/v1/rooms/room-test/commands/echo", HttpMethod.GET, null, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(res.getBody()).contains("UNAUTHORIZED");
    }
}
