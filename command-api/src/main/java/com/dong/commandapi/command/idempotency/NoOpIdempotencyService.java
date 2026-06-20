package com.dong.commandapi.command.idempotency;

import com.dong.commandapi.error.ApiException;
import com.dong.commandapi.error.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.UUID;

/**
 * Bootstrap implementation: validates the {@code Idempotency-Key} is a
 * well-formed UUID v4 and nothing more.
 *
 * <p><strong>This performs NO deduplication.</strong> Two requests carrying the
 * same key are both executed — replaying a command re-runs it. That is only safe
 * while every {@link com.dong.commandapi.command.CommandHandler} is side-effect
 * free (currently just {@code echo}). The first state-mutating command MUST
 * replace this with a persistent dedup store in the same change; issue #133
 * tracks that work, and {@code IdempotencyStubGuardTest} fails if a second
 * handler is wired before then.
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
