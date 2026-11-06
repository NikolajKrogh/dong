// @deno-types="npm:@types/web-push@3.6.4"
import webPush from 'npm:web-push@3.6.7';
import { encodeBase64Url } from '../../../../shared/encoding/base64url.ts';
import { classifyPushResponse, selectPushDestination, sendGoalPush } from './webPush.ts';

const target = { origin: 'https://updates.push.services.mozilla.com', pathPrefix: '/wpush/v2/', provider: 'mozilla' } as const;
const endpoint = target.origin + target.pathPrefix + 'opaque_id';
const id = '10000000-0000-4000-8000-000000000001';
const time = 10_000;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('push only accepts exact configured origins and opaque endpoint paths', () => {
  check(selectPushDestination(endpoint, [target]) === target, 'verified destination rejected');
  for (const bad of [
    endpoint.replace('.com', '.com.attacker.test'), endpoint.replace('https://', 'http://'),
    endpoint.replace('https://', 'https://user@'), endpoint + '?x=1', endpoint + '#fragment',
    endpoint + '/second-segment', endpoint.replace('/v2/', '/v2/%2f'),
    endpoint.replace('/v2/', '/v2/../v2/'), 'https://127.0.0.1/wpush/v2/token',
  ]) check(selectPushDestination(bad, [target]) === null, 'unverified destination accepted');
});

Deno.test('response mapping distinguishes a handoff from permanent endpoint failure', async () => {
  check((await classifyPushResponse('apple', new Response(null, { status: 201 }), time)).kind === 'accepted', 'acceptance not recorded');
  check((await classifyPushResponse('apple', new Response(null, { status: 404 }), time)).kind === 'failed', 'Apple invalid path retired enrollment');
  check((await classifyPushResponse('apple', new Response(null, { status: 403 }), time)).kind === 'failed', 'Apple auth error retired enrollment');
  check((await classifyPushResponse('apple', new Response(null, { status: 410 }), time)).kind === 'invalid_endpoint', 'Apple expiry missed');
  check((await classifyPushResponse('mozilla', Response.json({ errno: 102 }, { status: 404 }), time)).kind === 'invalid_endpoint', 'Mozilla invalid endpoint missed');
  check((await classifyPushResponse('mozilla', Response.json({ errno: 106 }, { status: 410 }), time)).kind === 'invalid_endpoint', 'Mozilla expiry missed');
  const throttled = await classifyPushResponse('mozilla', new Response(null, { status: 429, headers: { 'retry-after': '4' } }), time);
  check(throttled.kind === 'retryable' && throttled.retryAfterSeconds === 4, 'retry advice lost');
});

Deno.test('the encrypted sender enforces the remaining TTL and stable hexadecimal Topic', async () => {
  const receiver = webPush.generateVAPIDKeys();
  const options = {
    subscription: { endpoint, keys: { p256dh: receiver.publicKey, auth: encodeBase64Url(new Uint8Array(16)) } },
    payload: { version: 1, kind: 'test', id } as const,
    destinations: [target],
    authorization: () => Promise.resolve('vapid t=fixture,k=fixture'),
    now: () => time,
  };
  const expired = await sendGoalPush({
    ...options, deadline: time + 999,
    fetch: () => { throw new Error('Must not send expired work'); },
  });
  check(expired.kind === 'expired', 'zero-rounded TTL reached transport');

  let attempts = 0;
  const accepted = await sendGoalPush({
    ...options, deadline: time + 5000,
    fetch: (_url, request) => {
      attempts++;
      const headers = new Headers(request?.headers);
      check(request?.redirect === 'manual', 'redirect could be followed');
      check(headers.get('ttl') === '4', 'transit margin was not subtracted');
      check(headers.get('topic') === id.replaceAll('-', ''), 'unstable Topic');
      check(headers.get('content-encoding') === 'aes128gcm', 'payload was not encrypted');
      return Promise.resolve(new Response(null, { status: 201 }));
    },
  });
  check(attempts === 1 && accepted.kind === 'accepted', 'test handoff failed');
});
