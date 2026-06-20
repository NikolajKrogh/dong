package com.dong.commandapi.match;

import com.dong.commandapi.match.dto.NormalizedMatch;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

class MatchCacheServiceTest {

    @Test
    void returnsCachedResultsUntilConfiguredTtlExpiresUsingTheInjectedClock() {
        AdjustableClock clock = new AdjustableClock(Instant.parse("2026-05-24T10:15:30Z"), ZoneOffset.UTC);
        MatchDiscoveryProperties properties = new MatchDiscoveryProperties(
                Duration.ofMinutes(5),
                "https://site.api.espn.com/apis/site/v2/sports/soccer",
                List.of("eng.1"),
                null);
        MatchCacheService cacheService = new MatchCacheService(properties, clock);
        String cacheKey = MatchQuery.cacheKey(LocalDate.of(2026, 5, 24), "eng.1");
        AtomicInteger invocationCount = new AtomicInteger();
        Supplier<List<NormalizedMatch>> loader = () -> List.of(match("match-" + invocationCount.incrementAndGet()));

        List<NormalizedMatch> firstResult = cacheService.getOrLoad(cacheKey, loader);
        List<NormalizedMatch> secondResult = cacheService.getOrLoad(cacheKey, loader);

        clock.advance(Duration.ofMinutes(4).plusSeconds(59));
        List<NormalizedMatch> cachedResult = cacheService.getOrLoad(cacheKey, loader);

        clock.advance(Duration.ofSeconds(2));
        List<NormalizedMatch> refreshedResult = cacheService.getOrLoad(cacheKey, loader);

        assertThat(firstResult).extracting(NormalizedMatch::id).containsExactly("match-1");
        assertThat(secondResult).extracting(NormalizedMatch::id).containsExactly("match-1");
        assertThat(cachedResult).extracting(NormalizedMatch::id).containsExactly("match-1");
        assertThat(refreshedResult).extracting(NormalizedMatch::id).containsExactly("match-2");
        assertThat(invocationCount).hasValue(2);
    }

    @Test
    void coalescesInFlightLoadsForIdenticalQueries() throws InterruptedException, ExecutionException, TimeoutException {
        AdjustableClock clock = new AdjustableClock(Instant.parse("2026-05-24T10:15:30Z"), ZoneOffset.UTC);
        MatchDiscoveryProperties properties = new MatchDiscoveryProperties(
                Duration.ofMinutes(5),
                "https://site.api.espn.com/apis/site/v2/sports/soccer",
                List.of("eng.1"),
                null);
        MatchCacheService cacheService = new MatchCacheService(properties, clock);
        String cacheKey = MatchQuery.cacheKey(LocalDate.of(2026, 5, 24), "eng.1");
        AtomicInteger invocationCount = new AtomicInteger();
        CountDownLatch loaderStarted = new CountDownLatch(1);
        CountDownLatch releaseLoader = new CountDownLatch(1);
        Supplier<List<NormalizedMatch>> loader = () -> {
            invocationCount.incrementAndGet();
            loaderStarted.countDown();

            try {
                if (!releaseLoader.await(5, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Timed out waiting for coalesced loader release");
                }
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while waiting for coalesced loader release", ex);
            }

            return List.of(match("shared-match"));
        };

        ExecutorService executorService = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<List<NormalizedMatch>> firstResult = CompletableFuture.supplyAsync(
                    () -> cacheService.getOrLoad(cacheKey, loader),
                    executorService);

            assertThat(loaderStarted.await(5, TimeUnit.SECONDS)).isTrue();

            CompletableFuture<List<NormalizedMatch>> secondResult = CompletableFuture.supplyAsync(
                    () -> cacheService.getOrLoad(cacheKey, loader),
                    executorService);

            releaseLoader.countDown();

            assertThat(firstResult.get(5, TimeUnit.SECONDS))
                    .extracting(NormalizedMatch::id)
                    .containsExactly("shared-match");
            assertThat(secondResult.get(5, TimeUnit.SECONDS))
                    .extracting(NormalizedMatch::id)
                    .containsExactly("shared-match");
            assertThat(invocationCount).hasValue(1);
        } finally {
            executorService.shutdownNow();
        }
    }

    private static NormalizedMatch match(String id) {
        return new NormalizedMatch(
                id,
                "eng.1",
                "Arsenal",
                "Chelsea",
                OffsetDateTime.parse("2026-05-24T19:00:00Z"),
                NormalizedMatch.MatchStatus.SCHEDULED,
                null,
                "Emirates Stadium");
    }

    private static final class AdjustableClock extends Clock {

        private Instant currentInstant;
        private final ZoneId zoneId;

        private AdjustableClock(Instant currentInstant, ZoneId zoneId) {
            this.currentInstant = currentInstant;
            this.zoneId = zoneId;
        }

        @Override
        public ZoneId getZone() {
            return zoneId;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return new AdjustableClock(currentInstant, zone);
        }

        @Override
        public Instant instant() {
            return currentInstant;
        }

        private void advance(Duration duration) {
            currentInstant = currentInstant.plus(duration);
        }
    }
}