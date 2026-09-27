import { isIP } from 'node:net';

const operations: Record<string, readonly string[]> = {
  join_room_as_guest: ['join_code', 'guest_name', 'guest_token'],
  get_guest_room_snapshot: ['guest_token'],
  leave_room_as_guest: ['guest_token'],
  rotate_guest_room_grant: ['old_token', 'new_token', 'operation_id'],
  set_my_room_picks_as_guest: ['guest_token', 'match_ids'],
  change_manual_score_as_guest: ['guest_token', 'match_id', 'team', 'delta_goals', 'idempotency_key'],
  change_participant_drink_as_guest: ['guest_token', 'participant_id', 'delta_half_drinks', 'idempotency_key'],
};
const safeErrors = new Set(['guest_token_expired', 'guest_access_lost', 'room_unavailable',
  'not_permitted', 'invalid_request', 'rate_limited', 'invalid_room_state',
  'match_not_found', 'participant_not_found', 'not_authorized', 'invalid_delta',
  'invalid_team', 'idempotency_conflict', 'pick_limit_exceeded', 'room_not_player_picked',
  'room_not_joinable', 'not_room_participant', 'participant_inactive', 'target_inactive',
  'match_not_in_room', 'game_not_in_progress', 'manual_score_required',
  'provider_score_required', 'negative_result', 'idempotency_key_reused', 'forbidden']);
const responseHeaders = {
  'content-type': 'application/json', 'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: responseHeaders });
const failure = (code: string, status: number) => reply({ ok: false, code }, status);

export function createGuestIngress(config: { url: string; serviceKey: string; publicKeys: string[]; fetch: typeof fetch }) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders });
    if (request.method !== 'POST') return failure('invalid_request', 405);
    const apiKey = request.headers.get('apikey');
    if (!apiKey || !config.publicKeys.some(key => key.length > 0 && key === apiKey)) return failure('unauthorized', 401);
    // Only the managed Cloudflare route is supported. Never fall back to XFF,
    // X-Real-IP, a caller body field, or the Edge-to-database connection address.
    const caller = request.headers.get('cf-connecting-ip')?.trim() ?? '';
    if (!isIP(caller) || caller.includes('%')) return failure('caller_identity_unavailable', 503);
    if (!config.url || !config.serviceKey) return failure('service_unavailable', 503);
    let payload: unknown;
    try {
      const reader = request.body?.getReader();
      if (!reader) return failure('invalid_request', 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) { await reader.cancel(); return failure('invalid_request', 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch { return failure('invalid_request', 400); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return failure('invalid_request', 400);
    const { operation, args } = payload as Record<string, unknown>;
    if (Object.keys(payload).some(key => key !== 'operation' && key !== 'args') ||
        typeof operation !== 'string' || !Object.hasOwn(operations, operation) ||
        !args || typeof args !== 'object' || Array.isArray(args)) return failure('invalid_request', 400);
    const allowed = operations[operation];
    const keys = Object.keys(args);
    if (keys.length !== allowed.length || keys.some(key => !allowed.includes(key))) return failure('invalid_request', 400);
    try {
      // Never spread inbound headers. This is an allowlisted bearer-operation
      // dispatcher, not an arbitrary service-role proxy.
      const upstream = await config.fetch(`${config.url}/rest/v1/rpc/${operation}`, {
        method: 'POST', headers: { apikey: config.serviceKey,
          Authorization: `Bearer ${config.serviceKey}`, 'content-type': 'application/json',
          'x-dong-guest-caller': caller },
        body: JSON.stringify(args), signal: AbortSignal.timeout(10000),
      });
      const responseBody = await upstream.text();
      const data = responseBody ? JSON.parse(responseBody) :
        (upstream.ok && operation === 'set_my_room_picks_as_guest' ? null : undefined);
      if (data === undefined) return failure('service_unavailable', 503);
      if (!upstream.ok) {
        // Preserve only exact known domain errors. Never relay details/hints.
        if (typeof data?.message === 'string' && safeErrors.has(data.message)) {
          return reply({ ok: false, code: data.message });
        }
        return failure('service_unavailable', 503);
      }
      return reply(data);
    } catch { return failure('service_unavailable', 503); }
  };
}
