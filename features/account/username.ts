/** Mirrors server space trimming and NFC; Postgres owns category validation and uniqueness. */
export const normalizeAccountUsername = (value: string | null | undefined): string | null => {
  const normalized = (value ?? '').replace(/^[\u0020\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]+|[\u0020\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]+$/gu, '').normalize('NFC');
  return normalized || null;
};
