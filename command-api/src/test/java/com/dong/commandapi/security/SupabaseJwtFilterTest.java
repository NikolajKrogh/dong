package com.dong.commandapi.security;

import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import static io.jsonwebtoken.security.Keys.hmacShaKeyFor;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * US2 — authenticated access enforcement. Drives the wired filter chain
 * against a protected path via MockMvc to avoid the HttpURLConnection
 * streaming-mode limitation on 401 responses.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "supabase.jwt-secret=" + SupabaseJwtFilterTest.SECRET,
                "supabase.url=http://localhost:9"
        }
)
@AutoConfigureMockMvc
class SupabaseJwtFilterTest {

    static final String SECRET = "test-secret-which-is-at-least-thirty-two-bytes-long";
    private static final SecretKey KEY = hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
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
        return Jwts.builder()
                .subject("user-123")
                .claim("role", role)
                .expiration(Date.from(expiry))
                .signWith(KEY)
                .compact();
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

    @Test
    void tamperedSignatureIsRejected() throws Exception {
        String token = signed("authenticated", Instant.now().plusSeconds(300));
        String tampered = token.substring(0, token.length() - 2) + (token.endsWith("A") ? "B" : "A");
        call("Bearer " + tampered)
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
