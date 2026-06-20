package com.dong.commandapi.match;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.List;

@Validated
@ConfigurationProperties(prefix = "command-api.match-discovery")
public record MatchDiscoveryProperties(

        @NotNull(message = "command-api.match-discovery.ttl must be set")
        Duration ttl,

        @NotBlank(message = "command-api.match-discovery.espn-base-url must be set")
        String espnBaseUrl,

        @NotEmpty(message = "command-api.match-discovery.supported-league-codes must not be empty")
        List<@NotBlank(message = "command-api.match-discovery.supported-league-codes entries must not be blank") String> supportedLeagueCodes,

        // Maximum number of cached per-league/date entries. Bounds in-memory cache
        // growth on the public, unauthenticated /v1/matches endpoint. Optional in
        // config; defaults below when unset or non-positive.
        Long cacheMaximumSize
) {

    private static final long DEFAULT_CACHE_MAXIMUM_SIZE = 10_000L;

    public MatchDiscoveryProperties {
        supportedLeagueCodes = supportedLeagueCodes == null ? List.of() : List.copyOf(supportedLeagueCodes);
        cacheMaximumSize = (cacheMaximumSize == null || cacheMaximumSize <= 0)
                ? DEFAULT_CACHE_MAXIMUM_SIZE
                : cacheMaximumSize;
    }

    @AssertTrue(message = "command-api.match-discovery.ttl must be a positive duration")
    public boolean hasPositiveTtl() {
        return ttl != null && !ttl.isZero() && !ttl.isNegative();
    }
}