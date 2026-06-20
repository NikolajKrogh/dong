package com.dong.commandapi.match;

import com.dong.commandapi.match.dto.NormalizedMatch;
import com.dong.commandapi.match.espn.EspnScoreboardResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MatchNormalizationTest {

    private final MatchNormalizer matchNormalizer = new MatchNormalizer();
        private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void normalizesCompetitorsVenueScoreAndScheduledStatus() {
        OffsetDateTime kickoff = OffsetDateTime.parse("2026-05-24T19:00:00Z");
        EspnScoreboardResponse response = new EspnScoreboardResponse(
                List.of(),
                List.of(event(
                        "401791345",
                        "Chelsea at Arsenal",
                        kickoff,
                        "pre",
                        "Emirates Stadium",
                        competition(
                                competitor("home", "Arsenal", "0"),
                                competitor("away", "Chelsea", "0"))
                )));

        List<NormalizedMatch> normalizedMatches = matchNormalizer.normalize("eng.1", response);

        assertThat(normalizedMatches).hasSize(1);
        NormalizedMatch match = normalizedMatches.get(0);

        assertThat(match.id()).isEqualTo("401791345");
        assertThat(match.league()).isEqualTo("eng.1");
        assertThat(match.homeTeam()).isEqualTo("Arsenal");
        assertThat(match.awayTeam()).isEqualTo("Chelsea");
        assertThat(match.startDateTime()).isEqualTo(kickoff);
        assertThat(match.status()).isEqualTo(NormalizedMatch.MatchStatus.SCHEDULED);
        assertThat(match.score()).isEqualTo(new NormalizedMatch.MatchScore(0, 0));
        assertThat(match.venue()).isEqualTo("Emirates Stadium");
    }

    @Test
    void fallsBackToEventNameAndMapsLiveFinalPostponedAndCanceledStatuses() {
        OffsetDateTime kickoff = OffsetDateTime.parse("2026-05-24T19:00:00Z");
        EspnScoreboardResponse response = new EspnScoreboardResponse(
                List.of(),
                List.of(
                        event("live-1", "Tottenham Hotspur at Liverpool", kickoff, "in", null, competition()),
                        event("final-1", "Brighton at Everton", kickoff, "post", null, competition()),
                        event("postponed-1", "Fulham at Brentford", kickoff, "postponed", null, competition()),
                        event("canceled-1", "Roma at Milan", kickoff, "canceled", null, competition())));

        List<NormalizedMatch> normalizedMatches = matchNormalizer.normalize("eng.1", response);

        assertThat(normalizedMatches)
                .extracting(NormalizedMatch::id)
                .containsExactly("live-1", "final-1", "postponed-1", "canceled-1");
        assertThat(normalizedMatches)
                .extracting(NormalizedMatch::homeTeam)
                .containsExactly("Liverpool", "Everton", "Brentford", "Milan");
        assertThat(normalizedMatches)
                .extracting(NormalizedMatch::awayTeam)
                .containsExactly("Tottenham Hotspur", "Brighton", "Fulham", "Roma");
        assertThat(normalizedMatches)
                .extracting(NormalizedMatch::status)
                .containsExactly(
                        NormalizedMatch.MatchStatus.LIVE,
                        NormalizedMatch.MatchStatus.FINAL,
                        NormalizedMatch.MatchStatus.POSTPONED,
                        NormalizedMatch.MatchStatus.CANCELED);
    }

                @Test
                void deserializesAndNormalizesTheRealEspnCompetitionShape() throws Exception {
                                String espnPayload = """
                                                                {
                                                                        "leagues": [],
                                                                        "events": [
                                                                                {
                                                                                        "id": "740966",
                                                                                        "date": "2026-05-24T15:00Z",
                                                                                        "name": "Manchester United at Brighton & Hove Albion",
                                                                                        "shortName": "MAN @ BHA",
                                                                                        "competitions": [
                                                                                                {
                                                                                                        "status": {
                                                                                                                "type": {
                                                                                                                        "state": "post",
                                                                                                                        "description": "Full Time",
                                                                                                                        "detail": "FT",
                                                                                                                        "shortDetail": "FT"
                                                                                                                }
                                                                                                        },
                                                                                                        "venue": {
                                                                                                                "fullName": "American Express Stadium"
                                                                                                        },
                                                                                                        "competitors": [
                                                                                                                {
                                                                                                                        "homeAway": "home",
                                                                                                                        "score": "0",
                                                                                                                        "team": {
                                                                                                                                "displayName": "Brighton & Hove Albion",
                                                                                                                                "shortDisplayName": "Brighton",
                                                                                                                                "abbreviation": "BHA",
                                                                                                                                "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/331.png"
                                                                                                                        }
                                                                                                                },
                                                                                                                {
                                                                                                                        "homeAway": "away",
                                                                                                                        "score": "3",
                                                                                                                        "team": {
                                                                                                                                "displayName": "Manchester United",
                                                                                                                                "shortDisplayName": "Man United",
                                                                                                                                "abbreviation": "MAN",
                                                                                                                                "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/360.png"
                                                                                                                        }
                                                                                                                }
                                                                                                        ]
                                                                                                }
                                                                                        ]
                                                                                }
                                                                        ]
                                                                }
                                                                """;

                                EspnScoreboardResponse response = objectMapper.readValue(espnPayload, EspnScoreboardResponse.class);

                                List<NormalizedMatch> normalizedMatches = matchNormalizer.normalize("eng.1", response);

                                assertThat(normalizedMatches).hasSize(1);
                                NormalizedMatch match = normalizedMatches.get(0);

                                assertThat(match.id()).isEqualTo("740966");
                                assertThat(match.homeTeam()).isEqualTo("Brighton & Hove Albion");
                                assertThat(match.awayTeam()).isEqualTo("Manchester United");
                                assertThat(match.status()).isEqualTo(NormalizedMatch.MatchStatus.FINAL);
                                assertThat(match.score()).isEqualTo(new NormalizedMatch.MatchScore(0, 3));
                                assertThat(match.venue()).isEqualTo("American Express Stadium");
                }

    private static EspnScoreboardResponse.Event event(
            String id,
            String name,
            OffsetDateTime kickoff,
            String state,
            String venue,
            EspnScoreboardResponse.Competition competition
    ) {
        return new EspnScoreboardResponse.Event(
                id,
                name,
                name.replace(" at ", " @ "),
                kickoff,
                venue == null ? null : new EspnScoreboardResponse.Venue(venue),
                new EspnScoreboardResponse.Status(new EspnScoreboardResponse.StatusType(null, state, null, null, null, null)),
                List.of(competition));
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