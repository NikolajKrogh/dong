package com.dong.commandapi.command.idempotency;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.UUID;

/**
 * Bootstrap implementation: validates the {@code Idempotency-Key} is a
 * well-formed UUID v4. No deduplication storage (out of scope per spec
 * Assumptions); #133 replaces this with a persistent implementation.
 */
@Service
public class NoOpIdempotencyService implements IdempotencyService {

    @Override
    public UUID validate(String rawHeader) {
        if (!StringUtils.hasText(rawHeader)) {
            throw new ApiException(ErrorCode.MISSING_IDEMPOTENCY_KEY);
        }
        final UUID parsed;
        try {
            parsed = UUID.fromString(rawHeader.trim());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(ErrorCode.INVALID_UUID);
        }
        if (parsed.version() != 4) {
            throw new ApiException(ErrorCode.INVALID_UUID,
                    "Idempotency-Key must be a UUID version 4");
        }
        return parsed;
    }
}
