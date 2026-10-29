package com.dong.gameapi.health;

import java.time.Duration;
import java.time.Instant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

import com.dong.gameapi.supabase.SupabaseHealthProbe;
import com.dong.gameapi.supabase.SupabaseProperties;

/**
 * Reports Supabase reachability under the {@code supabase} health component.
 * Result is cached for 10s so polling doesn't hammer the dependency, while
 * still surfacing a degraded state well within the 15s budget (SC-003).
 */
@Component
public class SupabaseHealthIndicator implements HealthIndicator {

    private final SupabaseHealthProbe supabaseHealthProbe;
    private final String url;
    private final Duration cacheTtl;

    private volatile Instant lastCheckedAt = Instant.EPOCH;
    private volatile boolean lastReachable = false;

    public SupabaseHealthIndicator(
            SupabaseHealthProbe supabaseHealthProbe,
            SupabaseProperties properties,
            @Value("${game-api.health.supabase.cache-ttl:10s}") Duration cacheTtl) {
        this.supabaseHealthProbe = supabaseHealthProbe;
        this.url = properties.url();
        this.cacheTtl = cacheTtl;
    }

    @Override
    public Health health() {
        boolean reachable = checkCachedReachability();
        Health.Builder builder = reachable ? Health.up() : Health.down();
        return builder.withDetail("url", url).build();
    }

    private boolean checkCachedReachability() {
        Instant now = Instant.now();
        if (Duration.between(lastCheckedAt, now).compareTo(cacheTtl) >= 0) {
            synchronized (this) {
                if (Duration.between(lastCheckedAt, now).compareTo(cacheTtl) >= 0) {
                    lastReachable = supabaseHealthProbe.isReachable();
                    lastCheckedAt = now;
                }
            }
        }
        return lastReachable;
    }
}
