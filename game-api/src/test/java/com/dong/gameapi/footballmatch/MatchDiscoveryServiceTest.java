package com.dong.gameapi.footballmatch;

import com.dong.gameapi.error.ApiException;
import com.dong.gameapi.error.ErrorCode;
import com.dong.gameapi.footballmatch.dto.NormalizedMatch;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class MatchDiscoveryServiceTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 26);
    private final MatchCatalogClient catalog = mock(MatchCatalogClient.class);
    private MatchDiscoveryService service;

    @BeforeEach
    void setUp() {
        service = new MatchDiscoveryService(catalog,
                Clock.fixed(Instant.parse("2026-10-26T10:00:00Z"), ZoneOffset.UTC));
    }

    @Test
    void knownEmptyIsTheOnlyEmptySuccess() {
        when(catalog.discoverMatches(TODAY, List.of("eng.1"))).thenReturn(result(List.of(), "available", "eng.1"));
        assertThat(service.discoverMatches(null, List.of("eng.1"))).isEmpty();
        when(catalog.discoverMatches(TODAY, List.of("eng.1"))).thenReturn(result(List.of(), "pending", "eng.1"));
        assertThatThrownBy(() -> service.discoverMatches(null, List.of("eng.1")))
                .isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.UPSTREAM_UNAVAILABLE);
    }

    @Test
    void partialNonemptyFactsKeepSourceIdentityKickoffAndUnknownScores() {
        when(catalog.discoverMatches(TODAY, List.of("eng.1", "usa.1")))
                .thenReturn(result(List.of(match()), "partial", "eng.1", "usa.1"));
        NormalizedMatch match = service.discoverMatches(null, List.of("usa.1", "eng.1")).get(0);
        assertThat(match.id()).isEqualTo("event-123");
        assertThat(match.catalogMatchId()).isEqualTo("9007199254740993");
        assertThat(match.startDateTime()).isEqualTo(OffsetDateTime.parse("2026-10-26T19:00:00Z"));
        assertThat(match.status()).isEqualTo(NormalizedMatch.MatchStatus.LIVE);
        assertThat(match.score().home()).isEqualTo(2);
        assertThat(match.score().away()).isNull();
    }

    @Test
    void explicitOffsetResolvesCalendarDateWithoutUtcDayShift() {
        LocalDate offsetDay = TODAY.plusDays(1);
        when(catalog.discoverMatches(offsetDay, List.of("eng.1"))).thenReturn(result(List.of(), "available", "eng.1"));
        service.discoverMatches("2026-10-27T00:30:00+14:00", List.of(" eng.1 ", "eng.1"));
        verify(catalog).discoverMatches(offsetDay, List.of("eng.1"));
    }

    @Test
    void repeatedReadsForwardEveryTimeAndUseNoLocalFreshnessPolicy() {
        when(catalog.discoverMatches(TODAY, List.of("eng.1"))).thenReturn(result(List.of(), "available", "eng.1"));
        service.discoverMatches(null, List.of("eng.1"));
        service.discoverMatches(null, List.of("eng.1"));
        verify(catalog, times(2)).discoverMatches(TODAY, List.of("eng.1"));
    }

    @Test
    void rejectsInvalidOrOutOfRangeDateAndMalformedLeagueBeforeTransport() {
        assertThatThrownBy(() -> service.discoverMatches("not-a-date", List.of("eng.1"))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.discoverMatches("2026-11-03T00:00:00Z", List.of("eng.1"))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.discoverMatches(null, List.of("../bogus"))).isInstanceOf(ApiException.class);
        verifyNoInteractions(catalog);
    }

    @Test
    void malformedCatalogPreservesControlled502WhileUnavailableRemains503() {
        when(catalog.discoverMatches(TODAY, List.of("eng.1"))).thenThrow(new ApiException(ErrorCode.UPSTREAM_BAD_RESPONSE));
        assertThatThrownBy(() -> service.discoverMatches(null, List.of("eng.1"))).isInstanceOf(ApiException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.UPSTREAM_BAD_RESPONSE);
    }

    @Test
    void compatibilityRequestsChunkMoreThanSixteenLeaguesWithoutSourceFallback() {
        List<String> codes = IntStream.range(0, 20).mapToObj(i -> "league." + i).sorted().toList();
        when(catalog.discoverMatches(eq(TODAY), anyList())).thenAnswer(call -> {
            List<String> requestedCodes = call.getArgument(1);
            return result(List.of(), "available", requestedCodes.toArray(String[]::new));
        });
        assertThat(service.discoverMatches(null, codes)).isEmpty();
        verify(catalog).discoverMatches(TODAY, codes.subList(0, 16));
        verify(catalog).discoverMatches(TODAY, codes.subList(16, 20));
    }

    @Test
    void newlySupportedCatalogLeagueNeedsNoJavaConfigurationChange() {
        when(catalog.discoverMatches(TODAY, List.of("future.1"))).thenReturn(result(List.of(), "available", "future.1"));
        assertThat(service.discoverMatches(null, List.of("future.1"))).isEmpty();
        verify(catalog).discoverMatches(TODAY, List.of("future.1"));
    }

    static MatchCatalogClient.DiscoveryResult result(List<MatchCatalogClient.SavedMatch> matches, String state, String... codes) {
        return new MatchCatalogClient.DiscoveryResult(matches, state,
                Arrays.stream(codes).map(code -> new MatchCatalogClient.DiscoveryGroup(code, state)).toList());
    }

    static MatchCatalogClient.SavedMatch match() {
        return new MatchCatalogClient.SavedMatch(
                "9007199254740993",
                new MatchCatalogClient.Identity("espn", "eng.1", "event-123"),
                new MatchCatalogClient.Team("Home"),
                new MatchCatalogClient.Team("Away"),
                OffsetDateTime.parse("2026-10-26T19:00:00Z"),
                "live",
                2,
                null,
                new MatchCatalogClient.Venue("Stadium"));
    }
}
