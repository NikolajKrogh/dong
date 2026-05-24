package com.dong.commandapi.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * CORS settings. Bound from {@code command-api.cors} — populated only by
 * {@code application-dev.yml} so cross-origin access is never silently enabled
 * in other profiles (grep-able, profile-scoped).
 */
@ConfigurationProperties(prefix = "command-api.cors")
public record CorsProperties(
        boolean enabled,
        List<String> allowedOrigins,
        List<String> allowedMethods,
        List<String> allowedHeaders
) {
}
