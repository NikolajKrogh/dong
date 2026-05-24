package com.dong.commandapi.error;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Single error egress for everything that reaches a controller/advice.
 * Filter-stage failures go through the Spring Security entry point /
 * access-denied handler instead, but emit the identical {@link ApiError} shape.
 *
 * <p>Adding a failure mode = a new {@link ErrorCode} constant. No new handler.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApiException(ApiException ex) {
        ErrorCode code = ex.errorCode();
        if (code.httpStatus().is5xxServerError()) {
            log.error("API error {}: {}", code.code(), ex.getMessage(), ex);
        } else {
            log.warn("API error {}: {}", code.code(), ex.getMessage());
        }
        return ResponseEntity.status(code.httpStatus())
                .body(ApiError.of(code, ex.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException ex) {
        log.warn("Unreadable request body: {}", ex.getMessage());
        return ResponseEntity.status(ErrorCode.BAD_REQUEST.httpStatus())
                .body(ApiError.of(ErrorCode.BAD_REQUEST));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiError> handleMediaType(HttpMediaTypeNotSupportedException ex) {
        log.warn("Unsupported media type: {}", ex.getContentType());
        return ResponseEntity.status(ErrorCode.UNSUPPORTED_MEDIA_TYPE.httpStatus())
                .body(ApiError.of(ErrorCode.UNSUPPORTED_MEDIA_TYPE));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getField() + " " + fe.getDefaultMessage())
                .orElse(ErrorCode.BAD_REQUEST.defaultMessage());
        log.warn("Request validation failed: {}", detail);
        return ResponseEntity.status(ErrorCode.BAD_REQUEST.httpStatus())
                .body(ApiError.of(ErrorCode.BAD_REQUEST, detail));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(ErrorCode.INTERNAL_ERROR.httpStatus())
                .body(ApiError.of(ErrorCode.INTERNAL_ERROR));
    }
}
