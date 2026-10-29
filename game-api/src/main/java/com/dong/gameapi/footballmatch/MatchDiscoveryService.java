package com.dong.gameapi.footballmatch;

import com.dong.gameapi.error.ApiException;
import com.dong.gameapi.error.ErrorCode;
import com.dong.gameapi.footballmatch.dto.NormalizedMatch;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/** Compatibility projection only. The shared catalog owns acquisition and freshness. */
@Service
public class MatchDiscoveryService {
    private final MatchCatalogClient catalog;
    private final Clock clock;

    @Autowired
    public MatchDiscoveryService(MatchCatalogClient catalog) {
        this(catalog, Clock.systemUTC());
    }

    MatchDiscoveryService(MatchCatalogClient catalog, Clock clock) {
        this.catalog = catalog;
        this.clock = clock;
    }

    /** Parses the optional timestamp and projects catalog results into the flat HTTP response. */
    public List<NormalizedMatch> discoverMatches(String requestedAt, List<String> leagueCodes) {
        OffsetDateTime instant;
        try {
            instant = requestedAt == null || requestedAt.isBlank() ? null : OffsetDateTime.parse(requestedAt.trim());
        } catch (DateTimeParseException ex) {
            throw new ApiException(ErrorCode.INVALID_MATCH_DATE);
        }
        return discoverMatches(MatchQuery.fromRequest(instant, leagueCodes, clock));
    }

    public List<NormalizedMatch> discoverMatches(MatchQuery query) {
        LocalDate today = LocalDate.now(clock);
        if (query.resolvedDate().isBefore(today.minusDays(7)) || query.resolvedDate().isAfter(today.plusDays(7))) {
            throw new ApiException(ErrorCode.INVALID_MATCH_DATE, "Match date must be within seven days of today UTC.");
        }
        List<NormalizedMatch> matches = new ArrayList<>();
        boolean completeEmpty = true;
        ApiException firstFailure = null;
        for (int start = 0; start < query.leagueCodes().size(); start += 16) {
            List<String> codes = query.leagueCodes().subList(start, Math.min(start + 16, query.leagueCodes().size()));
            try {
                MatchCatalogClient.DiscoveryResult response = catalog.discoverMatches(query.resolvedDate(), codes);
                boolean available = "available".equals(response.availability())
                        && response.groups().size() == codes.size()
                        && response.groups().stream().allMatch(group -> "available".equals(group.availability()));
                completeEmpty &= available;
                for (MatchCatalogClient.SavedMatch match : response.matches()) {
                    matches.add(new NormalizedMatch(match.identity().sourceEventId(), match.identity().leagueCode(),
                            match.homeTeam().name(), match.awayTeam().name(), match.kickoffAt(), mapLifecycleToStatus(match.lifecycle()),
                            match.homeScore() == null && match.awayScore() == null ? null
                                    : new NormalizedMatch.MatchScore(match.homeScore(), match.awayScore()),
                            match.venue() == null ? null : match.venue().name(), match.catalogMatchId()));
                }
            } catch (ApiException ex) {
                completeEmpty = false;
                if (ex.errorCode() != ErrorCode.UPSTREAM_UNAVAILABLE && ex.errorCode() != ErrorCode.UPSTREAM_BAD_RESPONSE) throw ex;
                if (firstFailure == null) firstFailure = ex;
            }
        }
        if (matches.isEmpty() && !completeEmpty) {
            throw firstFailure == null ? new ApiException(ErrorCode.UPSTREAM_UNAVAILABLE) : firstFailure;
        }
        return List.copyOf(matches);
    }

    private static NormalizedMatch.MatchStatus mapLifecycleToStatus(String lifecycle) {
        return switch (lifecycle) {
            case "scheduled" -> NormalizedMatch.MatchStatus.SCHEDULED;
            case "live" -> NormalizedMatch.MatchStatus.LIVE;
            case "finished" -> NormalizedMatch.MatchStatus.FINISHED;
            case "postponed" -> NormalizedMatch.MatchStatus.POSTPONED;
            case "canceled" -> NormalizedMatch.MatchStatus.CANCELED;
            case "delayed" -> NormalizedMatch.MatchStatus.DELAYED;
            case "suspended" -> NormalizedMatch.MatchStatus.SUSPENDED;
            case "abandoned" -> NormalizedMatch.MatchStatus.ABANDONED;
            default -> NormalizedMatch.MatchStatus.UNKNOWN;
        };
    }
}
