package com.dong.commandapi.security;

import org.springframework.security.core.AuthenticationException;

/**
 * Thrown by {@link SupabaseJwtFilter} when a presented token is invalid.
 * Concrete subclass of the abstract {@link AuthenticationException} so Spring
 * Security's {@code ExceptionTranslationFilter} routes it to
 * {@link ApiAuthenticationEntryPoint} (single 401 egress, ADR-2).
 */
public class InvalidTokenException extends AuthenticationException {

    public InvalidTokenException(String message) {
        super(message);
    }

    public InvalidTokenException(String message, Throwable cause) {
        super(message, cause);
    }
}
