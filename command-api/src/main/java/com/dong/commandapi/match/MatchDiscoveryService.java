package com.dong.commandapi.match;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import com.dong.commandapi.match.dto.NormalizedMatch;
import com.dong.commandapi.match.espn.EspnClient;
import com.dong.commandapi.match.espn.EspnScoreboardResponse;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class MatchDiscoveryService {

    private static final Logger log = LoggerFactory.getLogger(MatchDiscoveryService.class);

    /** Upper bound on concurrent upstream league fetches per service instance. */
    private static final int MAX_PARALLEL_LEAGUE_FETCHES = 16;

    private final MatchDiscoveryProperties properties;
    private final MatchNormalizer matchNormalizer;
    private final EspnClient espnClient;
    private final MatchCacheService matchCacheService;
    private final Clock clock;
    private final ExecutorService leagueFetchExecutor;

    @Autowired
    public MatchDiscoveryService(
            MatchDiscoveryProperties properties,
            MatchNormalizer matchNormalizer,
            EspnClient espnClient,
            MatchCacheService matchCacheService
    ) {
        this(properties, matchNormalizer, espnClient, matchCacheService, Clock.systemUTC());
    }

    MatchDiscoveryService(
            MatchDiscoveryProperties properties,
            MatchNormalizer matchNormalizer,
            EspnClient espnClient,
            Clock clock
    ) {
        this(properties, matchNormalizer, espnClient, new MatchCacheService(properties), clock);
    }

    MatchDiscoveryService(
            MatchDiscoveryProperties properties,
            MatchNormalizer matchNormalizer,
            EspnClient espnClient,
            MatchCacheService matchCacheService,
            Clock clock
    ) {
        this.properties = properties;
        this.matchNormalizer = matchNormalizer;
        this.espnClient = espnClient;
        this.matchCacheService = matchCacheService;
        this.clock = clock;
        this.leagueFetchExecutor = Executors.newFixedThreadPool(
                MAX_PARALLEL_LEAGUE_FETCHES, daemonThreadFactory());
    }

    public List<NormalizedMatch> discover(String requestedAt, List<String> leagueCodes) {
        MatchQuery query = MatchQuery.from(parseRequestedAt(requestedAt), leagueCodes, properties, clock);
        return discover(query);
    }

    /**
     * Fans out one upstream fetch per league in parallel, each cached
     * independently. A league whose upstream call fails (unavailable or
     * malformed) is dropped from the response rather than failing the whole
     * request — so one dead league never blanks the others. Only when
     * <em>every</em> requested league fails is a controlled error surfaced.
     */
    public List<NormalizedMatch> discover(MatchQuery query) {
        LocalDate resolvedDate = query.resolvedDate();
        List<String> leagueCodes = query.leagueCodes();

        List<CompletableFuture<LeagueResult>> futures = leagueCodes.stream()
                .map(leagueCode -> CompletableFuture.supplyAsync(
                        () -> loadLeague(resolvedDate, leagueCode), leagueFetchExecutor))
                .toList();

        List<NormalizedMatch> matches = new ArrayList<>();
        List<ApiException> failures = new ArrayList<>();
        for (CompletableFuture<LeagueResult> future : futures) {
            LeagueResult result = join(future);
            if (result.error() != null) {
                failures.add(result.error());
            } else {
                matches.addAll(result.matches());
            }
        }

        // All requested leagues failed → surface a representative controlled error.
        // (A league that legitimately returns zero matches is a success, not a failure.)
        if (failures.size() == leagueCodes.size()) {
            throw failures.get(0);
        }

        return List.copyOf(matches);
    }

    private LeagueResult loadLeague(LocalDate resolvedDate, String leagueCode) {
        try {
            List<NormalizedMatch> matches = matchCacheService.getOrLoad(
                    MatchQuery.cacheKey(resolvedDate, leagueCode),
                    () -> normalizeScoreboard(leagueCode, espnClient.fetchScoreboard(leagueCode, resolvedDate)));
            return LeagueResult.success(matches);
        } catch (ApiException ex) {
            log.warn("Dropping league {} from match discovery for {}: {} ({})",
                    leagueCode, resolvedDate, ex.errorCode(), ex.getMessage());
            return LeagueResult.failure(ex);
        }
    }

    private List<NormalizedMatch> normalizeScoreboard(String leagueCode, EspnScoreboardResponse scoreboardResponse) {
        List<NormalizedMatch> normalizedMatches = matchNormalizer.normalize(leagueCode, scoreboardResponse);

        if (!scoreboardResponse.events().isEmpty() && normalizedMatches.size() != scoreboardResponse.events().size()) {
            throw new ApiException(ErrorCode.UPSTREAM_BAD_RESPONSE);
        }

        return normalizedMatches;
    }

    private static LeagueResult join(CompletableFuture<LeagueResult> future) {
        try {
            return future.join();
        } catch (CompletionException ex) {
            // loadLeague catches controlled ApiExceptions itself, so reaching here
            // means an unexpected failure — unwrap and let it propagate (→ 500).
            Throwable cause = ex.getCause();
            if (cause instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            if (cause instanceof Error error) {
                throw error;
            }
            throw ex;
        }
    }

    private OffsetDateTime parseRequestedAt(String requestedAt) {
        if (requestedAt == null || requestedAt.isBlank()) {
            return null;
        }

        try {
            return OffsetDateTime.parse(requestedAt.trim());
        } catch (DateTimeParseException ex) {
            throw new ApiException(ErrorCode.INVALID_MATCH_DATE, ErrorCode.INVALID_MATCH_DATE.defaultMessage());
        }
    }

    @PreDestroy
    void shutdown() {
        leagueFetchExecutor.shutdownNow();
    }

    private static ThreadFactory daemonThreadFactory() {
        AtomicInteger counter = new AtomicInteger();
        return runnable -> {
            Thread thread = new Thread(runnable, "match-league-fetch-" + counter.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        };
    }

    private record LeagueResult(List<NormalizedMatch> matches, ApiException error) {

        static LeagueResult success(List<NormalizedMatch> matches) {
            return new LeagueResult(matches, null);
        }

        static LeagueResult failure(ApiException error) {
            return new LeagueResult(List.of(), error);
        }
    }
}
