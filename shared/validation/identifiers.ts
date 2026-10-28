const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;
const MAX_POSTGRES_BIGINT_DIGITS = 19;

export function isUnsignedDecimal(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
    && [...value].every(character => character >= '0' && character <= '9');
}

/** Canonical positive decimal text that fits a PostgreSQL bigint. */
export function isPositivePostgresBigint(value: unknown): value is string {
  return isUnsignedDecimal(value) && value.length <= MAX_POSTGRES_BIGINT_DIGITS
    && value[0] !== '0' && BigInt(value) <= MAX_POSTGRES_BIGINT;
}
