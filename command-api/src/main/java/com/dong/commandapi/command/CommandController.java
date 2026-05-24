package com.dong.commandapi.command;

import com.dong.commandapi.command.dto.CommandRequest;
import com.dong.commandapi.command.dto.CommandResponse;
import com.dong.commandapi.security.AuthenticatedHost;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * Thin command surface (ADR-1): parse → build {@link CommandContext} →
 * {@link CommandDispatcher} → map {@code CommandResult} to the wire
 * {@link CommandResponse}. No business logic, no per-type branching.
 */
@RestController
@RequestMapping("/v1/rooms")
@SecurityRequirement(name = "bearerAuth")
public class CommandController {

    private final CommandDispatcher dispatcher;

    public CommandController(CommandDispatcher dispatcher) {
        this.dispatcher = dispatcher;
    }

    @PostMapping("/{roomId}/commands/{commandType}")
    @Operation(
            summary = "Submit a command to a room",
            description = "Validates the Supabase JWT and Idempotency-Key, dispatches to the "
                    + "registered handler, and returns the standard acknowledgement envelope."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Command accepted"),
            @ApiResponse(responseCode = "401", description = "Missing/invalid credentials"),
            @ApiResponse(responseCode = "422", description = "Missing/invalid Idempotency-Key or unknown command")
    })
    public ResponseEntity<CommandResponse> submit(
            @Parameter(description = "Target room id") @PathVariable String roomId,
            @Parameter(description = "Command type (e.g. 'echo')") @PathVariable String commandType,
            @Parameter(description = "UUID v4 idempotency key")
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody(required = false) CommandRequest request,
            @AuthenticationPrincipal AuthenticatedHost host) {

        CommandContext context = new CommandContext(
                roomId,
                commandType,
                idempotencyKey,
                host,
                request == null ? null : request.payload());

        CommandDispatcher.DispatchResult outcome = dispatcher.dispatch(context);

        CommandResponse body = new CommandResponse(
                commandType,
                roomId,
                outcome.idempotencyKey().toString(),
                outcome.result().status().name(),
                Instant.now());

        return ResponseEntity.ok(body);
    }
}
