import { base64urlnopad } from 'npm:@scure/base@2.4.0';

const BASE64_URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

export function isBase64UrlText(value: unknown): value is string {
  return typeof value === 'string'
    && [...value].every(character => BASE64_URL_ALPHABET.includes(character));
}

export function encodeBase64Url(bytes: Uint8Array): string {
  return base64urlnopad.encode(bytes);
}

/** Decode canonical, unpadded base64url without imposing a domain-specific byte length. */
export function decodeCanonicalBase64Url(value: unknown): Uint8Array<ArrayBuffer> | null {
  if (typeof value !== 'string') return null;
  try {
    return new Uint8Array(base64urlnopad.decode(value));
  } catch {
    return null;
  }
}

