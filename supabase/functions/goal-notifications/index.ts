import { decodeCanonicalBase64Url } from '../../../shared/encoding/base64url.ts';
import { goalNotificationRequest, MAX_GOAL_NOTIFICATION_REQUEST_BYTES } from '../_shared/goal-notifications/contracts.ts';
import { readGoalPushConfiguration } from '../_shared/goal-notifications/pushConfiguration.ts';
import { createGoalEnrollment } from '../_shared/goal-notifications/enrollment.ts';

const origins = new Set((Deno.env.get('GOAL_NOTIFICATION_ORIGINS') ?? '').split(',').map(origin => origin.trim()).filter(Boolean));
const publicKeys = new Set([Deno.env.get('SUPABASE_ANON_KEY') ?? '']);
try {
  const named: unknown = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
  if (named && typeof named === 'object') {
    for (const key of Object.values(named)) if (typeof key === 'string' && key.startsWith('sb_publishable_')) publicKeys.add(key);
  }
} catch { /* The configured legacy key can still be used. */ }
publicKeys.delete('');

let enrollment: ReturnType<typeof createGoalEnrollment> | undefined;

function getEnrollment() {
  if (enrollment) return enrollment;
  const config = readGoalPushConfiguration();
  const controlKey = decodeCanonicalBase64Url(Deno.env.get('GOAL_NOTIFICATION_CONTROL_KEY'));
  if (controlKey?.length !== 32) throw new Error('configuration_required');
  enrollment = createGoalEnrollment({
    ...config,
    databaseUrl: Deno.env.get('GOAL_NOTIFICATION_DATABASE_URL') ?? '',
    authUrl: Deno.env.get('SUPABASE_URL') ?? '',
    controlKey,
  });
  return enrollment;
}

async function readGoalNotificationRequest(request: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const bytes = new Uint8Array(MAX_GOAL_NOTIFICATION_REQUEST_BYTES);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 5000);
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (length + value.byteLength > bytes.byteLength) return null;
      bytes.set(value, length);
      length += value.byteLength;
    }
    if (timedOut) return null;
    return goalNotificationRequest.safeParse(JSON.parse(new TextDecoder().decode(bytes.subarray(0, length))));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    void reader.cancel().catch(() => {});
  }
}

export default { async fetch(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  const headers = new Headers({ 'cache-control': 'no-store', vary: 'Origin' });
  const failure = (code: string, status: number) => Response.json({ ok: false, code }, { status, headers });
  if (!origin || !origins.has(origin)) return failure('unauthorized', 403);
  headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-methods', 'POST, OPTIONS');
  headers.set('access-control-allow-headers', 'authorization, apikey, content-type, x-client-info');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return failure('invalid_request', 405);
  const key = request.headers.get('apikey');
  if (!key || !publicKeys.has(key)) return failure('unauthorized', 401);
  const input = await readGoalNotificationRequest(request);
  if (!input?.success) return failure('invalid_request', 400);
  try {
    const response = await getEnrollment().handle(input.data, request, key);
    response.headers.forEach((value, name) => headers.set(name, value));
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return failure('unavailable', 503);
  }
} };
