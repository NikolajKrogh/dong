package com.dong.commandapi.match.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonValue;

import java.time.OffsetDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record NormalizedMatch(
        String id,
        String league,
        String homeTeam,
        String awayTeam,
        OffsetDateTime startDateTime,
        MatchStatus status,
        MatchScore score,
        String venue,
        String catalogMatchId
) {

    public record MatchScore(Integer home, Integer away) {
    }

    public enum MatchStatus {
        SCHEDULED("scheduled"),
        LIVE("live"),
        FINAL("final"),
        POSTPONED("postponed"),
        CANCELED("canceled"),
        DELAYED("delayed"),
        SUSPENDED("suspended"),
        ABANDONED("abandoned"),
        UNKNOWN("unknown");

        private final String wireValue;

        MatchStatus(String wireValue) {
            this.wireValue = wireValue;
        }

        @JsonValue
        public String wireValue() {
            return wireValue;
        }
    }
}
