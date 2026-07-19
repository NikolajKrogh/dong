package com.dong.commandapi.command;

import com.dong.commandapi.supabase.SupabaseRestClient;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
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
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static io.jsonwebtoken.security.Keys.hmacShaKeyFor;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * US3 end-to-end: the {@code start-game} command through the real controller +
 * dispatcher + {@code PersistentIdempotencyService}, with {@link SupabaseRestClient}
 * mocked to fake the {@code command_idempotency} store and the room RPCs — covers
 * the double-submit replay and cross-room key-reuse conflict (FR-013/SC-005).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "supabase.jwt-secret=" + StartGameCommandControllerTest.SECRET,
        "supabase.url=http://localhost:9"
})
class StartGameCommandControllerTest {

    static final String SECRET = "test-secret-which-is-at-least-thirty-two-bytes-long";
    private static final SecretKey KEY = hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));

    @Autowired
    private TestRestTemplate restTemplate;

    @MockBean
    private SupabaseRestClient supabaseRestClient;

    private String validJwt() {
        return Jwts.builder()
                .subject("host-1")
                .claim("role", "authenticated")
                .expiration(Date.from(Instant.now().plusSeconds(300)))
                .signWith(KEY)
                .compact();
    }

    private ResponseEntity<String> startGame(String roomId, String idempotencyKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(validJwt());
        headers.set("Idempotency-Key", idempotencyKey);
        return restTemplate.exchange(
                "/v1/rooms/" + roomId + "/commands/start-game",
                HttpMethod.POST,
                new HttpEntity<>(null, headers),
                String.class);
    }

    private Map<String, Object> validSnapshot() {
        return Map.of(
                "state", "joinable",
                "commonMatchId", "match-1",
                "participants", java.util.List.of(Map.of("id", "p-1")),
                "matches", java.util.List.of(Map.of("id", "match-1"), Map.of("id", "match-2")),
                "assignments", java.util.List.of(Map.of("participantId", "p-1", "matchId", "match-2")));
    }

    /** In-memory fake of the command_idempotency table's reserve/complete semantics. */
    private void stubInMemoryIdempotencyStore() {
        Map<String, Map<String, Object>> store = new HashMap<>();

        when(supabaseRestClient.rpc(eq("reserve_command_idempotency"), any(), anyString(), any()))
                .thenAnswer(invocation -> {
                    Map<String, Object> params = invocation.getArgument(1);
                    String key = (String) params.get("idempotency_key");
                    String commandType = (String) params.get("command_type");
                    String roomId = (String) params.get("room_id");

                    Map<String, Object> existing = store.get(key);
                    if (existing == null) {
                        Map<String, Object> reservation = new HashMap<>();
                        reservation.put("commandType", commandType);
                        reservation.put("roomId", roomId);
                        store.put(key, reservation);
                        return Map.of("outcome", "reserved");
                    }
                    if (!existing.get("commandType").equals(commandType) || !existing.get("roomId").equals(roomId)) {
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

        when(supabaseRestClient.rpc(eq("get_room_snapshot"), any(), anyString(), any()))
                .thenReturn(validSnapshot());
        when(supabaseRestClient.rpc(eq("start_game_session"), any(), anyString(), any()))
                .thenReturn(Map.of("status", "started", "sessionId", "room-1"));

        org.mockito.Mockito.doAnswer(invocation -> {
                    Map<String, Object> params = invocation.getArgument(1);
                    String key = (String) params.get("idempotency_key");
                    Map<String, Object> reservation = store.get(key);
                    reservation.put("responseStatus", params.get("response_status"));
                    reservation.put("responseDetail", params.get("response_detail"));
                    return null;
                })
                .when(supabaseRestClient).call(eq("complete_command_idempotency"), any(), anyString());
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

        org.mockito.Mockito.verify(supabaseRestClient, org.mockito.Mockito.times(1))
                .rpc(eq("start_game_session"), any(), anyString(), any());
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
