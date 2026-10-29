package com.dong.gameapi.roomaction;

import com.dong.gameapi.roomaction.dto.RoomActionRequest;
import com.dong.gameapi.roomaction.dto.RoomActionResponse;
import com.dong.gameapi.security.AuthenticatedHost;
import com.dong.gameapi.supabase.SupabaseRpcClient;
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
 * Accepts authenticated room actions at {@code /v1/rooms/{roomId}/actions/{actionType}}.
 * Builds the handler context and maps the dispatch result to an acknowledgement.
 * Pending room processing is returned separately so callers can retry the same key.
 */
@RestController
@RequestMapping("/v1/rooms")
@SecurityRequirement(name = "bearerAuth")
public class RoomActionController {

    private final RoomActionDispatcher dispatcher;

    public RoomActionController(RoomActionDispatcher dispatcher) {
        this.dispatcher = dispatcher;
    }

    @PostMapping("/{roomId}/actions/{actionType}")
    @Operation(
            summary = "Submit a room action",
            description = "Validates the Supabase JWT and Idempotency-Key, dispatches to the "
                    + "registered handler, and returns the standard acknowledgement envelope."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Room action accepted"),
            @ApiResponse(responseCode = "401", description = "Missing/invalid credentials"),
            @ApiResponse(responseCode = "422", description = "Missing/invalid Idempotency-Key or unknown action")
    })
    public ResponseEntity<?> submitAction(
            @Parameter(description = "Target room id") @PathVariable String roomId,
            @Parameter(description = "Action type (e.g. 'start-game')") @PathVariable String actionType,
            @Parameter(description = "UUID v4 idempotency key")
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody(required = false) RoomActionRequest request,
            @AuthenticationPrincipal AuthenticatedHost host) {

        RoomActionContext context = new RoomActionContext(
                roomId,
                actionType,
                idempotencyKey,
                host,
                request == null ? null : request.payload());

        RoomActionDispatcher.DispatchResult outcome = dispatcher.dispatchAction(context);

        if (SupabaseRpcClient.isRoomProcessingPending(outcome.result().detail())) {
            return ResponseEntity.ok(SupabaseRpcClient.createRoomProcessingPendingResponse());
        }

        RoomActionResponse body = new RoomActionResponse(
                actionType,
                roomId,
                outcome.idempotencyKey().toString(),
                outcome.result().status().name(),
                Instant.now());

        return ResponseEntity.ok(body);
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(SupabaseRpcClient.RoomProcessingPendingException.class)
    public ResponseEntity<?> handlePendingRoomProcessing() {
        return ResponseEntity.ok(SupabaseRpcClient.createRoomProcessingPendingResponse());
    }
}
