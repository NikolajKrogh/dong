package com.dong.commandapi.match;

import com.dong.commandapi.match.dto.NormalizedMatch;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/v1/matches")
public class MatchDiscoveryController {

    private final MatchDiscoveryService matchDiscoveryService;

    public MatchDiscoveryController(MatchDiscoveryService matchDiscoveryService) {
        this.matchDiscoveryService = matchDiscoveryService;
    }

    @GetMapping
    @Operation(
            summary = "Discover normalized matches for supported leagues",
            description = "Public read-only proxy endpoint for a flat normalized match array. "
                + "When requestedAt is omitted, the service defaults to today's date."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Normalized match list returned"),
            @ApiResponse(responseCode = "400", description = "Invalid requestedAt or unsupported leagueCode"),
            @ApiResponse(responseCode = "503", description = "Match discovery is not fully implemented yet")
    })
    public List<NormalizedMatch> discover(
            @Parameter(description = "Repeat leagueCode to request one or more supported leagues")
            @RequestParam(name = "leagueCode", required = false) List<String> leagueCodes,
            @Parameter(description = "Optional ISO 8601 datetime with timezone used to resolve the match date")
            @RequestParam(name = "requestedAt", required = false) String requestedAt
    ) {
        return matchDiscoveryService.discover(requestedAt, leagueCodes);
    }
}