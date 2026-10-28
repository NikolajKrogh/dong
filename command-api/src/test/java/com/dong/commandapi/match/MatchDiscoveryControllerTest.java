package com.dong.commandapi.match;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "supabase.jwks-url=https://example.invalid/.well-known/jwks.json", "supabase.url=http://localhost:9"
})
class MatchDiscoveryControllerTest {
    @Autowired private TestRestTemplate restTemplate;
    @MockitoBean private MatchCatalogClient catalog;

    @Test
    void publicCompatibilityReturnsSourceIdAndAdditiveOpaqueCatalogId() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        when(catalog.discover(today, List.of("eng.1", "usa.1")))
                .thenReturn(MatchDiscoveryServiceTest.result(List.of(MatchDiscoveryServiceTest.match()), "partial", "eng.1", "usa.1"));
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/v1/matches?leagueCode=usa.1&leagueCode=eng.1&requestedAt=" + today + "T00:30:00Z", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"id\":\"event-123\"", "\"catalogMatchId\":\"9007199254740993\"",
                "\"league\":\"eng.1\"", "\"status\":\"live\"");
        verify(catalog).discover(today, List.of("eng.1", "usa.1"));
    }

    @Test
    void omittedDateUsesUtcTodayAndFreshQueriesStillReachSharedCatalog() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        when(catalog.discover(today, List.of("eng.1"))).thenReturn(MatchDiscoveryServiceTest.result(List.of(), "available", "eng.1"));
        assertThat(restTemplate.getForEntity("/v1/matches?leagueCode=eng.1", String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(restTemplate.getForEntity("/v1/matches?leagueCode=eng.1", String.class).getBody()).isEqualTo("[]");
        verify(catalog, times(2)).discover(today, List.of("eng.1"));
    }

    @Test
    void pendingColdDataIs503AndNeverAFalseEmptyList() {
        when(catalog.discover(LocalDate.now(ZoneOffset.UTC), List.of("eng.1")))
                .thenReturn(MatchDiscoveryServiceTest.result(List.of(), "pending", "eng.1"));
        ResponseEntity<String> response = restTemplate.getForEntity("/v1/matches?leagueCode=eng.1", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).contains("UPSTREAM_UNAVAILABLE");
    }

    @Test
    void unavailableCatalogHasNoProviderFallback() {
        when(catalog.discover(LocalDate.now(ZoneOffset.UTC), List.of("eng.1"))).thenThrow(new ApiException(ErrorCode.UPSTREAM_UNAVAILABLE));
        assertThat(restTemplate.getForEntity("/v1/matches?leagueCode=eng.1", String.class).getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void malformedDatesAndUnsupportedOrMissingLeaguesRemainControlled400() {
        assertThat(restTemplate.getForEntity("/v1/matches?leagueCode=eng.1&requestedAt=not-a-date", String.class).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(restTemplate.getForEntity("/v1/matches?leagueCode=UPPERCASE", String.class).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(restTemplate.getForEntity("/v1/matches", String.class).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verifyNoInteractions(catalog);
    }

    @Test
    void catalogUnsupportedLeagueRemainsControlled400() {
        when(catalog.discover(LocalDate.now(ZoneOffset.UTC), List.of("unknown.1")))
                .thenThrow(new ApiException(ErrorCode.UNSUPPORTED_LEAGUE_CODE));
        ResponseEntity<String> response = restTemplate.getForEntity("/v1/matches?leagueCode=unknown.1", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("UNSUPPORTED_LEAGUE_CODE");
        verify(catalog).discover(LocalDate.now(ZoneOffset.UTC), List.of("unknown.1"));
    }
}
