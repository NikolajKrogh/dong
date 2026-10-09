package com.dong.commandapi.security;

import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * CORS settings bound from {@code command-api.cors}. Dev permits loopback;
 * prod requires an explicit list of web origins.
 */
@ConfigurationProperties(prefix = "command-api.cors")
public record CorsProperties(
        boolean enabled,
        @NotNull List<String> allowedOrigins,
        @NotNull List<String> allowedMethods,
        @NotNull List<String> allowedHeaders
) {
}
