import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import type { Json } from '../../types/database.types';

type Relationship = 'none' | 'incoming' | 'outgoing' | 'friends' | 'blocked' | 'unavailable';
export interface Person {
  account_id: string;
  username: string;
  relationship: Relationship;
  request_id: string | null;
  block_id?: string | null;
  created_at?: string;
}
export interface SocialPage { items: Person[]; next_cursor: string | null }
export type ListKind = 'friends' | 'incoming' | 'outgoing' | 'blocks';
export type FriendAction = 'send' | 'accept' | 'decline' | 'cancel' | 'unfriend' | 'block' | 'unblock';
type Client = SupabaseClient<Database>;

const messages: Record<string, string> = {
  authentication_required: 'Sign in to manage friends.', username_required: 'Choose your username first.',
  target_unavailable: 'This account is unavailable.', target_changed: 'Their username changed. Refresh and confirm the new username.',
  request_conflict: 'This request changed. Refresh to see its current state.', request_not_allowed: 'This action is no longer available.',
  idempotency_conflict: 'This operation changed. Refresh and try again.', invalid_input: 'This action is invalid.',
};
export class SocialError extends Error {
  constructor(public code: string) {
    super(messages[code] ?? (/fetch|network|timeout/i.test(code)
      ? 'Unable to reach the server. Retry to check the result.'
      : 'The server could not complete this action. Please try again.'));
  }
}
const object = (value: Json): Record<string, Json | undefined> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid social response.');
  return value;
};
const parsePerson = (value: Json): Person => {
  const row = object(value);
  if (typeof row.account_id !== 'string' || typeof row.username !== 'string' ||
    !['none', 'incoming', 'outgoing', 'friends', 'blocked', 'unavailable'].includes(String(row.relationship)) ||
    (row.request_id !== null && typeof row.request_id !== 'string') ||
    (row.block_id !== undefined && row.block_id !== null && typeof row.block_id !== 'string')) throw new Error('Invalid social response.');
  return { account_id: row.account_id, username: row.username, relationship: row.relationship as Relationship,
    request_id: row.request_id, block_id: row.block_id as string | null | undefined,
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined };
};
export const parseSocialPage = (value: Json): SocialPage => {
  const page = object(value);
  if (!Array.isArray(page.items) || (page.next_cursor !== null && typeof page.next_cursor !== 'string')) throw new Error('Invalid social response.');
  return { items: page.items.map(parsePerson), next_cursor: page.next_cursor };
};
export async function searchFriends(client: Client, prefix: string, signal: AbortSignal): Promise<Person[]> {
  const { data, error } = await client.rpc('search_accounts_by_username_prefix', { prefix }).abortSignal(signal);
  if (error) throw new SocialError(error.message);
  if (!data) throw new Error('Missing social response.');
  return data.map(parsePerson);
}
export async function listFriends(client: Client, kind: ListKind, cursor: string | null, signal: AbortSignal): Promise<SocialPage> {
  const request = kind === 'blocks'
    ? client.rpc('list_account_blocks', { ...(cursor ? { cursor } : {}), page_size: 50 })
    : client.rpc('list_social_relationships', { kind, ...(cursor ? { cursor } : {}), page_size: 50 });
  const { data, error } = await request.abortSignal(signal);
  if (error) throw new SocialError(error.message);
  if (!data) throw new Error('Missing social response.');
  return parseSocialPage(data);
}
export async function actOnFriend(client: Client, action: FriendAction, person: Person, operationId: string) {
  const target = { target_account_id: person.account_id, operation_id: operationId };
  let request;
  if (action === 'send') request = client.rpc('send_friend_request', { ...target, expected_username: person.username });
  else if (action === 'block') request = client.rpc('block_account', target);
  else if (action === 'unblock') {
    if (!person.block_id) throw new SocialError('invalid_input');
    request = client.rpc('unblock_account', { ...target, block_id: person.block_id });
  } else {
    if (!person.request_id) throw new SocialError('invalid_input');
    request = action === 'accept' || action === 'decline'
      ? client.rpc('respond_friend_request', { ...target, request_id: person.request_id, decision: action })
      : client.rpc('cancel_friendship', { ...target, request_id: person.request_id, expected_status: action === 'unfriend' ? 'accepted' : 'pending' });
  }
  const { data, error } = await request;
  if (error) throw new SocialError(error.message);
  if (!data) throw new Error('Missing social response.');
  const result = object(data);
  if (result.operation_id !== operationId || typeof result.replayed !== 'boolean' || typeof result.disposition !== 'string' || typeof result.current_relationship !== 'string') throw new Error('Invalid social response.');
  return { ...result, person: parsePerson({ ...person, relationship: result.current_relationship,
    request_id: result.request_id ?? null, block_id: result.own_block_id ?? null }) };
}

export const actionsForPerson = (person: Person): FriendAction[] => {
  switch (person.relationship) {
    case 'none': return ['send', 'block'];
    case 'incoming': return ['accept', 'decline', 'block'];
    case 'outgoing': return ['cancel', 'block'];
    case 'friends': return ['unfriend', 'block'];
    case 'blocked': return ['unblock'];
    default: return [];
  }
};
