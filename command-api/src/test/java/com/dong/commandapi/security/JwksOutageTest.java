package com.dong.commandapi.security;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import com.nimbusds.jose.RemoteKeySourceException;
import com.nimbusds.jose.jwk.JWKSelector;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.dong.commandapi.testsupport.JwksTestSupport;

/**
 * A Supabase JWKS outage must not masquerade as an authentication failure.
 *
 * <p>Nimbus reports an unreachable key set as a {@link RemoteKeySourceException},
 * which extends {@code JOSEException} — the same supertype as a forged-signature
 * failure. Collapsing the two would answer 401 during a transient upstream
 * outage, and clients routinely treat 401 as "session invalid" and force a
 * re-login. This pins the mapping to 503 instead.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK, properties = {
        "supabase.jwks-url=https://example.invalid/.well-known/jwks.json",
        "supabase.url=http://localhost:9"
})
@AutoConfigureMockMvc
@Import(JwksOutageTest.UnreachableJwksConfig.class)
class JwksOutageTest {

    private static final String PROTECTED = "/v1/rooms/test/commands/noop";

    @Autowired
    private MockMvc mockMvc;

    /** Stands in for a JWKS endpoint that is down with nothing cached to fall back on. */
    @TestConfiguration
    static class UnreachableJwksConfig {

        @Bean
        @Primary
        JWKSource<SecurityContext> unreachableJwkSource() {
            return (JWKSelector selector, SecurityContext context) -> {
                throw new RemoteKeySourceException("Couldn't retrieve remote JWK set",
                        new java.io.IOException("simulated outage"));
            };
        }
    }

    @Test
    void jwksOutageYieldsServiceUnavailableRatherThanUnauthorized() throws Exception {
        String token = JwksTestSupport.signedJwt(
                "host-1", "authenticated", Instant.now().plusSeconds(300));

        mockMvc.perform(post(PROTECTED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().string(containsString("SERVICE_UNAVAILABLE")));
    }

    /** A genuinely bad token must still be a 401 even while the key source is unhappy. */
    @Test
    void malformedTokenIsStillUnauthorized() throws Exception {
        mockMvc.perform(post(PROTECTED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, "Token not-even-a-jwt"))
                .andExpect(status().isUnauthorized());
    }
}
