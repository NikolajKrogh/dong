package com.dong.commandapi.error;

import java.time.Instant;

/**
 * The single wire shape for every error response. Emitted identically by
 * {@code GlobalExceptionHandler}, {@code ApiAuthenticationEntryPoint} (401),
 * and {@code ApiAccessDeniedHandler} (403).
 *
 * @param error     machine-readable code ({@link ErrorCode#code()})
 * @param message   human-readable description
 * @param timestamp server time of the error (ISO-8601)
 */
public record ApiError(String error, String message, Instant timestamp) {

    public static ApiError of(ErrorCode code, String message) {
        return new ApiError(code.code(), message, Instant.now());
    }

    public static ApiError of(ErrorCode code) {
        return of(code, code.defaultMessage());
    }
}
