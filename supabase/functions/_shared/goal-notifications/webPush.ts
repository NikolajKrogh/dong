// @deno-types="npm:@types/web-push@3.6.4"
import webPush from 'npm:web-push@3.6.7';
import type { GoalPushPayload, GoalPushSubscription } from './contracts.ts';

type PushProvider = 'apple' | 'mozilla' | 'fcm';

export interface VerifiedPushDestination {
  origin: string;
  pathPrefix: string;
  provider: PushProvider;
}

type PushOutcome =
  | { kind: 'accepted' | 'invalid_endpoint' | 'invalid_destination' | 'expired' | 'failed' }
  | { kind: 'retryable'; retryAfterSeconds: number | null; uncertain: boolean };

export function selectPushDestination(
  endpoint: string, destinations: readonly VerifiedPushDestination[],
): VerifiedPushDestination | null {
  let url: URL;
  try { url = new URL(endpoint); } catch { return null; }
  if (
    url.href !== endpoint || url.protocol !== 'https:' || url.port ||
    url.username || url.password || url.search || url.hash ||
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z][a-z0-9-]*$/.test(url.hostname)
  ) return null;

  return destinations.find(destination =>
    destination.origin === url.origin && destination.pathPrefix.endsWith('/') &&
    url.pathname.startsWith(destination.pathPrefix) &&
    /^[a-z0-9:_.-]+$/i.test(url.pathname.slice(destination.pathPrefix.length))
  ) ?? null;
}

function retryAfterSeconds(value: string | null, now: number): number | null {
  if (!value) return null;
  if (/^\d{1,9}$/.test(value)) return Number(value);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - now) / 1000)) : null;
}

async function readMozillaError(response: Response): Promise<number | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const buffer = new Uint8Array(1024);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.byteLength > buffer.byteLength) return null;
      buffer.set(value, length);
      length += value.byteLength;
    }
    const payload = JSON.parse(new TextDecoder().decode(buffer.subarray(0, length)));
    return typeof payload?.errno === 'number' ? payload.errno : null;
  } catch {
    return null;
  } finally {
    void reader.cancel().catch(() => {});
  }
}

export async function classifyPushResponse(
  provider: PushProvider, response: Response, now: number,
): Promise<PushOutcome> {
  const status = response.status;
  if (provider === 'mozilla' && (status === 404 || status === 410)) {
    const reason = await readMozillaError(response);
    return (status === 404 && reason === 102) || (status === 410 && reason !== null && [103, 105, 106].includes(reason))
      ? { kind: 'invalid_endpoint' }
      : { kind: 'failed' };
  }

  void response.body?.cancel().catch(() => {});
  if (status === 201 || status === 202) return { kind: 'accepted' };
  if (provider === 'apple' && status === 410) return { kind: 'invalid_endpoint' };
  if (status === 429 || status >= 500) {
    return { kind: 'retryable', retryAfterSeconds: retryAfterSeconds(response.headers.get('retry-after'), now), uncertain: false };
  }
  return { kind: 'failed' };
}

// The deadline is derived from committed evidence, so retries never renew the TTL.
function remainingTtl(deadline: number, now: number): number {
  return Math.min(300, Math.floor((deadline - now - 1000) / 1000));
}

export async function sendGoalPush(input: {
  subscription: GoalPushSubscription;
  payload: GoalPushPayload;
  deadline: number;
  destinations: readonly VerifiedPushDestination[];
  // The caller supplies a server-owned authorization header, with durable Apple JWT reuse.
  authorization: (destination: VerifiedPushDestination) => Promise<string>;
  fetch?: typeof fetch;
  now?: () => number;
}): Promise<PushOutcome> {
  const destination = selectPushDestination(input.subscription.endpoint, input.destinations);
  if (!destination) return { kind: 'invalid_destination' };
  const now = input.now ?? Date.now;
  const ttl = remainingTtl(input.deadline, now());
  if (!Number.isFinite(ttl) || ttl <= 0) return { kind: 'expired' };

  let headers: Headers;
  let body: ArrayBuffer | undefined;
  try {
    const authorization = await input.authorization(destination);
    if (!authorization) return { kind: 'failed' };
    const details = webPush.generateRequestDetails(input.subscription, JSON.stringify(input.payload), {
      TTL: ttl,
      topic: input.payload.id.replaceAll('-', '').toLowerCase(),
    });
    headers = new Headers(Object.entries(details.headers).map(([name, value]) => [name, String(value)]));
    headers.set('authorization', authorization);
    if (details.body) body = Uint8Array.from(details.body).buffer;
  } catch {
    return { kind: 'failed' };
  }
  const finalTtl = remainingTtl(input.deadline, now());
  if (finalTtl <= 0) return { kind: 'expired' };
  headers.set('ttl', String(finalTtl));

  try {
    const response = await (input.fetch ?? fetch)(input.subscription.endpoint, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    return await classifyPushResponse(destination.provider, response, now());
  } catch {
    return { kind: 'retryable', retryAfterSeconds: null, uncertain: true };
  }
}
