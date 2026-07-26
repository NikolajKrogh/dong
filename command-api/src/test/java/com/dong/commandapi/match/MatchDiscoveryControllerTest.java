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

import java.time.Clock;
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
class MatchDiscoveryControllerTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @MockBean
    private EspnClient espnClient;

    @Test
    void supportedRequestedAtAndLeagueCodesReturnNormalizedMatchesWithoutAuth() {
        LocalDate requestedDate = LocalDate.of(2026, 5, 24);
        when(espnClient.fetchScoreboard("eng.1", requestedDate)).thenReturn(scoreboard(
                "401791345",
                "Chelsea at Arsenal",
                OffsetDateTime.parse("2026-05-24T19:00:00Z"),
                "pre",
                "Emirates Stadium",
                competition(
                        competitor("home", "Arsenal", "0"),
                        competitor("away", "Chelsea", "0"))));
        when(espnClient.fetchScoreboard("usa.1", requestedDate)).thenReturn(scoreboard(
                "401791346",
                "Inter Miami CF at LA Galaxy",
                OffsetDateTime.parse("2026-05-24T21:30:00Z"),
                "pre",
                "Dignity Health Sports Park",
                competition(
                        competitor("home", "LA Galaxy", "1"),
                        competitor("away", "Inter Miami CF", "2"))));

        ResponseEntity<String> response = restTemplate.getForEntity(
                "/v1/matches?leagueCode=eng.1&leagueCode=usa.1&requestedAt=2026-05-24T00:00:00.000Z",
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"league\":\"eng.1\"");
        assertThat(response.getBody()).contains("\"league\":\"usa.1\"");
        assertThat(response.getBody()).contains("\"homeTeam\":\"Arsenal\"");
        assertThat(response.getBody()).contains("\"awayTeam\":\"Chelsea\"");
        assertThat(response.getBody()).contains("\"homeTeam\":\"LA Galaxy\"");
        assertThat(response.getBody()).contains("\"awayTeam\":\"Inter Miami CF\"");
    }

    @Test
    void omittedRequestedAtDefaultsToToday() {
        LocalDate today = LocalDate.now(Clock.systemUTC());
        when(espnClient.fetchScoreboard("eng.1", today)).thenReturn(scoreboard(
                "401791345",
                "Chelsea at Arsenal",
                OffsetDateTime.parse("2026-05-24T19:00:00Z"),
                "pre",
                "Emirates Stadium",
                competition(
                        competitor("home", "Arsenal", "0"),
                        competitor("away", "Chelsea", "0"))));

        ResponseEntity<String> response = restTemplate.getForEntity(
                "/v1/matches?leagueCode=eng.1",
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(espnClient).fetchScoreboard("eng.1", today);
    }

        @Test
        void invalidRequestedAtIsRejectedWithClientSafeValidationError() {
                ResponseEntity<String> response = restTemplate.getForEntity(
                                "/v1/matches?leagueCode=eng.1&requestedAt=not-a-date",
                                String.class);

                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(response.getBody()).contains("INVALID_MATCH_DATE");
        }

        @Test
        void unsupportedLeagueCodeIsRejectedWithClientSafeValidationError() {
                ResponseEntity<String> response = restTemplate.getForEntity(
                                "/v1/matches?leagueCode=unsupported.league",
                                String.class);

                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(response.getBody()).contains("UNSUPPORTED_LEAGUE_CODE");
        }

            @Test
            void repeatedIdenticalQueriesReuseCachedResultsWithinTheConfiguredTtl() {
                LocalDate requestedDate = LocalDate.of(2026, 5, 25);
                when(espnClient.fetchScoreboard("eng.1", requestedDate)).thenReturn(scoreboard(
                        "401791345",
                        "Chelsea at Arsenal",
                        OffsetDateTime.parse("2026-05-25T19:00:00Z"),
                        "pre",
                        "Emirates Stadium",
                        competition(
                                competitor("home", "Arsenal", "0"),
                                competitor("away", "Chelsea", "0"))));

                ResponseEntity<String> firstResponse = restTemplate.getForEntity(
                        "/v1/matches?leagueCode=eng.1&requestedAt=2026-05-25T00:00:00.000Z",
                        String.class);
                ResponseEntity<String> secondResponse = restTemplate.getForEntity(
                        "/v1/matches?leagueCode=eng.1&requestedAt=2026-05-25T00:00:00.000Z",
                        String.class);

                assertThat(firstResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
                assertThat(secondResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
                assertThat(secondResponse.getBody()).isEqualTo(firstResponse.getBody());
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