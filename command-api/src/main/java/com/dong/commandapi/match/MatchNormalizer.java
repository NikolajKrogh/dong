package com.dong.commandapi.match;

import com.dong.commandapi.match.dto.NormalizedMatch;
import com.dong.commandapi.match.espn.EspnScoreboardResponse;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Component
public class MatchNormalizer {

    public List<NormalizedMatch> normalize(String leagueCode, EspnScoreboardResponse scoreboardResponse) {
        Objects.requireNonNull(leagueCode, "leagueCode must not be null");
        Objects.requireNonNull(scoreboardResponse, "scoreboardResponse must not be null");

        return scoreboardResponse.events().stream()
                .map(event -> normalizeEvent(leagueCode, event))
                .flatMap(Optional::stream)
                .toList();
    }

    private Optional<NormalizedMatch> normalizeEvent(String leagueCode, EspnScoreboardResponse.Event event) {
        String homeTeam = resolveTeamName(event, "home");
        String awayTeam = resolveTeamName(event, "away");

        if (homeTeam == null || awayTeam == null) {
            MatchPair matchPair = parseTeamsFromEventName(event.name(), event.shortName());
            if (homeTeam == null) {
                homeTeam = matchPair.homeTeam();
            }
            if (awayTeam == null) {
                awayTeam = matchPair.awayTeam();
            }
        }

        if (isBlank(homeTeam) || isBlank(awayTeam) || isBlank(event.id()) || event.date() == null) {
            return Optional.empty();
        }

        return Optional.of(new NormalizedMatch(
                event.id().trim(),
                leagueCode,
                homeTeam,
                awayTeam,
                event.date(),
                normalizeStatus(resolveStatus(event)),
                normalizeScore(event),
                normalizeVenue(resolveVenue(event))));
    }

    private EspnScoreboardResponse.Status resolveStatus(EspnScoreboardResponse.Event event) {
        if (event.status() != null) {
            return event.status();
        }

        return event.competitions().stream()
                .map(EspnScoreboardResponse.Competition::status)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private EspnScoreboardResponse.Venue resolveVenue(EspnScoreboardResponse.Event event) {
        if (event.venue() != null) {
            return event.venue();
        }

        return event.competitions().stream()
                .map(EspnScoreboardResponse.Competition::venue)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private String resolveTeamName(EspnScoreboardResponse.Event event, String homeAway) {
        return event.competitions().stream()
                .flatMap(competition -> competition.competitors().stream())
                .filter(competitor -> homeAway.equalsIgnoreCase(competitor.homeAway()))
                .map(EspnScoreboardResponse.Competitor::team)
                .filter(Objects::nonNull)
                .map(EspnScoreboardResponse.Team::displayName)
                .filter(name -> !isBlank(name))
                .map(String::trim)
                .findFirst()
                .orElse(null);
    }

    private NormalizedMatch.MatchScore normalizeScore(EspnScoreboardResponse.Event event) {
        Integer homeScore = resolveScore(event, "home");
        Integer awayScore = resolveScore(event, "away");

        if (homeScore == null || awayScore == null) {
            return null;
        }

        return new NormalizedMatch.MatchScore(homeScore, awayScore);
    }

    private Integer resolveScore(EspnScoreboardResponse.Event event, String homeAway) {
        return event.competitions().stream()
                .flatMap(competition -> competition.competitors().stream())
                .filter(competitor -> homeAway.equalsIgnoreCase(competitor.homeAway()))
                .map(EspnScoreboardResponse.Competitor::score)
                .filter(Objects::nonNull)
                .map(EspnScoreboardResponse.Score::value)
                .filter(value -> !isBlank(value))
                .map(String::trim)
                .map(this::parseScore)
                .findFirst()
                .orElse(null);
    }

    private Integer parseScore(String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private NormalizedMatch.MatchStatus normalizeStatus(EspnScoreboardResponse.Status status) {
        if (status == null || status.type() == null || isBlank(status.type().state())) {
            return NormalizedMatch.MatchStatus.SCHEDULED;
        }

        String state = status.type().state().trim().toLowerCase();
        return switch (state) {
            case "in" -> NormalizedMatch.MatchStatus.LIVE;
            case "post" -> NormalizedMatch.MatchStatus.FINAL;
            case "postponed", "delay", "delayed" -> NormalizedMatch.MatchStatus.POSTPONED;
            case "canceled", "cancelled", "abandoned" -> NormalizedMatch.MatchStatus.CANCELED;
            default -> NormalizedMatch.MatchStatus.SCHEDULED;
        };
    }

    private String normalizeVenue(EspnScoreboardResponse.Venue venue) {
        if (venue == null) {
            return null;
        }

        if (!isBlank(venue.displayName())) {
            return venue.displayName().trim();
        }

        if (!isBlank(venue.fullName())) {
            return venue.fullName().trim();
        }

        return null;
    }

    private MatchPair parseTeamsFromEventName(String eventName, String shortName) {
        MatchPair parsedFromName = splitTeams(eventName, " at ");
        if (parsedFromName.isComplete()) {
            return parsedFromName;
        }

        MatchPair parsedFromShortName = splitTeams(shortName, " @ ");
        if (parsedFromShortName.isComplete()) {
            return parsedFromShortName;
        }

        return MatchPair.empty();
    }

    private MatchPair splitTeams(String value, String separator) {
        if (isBlank(value) || !value.contains(separator)) {
            return MatchPair.empty();
        }

        String[] parts = value.split(separator, 2);
        if (parts.length != 2 || isBlank(parts[0]) || isBlank(parts[1])) {
            return MatchPair.empty();
        }

        return new MatchPair(parts[1].trim(), parts[0].trim());
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record MatchPair(String homeTeam, String awayTeam) {
        private static MatchPair empty() {
            return new MatchPair(null, null);
        }

        private boolean isComplete() {
            return homeTeam != null && awayTeam != null;
        }
    }
}