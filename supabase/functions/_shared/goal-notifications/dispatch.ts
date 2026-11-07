import { Buffer } from 'node:buffer';
// @deno-types="npm:@types/web-push@3.6.4"
import webPush from 'npm:web-push@3.6.7';
import { encodeBase64Url } from '../../../../shared/encoding/base64url.ts';
import type { GoalNotificationTarget } from './contracts.ts';
import { connectGoalNotificationDatabase, type GoalPushConfiguration } from './pushConfiguration.ts';
import { goalScoreMessage, type GoalScoreChange } from './scoreChange.ts';
import { sendGoalPush } from './webPush.ts';

type DeliveryClaim = { id: string; token: string };
type AuthorizedDelivery = GoalScoreChange & {
  target: GoalNotificationTarget;
  endpoint: string;
  p256dh: string;
  authKey: string;
  vapidKeyId: string;
  appleAuthorization: string | null;
  deadline: string;
  attempt: number;
};

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const hexHmac = /^[0-9a-f]{64}$/;

export function createGoalNotificationDispatcher(
  config: GoalPushConfiguration, databaseUrl: string, secret: string,
) {
  if (secret.length < 32) throw new Error('configuration_required');
  const sql = connectGoalNotificationDatabase(databaseUrl, config.environment, 'dong-goal-dispatch');
  const wakeKey = crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);

  async function sendClaimedDelivery({ id, token }: DeliveryClaim) {
    const [row] = await sql<{ delivery: AuthorizedDelivery | null }[]>`
      select private.authorize_goal_notification_delivery(${id}::uuid, ${token}::uuid,
        ${config.environment}, ${config.vapid.publicKey}) as delivery
    `;
    const delivery = row.delivery;
    if (!delivery) return;
    const message = goalScoreMessage(delivery);
    const outcome = message && delivery.vapidKeyId === config.vapid.keyId
      ? await sendGoalPush({
        subscription: {
          endpoint: delivery.endpoint,
          keys: {
            p256dh: encodeBase64Url(Buffer.from(delivery.p256dh, 'hex')),
            auth: encodeBase64Url(Buffer.from(delivery.authKey, 'hex')),
          },
        },
        payload: { version: 1, kind: 'goal', id, ...message },
        deadline: Date.parse(delivery.deadline),
        destinations: config.destinations[delivery.target] ?? [],
        authorization: async destination => {
          if (destination.provider === 'apple' && delivery.appleAuthorization) return delivery.appleAuthorization;
          const header = webPush.getVapidHeaders(destination.origin, config.vapid.subject, config.vapid.publicKey,
            config.vapid.privateKey, 'aes128gcm', Math.floor(Date.now() / 1000) + 7200).Authorization;
          if (destination.provider !== 'apple') return header;
          const [stored] = await sql<{ vapid_header: string }[]>`
            select private.cache_goal_notification_apple_authorization(${destination.origin},
              ${config.vapid.publicKey}, ${header}) as vapid_header
          `;
          return stored.vapid_header;
        },
      }) : { kind: 'failed' } as const;
    const backoff = 10 * 2 ** (delivery.attempt - 1);
    const delay = outcome.kind === 'retryable' ? Math.min(300, Math.max(backoff, outcome.retryAfterSeconds ?? 0)) : 0;
    const state = outcome.kind === 'invalid_destination' ? 'failed' : outcome.kind;
    await sql`select private.finish_goal_notification_delivery(${id}::uuid, ${token}::uuid, ${state},
      ${delay}::int, ${outcome.kind === 'retryable' && outcome.uncertain})`;
  }

  return async function handle(request: Request) {
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    const wake = request.headers.get('x-dong-wake-id') ?? '';
    const proof = request.headers.get('x-dong-wake-proof') ?? '';
    if (!uuid.test(wake) || !hexHmac.test(proof) ||
      !await crypto.subtle.verify('HMAC', await wakeKey, Buffer.from(proof, 'hex'), new TextEncoder().encode(wake))) {
      return new Response(null, { status: 403 });
    }
    const claims = await sql<DeliveryClaim[]>`select id, token from private.claim_goal_notification_deliveries(${wake}::uuid, ${config.environment})`;
    for (let offset = 0; offset < claims.length; offset += 5) {
      await Promise.allSettled(claims.slice(offset, offset + 5).map(sendClaimedDelivery));
    }
    return Response.json({ claimed: claims.length }, { headers: { 'cache-control': 'no-store' } });
  };
}
