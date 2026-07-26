package com.dong.commandapi.match;

import com.dong.commandapi.match.espn.EspnClient;
import com.dong.commandapi.match.espn.EspnScoreboardResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "supabase.jwks-url=https://example.invalid/.well-known/jwks.json",
                "supabase.url=http://localhost:9"
        }
)
class MatchDiscoveryPerformanceTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @MockBean
    private EspnClient espnClient;

    @Test
    void repeatedIdenticalQueriesServeFromCacheWithoutRefetchingUpstream() {
        // A date no other test uses, so this shares the Spring context's singleton
        // cache yet still starts cold here — keeping the fetch count deterministic.
        LocalDate requestedDate = LocalDate.of(2026, 7, 15);
        when(espnClient.fetchScoreboard("eng.1", requestedDate)).thenReturn(scoreboard(
                "401791345",
                "Chelsea at Arsenal",
                OffsetDateTime.parse("2026-07-15T19:00:00Z"),
                "pre",
                "Emirates Stadium",
                competition(
                        competitor("home", "Arsenal", "0"),
                        competitor("away", "Chelsea", "0"))));

        String requestPath = "/v1/matches?leagueCode=eng.1&requestedAt=2026-07-15T00:00:00.000Z";

        ResponseEntity<String> warmupResponse = restTemplate.getForEntity(requestPath, String.class);
        ResponseEntity<String> cachedResponse = restTemplate.getForEntity(requestPath, String.class);

        assertThat(warmupResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(cachedResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(cachedResponse.getBody()).contains("\"league\":\"eng.1\"");
        // The cache, not a wall-clock latency threshold, is what we assert: the
        // second identical request must be served without a second upstream fetch.
        verify(espnClient, times(1)).fetchScoreboard("eng.1", requestedDate);
    }

    private static EspnScoreboardResponse scoreboard(
            String id,
            String name,
            OffsetDateTime kickoff,
            String state,
            String venue,
            EspnScoreboardResponse.Competition competition
    ) {
        return new EspnScoreboardResponse(
                List.of(),
                List.of(new EspnScoreboardResponse.Event(
                        id,
                        name,
                        name.replace(" at ", " @ "),
                        kickoff,
                        venue == null ? null : new EspnScoreboardResponse.Venue(venue),
                        new EspnScoreboardResponse.Status(new EspnScoreboardResponse.StatusType(null, state, null, null, null, null)),
                        List.of(competition))));
    }

    private static EspnScoreboardResponse.Competition competition(EspnScoreboardResponse.Competitor... competitors) {
        return new EspnScoreboardResponse.Competition(List.of(competitors));
    }

    private static EspnScoreboardResponse.Competitor competitor(String homeAway, String displayName, String score) {
        return new EspnScoreboardResponse.Competitor(
                homeAway,
                new EspnScoreboardResponse.Team(displayName, displayName, null, null),
                score == null ? null : new EspnScoreboardResponse.Score(score));
    }
}