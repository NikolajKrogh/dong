package com.dong.gameapi.roomaction.idempotency;

import com.dong.gameapi.roomaction.RoomActionResult;
import com.dong.gameapi.security.AuthenticatedHost;

import java.util.UUID;

/**
 * Coordinates replay keys for authenticated room actions.
 * Reservations distinguish a new attempt from an already completed action. The
 * Postgres-backed implementation scopes each key to its host, action type and room.
 */
public interface IdempotencyService {

    /**
     * Parses and validates a UUID v4 replay key.
     *
     * @param rawHeader the raw {@code Idempotency-Key} header value (may be null/blank)
     * @return the parsed key
     * @throws com.dong.gameapi.error.ApiException MISSING_IDEMPOTENCY_KEY or INVALID_UUID
     */
    UUID parseIdempotencyKey(String rawHeader);

    /**
     * Reserves {@code idempotencyKey} for {@code actionType}/{@code roomId}, or
     * resolves it against a prior reservation.
     *
     * <p>Resolves fully before returning: a same-key/action/room reservation still
     * in flight is polled with a short bounded backoff until it either completes
     * (→ {@link IdempotencyDecision.Replay}) or is released by its owner failing
     * validation (→ {@link IdempotencyDecision.Proceed}, this caller now owns it).
     *
     * @throws com.dong.gameapi.error.ApiException {@code IDEMPOTENCY_KEY_REUSE} (409) if the
     *                                                 key was already used for a different action/room;
     *                                                 {@code SERVICE_UNAVAILABLE} (503) if an in-flight
     *                                                 reservation never resolves within the backoff budget
     */
    IdempotencyDecision reserveAction(UUID idempotencyKey, String actionType, String roomId, AuthenticatedHost host);

    /**
     * Persists a successful handler result so future replays of {@code idempotencyKey} short-circuit
     * to it. Best-effort: the handler's own mutation already succeeded and is durable, so a failure
     * to persist this bookkeeping record is logged and swallowed rather than turned into an error
     * response for a request that actually succeeded.
     */
    void saveActionResult(UUID idempotencyKey, RoomActionResult result, AuthenticatedHost host);

    /** Releases a reservation after failure or pending processing, allowing the same action to be retried. */
    void releaseActionReservation(UUID idempotencyKey, AuthenticatedHost host);
}
