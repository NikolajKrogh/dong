import { decodeCanonicalBase64Url, encodeBase64Url, isBase64UrlText } from '../../../shared/encoding/base64url';

describe('canonical base64url encoding', () => {
  it.each([0, 1, 2, 3, 31, 32, 33])('round-trips %i bytes without a tracking-token length policy', length => {
    const bytes = Uint8Array.from({ length }, (_, index) => index);
    expect(decodeCanonicalBase64Url(encodeBase64Url(bytes))).toEqual(bytes);
  });

  it('rejects padding, invalid characters, invalid lengths and noncanonical padding bits', () => {
    const token = encodeBase64Url(new Uint8Array(32));
    expect(decodeCanonicalBase64Url(token.slice(0, -1) + 'B')).toBeNull();
    expect(decodeCanonicalBase64Url(token + '=')).toBeNull();
    expect(decodeCanonicalBase64Url('A')).toBeNull();
    expect(decodeCanonicalBase64Url('!'.repeat(43))).toBeNull();
    expect(decodeCanonicalBase64Url(null)).toBeNull();
  });

  it('keeps alphabet checks separate from decodable canonical bytes', () => {
    expect(isBase64UrlText('EVENT_100-a')).toBe(true);
    expect(isBase64UrlText('')).toBe(true);
    expect(isBase64UrlText('../event')).toBe(false);
    expect(isBase64UrlText('évent')).toBe(false);
  });
});
