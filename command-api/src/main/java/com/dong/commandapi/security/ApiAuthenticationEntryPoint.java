package com.dong.commandapi.security;

import com.dong.commandapi.error.ApiError;
import com.dong.commandapi.error.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Single egress for filter-stage authentication failures (ADR-2). The JWT filter
 * throws {@link AuthenticationException}; Spring Security's
 * {@code ExceptionTranslationFilter} routes here. Emits the same
 * {@link ApiError} shape as {@code GlobalExceptionHandler}.
 *
 * <p>Normally that means 401. The one exception is
 * {@link KeySourceUnavailableException}: the token could not be evaluated at all
 * because Supabase's JWKS endpoint was unreachable, which is an upstream outage
 * (503) rather than a verdict on the caller's credentials. Answering 401 there
 * would push clients into discarding a perfectly good session.
 */
@Component
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public ApiAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        ErrorCode code = authException instanceof KeySourceUnavailableException
                ? ErrorCode.SERVICE_UNAVAILABLE
                : ErrorCode.UNAUTHORIZED;
        response.setStatus(code.httpStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(),
                ApiError.of(code, code.defaultMessage()));
    }
}
