import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';
import { actOnFriend, actionsForPerson, listFriends, parseSocialPage, searchFriends, type Person } from '../../../features/friends/friendsRepository';

const person: Person = { account_id: 'B', username: 'Émile', relationship: 'none', request_id: 'request', block_id: 'block' };
function mockClient(data: unknown, error: { message: string } | null = null) {
  const abortSignal = jest.fn(async () => ({ data, error }));
  const rpc = jest.fn(() => Object.assign(Promise.resolve({ data, error }), { abortSignal }));
  return { rpc, abortSignal, client: { rpc } as unknown as SupabaseClient<Database> };
}
describe('friend repository', () => {
  it('distinguishes database failures from connection failures', async () => {
    const database = mockClient(null, { message: 'missing FROM-clause entry for table "social_command"' });
    await expect(actOnFriend(database.client, 'send', person, 'intent')).rejects.toThrow('The server could not complete this action.');
    const network = mockClient(null, { message: 'TypeError: Network request failed' });
    await expect(actOnFriend(network.client, 'send', person, 'intent')).rejects.toThrow('Unable to reach the server.');
  });
  it('passes raw Unicode search and cancellation to the server', async () => {
    const { client, rpc, abortSignal } = mockClient([person]);
    const signal = new AbortController().signal;
    await expect(searchFriends(client, ' E\u0301m ', signal)).resolves.toEqual([person]);
    expect(rpc).toHaveBeenCalledWith('search_accounts_by_username_prefix', { prefix: ' E\u0301m ' });
    expect(abortSignal).toHaveBeenCalledWith(signal);
  });
  it('propagates each list cursor and abort signal', async () => {
    const { client, rpc, abortSignal } = mockClient({ items: [], next_cursor: null });
    const signal = new AbortController().signal;
    await listFriends(client, 'incoming', 'cursor', signal);
    expect(rpc).toHaveBeenCalledWith('list_social_relationships', { kind: 'incoming', cursor: 'cursor', page_size: 50 });
    expect(abortSignal).toHaveBeenCalledWith(signal);
  });
  it.each(['authentication_required','username_required','target_unavailable','target_changed','request_conflict','request_not_allowed','idempotency_conflict','invalid_input'])('throws %s instead of an empty result', async message => {
    const { client } = mockClient(null, { message });
    await expect(searchFriends(client, 'Émi', new AbortController().signal)).rejects.toMatchObject({ code: message });
  });
  it('rejects malformed page payloads', () => {
    expect(() => parseSocialPage({ items: [{ ...person, request_id: 3 }], next_cursor: null })).toThrow('Invalid social response');
  });
  it.each([
    ['send','send_friend_request',{ expected_username: 'Émile' }],
    ['accept','respond_friend_request',{ request_id: 'request', decision: 'accept' }],
    ['decline','respond_friend_request',{ request_id: 'request', decision: 'decline' }],
    ['cancel','cancel_friendship',{ request_id: 'request', expected_status: 'pending' }],
    ['unfriend','cancel_friendship',{ request_id: 'request', expected_status: 'accepted' }],
    ['block','block_account',{}],
    ['unblock','unblock_account',{ block_id: 'block' }],
  ] as const)('routes %s through its generation-guarded command', async (action, rpcName, args) => {
    const { client, rpc } = mockClient({ operation_id: 'intent', replayed: false, disposition: 'done', current_relationship: 'none' });
    await actOnFriend(client, action, person, 'intent');
    expect(rpc).toHaveBeenCalledWith(rpcName, { target_account_id: 'B', operation_id: 'intent', ...args });
  });
  it('offers only participant-appropriate actions', () => {
    expect(actionsForPerson({ ...person, relationship: 'incoming' })).toEqual(['accept','decline','block']);
    expect(actionsForPerson({ ...person, relationship: 'outgoing' })).toEqual(['cancel','block']);
    expect(actionsForPerson({ ...person, relationship: 'friends' })).toEqual(['unfriend','block']);
    expect(actionsForPerson({ ...person, relationship: 'blocked' })).toEqual(['unblock']);
    expect(actionsForPerson({ ...person, relationship: 'unavailable' })).toEqual([]);
  });
});
