import { decodeCanonicalBase64Url } from '../../../shared/encoding/base64url.ts';
import { goalNotificationRequest, MAX_GOAL_NOTIFICATION_REQUEST_BYTES } from '../_shared/goal-notifications/contracts.ts';
import { createGoalEnrollment, type GoalEnrollmentConfig } from '../_shared/goal-notifications/enrollment.ts';

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
  const environment = Deno.env.get('GOAL_NOTIFICATION_ENVIRONMENT') ?? '';
  const controlKey = decodeCanonicalBase64Url(Deno.env.get('GOAL_NOTIFICATION_CONTROL_KEY'));
  const vapid = {
    keyId: Deno.env.get('GOAL_NOTIFICATION_VAPID_KEY_ID') ?? '',
    subject: Deno.env.get('GOAL_NOTIFICATION_VAPID_SUBJECT') ?? '',
    publicKey: Deno.env.get('GOAL_NOTIFICATION_VAPID_PUBLIC_KEY') ?? '',
    privateKey: Deno.env.get('GOAL_NOTIFICATION_VAPID_PRIVATE_KEY') ?? '',
  };
  if (
    !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(environment) || controlKey?.length !== 32 ||
    decodeCanonicalBase64Url(vapid.publicKey)?.length !== 65 ||
    decodeCanonicalBase64Url(vapid.privateKey)?.length !== 32 || !vapid.keyId || !vapid.subject
  ) throw new Error('configuration_required');
  const destinations = parseDestinations(Deno.env.get('GOAL_NOTIFICATION_DESTINATIONS') ?? '{}');
  enrollment = createGoalEnrollment({
    databaseUrl: Deno.env.get('GOAL_NOTIFICATION_DATABASE_URL') ?? '',
    authUrl: Deno.env.get('SUPABASE_URL') ?? '',
    environment, controlKey, vapid, destinations,
  });
  return enrollment;
}

function parseDestinations(raw: string): GoalEnrollmentConfig['destinations'] {
  const config: unknown = JSON.parse(raw);
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('configuration_required');
  const result: GoalEnrollmentConfig['destinations'] = {};
  for (const target of ['android_chrome', 'android_firefox', 'android_samsung', 'iphone_home_screen', 'other'] as const) {
    const entries = (config as Record<string, unknown>)[target];
    if (!Array.isArray(entries)) continue;
    result[target] = entries.filter(entry => {
      if (!entry || typeof entry !== 'object' || typeof entry.origin !== 'string' ||
        typeof entry.pathPrefix !== 'string' || !/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(entry.pathPrefix)) return false;
      if (entry.provider === 'fcm') return entry.origin === 'https://fcm.googleapis.com';
      if (entry.provider === 'mozilla') return entry.origin === 'https://updates.push.services.mozilla.com';
      return entry.provider === 'apple' && /^https:\/\/(?:[a-z0-9-]+\.)+push\.apple\.com$/.test(entry.origin);
    });
  }
  return result;
}

async function readRequest(request: Request) {
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
  const input = await readRequest(request);
  if (!input?.success) return failure('invalid_request', 400);
  try {
    const response = await getEnrollment().handle(input.data, request, key);
    response.headers.forEach((value, name) => headers.set(name, value));
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return failure('unavailable', 503);
  }
} };
