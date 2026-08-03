package com.dong.commandapi.security;

import com.dong.commandapi.supabase.SupabaseProperties;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.SecurityContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.MalformedURLException;
import java.net.URL;

/**
 * Supplies the {@link JWKSource} that {@link SupabaseJwtFilter} verifies JWT
 * signatures against.
 *
 * <p>A separate bean (rather than building this inline in the filter) so tests
 * can substitute an in-memory key set and never make a real network call to
 * Supabase.
 *
 * <p>Resilience matters here because, unlike the retired shared-secret scheme,
 * verification now depends on an <em>external</em> endpoint on the hot path of
 * every authenticated request:
 * <ul>
 *   <li><b>cache</b> — keys are held for {@code CACHE_TTL_MS}, so the common case
 *       does no I/O at all. An unrecognised {@code kid} forces a refresh, which is
 *       what makes dashboard key rotation work without a redeploy.</li>
 *   <li><b>rate limited</b> — bounds refreshes so a burst of tokens carrying an
 *       unknown {@code kid} cannot be turned into a request flood against Supabase.</li>
 *   <li><b>retrying</b> — one retry absorbs a single dropped connection.</li>
 *   <li><b>outage tolerant</b> — if Supabase is unreachable <em>after</em> a
 *       successful fetch, the last known key set keeps being served for
 *       {@code OUTAGE_TOLERANCE_MS} instead of failing every request. Without this a
 *       brief JWKS blip would reject every token in flight.</li>
 * </ul>
 *
 * <p>Note the deliberate gap: an outage that begins <em>before</em> any successful
 * fetch (bad URL, network down at boot) has no cached keys to fall back on and
 * does fail — surfaced as 503, not 401, by {@link SupabaseJwtFilter} and
 * {@link ApiAuthenticationEntryPoint}, and reported DOWN by
 * {@link com.dong.commandapi.health.SupabaseJwksHealthIndicator}.
 */
@Configuration
public class JwksSourceConfig {

    /** How long a fetched key set is trusted before a refresh is due. */
    private static final long CACHE_TTL_MS = 5 * 60 * 1000L;
    /** How long a refresh may block while the cache is being repopulated. */
    private static final long CACHE_REFRESH_TIMEOUT_MS = 5 * 1000L;
    /** Serve stale keys for up to this long while Supabase is unreachable. */
    private static final long OUTAGE_TOLERANCE_MS = 60 * 60 * 1000L;

    @Bean
    public JWKSource<SecurityContext> supabaseJwkSource(SupabaseProperties properties)
            throws MalformedURLException {
        return JWKSourceBuilder.<SecurityContext>create(new URL(properties.jwksUrl()))
                .cache(CACHE_TTL_MS, CACHE_REFRESH_TIMEOUT_MS)
                .rateLimited(true)
                .retrying(true)
                .outageTolerant(OUTAGE_TOLERANCE_MS)
                .build();
    }
}
