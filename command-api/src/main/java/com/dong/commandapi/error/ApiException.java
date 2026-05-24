package com.dong.commandapi.error;

/**
 * The only custom exception in the service. Carries an {@link ErrorCode};
 * {@code GlobalExceptionHandler} maps it to the HTTP response.
 */
public class ApiException extends RuntimeException {

    private final ErrorCode errorCode;

    public ApiException(ErrorCode errorCode) {
        this(errorCode, errorCode.defaultMessage());
    }

    public ApiException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public ErrorCode errorCode() {
        return errorCode;
    }
}
