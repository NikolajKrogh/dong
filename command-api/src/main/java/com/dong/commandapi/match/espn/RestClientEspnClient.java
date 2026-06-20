package com.dong.commandapi.match.espn;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Component
public class RestClientEspnClient implements EspnClient {

    private static final Logger log = LoggerFactory.getLogger(RestClientEspnClient.class);

    private final RestClient restClient;

    public RestClientEspnClient(@Qualifier("espnRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public EspnScoreboardResponse fetchScoreboard(String leagueCode, LocalDate matchDate) {
        try {
            EspnScoreboardResponse response = restClient.get()
                    .uri("/{leagueCode}/scoreboard?dates={dates}", leagueCode, matchDate.format(DateTimeFormatter.BASIC_ISO_DATE))
                    .retrieve()
                    .body(EspnScoreboardResponse.class);

            if (response == null) {
                throw new ApiException(ErrorCode.UPSTREAM_BAD_RESPONSE);
            }

            return response;
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 429 || ex.getStatusCode().is5xxServerError()) {
                log.warn("ESPN scoreboard request failed for league {} on {} with status {}", leagueCode, matchDate,
                        ex.getStatusCode().value());
                throw new ApiException(ErrorCode.UPSTREAM_UNAVAILABLE);
            }

            log.warn("ESPN scoreboard returned unexpected status {} for league {} on {}", ex.getStatusCode().value(),
                    leagueCode, matchDate);
            throw new ApiException(ErrorCode.UPSTREAM_BAD_RESPONSE);
        } catch (RestClientException ex) {
            log.warn("ESPN scoreboard request failed for league {} on {}: {}", leagueCode, matchDate,
                    ex.getMessage());
            throw new ApiException(ErrorCode.UPSTREAM_UNAVAILABLE);
        }
    }
}