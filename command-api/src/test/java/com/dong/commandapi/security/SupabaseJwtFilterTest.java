package com.dong.commandapi.security;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.dong.commandapi.testsupport.JwksTestSupport;

/**
 * US2 — authenticated access enforcement. Drives the wired filter chain
 * against a protected path via MockMvc to avoid the HttpURLConnection
 * streaming-mode limitation on 401 responses.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK, properties = {
        "supabase.jwks-url=https://example.invalid/.well-known/jwks.json",
        "supabase.url=http://localhost:9"
})
@AutoConfigureMockMvc
@Import(JwksTestSupport.TestJwksConfig.class)
class SupabaseJwtFilterTest {

    private static final String PROTECTED = "/v1/rooms/test/commands/noop";

    @Autowired
    private MockMvc mockMvc;

    private ResultActions call(String authHeaderValue) throws Exception {
        MockHttpServletRequestBuilder req = post(PROTECTED)
                .contentType(MediaType.APPLICATION_JSON);
        if (authHeaderValue != null) {
            req.header(HttpHeaders.AUTHORIZATION, authHeaderValue);
        }
        return mockMvc.perform(req);
    }

    private String signed(String role, Instant expiry) {
        return JwksTestSupport.signedJwt("user-123", role, expiry);
    }

    @Test
    void missingHeaderIsRejected() throws Exception {
        call(null)
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(containsString("UNAUTHORIZED")));
    }

    @Test
    void malformedBearerIsRejected() throws Exception {
        call("Token abc.def.ghi")
                .andExpect(status().isUnauthorized());
    }

    @Test
    void expiredTokenIsRejected() throws Exception {
        String token = signed("authenticated", Instant.now().minusSeconds(60));
        call("Bearer " + token)
                .andExpect(status().isUnauthorized());
    }

    /**
     * Guards the clock-skew setting. Nimbus's default 60s tolerance would accept
     * this token; {@code expiredTokenIsRejected} above sits exactly on that
     * boundary and so cannot tell the two configurations apart.
     */
    @Test
    void tokenExpiredWellWithinNimbusDefaultSkewIsStillRejected() throws Exception {
        String token = signed("authenticated", Instant.now().minusSeconds(30));
        call("Bearer " + token)
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tamperedSignatureIsRejected() throws Exception {
        String token = signed("authenticated", Instant.now().plusSeconds(300));
        call("Bearer " + JwksTestSupport.withCorruptedSignature(token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void truncatedSignatureIsRejected() throws Exception {
        String token = signed("authenticated", Instant.now().plusSeconds(300));
        call("Bearer " + token.substring(0, token.length() - 4))
                .andExpect(status().isUnauthorized());
    }

    /** A structurally valid token signed by a key the JWK set does not publish. */
    @Test
    void tokenSignedByAnUnpublishedKeyIsRejected() throws Exception {
        String forged = JwksTestSupport.forgedJwt(
                "user-123", "authenticated", Instant.now().plusSeconds(300));
        call("Bearer " + forged)
                .andExpect(status().isUnauthorized());
    }

    /**
     * The reason this service moved off the shared secret at all: with asymmetric
     * signing the verification key is public, so accepting HS256 would let anyone
     * forge tokens using that public key as the HMAC secret.
     */
    @Test
    void hs256AlgorithmConfusionForgeryIsRejected() throws Exception {
        String forged = JwksTestSupport.hs256ConfusionJwt(
                "attacker", "authenticated", Instant.now().plusSeconds(300));
        call("Bearer " + forged)
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unsecuredAlgNoneTokenIsRejected() throws Exception {
        String unsecured = JwksTestSupport.unsecuredJwt(
                "attacker", "authenticated", Instant.now().plusSeconds(300));
        call("Bearer " + unsecured)
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenWithoutExpiryIsRejected() throws Exception {
        call("Bearer " + JwksTestSupport.signedJwtWithoutExpiry("user-123", "authenticated"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void anonRoleIsRejected() throws Exception {
        String token = signed("anon", Instant.now().plusSeconds(300));
        call("Bearer " + token)
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validAuthenticatedTokenPassesFilter() throws Exception {
        String token = signed("authenticated", Instant.now().plusSeconds(300));
        // Filter passes → request reaches the controller (NOT blocked with 401).
        call("Bearer " + token)
                .andExpect(status().is(org.hamcrest.Matchers.not(401)));
    }
}
