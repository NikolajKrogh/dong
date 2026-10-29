package com.dong.gameapi.supabase;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class SupabaseRpcClientTest {
    @Test
    void pendingThenSuccessReturnsTheActualMutationResult() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://rpc.test/rest/v1");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        AtomicInteger waits = new AtomicInteger();
        SupabaseRpcClient client = new SupabaseRpcClient(builder.build(), "public-key", waits::incrementAndGet);
        server.expect(requestTo("http://rpc.test/rest/v1/rpc/end_game_session"))
                .andRespond(withSuccess("{\"ok\":false,\"code\":\"room_processing_pending\",\"retryAfterSeconds\":1}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://rpc.test/rest/v1/rpc/end_game_session"))
                .andRespond(withSuccess("{\"sessionId\":\"room\",\"state\":\"completed\"}", MediaType.APPLICATION_JSON));
        assertThat(client.invokeRpc("end_game_session", Map.of("idempotency_key", "original-key"), "token", Map.class))
                .containsEntry("state", "completed");
        assertThat(waits.get()).isEqualTo(1);
        server.verify();
    }

    @Test
    void pendingRetriesTwiceWithIdenticalBusinessPayloadAndKeyThenStops() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://rpc.test/rest/v1");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        AtomicInteger waits = new AtomicInteger();
        SupabaseRpcClient client = new SupabaseRpcClient(builder.build(), "public-key", waits::incrementAndGet);
        Map<String, Object> params = Map.of("session_id", "room", "idempotency_key", "original-key", "expected_sequence", 17);
        for (int i = 0; i < 3; i++) {
            server.expect(requestTo("http://rpc.test/rest/v1/rpc/end_game_session"))
                    .andExpect(header("Authorization", "Bearer original-user-token"))
                    .andExpect(content().json("{\"session_id\":\"room\",\"idempotency_key\":\"original-key\",\"expected_sequence\":17}"))
                    .andRespond(withSuccess("{\"ok\":false,\"code\":\"room_processing_pending\",\"retryAfterSeconds\":1}", MediaType.APPLICATION_JSON));
        }
        assertThatThrownBy(() -> client.invokeRpc("end_game_session", params, "original-user-token", Map.class))
                .isInstanceOf(SupabaseRpcClient.RoomProcessingPendingException.class);
        assertThat(waits.get()).isEqualTo(2);
        server.verify();
    }

    @Test
    void pendingThenStaleConflictIsNeverRebasedOrRetriedAsSuccess() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://rpc.test/rest/v1");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SupabaseRpcClient client = new SupabaseRpcClient(builder.build(), "public-key", () -> { });
        server.expect(requestTo("http://rpc.test/rest/v1/rpc/end_game_session"))
                .andRespond(withSuccess("{\"ok\":false,\"code\":\"room_processing_pending\",\"retryAfterSeconds\":1}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://rpc.test/rest/v1/rpc/end_game_session"))
                .andRespond(withStatus(HttpStatus.CONFLICT)
                        .contentType(MediaType.APPLICATION_JSON).body("{\"message\":\"stale_sequence\"}"));
        assertThatThrownBy(() -> client.invokeRpc("end_game_session", Map.of("expected_sequence", 17), "token", Map.class))
                .isInstanceOf(SupabaseRpcClient.SupabaseRpcException.class).extracting("postgresMessage").isEqualTo("stale_sequence");
        server.verify();
    }
}
