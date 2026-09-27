/** @jest-environment node */
import { createGuestIngress } from '../../supabase/functions/guest-room-access/handler';

const endpoint = 'https://example.supabase.co/functions/v1/guest-room-access';
const body = { operation: 'get_guest_room_snapshot', args: { guest_token: 'secret' } };
const request = (headers: Record<string, string> = {}, payload: unknown = body) => new Request(endpoint, {
  method: 'POST', headers: { 'content-type': 'application/json', apikey: 'public-key', ...headers }, body: JSON.stringify(payload),
});

describe('trusted guest ingress', () => {
  const upstream = jest.fn();
  const handler = createGuestIngress({ url: 'https://example.supabase.co', serviceKey: 'server-only', publicKeys: ['public-key'], fetch: upstream });
  beforeEach(() => { upstream.mockReset(); upstream.mockResolvedValue(Response.json({ sessionId: 'room' })); });

  it('rejects an unrecognized API key before privileged dispatch', async () => {
    expect((await handler(request({ apikey: 'wrong', 'cf-connecting-ip': '203.0.113.1' }))).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('rejects missing trusted identity even with a forged forwarding chain', async () => {
    expect((await handler(request({ 'x-forwarded-for': '198.51.100.1' }))).status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('forwards only its own credentials and trusted caller address', async () => {
    const result = await handler(request({ 'cf-connecting-ip': '203.0.113.1', 'x-forwarded-for': '198.51.100.1', authorization: 'Bearer attacker', 'x-dong-guest-caller': '198.51.100.2' }));
    expect(await result.json()).toEqual({ sessionId: 'room' });
    const [url, options] = upstream.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/get_guest_room_snapshot');
    expect(options.headers.Authorization).toBe('Bearer server-only');
    expect(options.headers['x-dong-guest-caller']).toBe('203.0.113.1');
    expect(JSON.stringify(options.headers)).not.toContain('198.51.100');
  });
  it.each(['', '203.0.113.1, 198.51.100.1', 'garbage', '1.2.3.999', '127.0.0.1/8'])('fails closed for malformed identity %s', async ip => {
    expect((await handler(request({ 'cf-connecting-ip': ip }))).status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('rejects arbitrary RPCs and caller-supplied extra arguments', async () => {
    for (const payload of [{ operation: 'delete_account', args: {} }, { ...body, args: { guest_token: 'secret', caller: 'forged' } }]) {
      expect((await handler(request({ 'cf-connecting-ip': '203.0.113.1' }, payload))).status).toBe(400);
    }
    expect(upstream).not.toHaveBeenCalled();
  });
  it('bounds actual body bytes', async () => {
    expect((await handler(request({ 'cf-connecting-ip': '203.0.113.1' }, { data: 'a'.repeat(9000) }))).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('accepts empty successful void responses without reporting a committed write as failed', async () => {
    upstream.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await handler(request({ 'cf-connecting-ip': '203.0.113.1' }, {
      operation: 'set_my_room_picks_as_guest', args: { guest_token: 'secret', match_ids: [] },
    }));
    expect(result.status).toBe(200);
    expect(await result.json()).toBeNull();
  });
  it('preserves known gameplay failures without upstream details', async () => {
    upstream.mockResolvedValueOnce(Response.json({ message: 'negative_result', details: 'secret' }, { status: 400 }));
    const result = await handler(request({ 'cf-connecting-ip': '203.0.113.1' }));
    expect(await result.json()).toEqual({ ok: false, code: 'negative_result' });
  });
  it('redacts upstream errors and transport failures', async () => {
    upstream.mockResolvedValueOnce(Response.json({ message: 'secret ROOM42' }, { status: 500 }));
    upstream.mockRejectedValueOnce(new Error('secret ROOM42'));
    for (let i = 0; i < 2; i++) {
      const result = await handler(request({ 'cf-connecting-ip': '203.0.113.1' }));
      expect(result.status).toBe(503);
      expect(await result.text()).not.toMatch(/secret|ROOM42/);
    }
  });
});
