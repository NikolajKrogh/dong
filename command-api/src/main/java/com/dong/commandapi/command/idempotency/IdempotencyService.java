package com.dong.commandapi.command.idempotency;

import java.util.UUID;

/**
 * Idempotency seam (ADR-7). Today: format validation only. #133 supplies a
 * persistent implementation (replay detection) — a Decorator on the dispatch
 * path — with zero controller/dispatcher churn.
 */
public interface IdempotencyService {

    /**
     * @param rawHeader the raw {@code Idempotency-Key} header value (may be null/blank)
     * @return the parsed key
     * @throws com.dong.commandapi.error.ApiException MISSING_IDEMPOTENCY_KEY or INVALID_UUID
     */
    UUID validate(String rawHeader);
}
