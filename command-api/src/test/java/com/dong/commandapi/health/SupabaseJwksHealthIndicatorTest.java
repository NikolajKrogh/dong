package com.dong.commandapi.health;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.List;

import com.dong.commandapi.supabase.SupabaseProperties;
import com.nimbusds.jose.RemoteKeySourceException;
import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.gen.ECKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;

import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;

/**
 * The readiness signal for the dependency that actually governs whether
 * authentication works. Before this indicator existed, a wrong
 * {@code supabase.jwks-url} started cleanly and reported UP off the back of an
 * unrelated base URL, then rejected every authenticated request.
 */
class SupabaseJwksHealthIndicatorTest {

    private static final String JWKS_URL = "https://example.test/.well-known/jwks.json";

    private static SupabaseProperties props() {
        return new SupabaseProperties(JWKS_URL, "http://localhost:9", "");
    }

    private static SupabaseJwksHealthIndicator indicator(JWKSource<SecurityContext> source) {
        return new SupabaseJwksHealthIndicator(source, props());
    }

    @Test
    void reportsUpWhenTheKeySetResolves() throws Exception {
        var key = new ECKeyGenerator(Curve.P_256).keyID("k1").generate();
        Health health = indicator(new ImmutableJWKSet<>(new JWKSet(key.toPublicJWK()))).health();

        assertThat(health.getStatus()).isEqualTo(Status.UP);
        assertThat(health.getDetails()).containsEntry("keys", 1);
        assertThat(health.getDetails()).containsEntry("jwksUrl", JWKS_URL);
    }

    @Test
    void reportsDownWhenTheEndpointIsUnreachable() {
        JWKSource<SecurityContext> broken = (selector, context) -> {
            throw new RemoteKeySourceException("Couldn't retrieve remote JWK set",
                    new IOException("simulated outage"));
        };

        Health health = indicator(broken).health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        assertThat(health.getDetails()).containsEntry("jwksUrl", JWKS_URL);
    }

    /**
     * A reachable endpoint serving an empty key set is still unusable — this is what
     * a project that has not yet created an asymmetric signing key looks like.
     */
    @Test
    void reportsDownWhenTheKeySetIsEmpty() {
        JWKSource<SecurityContext> empty = (selector, context) -> List.of();

        Health health = indicator(empty).health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        assertThat(health.getDetails()).containsEntry("reason", "JWK set contains no keys");
    }
}
