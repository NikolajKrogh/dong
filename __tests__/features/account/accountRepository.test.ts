import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';
import { normalizeAccountUsername, saveAccountUsername } from '../../../features/account';

describe('username persistence', () => {
  const row = { id: 'account-a', username: 'Émile', created_at: null, updated_at: null };
  const clientFor = (data: typeof row | null, error: { message: string } | null = null) => {
    const rpc = jest.fn(() => ({ single: async () => ({ data, error }) }));
    return { rpc, client: { rpc } as unknown as SupabaseClient<Database> };
  };
  it('trims only specified separators and normalizes NFC without deleting controls', () => {
    expect(normalizeAccountUsername('\u00a0E\u0301mile\u3000')).toBe('Émile');
    expect(normalizeAccountUsername('\tÉmile\n')).toBe('\tÉmile\n');
    expect(normalizeAccountUsername('\ufeffÉmile')).toBe('\ufeffÉmile');
  });
  it('uses the owner RPC and maps the confirmed server spelling', async () => {
    const { client, rpc } = clientFor(row);
    await expect(saveAccountUsername(client, row.id, ' E\u0301mile ')).resolves.toEqual({ id: row.id, username: row.username, createdAt: null, updatedAt: null });
    expect(rpc).toHaveBeenCalledWith('set_account_username', { requested_username: 'Émile' });
  });
  it.each([
    ['username_unavailable', 'That username is already taken. Choose another.'],
    ['invalid_username', 'Use 3–30 letters, numbers, or underscores.'],
  ])('reports %s without accepting a new account', async (code, message) => {
    const { client } = clientFor(null, { message: code });
    await expect(saveAccountUsername(client, row.id, 'Émile')).rejects.toThrow(message);
  });
  it('rejects a changed authenticated identity', async () => {
    const { client } = clientFor(row);
    await expect(saveAccountUsername(client, 'account-b', 'Émile')).rejects.toThrow('Account changed');
  });
  it('accepts a confirmed case-only rename on the same account', async () => {
    const { client } = clientFor({ ...row, username: 'ÉMILE' });
    const confirmed = await saveAccountUsername(client, row.id, 'ÉMILE');
    expect(confirmed.id).toBe(row.id);
    expect(confirmed.username).toBe('ÉMILE');
  });
});
