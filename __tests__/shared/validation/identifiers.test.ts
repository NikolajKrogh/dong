import { isPositivePostgresBigint, isUnsignedDecimal } from '../../../shared/validation/identifiers';

describe('decimal identifiers', () => {
  it('preserves exact bigint bounds and rejects alternate numeric spellings', () => {
    expect(isPositivePostgresBigint('9223372036854775807')).toBe(true);
    expect(isPositivePostgresBigint('9223372036854775808')).toBe(false);
    for (const value of ['0', '01', '+1', '-1', '1.0', '1e3', ' 1', '１', 1]) {
      expect(isPositivePostgresBigint(value)).toBe(false);
    }
  });

  it('allows zero and leading zeroes only for unsigned decimal text', () => {
    expect(isUnsignedDecimal('0')).toBe(true);
    expect(isUnsignedDecimal('001')).toBe(true);
    expect(isUnsignedDecimal('')).toBe(false);
    expect(isUnsignedDecimal('+1')).toBe(false);
    expect(isUnsignedDecimal(1)).toBe(false);
  });
});
