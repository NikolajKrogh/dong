package com.dong.gameapi.roomaction;

import com.dong.gameapi.supabase.SupabaseRpcClient;
import com.dong.gameapi.testsupport.JwksTestSupport;
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

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * End-to-end: the {@code start-game} action through the real controller +
 * dispatcher + {@code PersistentIdempotencyService}, with {@link SupabaseRpcClient}
 * mocked to fake the {@code command_idempotency} store and {@code start_game_session}
 * — covers the double-submit replay and cross-room key-reuse conflict (FR-025/SC-010,
 * specs/020-canonical-assignment-generation).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "supabase.jwks-url=https://example.invalid/.well-known/jwks.json",
        "supabase.url=http://localhost:9"
})
@Import(JwksTestSupport.TestJwksConfig.class)
class StartGameActionControllerTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @MockitoBean
    private SupabaseRpcClient supabaseRpcClient;

    private String validJwt() {
        return JwksTestSupport.signedJwt("host-1", "authenticated", Instant.now().plusSeconds(300));
    }

    private ResponseEntity<String> startGame(String roomId, String idempotencyKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(validJwt());
        headers.set("Idempotency-Key", idempotencyKey);
        return restTemplate.exchange(
                "/v1/rooms/" + roomId + "/actions/start-game",
                HttpMethod.POST,
                new HttpEntity<>(null, headers),
                String.class);
    }

    /** In-memory fake of the command_idempotency table's reserve/complete semantics. */
    private void stubInMemoryIdempotencyStore() {
        Map<String, Map<String, Object>> store = new HashMap<>();

        when(supabaseRpcClient.invokeRpc(eq("reserve_command_idempotency"), any(), anyString(), any()))
                .thenAnswer(invocation -> {
                    Map<String, Object> params = invocation.getArgument(1);
                    String key = (String) params.get("idempotency_key");
                    String actionType = (String) params.get("command_type");
                    String roomId = (String) params.get("room_id");

                    Map<String, Object> existing = store.get(key);
                    if (existing == null) {
                        Map<String, Object> reservation = new HashMap<>();
                        reservation.put("actionType", actionType);
                        reservation.put("roomId", roomId);
                        store.put(key, reservation);
                        return Map.of("outcome", "reserved");
                    }
                    if (!existing.get("actionType").equals(actionType) || !existing.get("roomId").equals(roomId)) {
                        return Map.of("outcome", "conflict");
                    }
                    if (!existing.containsKey("responseStatus")) {
                        return Map.of("outcome", "in_flight");
                    }
                    return Map.of(
                            "outcome", "replay",
                            "responseStatus", existing.get("responseStatus"),
                            "responseDetail", existing.get("responseDetail"));
                });

        when(supabaseRpcClient.invokeRpc(eq("start_game_session"), any(), anyString(), any()))
                .thenReturn(Map.of("status", "started", "sessionId", "room-1"));

        org.mockito.Mockito.doAnswer(invocation -> {
                    Map<String, Object> params = invocation.getArgument(1);
                    String key = (String) params.get("idempotency_key");
                    Map<String, Object> reservation = store.get(key);
                    reservation.put("responseStatus", params.get("response_status"));
                    reservation.put("responseDetail", params.get("response_detail"));
                    return null;
                })
                .when(supabaseRpcClient).invokeRpcWithoutResponse(eq("complete_command_idempotency"), any(), anyString());
    }

    @Test
    void doubleSubmitReturnsIdenticalResponseWithoutASecondStart() {
        stubInMemoryIdempotencyStore();
        String key = UUID.randomUUID().toString();

        ResponseEntity<String> first = startGame("room-1", key);
        ResponseEntity<String> second = startGame("room-1", key);

        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(second.getBody()).contains("\"status\":\"ACCEPTED\"");

        org.mockito.Mockito.verify(supabaseRpcClient, org.mockito.Mockito.times(1))
                .invokeRpc(eq("start_game_session"), any(), anyString(), any());
    }

    @Test
    void reusingKeyAgainstADifferentRoomIsRejectedWithConflict() {
        stubInMemoryIdempotencyStore();
        String key = UUID.randomUUID().toString();

        startGame("room-1", key);
        ResponseEntity<String> second = startGame("room-2", key);

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(second.getBody()).contains("IDEMPOTENCY_KEY_REUSE");
    }
}
