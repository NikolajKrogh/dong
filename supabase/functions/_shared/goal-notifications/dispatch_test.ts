import { createGoalNotificationDispatcher } from './dispatch.ts';

Deno.test('the scheduler rejects missing and forged proofs before touching the database', async () => {
  const handle = createGoalNotificationDispatcher({
    environment: 'local', vapid: { keyId: 'fixture', subject: 'https://dong.example', publicKey: '', privateKey: '' },
    destinations: {},
  }, 'postgresql://fixture:fixture@127.0.0.1:1/postgres', 'a'.repeat(32));
  const responses = await Promise.all([
    new Headers(),
    new Headers({ 'x-dong-wake-id': '10000000-0000-4000-8000-000000000001', 'x-dong-wake-proof': '0'.repeat(64) }),
  ].map(headers => handle(new Request('https://dong.example/dispatch', { method: 'POST', headers }))));
  if (responses.some(response => response.status !== 403)) {
    throw new Error('Unauthenticated scheduler request reached delivery');
  }
  const response = await handle(new Request('https://dong.example/dispatch'));
  if (response.status !== 405) throw new Error('Scheduler accepted the wrong method');
});
