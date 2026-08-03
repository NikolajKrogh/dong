package com.dong.commandapi.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import com.dong.commandapi.supabase.SupabaseRestClient;
import com.dong.commandapi.testsupport.JwksTestSupport;

/**
 * US4 — command envelope demonstration. Drives the full chain (auth + dispatch
 * + idempotency seam) with a real signed JWT. {@link SupabaseRestClient} is mocked:
 * {@code PersistentIdempotencyService} (research.md R7) now calls a real
 * {@code command_idempotency} RPC on every dispatch, and this test is about the
 * controller/dispatch/auth wiring, not live Supabase connectivity.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "supabase.jwks-url=https://example.invalid/.well-known/jwks.json",
        "supabase.url=http://localhost:9"
})
@Import(JwksTestSupport.TestJwksConfig.class)
class CommandControllerTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @MockBean
    private SupabaseRestClient supabaseRestClient;

    private String validJwt() {
        return JwksTestSupport.signedJwt("host-1", "authenticated", Instant.now().plusSeconds(300));
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
    @SuppressWarnings("unchecked")
    void validRequestReturnsAcceptedEnvelope() {
        when(supabaseRestClient.rpc(anyString(), any(), anyString(), any()))
                .thenReturn(Map.of("outcome", "reserved"));

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
        // GET avoids HttpURLConnection streaming-mode limitation when reading a 401
        // response.
        ResponseEntity<String> res = restTemplate.exchange(
                "/v1/rooms/room-test/commands/echo", HttpMethod.GET, null, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(res.getBody()).contains("UNAUTHORIZED");
    }
}
