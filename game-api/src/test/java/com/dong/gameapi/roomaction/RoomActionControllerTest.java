package com.dong.gameapi.roomaction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import com.dong.gameapi.supabase.SupabaseRpcClient;
import com.dong.gameapi.testsupport.JwksTestSupport;

/**
 * US4 — action envelope demonstration. Drives the full chain (auth + dispatch
 * + idempotency seam) with a real signed JWT. {@link SupabaseRpcClient} is mocked:
 * {@code PersistentIdempotencyService} (research.md R7) now calls a real
 * {@code command_idempotency} RPC on every dispatch, and this test is about the
 * controller/dispatch/auth wiring, not live Supabase connectivity.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "supabase.jwks-url=https://example.invalid/.well-known/jwks.json",
        "supabase.url=http://localhost:9"
})
@Import({JwksTestSupport.TestJwksConfig.class, com.dong.gameapi.testsupport.TestRoomActionConfig.class})
class RoomActionControllerTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @MockitoBean
    private SupabaseRpcClient supabaseRpcClient;

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
                "/v1/rooms/room-test/actions/" + type,
                HttpMethod.POST,
                new HttpEntity<>(null, headers),
                String.class);
    }

    @Test
    @SuppressWarnings("unchecked")
    void validRequestReturnsAcceptedEnvelope() {
        when(supabaseRpcClient.invokeRpc(anyString(), any(), anyString(), any()))
                .thenReturn(Map.of("outcome", "reserved"));

        ResponseEntity<String> res = post("test-action", UUID.randomUUID().toString(), true);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).contains("\"actionType\":\"test-action\"");
        assertThat(res.getBody()).contains("\"roomId\":\"room-test\"");
        assertThat(res.getBody()).contains("\"status\":\"ACCEPTED\"");
        assertThat(res.getBody()).contains("\"timestamp\"");
    }

    @Test
    void missingIdempotencyKeyIsRejected() {
        ResponseEntity<String> res = post("test-action", null, true);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(res.getBody()).contains("MISSING_IDEMPOTENCY_KEY");
    }

    @Test
    void nonUuidIdempotencyKeyIsRejected() {
        ResponseEntity<String> res = post("test-action", "not-a-uuid", true);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(res.getBody()).contains("INVALID_UUID");
    }

    @Test
    void unknownRoomActionTypeIsRejected() {
        ResponseEntity<String> res = post("start-round", UUID.randomUUID().toString(), true);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(res.getBody()).contains("UNKNOWN_ROOM_ACTION");
    }

    @Test
    void unauthenticatedRequestIsRejected() {
        // GET avoids HttpURLConnection streaming-mode limitation when reading a 401
        // response.
        ResponseEntity<String> res = restTemplate.exchange(
                "/v1/rooms/room-test/actions/test-action", HttpMethod.GET, null, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(res.getBody()).contains("UNAUTHORIZED");
    }

    @Test
    void committedPendingProgressIsAnExactHttp200EnvelopeAndNotTerminalSuccess() {
        when(supabaseRpcClient.invokeRpc(eq("reserve_command_idempotency"), any(), anyString(), any()))
                .thenReturn(Map.of("outcome", "reserved"));
        when(supabaseRpcClient.invokeRpc(eq("start_game_session"), any(), anyString(), any()))
                .thenReturn(Map.of("ok", false, "code", "room_processing_pending", "retryAfterSeconds", 1));
        String key = UUID.randomUUID().toString();
        ResponseEntity<String> response = post("start-game", key, true);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"ok\":false", "\"code\":\"room_processing_pending\"", "\"retryAfterSeconds\":1")
                .doesNotContain("ACCEPTED", "timestamp", "actionType");
        verify(supabaseRpcClient).invokeRpcWithoutResponse(eq("release_command_idempotency"), eq(Map.of("idempotency_key", key)), anyString());
        verify(supabaseRpcClient, never()).invokeRpcWithoutResponse(eq("complete_command_idempotency"), any(), anyString());
    }

    @Test
    void exhaustedRpcPendingRetriesStillReturnHttp200WithoutSuccessCaching() {
        when(supabaseRpcClient.invokeRpc(eq("reserve_command_idempotency"), any(), anyString(), any()))
                .thenReturn(Map.of("outcome", "reserved"));
        when(supabaseRpcClient.invokeRpc(eq("start_game_session"), any(), anyString(), any()))
                .thenThrow(new SupabaseRpcClient.RoomProcessingPendingException());
        ResponseEntity<String> response = post("start-game", UUID.randomUUID().toString(), true);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("room_processing_pending").doesNotContain("ACCEPTED");
        verify(supabaseRpcClient, never()).invokeRpcWithoutResponse(eq("complete_command_idempotency"), any(), anyString());
    }
}
