import { createPostgresFootballMatchRepository } from './postgresFootballMatchRepository.ts';

Deno.test('plaintext Docker connections require the fixture flag and exact local alias', () => {
  const previous = Deno.env.get('MATCH_CATALOG_FIXTURES_ONLY');
  const accepts = (url: string) => {
    try { createPostgresFootballMatchRepository(url); return true; }
    catch (error) {
      if (!(error instanceof Error) || error.message !== 'configuration_required') throw error;
      return false;
    }
  };
  try {
    Deno.env.delete('MATCH_CATALOG_FIXTURES_ONLY');
    if (accepts('postgres://fixture:fixture@db.supabase.internal:5432/postgres?sslmode=disable')) throw new Error('production connection accepted plaintext');
    Deno.env.set('MATCH_CATALOG_FIXTURES_ONLY', 'true');
    if (!accepts('postgres://fixture:fixture@db.supabase.internal:5432/postgres?sslmode=disable')) throw new Error('local fixture connection rejected');
    if (accepts('postgres://fixture:fixture@example.com:5432/postgres?sslmode=disable')) throw new Error('remote fixture connection accepted plaintext');
    if (accepts('postgres://fixture:fixture@db.supabase.internal:6543/postgres?sslmode=disable')) throw new Error('unexpected fixture port accepted plaintext');
  } finally {
    if (previous === undefined) Deno.env.delete('MATCH_CATALOG_FIXTURES_ONLY');
    else Deno.env.set('MATCH_CATALOG_FIXTURES_ONLY', previous);
  }
});
