package com.dong.gameapi.footballmatch;

import com.dong.gameapi.error.ApiException;
import com.dong.gameapi.error.ErrorCode;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

/** Discovery selection with a resolved date and sorted, distinct league codes. */
public record MatchQuery(LocalDate resolvedDate, List<String> leagueCodes) {

    private static final int MAX_DISTINCT_LEAGUE_CODES = 128;
    private static final int MAX_LEAGUE_CODE_LENGTH = 80;

    public MatchQuery {
        leagueCodes = List.copyOf(leagueCodes);
    }

    /** Uses the requested calendar date, or today UTC when absent; validates league identifiers. */
    public static MatchQuery fromRequest(
            OffsetDateTime requestedAt,
            Collection<String> requestedLeagueCodes,
            Clock clock
    ) {
        List<String> normalizedLeagueCodes = normalizeLeagueCodes(requestedLeagueCodes);
        Clock effectiveClock = clock == null ? Clock.systemUTC() : clock;
        LocalDate resolvedDate;
        if (requestedAt != null) {
            resolvedDate = requestedAt.toLocalDate();
        } else {
            resolvedDate = LocalDate.now(effectiveClock);
        }

        return new MatchQuery(resolvedDate, normalizedLeagueCodes);
    }

    private static List<String> normalizeLeagueCodes(
            Collection<String> requestedLeagueCodes
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

        if (normalizedLeagueCodes.size() > MAX_DISTINCT_LEAGUE_CODES
                || normalizedLeagueCodes.stream().anyMatch(code -> !isValidLeagueCode(code))) {
            throw new ApiException(
                    ErrorCode.UNSUPPORTED_LEAGUE_CODE,
                    "League codes must be valid identifiers, with at most "
                            + MAX_DISTINCT_LEAGUE_CODES + " distinct values."
            );
        }

        return normalizedLeagueCodes;
    }

    private static boolean isValidLeagueCode(String code) {
        if (code.isEmpty() || code.length() > MAX_LEAGUE_CODE_LENGTH) {
            return false;
        }

        for (int index = 0; index < code.length(); index++) {
            char character = code.charAt(index);
            boolean isLowercaseLetter = character >= 'a' && character <= 'z';
            boolean isDigit = character >= '0' && character <= '9';
            if (!isLowercaseLetter && !isDigit
                    && character != '.' && character != '_' && character != '-') {
                return false;
            }
        }

        return true;
    }
}
