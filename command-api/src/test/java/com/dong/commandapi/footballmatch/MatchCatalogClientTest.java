package com.dong.commandapi.footballmatch;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.headerDoesNotExist;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class MatchCatalogClientTest {
    private MockRestServiceServer server;
    private MatchCatalogClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://catalog.test/functions/v1");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new MatchCatalogClient(builder.build(), "public-key");
    }

    @Test
    void forwardsOnlyPublicDiscoverySelectionAndKeyWithoutBearerAuthority() {
        server.expect(requestTo("http://catalog.test/functions/v1/discover-matches"))
                .andExpect(method(HttpMethod.POST)).andExpect(header("apikey", "public-key"))
                .andExpect(headerDoesNotExist("Authorization"))
                .andExpect(content().json("{\"leagueCodes\":[\"eng.1\"],\"date\":\"2026-10-26\"}"))
                .andRespond(withSuccess("{\"matches\":[],\"groups\":[{\"leagueCode\":\"eng.1\",\"availability\":\"available\"}],\"availability\":\"available\"}", MediaType.APPLICATION_JSON));
        assertThat(client.discover(LocalDate.of(2026, 10, 26), List.of("eng.1")).matches()).isEmpty();
        server.verify();
    }

    @Test
    void malformedResponsesFailWithoutRetryOrProviderFallback() {
        server.expect(requestTo("http://catalog.test/functions/v1/discover-matches")).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.discover(LocalDate.of(2026, 10, 26), List.of("eng.1"))).isInstanceOf(ApiException.class);
        server.verify();
    }

    @Test
    void savedProjectionPreservesOpaqueIdAndNullableStatisticsWithoutReparsingEspn() {
        server.expect(requestTo("http://catalog.test/functions/v1/discover-matches"))
                .andRespond(withSuccess("""
                        {"availability":"partial","groups":[{"leagueCode":"eng.1","availability":"partial"}],
                         "matches":[{"catalogMatchId":"9007199254740993","identity":{"provider":"espn","leagueCode":"eng.1","sourceEventId":"event-1","sourceCompetitionId":"different-competition"},
                          "homeTeam":{"name":"Home"},"awayTeam":{"name":"Away"},"kickoffAt":"2026-10-26T19:00:00Z",
                          "lifecycle":"suspended","homeScore":2,"awayScore":null,"goals":null,"freshness":{"isStale":true}}]}
                        """, MediaType.APPLICATION_JSON));
        MatchCatalogClient.SavedMatch match = client.discover(LocalDate.of(2026, 10, 26), List.of("eng.1")).matches().get(0);
        assertThat(match.catalogMatchId()).isEqualTo("9007199254740993");
        assertThat(match.identity().sourceEventId()).isEqualTo("event-1");
        assertThat(match.awayScore()).isNull();
        assertThat(match.lifecycle()).isEqualTo("suspended");
        server.verify();
    }

    @Test
    void transportFailureMakesOneAttemptAndDoesNotExposeUpstreamBody() {
        server.expect(requestTo("http://catalog.test/functions/v1/discover-matches"))
                .andRespond(withServerError().body("private source failure"));
        assertThatThrownBy(() -> client.discover(LocalDate.of(2026, 10, 26), List.of("eng.1")))
                .isInstanceOf(ApiException.class).hasMessageNotContaining("private source failure");
        server.verify();
    }

    @Test
    void catalogOwnsSupportedLeagueValidationAndKeepsThePublic400Error() {
        server.expect(requestTo("http://catalog.test/functions/v1/discover-matches"))
                .andRespond(withBadRequest().contentType(MediaType.APPLICATION_JSON)
                        .body("{\"ok\":false,\"code\":\"unsupported_league\",\"retryAfterSeconds\":null}"));
        assertThatThrownBy(() -> client.discover(LocalDate.of(2026, 10, 26), List.of("unknown.1")))
                .isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.UNSUPPORTED_LEAGUE_CODE);
        server.verify();
    }

    @Test
    void catalogDateRejectionKeepsThePublic400Error() {
        server.expect(requestTo("http://catalog.test/functions/v1/discover-matches"))
                .andRespond(withBadRequest().contentType(MediaType.APPLICATION_JSON)
                        .body("{\"ok\":false,\"code\":\"date_out_of_range\"}"));
        assertThatThrownBy(() -> client.discover(LocalDate.of(2026, 10, 26), List.of("eng.1")))
                .isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.INVALID_MATCH_DATE);
        server.verify();
    }

    @Test
    void unrecognizedUpstreamErrorIsNotExposedAsCallerValidation() {
        server.expect(requestTo("http://catalog.test/functions/v1/discover-matches"))
                .andRespond(withBadRequest().contentType(MediaType.APPLICATION_JSON).body("private upstream details"));
        assertThatThrownBy(() -> client.discover(LocalDate.of(2026, 10, 26), List.of("eng.1")))
                .isInstanceOf(ApiException.class).hasMessageNotContaining("private upstream details")
                .extracting("errorCode").isEqualTo(ErrorCode.UPSTREAM_UNAVAILABLE);
        server.verify();
    }
}
