package com.dong.commandapi.match.espn;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class RestClientEspnClientTest {

    private static final LocalDate MATCH_DATE = LocalDate.of(2026, 5, 24);
    private static final String EXPECTED_URI = "/eng.1/scoreboard?dates=20260524";

    private MockRestServiceServer server;
    private RestClientEspnClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new RestClientEspnClient(builder.build());
    }

    @Test
    void wellFormedResponseIsParsed() {
        server.expect(requestTo(EXPECTED_URI))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(
                        "{\"events\":[{\"id\":\"401791345\",\"name\":\"Chelsea at Arsenal\","
                                + "\"date\":\"2026-05-24T19:00:00Z\",\"competitions\":[]}]}",
                        MediaType.APPLICATION_JSON));

        EspnScoreboardResponse response = client.fetchScoreboard("eng.1", MATCH_DATE);

        assertThat(response.events()).hasSize(1);
        assertThat(response.events().get(0).id()).isEqualTo("401791345");
        server.verify();
    }

    @Test
    void emptyBodyIsRejectedAsUpstreamBadResponse() {
        server.expect(requestTo(EXPECTED_URI))
                .andRespond(withSuccess("", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.fetchScoreboard("eng.1", MATCH_DATE))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UPSTREAM_BAD_RESPONSE);
    }

    @Test
    void rateLimitedResponseIsSurfacedAsUpstreamUnavailable() {
        server.expect(requestTo(EXPECTED_URI))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        assertThatThrownBy(() -> client.fetchScoreboard("eng.1", MATCH_DATE))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UPSTREAM_UNAVAILABLE);
    }

    @Test
    void serverErrorIsSurfacedAsUpstreamUnavailable() {
        server.expect(requestTo(EXPECTED_URI))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertThatThrownBy(() -> client.fetchScoreboard("eng.1", MATCH_DATE))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UPSTREAM_UNAVAILABLE);
    }

    @Test
    void otherClientErrorIsSurfacedAsUpstreamBadResponse() {
        server.expect(requestTo(EXPECTED_URI))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        assertThatThrownBy(() -> client.fetchScoreboard("eng.1", MATCH_DATE))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UPSTREAM_BAD_RESPONSE);
    }

    @Test
    void connectionFailureIsSurfacedAsUpstreamUnavailable() {
        server.expect(requestTo(EXPECTED_URI))
                .andRespond(withException(new IOException("connection refused")));

        assertThatThrownBy(() -> client.fetchScoreboard("eng.1", MATCH_DATE))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UPSTREAM_UNAVAILABLE);
    }
}
