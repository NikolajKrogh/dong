package com.dong.commandapi.match;

import com.dong.commandapi.match.dto.NormalizedMatch;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.List;
import java.util.function.Supplier;

/**
 * Bounded, TTL-expiring cache for per-league/date match results.
 *
 * <p>Keyed at the single-league grain (see {@link MatchQuery#cacheKey}) so each
 * league caches and expires independently — a failing league is simply not
 * cached and retries on the next request, while healthy leagues stay warm.
 *
 * <p>Backed by Caffeine: {@code maximumSize} bounds memory on the public,
 * unauthenticated endpoint, {@code expireAfterWrite} drives the TTL (via an
 * injectable {@link Clock} for testing), and {@code get(key, loader)} coalesces
 * concurrent identical loads while never caching a thrown exception.
 */
@Service
public class MatchCacheService {

    private final Cache<String, List<NormalizedMatch>> cache;

    @Autowired
    public MatchCacheService(MatchDiscoveryProperties properties) {
        this(properties, Clock.systemUTC());
    }

    MatchCacheService(MatchDiscoveryProperties properties, Clock clock) {
        Clock effectiveClock = clock == null ? Clock.systemUTC() : clock;
        Ticker ticker = () -> effectiveClock.millis() * 1_000_000L;
        this.cache = Caffeine.newBuilder()
                .expireAfterWrite(properties.ttl())
                .maximumSize(properties.cacheMaximumSize())
                .ticker(ticker)
                .executor(Runnable::run)
                .build();
    }

    /**
     * Returns the cached matches for {@code cacheKey}, or loads, copies, and
     * caches them. Concurrent calls for the same key share one loader
     * invocation. If the loader throws, the exception propagates and nothing is
     * cached.
     */
    public List<NormalizedMatch> getOrLoad(String cacheKey, Supplier<List<NormalizedMatch>> loader) {
        return cache.get(cacheKey, key -> List.copyOf(loader.get()));
    }
}
