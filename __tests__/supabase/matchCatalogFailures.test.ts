import { createEspnHttpClient } from '../../supabase/functions/_shared/football-matches/espnHttpClient';

const resource = { kind: 'scoreboard' as const, leagueCode: 'eng.1', date: '2026-10-26' };

describe('provider failure details beyond the baseline HTTP contract', () => {
  it('keeps provider event ID length and alphabet policy at the HTTP adapter', async () => {
    const fetcher = jest.fn().mockImplementation(async () => new Response('{}'));
    const client = createEspnHttpClient({ fetch: fetcher });
    await client.read({ kind: 'summary', leagueCode: 'eng.1', sourceEventId: 'a'.repeat(128) });
    for (const sourceEventId of ['', 'a'.repeat(129), 'évent']) {
      await expect(client.read({ kind: 'summary', leagueCode: 'eng.1', sourceEventId }))
        .rejects.toThrow('invalid_provider_resource');
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(['fetch', 'body'])('reports a failed %s as unavailable without retrying', async failureStage => {
    const fetcher = jest.fn();
    if (failureStage === 'fetch') {
      fetcher.mockRejectedValue(new Error('network unavailable'));
    } else {
      const body = new ReadableStream<Uint8Array>({
        pull(controller) { controller.error(new Error('stream interrupted')); },
      });
      fetcher.mockResolvedValue(new Response(body));
    }
    expect(await createEspnHttpClient({ fetch: fetcher }).read(resource)).toEqual({
      ok: false, code: 'provider_unavailable', status: null, scope: 'group', retryAfterSeconds: null,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, 'provider_access_rejected'],
    [404, 'match_not_found'],
    [500, 'provider_unavailable'],
  ] as const)('keeps HTTP %i failure classification', async (status, code) => {
    const fetcher = jest.fn().mockResolvedValue(new Response('private upstream body', { status }));
    expect(await createEspnHttpClient({ fetch: fetcher }).read(resource)).toEqual({
      ok: false, code, status, scope: 'group', retryAfterSeconds: null,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('builds summary URLs and rejects invalid resource identifiers before transport', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response('{}'));
    const client = createEspnHttpClient({ fetch: fetcher });
    await client.read({ kind: 'summary', leagueCode: 'eng.1', sourceEventId: 'event-100' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=event-100', expect.any(Object),
    );
    await expect(client.read({ ...resource, date: '2026-02-30' })).rejects.toThrow('invalid_provider_resource');
    await expect(client.read({ kind: 'summary', leagueCode: 'eng.1', sourceEventId: '../event' })).rejects.toThrow('invalid_provider_resource');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('honors HTTP-date Retry-After without reflecting provider bodies or issuing a probe', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-26T12:00:00Z'));
    try {
      const fetcher = jest.fn().mockResolvedValue(new Response('upstream-private-text', { status: 429, headers: { 'retry-after': 'Mon, 26 Oct 2026 12:30:00 GMT' } }));
      const result = await createEspnHttpClient({ fetch: fetcher }).read(resource);
      expect(result).toEqual({ ok: false, code: 'provider_throttled', status: 429, scope: 'provider', retryAfterSeconds: 1800 });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain('upstream-private-text');
    } finally { now.mockRestore(); }
  });

  it('rejects a declared oversize response before reading its body', async () => {
    const response = new Response(new ReadableStream<Uint8Array>(), { headers: { 'content-length': String(2 * 1024 * 1024 + 1) } });
    const cancel = jest.spyOn(response.body!, 'cancel').mockResolvedValue(undefined);
    const getReader = jest.spyOn(response.body!, 'getReader');
    const fetcher = jest.fn().mockResolvedValue(response);
    expect(await createEspnHttpClient({ fetch: fetcher }).read(resource)).toMatchObject({ ok: false, code: 'provider_response_too_large' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(getReader).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed UTF-8 instead of accepting a repaired JSON string', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125])));
    expect(await createEspnHttpClient({ fetch: fetcher }).read(resource)).toEqual({ ok: false, code: 'invalid_provider_response', status: 200, scope: 'group', retryAfterSeconds: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('discards a response that arrives after the total timeout even when fetch ignores abort', async () => {
    jest.useFakeTimers();
    try {
      let respond: (response: Response) => void = () => { throw new Error('fetch not started'); };
      const fetcher = jest.fn().mockImplementation(() => new Promise<Response>(resolve => { respond = resolve; }));
      const pending = createEspnHttpClient({ fetch: fetcher }).read(resource);
      await jest.advanceTimersByTimeAsync(10_001);
      expect(await pending).toMatchObject({ ok: false, code: 'provider_timeout' });
      const response = new Response(new ReadableStream<Uint8Array>());
      const cancel = jest.spyOn(response.body!, 'cancel').mockResolvedValue(undefined);
      const getReader = jest.spyOn(response.body!, 'getReader');
      respond(response);
      await jest.advanceTimersByTimeAsync(1);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(getReader).not.toHaveBeenCalled();
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { jest.useRealTimers(); }
  });
});
