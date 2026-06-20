package com.dong.commandapi.match.espn;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.OffsetDateTime;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record EspnScoreboardResponse(
        List<League> leagues,
        List<Event> events
) {

    public EspnScoreboardResponse {
        leagues = leagues == null ? List.of() : List.copyOf(leagues);
        events = events == null ? List.of() : List.copyOf(events);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record League(String slug, List<Logo> logos) {
        public League {
            logos = logos == null ? List.of() : List.copyOf(logos);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Logo(String href, List<String> rel) {
        public Logo {
            rel = rel == null ? List.of() : List.copyOf(rel);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Event(
            String id,
            String name,
            String shortName,
            OffsetDateTime date,
            Venue venue,
            Status status,
            List<Competition> competitions
    ) {
        public Event {
            competitions = competitions == null ? List.of() : List.copyOf(competitions);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Venue(String displayName, String fullName) {
        public Venue(String displayName) {
            this(displayName, displayName);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Status(StatusType type) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record StatusType(String name, String state, Boolean completed, String description, String detail, String shortDetail) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Competition(Status status, Venue venue, List<Competitor> competitors) {
        public Competition(List<Competitor> competitors) {
            this(null, null, competitors);
        }

        public Competition {
            competitors = competitors == null ? List.of() : List.copyOf(competitors);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Competitor(String homeAway, Team team, Score score) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Team(String displayName, String shortDisplayName, String abbreviation, String logo) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Score(String value) {
        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        public Score {
        }
    }
}