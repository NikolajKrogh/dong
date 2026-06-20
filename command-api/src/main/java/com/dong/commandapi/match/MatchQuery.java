package com.dong.commandapi.match;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

public record MatchQuery(LocalDate resolvedDate, List<String> leagueCodes) {

    public MatchQuery {
        leagueCodes = List.copyOf(leagueCodes);
    }

    public static MatchQuery from(
            OffsetDateTime requestedAt,
            Collection<String> requestedLeagueCodes,
            MatchDiscoveryProperties properties,
            Clock clock
    ) {
        Objects.requireNonNull(properties, "properties must not be null");

        List<String> normalizedLeagueCodes = normalizeLeagueCodes(requestedLeagueCodes, properties);
        LocalDate resolvedDate = requestedAt != null
                ? requestedAt.toLocalDate()
                : LocalDate.now(clock == null ? Clock.systemUTC() : clock);

        return new MatchQuery(resolvedDate, normalizedLeagueCodes);
    }

    /** Per-league cache key, e.g. {@code 2026-05-24|eng.1}. */
    public static String cacheKey(LocalDate resolvedDate, String leagueCode) {
        return resolvedDate + "|" + leagueCode;
    }

    private static List<String> normalizeLeagueCodes(
            Collection<String> requestedLeagueCodes,
            MatchDiscoveryProperties properties
    ) {
        Stream<String> leagueCodeStream = requestedLeagueCodes == null
            ? Stream.empty()
            : requestedLeagueCodes.stream();

        List<String> normalizedLeagueCodes = leagueCodeStream
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(code -> !code.isEmpty())
                .distinct()
                .sorted()
                .toList();

        if (normalizedLeagueCodes.isEmpty()) {
            throw new ApiException(
                    ErrorCode.UNSUPPORTED_LEAGUE_CODE,
                    "At least one supported leagueCode query parameter is required."
            );
        }

        HashSet<String> supportedLeagueCodes = new HashSet<>(properties.supportedLeagueCodes());
        List<String> unsupportedLeagueCodes = normalizedLeagueCodes.stream()
                .filter(code -> !supportedLeagueCodes.contains(code))
                .toList();

        if (!unsupportedLeagueCodes.isEmpty()) {
            throw new ApiException(
                    ErrorCode.UNSUPPORTED_LEAGUE_CODE,
                    "Unsupported leagueCode values: " + String.join(", ", unsupportedLeagueCodes)
            );
        }

        return normalizedLeagueCodes;
    }
}