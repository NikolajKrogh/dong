package com.dong.commandapi.error;

import org.springframework.http.HttpStatus;

/**
 * Single source of truth for every failure mode. Adding a new failure is one
 * enum constant — no new exception class, no new handler (ADR-2).
 */
public enum ErrorCode {

    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Authentication is required or the supplied credentials are invalid."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "The authenticated caller is not permitted to perform this action."),
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "The request body could not be read."),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "The request content type is not supported."),
    MISSING_IDEMPOTENCY_KEY(HttpStatus.UNPROCESSABLE_ENTITY, "The Idempotency-Key header is required."),
    INVALID_UUID(HttpStatus.UNPROCESSABLE_ENTITY, "The Idempotency-Key header must be a valid UUID v4."),
    UNKNOWN_COMMAND(HttpStatus.UNPROCESSABLE_ENTITY, "No handler is registered for the requested command type."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred."),
    SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "A required dependency is unavailable.");

    private final HttpStatus httpStatus;
    private final String defaultMessage;

    ErrorCode(HttpStatus httpStatus, String defaultMessage) {
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus httpStatus() {
        return httpStatus;
    }

    /** Machine-readable code emitted in the {@code error} field (== enum name). */
    public String code() {
        return name();
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
