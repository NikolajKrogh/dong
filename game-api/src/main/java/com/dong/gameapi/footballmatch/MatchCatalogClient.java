package com.dong.gameapi.footballmatch;

import com.dong.gameapi.error.ApiException;
import com.dong.gameapi.error.ErrorCode;
import com.dong.gameapi.supabase.SupabaseProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Public discovery authority only: no provider endpoint, worker secret, cache or retries. */
@Component
public class MatchCatalogClient {
    private static final String MATCH_CATALOG_PROVIDER = "espn";
    private static final Set<String> AVAILABILITY = Set.of("available", "partial", "pending", "unavailable", "deferred");
    private final RestClient client;
    private final String publicKey;

    @Autowired
    public MatchCatalogClient(SupabaseProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(40_000);
        client = RestClient.builder().baseUrl(properties.url() + "/functions/v1").requestFactory(factory).build();
        publicKey = properties.anonKey();
    }

    MatchCatalogClient(RestClient client, String publicKey) {
        this.client = client;
        this.publicKey = publicKey;
    }

    /** Calls public catalog discovery once and rejects malformed or inconsistent results. */
    public DiscoveryResult discoverMatches(LocalDate date, List<String> leagueCodes) {
        if (!StringUtils.hasText(publicKey) || publicKey.startsWith("sb_secret_")) throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE);
        try {
            DiscoveryResult result = client.post().uri("/discover-matches")
                    .header("apikey", publicKey).contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("leagueCodes", leagueCodes, "date", date.toString()))
                    .retrieve().body(DiscoveryResult.class);
            validateDiscoveryResponse(result, leagueCodes);
            return result;
        } catch (RestClientResponseException ex) {
            throw mapCatalogFailure(ex);
        } catch (RestClientException ex) {
            throw new ApiException(ErrorCode.UPSTREAM_UNAVAILABLE);
        }
    }

    private static ApiException mapCatalogFailure(RestClientResponseException failure) {
        if (failure.getStatusCode().value() == 400) {
            try {
                DiscoveryError error = failure.getResponseBodyAs(DiscoveryError.class);
                if (error != null && Boolean.FALSE.equals(error.ok())) {
                    if ("unsupported_league".equals(error.code())) return new ApiException(ErrorCode.UNSUPPORTED_LEAGUE_CODE);
                    if ("date_out_of_range".equals(error.code())) return new ApiException(ErrorCode.INVALID_MATCH_DATE);
                }
            } catch (RestClientException ignored) {
                // Unrecognized error bodies remain an upstream failure, never a public message.
            }
        }
        return new ApiException(ErrorCode.UPSTREAM_UNAVAILABLE);
    }

    private static void validateDiscoveryResponse(DiscoveryResult result, List<String> codes) {
        if (result == null || result.matches() == null || result.groups() == null || result.availability() == null || !AVAILABILITY.contains(result.availability())
                || result.groups().size() != codes.size()) throw new ApiException(ErrorCode.UPSTREAM_BAD_RESPONSE);
        Set<String> groups = new HashSet<>();
        for (DiscoveryGroup group : result.groups()) {
            if (group == null || !codes.contains(group.leagueCode()) || !groups.add(group.leagueCode())
                    || group.availability() == null || !AVAILABILITY.contains(group.availability())) throw new ApiException(ErrorCode.UPSTREAM_BAD_RESPONSE);
        }
        for (SavedMatch match : result.matches()) {
            if (match == null || match.identity() == null || !MATCH_CATALOG_PROVIDER.equals(match.identity().provider())
                    || !codes.contains(match.identity().leagueCode()) || !StringUtils.hasText(match.identity().sourceEventId())
                    || !isCatalogMatchId(match.catalogMatchId())
                    || match.homeTeam() == null || !StringUtils.hasText(match.homeTeam().name())
                    || match.awayTeam() == null || !StringUtils.hasText(match.awayTeam().name()) || match.lifecycle() == null
                    || match.homeScore() != null && match.homeScore() < 0 || match.awayScore() != null && match.awayScore() < 0) {
                throw new ApiException(ErrorCode.UPSTREAM_BAD_RESPONSE);
            }
        }
    }

    private static boolean isCatalogMatchId(String value) {
        try {
            long parsed = Long.parseLong(value);
            return parsed > 0 && Long.toString(parsed).equals(value);
        } catch (NumberFormatException ex) {
            return false;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record DiscoveryError(Boolean ok, String code) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DiscoveryResult(List<SavedMatch> matches, String availability, List<DiscoveryGroup> groups) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DiscoveryGroup(String leagueCode, String availability) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SavedMatch(String catalogMatchId, Identity identity, Team homeTeam, Team awayTeam,
                             OffsetDateTime kickoffAt, String lifecycle, Integer homeScore, Integer awayScore, Venue venue) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Identity(String provider, String leagueCode, String sourceEventId) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Team(String name) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Venue(String name) { }
}
