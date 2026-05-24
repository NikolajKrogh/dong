package com.dong.commandapi.supabase;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Type-safe Supabase configuration. Owned by the {@code supabase/} integration
 * boundary; {@code security/} and {@code health/} depend forward onto it.
 *
 * <p>{@code @Validated} + {@code @NotBlank} means a missing or blank secret
 * fails bean validation and the application context refuses to start — the
 * fail-closed startup guarantee (FR-013 / research.md ADR-3 §10).
 *
 * @param jwtSecret HS256 secret used to verify Supabase-issued JWTs
 * @param url       Supabase base URL (used by the health indicator)
 */
@Validated
@ConfigurationProperties(prefix = "supabase")
public record SupabaseProperties(

        @NotBlank(message = "supabase.jwt-secret must be set (fail-closed)")
        String jwtSecret,

        @NotBlank(message = "supabase.url must be set")
        String url
) {
}
