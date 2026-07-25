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
    INVALID_MATCH_DATE(HttpStatus.BAD_REQUEST, "requestedAt must be a valid ISO 8601 datetime with timezone."),
    UNSUPPORTED_LEAGUE_CODE(HttpStatus.BAD_REQUEST, "One or more requested leagueCode values are not supported."),
    MISSING_IDEMPOTENCY_KEY(HttpStatus.UNPROCESSABLE_ENTITY, "The Idempotency-Key header is required."),
    INVALID_UUID(HttpStatus.UNPROCESSABLE_ENTITY, "The Idempotency-Key header must be a valid UUID v4."),
    UNKNOWN_COMMAND(HttpStatus.UNPROCESSABLE_ENTITY, "No handler is registered for the requested command type."),
    UPSTREAM_BAD_RESPONSE(HttpStatus.BAD_GATEWAY, "The upstream match provider returned an invalid response."),
    UPSTREAM_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "The upstream match provider is unavailable."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred."),
    SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "A required dependency is unavailable."),
    ROOM_NOT_FOUND(HttpStatus.UNPROCESSABLE_ENTITY, "The requested room does not exist in the system."),
    INVALID_ROOM_STATE(HttpStatus.UNPROCESSABLE_ENTITY, "The room state is not in the joinable lobby state."),
    EMPTY_PARTICIPANTS(HttpStatus.UNPROCESSABLE_ENTITY, "At least one valid participant must be in the room."),
    EMPTY_MATCHES(HttpStatus.UNPROCESSABLE_ENTITY, "At least one match must be selected for the room."),
    MISSING_COMMON_MATCH(HttpStatus.UNPROCESSABLE_ENTITY, "No common match is currently designated for the room."),
    INVALID_COMMON_MATCH(HttpStatus.UNPROCESSABLE_ENTITY, "The common match designated is not in the selected matches pool."),
    INSUFFICIENT_MATCH_POOL(HttpStatus.UNPROCESSABLE_ENTITY, "The selected matches pool is too small to assign every participant their configured number of matches, even with constraints relaxed."),
    ASSIGNMENT_CONSTRAINTS_UNSATISFIABLE(HttpStatus.UNPROCESSABLE_ENTITY, "The selected matches pool cannot satisfy the room's configured assignment rules. Add more matches, or retry with constraints relaxed."),
    IDEMPOTENCY_KEY_REUSE(HttpStatus.CONFLICT, "This Idempotency-Key was already used for a different room or command.");

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
