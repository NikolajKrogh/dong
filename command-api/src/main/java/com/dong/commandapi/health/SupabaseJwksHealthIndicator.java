package com.dong.commandapi.health;

import com.dong.commandapi.supabase.SupabaseProperties;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKMatcher;
import com.nimbusds.jose.jwk.JWKSelector;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Reports whether Supabase's JWT signing keys can actually be resolved, under the
 * {@code supabaseJwks} health component.
 *
 * <p>Separate from {@link SupabaseHealthIndicator} because {@code supabase.url} and
 * {@code supabase.jwks-url} are independent settings, and only the latter governs
 * whether authentication works. Without this, a project ref typo or an omitted
 * {@code /auth/v1/.well-known/jwks.json} path starts cleanly, passes
 * {@code @NotBlank}, parses as a URL, reports UP on the strength of an unrelated
 * base URL, sails through the readiness gate — and then rejects 100% of
 * authenticated requests. This makes that misconfiguration visible before traffic
 * arrives.
 *
 * <p>No caching here: the underlying {@link JWKSource} is already a caching,
 * rate-limited, outage-tolerant source (see
 * {@code JwksSourceConfig}), so a poll normally resolves from memory and never
 * touches the network. It reports UP whenever a usable key set is available —
 * including one served from cache during a Supabase outage, which is the honest
 * answer to "can this service still verify tokens?"
 */
@Component
public class SupabaseJwksHealthIndicator implements HealthIndicator {

    private final JWKSource<SecurityContext> jwkSource;
    private final String jwksUrl;

    public SupabaseJwksHealthIndicator(JWKSource<SecurityContext> jwkSource,
                                       SupabaseProperties properties) {
        this.jwkSource = jwkSource;
        this.jwksUrl = properties.jwksUrl();
    }

    @Override
    public Health health() {
        Health.Builder builder;
        try {
            List<JWK> keys = jwkSource.get(new JWKSelector(new JWKMatcher.Builder().build()), null);
            builder = keys.isEmpty()
                    ? Health.down().withDetail("reason", "JWK set contains no keys")
                    : Health.up().withDetail("keys", keys.size());
        } catch (Exception ex) {
            builder = Health.down().withDetail("reason", ex.getMessage());
        }
        return builder.withDetail("jwksUrl", jwksUrl).build();
    }
}
