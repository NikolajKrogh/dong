import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: false },
    mutations: { retry: false, networkMode: 'always' },
  },
});

let identity = { accountId: null as string | null, generation: 0 };
export const getAccountScope = () => identity;
export const isCurrentAccountScope = (scope: ReturnType<typeof getAccountScope>) =>
  scope.accountId === identity.accountId && scope.generation === identity.generation;

/** Synchronous fencing precedes cancellation: canceled transports may still complete. */
export const setAccountScope = (accountId: string | null) => {
  if (accountId === identity.accountId) return identity;
  const previousId = identity.accountId;
  identity = { accountId, generation: identity.generation + 1 };
  if (previousId) {
    const filters = { queryKey: ['account', previousId] };
    void queryClient.cancelQueries(filters);
    queryClient.removeQueries(filters);
  }
  queryClient.getMutationCache().clear();
  return identity;
};
