import { FOOTBALL_MATCH_ERROR_CODES } from '../types/footballMatch';
import type { FootballMatchErrorCode } from '../types/footballMatch';

export class FootballMatchError extends Error {
  constructor(
    readonly code: FootballMatchErrorCode,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
    this.name = 'FootballMatchError';
  }
}

export function parseRetryAfterSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }
  return value;
}

/** Expose only known football match error codes, never raw upstream messages. */
export function toFootballMatchError(error: unknown): FootballMatchError {
  if (error instanceof FootballMatchError) return error;

  if (error !== null && typeof error === 'object') {
    const fields = error as { code?: unknown; message?: unknown; retryAfterSeconds?: unknown };
    for (const candidate of [fields.code, fields.message]) {
      const code = FOOTBALL_MATCH_ERROR_CODES.find(knownCode => knownCode === candidate);
      if (code) {
        return new FootballMatchError(code, parseRetryAfterSeconds(fields.retryAfterSeconds));
      }
    }
  }

  return new FootballMatchError('transport_unavailable');
}
