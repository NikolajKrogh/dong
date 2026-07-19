package com.dong.commandapi.command.idempotency;

import com.dong.commandapi.command.CommandResult;
import com.dong.commandapi.security.AuthenticatedHost;

import java.util.UUID;

/**
 * Idempotency seam (ADR-7). {@link PersistentIdempotencyService} is the sole
 * implementation, backed by the {@code public.command_idempotency} table
 * (research.md R7) — the bootstrap {@code NoOpIdempotencyService} (format
 * validation only, no dedup) was replaced in the same change that wired the first
 * state-mutating command ({@code start-game}, #133/018), per its own docstring and
 * {@code IdempotencyStubGuardTest}.
 */
public interface IdempotencyService {

    /**
     * @param rawHeader the raw {@code Idempotency-Key} header value (may be null/blank)
     * @return the parsed key
     * @throws com.dong.commandapi.error.ApiException MISSING_IDEMPOTENCY_KEY or INVALID_UUID
     */
    UUID validate(String rawHeader);

    /**
     * Reserves {@code idempotencyKey} for {@code commandType}/{@code roomId}, or
     * resolves it against a prior reservation.
     *
     * <p>Resolves fully before returning: a same-key/command/room reservation still
     * in flight is polled with a short bounded backoff until it either completes
     * (→ {@link IdempotencyDecision.Replay}) or is released by its owner failing
     * validation (→ {@link IdempotencyDecision.Proceed}, this caller now owns it).
     *
     * @throws com.dong.commandapi.error.ApiException {@code IDEMPOTENCY_KEY_REUSE} (409) if the
     *                                                 key was already used for a different command/room;
     *                                                 {@code SERVICE_UNAVAILABLE} (503) if an in-flight
     *                                                 reservation never resolves within the backoff budget
     */
    IdempotencyDecision reserve(UUID idempotencyKey, String commandType, String roomId, AuthenticatedHost host);

    /**
     * Persists a successful handler result so future replays of {@code idempotencyKey} short-circuit
     * to it. Best-effort: the handler's own mutation already succeeded and is durable, so a failure
     * to persist this bookkeeping record is logged and swallowed rather than turned into an error
     * response for a request that actually succeeded.
     */
    void complete(UUID idempotencyKey, CommandResult result, AuthenticatedHost host);

    /** Releases a reservation after the handler threw, so a same-key retry re-runs validation from scratch. */
    void release(UUID idempotencyKey, AuthenticatedHost host);
}
