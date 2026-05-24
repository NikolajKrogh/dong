package com.dong.commandapi.security;

import com.dong.commandapi.supabase.SupabaseProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static io.jsonwebtoken.security.Keys.hmacShaKeyFor;

/**
 * Validates Supabase HS256 JWTs (research.md §2, §6, §10).
 *
 * <p>If an {@code Authorization: Bearer} token is present it is verified
 * (signature, {@code exp}, non-empty {@code sub}, {@code role=authenticated})
 * and an {@link AuthenticatedHost} is placed in the security context. Any
 * failure throws {@link InvalidTokenException} — the filter never writes the
 * response (ADR-2); Spring Security routes to {@link ApiAuthenticationEntryPoint}.
 *
 * <p>A <em>missing</em> token is not rejected here: the request proceeds
 * unauthenticated and the authorization rules deny protected paths (401 via the
 * same entry point). Public paths thus remain reachable without a token.
 */
@Component
public class SupabaseJwtFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(SupabaseJwtFilter.class);
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String AUTHENTICATED_ROLE = "authenticated";

    private final SecretKey signingKey;

    public SupabaseJwtFilter(SupabaseProperties properties) {
        this.signingKey = hmacShaKeyFor(properties.jwtSecret().getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if (StringUtils.hasText(header)) {
            if (!header.startsWith(BEARER_PREFIX)) {
                throw new InvalidTokenException("Authorization header must be a Bearer token");
            }
            String token = header.substring(BEARER_PREFIX.length()).trim();
            AuthenticatedHost host = validate(token);

            var authentication = new UsernamePasswordAuthenticationToken(
                    host, null, List.of(new SimpleGrantedAuthority("ROLE_" + host.role())));
            SecurityContextHolder.getContext().setAuthentication(authentication);
            log.debug("Authenticated host {}", host.hostId());
        }

        filterChain.doFilter(request, response);
    }

    private AuthenticatedHost validate(String token) {
        Claims claims;
        try {
            Jws<Claims> jws = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token); // throws on bad signature / expired
            claims = jws.getPayload();
        } catch (JwtException | IllegalArgumentException ex) {
            throw new InvalidTokenException("Invalid or expired token", ex);
        }

        String subject = claims.getSubject();
        if (!StringUtils.hasText(subject)) {
            throw new InvalidTokenException("Token is missing a subject (sub) claim");
        }

        Object role = claims.get("role");
        if (role == null || !AUTHENTICATED_ROLE.equals(role.toString())) {
            throw new InvalidTokenException("Token role is not '" + AUTHENTICATED_ROLE + "'");
        }

        return new AuthenticatedHost(subject, role.toString());
    }
}
