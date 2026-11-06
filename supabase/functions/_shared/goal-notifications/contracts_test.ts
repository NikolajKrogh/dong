import { encodeBase64Url } from '../../../../shared/encoding/base64url.ts';
import { goalNotificationRequest, goalPushPayload } from './contracts.ts';

const id = '10000000-0000-4000-8000-000000000001';
const capability = encodeBase64Url(new Uint8Array(32));
const p256dh = new Uint8Array(65);
p256dh[0] = 4;
const subscription = {
  endpoint: 'https://push.example/endpoint',
  keys: { p256dh: encodeBase64Url(p256dh), auth: encodeBase64Url(new Uint8Array(16)) },
};

Deno.test('registration accepts only the supported proof and endpoint shapes', () => {
  const request = { operation: 'register', requestId: id, target: 'android_chrome', subscription };
  for (const proof of [
    { kind: 'registered', sessionId: id },
    { kind: 'guest', sessionId: id, guestToken: 'a'.repeat(64) },
    { kind: 'solo', grantToken: capability },
  ]) {
    if (!goalNotificationRequest.safeParse({ ...request, proof }).success) throw new Error('Valid proof rejected');
  }
  const proof = { kind: 'solo', grantToken: capability };
  for (const invalid of [
    { ...request, proof: { ...proof, grantToken: capability + '=' } },
    { ...request, proof, subscription: { ...subscription, endpoint: 'http://push.example/endpoint' } },
    { ...request, proof, subscription: { ...subscription, keys: { ...subscription.keys, auth: capability } } },
    { ...request, proof, recipientId: id },
  ]) {
    if (goalNotificationRequest.safeParse(invalid).success) throw new Error('Invalid registration accepted');
  }
});

Deno.test('disable requires the installation generation and test payloads have no URL', () => {
  const installation = { id, credential: capability, generation: 1 };
  if (!goalNotificationRequest.safeParse({ operation: 'disable', installation }).success) throw new Error('Valid stop rejected');
  if (goalNotificationRequest.safeParse({ operation: 'disable', installation: { ...installation, generation: 0 } }).success) {
    throw new Error('Invalid generation accepted');
  }
  const payload = { version: 1, kind: 'test', id };
  if (!goalPushPayload.safeParse(payload).success || goalPushPayload.safeParse({ ...payload, url: '/' }).success) {
    throw new Error('Test payload must contain only its version, type and ID');
  }
});
