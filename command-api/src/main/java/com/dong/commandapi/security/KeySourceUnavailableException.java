package com.dong.commandapi.security;

import org.springframework.security.core.AuthenticationException;

/**
 * Thrown by {@link SupabaseJwtFilter} when the token could not be
 * <em>evaluated</em> because Supabase's JWKS endpoint was unreachable — as
 * opposed to {@link InvalidTokenException}, which means the token itself was
 * judged and found bad.
 *
 * <p>The distinction is the difference between a 503 and a 401. Nimbus reports
 * both a forged signature and a failed key-set fetch as a
 * {@code JOSEException}, so collapsing them would tell a client "your session is
 * invalid" during what is really a transient upstream outage — and clients
 * routinely react to 401 by discarding the session and forcing a re-login. This
 * subclass carries that distinction to {@link ApiAuthenticationEntryPoint},
 * which maps it to {@link com.dong.commandapi.error.ErrorCode#SERVICE_UNAVAILABLE}.
 *
 * <p>It remains an {@link AuthenticationException} so the filter still never
 * writes the response itself (ADR-2): Spring Security's
 * {@code ExceptionTranslationFilter} keeps routing every filter-stage failure
 * through the one entry point.
 */
public class KeySourceUnavailableException extends AuthenticationException {

    public KeySourceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
