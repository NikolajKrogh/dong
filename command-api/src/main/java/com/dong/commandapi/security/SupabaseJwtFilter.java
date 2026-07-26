package com.dong.commandapi.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.KeySourceException;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.BadJOSEException;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTClaimsVerifier;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
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

import java.io.IOException;
import java.text.ParseException;
import java.util.List;
import java.util.Set;

/**
 * Validates Supabase JWTs signed with an asymmetric JWT Signing Key
 * (research.md §2, §6, §10 — JWT Signing Algorithm ADR superseded: HS256 with
 * a shared secret has been retired by Supabase in favor of JWT Signing Keys;
 * see https://supabase.com/docs/guides/auth/signing-keys).
 *
 * <p>The signature is verified against Supabase's published JSON Web Key Set
 * ({@code supabase.jwks-url}, resolved by {@link JwksSourceConfig}), keyed by
 * the token's {@code kid} header — this service holds no shared secret. If an
 * {@code Authorization: Bearer} token is present it is verified (signature,
 * {@code exp}, non-empty {@code sub}, {@code role=authenticated}) and an
 * {@link AuthenticatedHost} is placed in the security context. Any failure
 * throws {@link InvalidTokenException} — the filter never writes the
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

    /**
     * Tolerance applied to {@code exp} when deciding whether a token has expired.
     *
     * <p>Set explicitly, and to zero, on purpose. Nimbus's
     * {@link DefaultJWTClaimsVerifier} defaults to
     * {@link DefaultJWTClaimsVerifier#DEFAULT_MAX_CLOCK_SKEW_SECONDS} (60s), which
     * would silently keep honouring access tokens for a minute after Supabase
     * considers them expired — a behaviour change the retired JJWT parser did not
     * have (its {@code allowedClockSkewMillis} defaulted to 0). Clients refresh
     * well before expiry, so there is no upside to a grace window here; raise this
     * only if real clock drift between this service and Supabase is ever observed.
     */
    private static final int MAX_CLOCK_SKEW_SECONDS = 0;

    private final ConfigurableJWTProcessor<SecurityContext> jwtProcessor;

    public SupabaseJwtFilter(JWKSource<SecurityContext> jwkSource) {
        JWSVerificationKeySelector<SecurityContext> keySelector = new JWSVerificationKeySelector<>(
                Set.of(JWSAlgorithm.ES256, JWSAlgorithm.RS256), jwkSource);

        var claimsVerifier = new DefaultJWTClaimsVerifier<SecurityContext>(
                new JWTClaimsSet.Builder().claim("role", AUTHENTICATED_ROLE).build(),
                Set.of("sub", "exp", "role"));
        claimsVerifier.setMaxClockSkew(MAX_CLOCK_SKEW_SECONDS);

        DefaultJWTProcessor<SecurityContext> processor = new DefaultJWTProcessor<>();
        processor.setJWSKeySelector(keySelector);
        processor.setJWTClaimsSetVerifier(claimsVerifier);
        this.jwtProcessor = processor;
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
        JWTClaimsSet claims;
        try {
            claims = jwtProcessor.process(token, null);
        } catch (KeySourceException ex) {
            // The token was never judged: Supabase's JWKS endpoint could not be
            // reached and no cached key set was available. Distinct from a bad
            // token (see KeySourceUnavailableException) so this leaves as a 503
            // rather than telling the client its session is invalid.
            log.warn("Could not retrieve the Supabase JWK set; failing this request as unavailable", ex);
            throw new KeySourceUnavailableException("Unable to verify token signing key", ex);
        } catch (ParseException | BadJOSEException | JOSEException ex) {
            throw new InvalidTokenException("Invalid or expired token", ex);
        }

        String subject = claims.getSubject();
        if (!StringUtils.hasText(subject)) {
            throw new InvalidTokenException("Token is missing a subject (sub) claim");
        }

        return new AuthenticatedHost(subject, AUTHENTICATED_ROLE, token);
    }
}
