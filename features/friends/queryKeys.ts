import type { ListKind } from './friendsRepository';
export const friendKeys = {
  all: (accountId: string) => ['account', accountId, 'friends'] as const,
  list: (accountId: string, kind: ListKind) => [...friendKeys.all(accountId), 'list', kind] as const,
  search: (accountId: string, prefix: string) => [...friendKeys.all(accountId), 'search', prefix] as const,
};
