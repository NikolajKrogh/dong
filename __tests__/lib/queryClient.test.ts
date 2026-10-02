import { getAccountScope, isCurrentAccountScope, queryClient, setAccountScope } from '../../lib/queryClient';

describe('private account scope', () => {
  afterEach(() => queryClient.clear());
  beforeEach(() => { setAccountScope(null); queryClient.clear(); });
  it('removes old private queries and fences delayed work on A to B', () => {
    const a = setAccountScope('A');
    queryClient.setQueryData(['account', 'A', 'friends'], ['private']);
    queryClient.setQueryData(['public'], ['shared']);
    setAccountScope('B');
    expect(isCurrentAccountScope(a)).toBe(false);
    expect(queryClient.getQueryData(['account', 'A', 'friends'])).toBeUndefined();
    expect(queryClient.getQueryData(['public'])).toEqual(['shared']);
  });
  it('fences A logout A while retaining scope for same-account token refresh', () => {
    const a = setAccountScope('A');
    expect(setAccountScope('A')).toBe(a);
    setAccountScope(null);
    setAccountScope('A');
    expect(isCurrentAccountScope(a)).toBe(false);
    expect(getAccountScope().accountId).toBe('A');
  });
  it('cancels an active query and never installs its late data', async () => {
    setAccountScope('A');
    let finish!: (value: string) => void;
    const result = queryClient.fetchQuery({ queryKey: ['account', 'A', 'history'], queryFn: () => new Promise<string>(resolve => { finish = resolve; }) }).catch(() => undefined);
    setAccountScope('B');
    finish('private');
    await result;
    expect(queryClient.getQueryData(['account', 'A', 'history'])).toBeUndefined();
  });
});
