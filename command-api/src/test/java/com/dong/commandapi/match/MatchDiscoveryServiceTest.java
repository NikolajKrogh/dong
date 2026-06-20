package com.dong.commandapi.match;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import com.dong.commandapi.match.dto.NormalizedMatch;
import com.dong.commandapi.match.espn.EspnClient;
import com.dong.commandapi.match.espn.EspnScoreboardResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MatchDiscoveryServiceTest {

    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-05-24T10:15:30Z"), ZoneOffset.UTC);

    private EspnClient espnClient;
    private MatchDiscoveryService matchDiscoveryService;

    @BeforeEach
    void setUp() {
        espnClient = mock(EspnClient.class);
        MatchDiscoveryProperties properties = new MatchDiscoveryProperties(
                Duration.ofMinutes(5),
                "https://site.api.espn.com/apis/site/v2/sports/soccer",
                List.of("eng.1", "usa.1"),
                null);

        matchDiscoveryService = new MatchDiscoveryService(
                properties,
                new MatchNormalizer(),
                espnClient,
                FIXED_CLOCK);
    }

    @Test
    void emptyScoreboardReturnsAnEmptyList() {
        when(espnClient.fetchScoreboard("eng.1", LocalDate.of(2026, 5, 24)))
                .thenReturn(new EspnScoreboardResponse(List.of(), List.of()));

        List<NormalizedMatch> response = matchDiscoveryService.discover(null, List.of("eng.1"));

        assertThat(response).isEmpty();
    }

    @Test
    void upstreamUnavailableIsSurfacedAsAControlledServiceError() {
        when(espnClient.fetchScoreboard("eng.1", LocalDate.of(2026, 5, 24)))
                .thenThrow(new ApiException(ErrorCode.UPSTREAM_UNAVAILABLE));

        assertThatThrownBy(() -> matchDiscoveryService.discover(null, List.of("eng.1")))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UPSTREAM_UNAVAILABLE);
    }

    @Test
    void malformedPayloadIsRejectedAsUpstreamBadResponse() {
        when(espnClient.fetchScoreboard("eng.1", LocalDate.of(2026, 5, 24)))
                .thenReturn(new EspnScoreboardResponse(
                        List.of(),
                        List.of(new EspnScoreboardResponse.Event(
                                "broken-event",
                                "Chelsea at Arsenal",
                                "Chelsea @ Arsenal",
                                null,
                                null,
                                new EspnScoreboardResponse.Status(
                                        new EspnScoreboardResponse.StatusType(null, "pre", null, null, null, null)),
                                List.of(new EspnScoreboardResponse.Competition(List.of(
                                        competitor("home", "Arsenal", "0"),
                                        competitor("away", "Chelsea", "0"))))))));

        assertThatThrownBy(() -> matchDiscoveryService.discover(null, List.of("eng.1")))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UPSTREAM_BAD_RESPONSE);
    }

    @Test
    void rateLimitedUpstreamIsSurfacedAsServiceUnavailable() {
        when(espnClient.fetchScoreboard("eng.1", LocalDate.of(2026, 5, 24)))
                .thenThrow(new ApiException(ErrorCode.UPSTREAM_UNAVAILABLE));

        assertThatThrownBy(() -> matchDiscoveryService.discover(null, List.of("eng.1")))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UPSTREAM_UNAVAILABLE);
    }

    @Test
    void oneFailingLeagueDoesNotBlankHealthyLeagues() {
        when(espnClient.fetchScoreboard("eng.1", LocalDate.of(2026, 5, 24)))
                .thenReturn(scoreboardWithOneMatch("match-eng-1", "Arsenal", "Chelsea"));
        when(espnClient.fetchScoreboard("usa.1", LocalDate.of(2026, 5, 24)))
                .thenThrow(new ApiException(ErrorCode.UPSTREAM_UNAVAILABLE));

        List<NormalizedMatch> response = matchDiscoveryService.discover(null, List.of("eng.1", "usa.1"));

        assertThat(response).extracting(NormalizedMatch::id).containsExactly("match-eng-1");
        assertThat(response).extracting(NormalizedMatch::league).containsExactly("eng.1");
    }

    @Test
    void malformedLeagueIsDroppedWhenAnotherSucceeds() {
        when(espnClient.fetchScoreboard("eng.1", LocalDate.of(2026, 5, 24)))
                .thenReturn(scoreboardWithOneMatch("match-eng-1", "Arsenal", "Chelsea"));
        when(espnClient.fetchScoreboard("usa.1", LocalDate.of(2026, 5, 24)))
                .thenReturn(malformedScoreboard());

        List<NormalizedMatch> response = matchDiscoveryService.discover(null, List.of("eng.1", "usa.1"));

        assertThat(response).extracting(NormalizedMatch::id).containsExactly("match-eng-1");
    }

    @Test
    void everyLeagueFailingSurfacesAControlledServiceError() {
        when(espnClient.fetchScoreboard("eng.1", LocalDate.of(2026, 5, 24)))
                .thenThrow(new ApiException(ErrorCode.UPSTREAM_UNAVAILABLE));
        when(espnClient.fetchScoreboard("usa.1", LocalDate.of(2026, 5, 24)))
                .thenThrow(new ApiException(ErrorCode.UPSTREAM_UNAVAILABLE));

        assertThatThrownBy(() -> matchDiscoveryService.discover(null, List.of("eng.1", "usa.1")))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UPSTREAM_UNAVAILABLE);
    }

    private static EspnScoreboardResponse scoreboardWithOneMatch(String id, String homeTeam, String awayTeam) {
        EspnScoreboardResponse.Event event = new EspnScoreboardResponse.Event(
                id,
                awayTeam + " at " + homeTeam,
                awayTeam + " @ " + homeTeam,
                OffsetDateTime.parse("2026-05-24T19:00:00Z"),
                new EspnScoreboardResponse.Venue("Emirates Stadium"),
                new EspnScoreboardResponse.Status(
                        new EspnScoreboardResponse.StatusType("STATUS_SCHEDULED", "pre", false, null, null, null)),
                List.of(new EspnScoreboardResponse.Competition(List.of(
                        competitor("home", homeTeam, "0"),
                        competitor("away", awayTeam, "0")))));
        return new EspnScoreboardResponse(List.of(), List.of(event));
    }

    private static EspnScoreboardResponse malformedScoreboard() {
        // Event with a null date normalizes to nothing, so normalized.size() != events.size()
        // and the service rejects the league as UPSTREAM_BAD_RESPONSE.
        EspnScoreboardResponse.Event event = new EspnScoreboardResponse.Event(
                "broken-event",
                "Chelsea at Arsenal",
                "Chelsea @ Arsenal",
                null,
                null,
                new EspnScoreboardResponse.Status(
                        new EspnScoreboardResponse.StatusType(null, "pre", null, null, null, null)),
                List.of(new EspnScoreboardResponse.Competition(List.of(
                        competitor("home", "Arsenal", "0"),
                        competitor("away", "Chelsea", "0")))));
        return new EspnScoreboardResponse(List.of(), List.of(event));
    }

    private static EspnScoreboardResponse.Competitor competitor(String homeAway, String displayName, String score) {
        return new EspnScoreboardResponse.Competitor(
                homeAway,
                new EspnScoreboardResponse.Team(displayName, displayName, null, null),
                score == null ? null : new EspnScoreboardResponse.Score(score));
    }
}