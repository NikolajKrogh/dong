import { Buffer } from 'node:buffer';
// @deno-types="npm:@types/web-push@3.6.4"
import webPush from 'npm:web-push@3.6.7';
import postgres from 'npm:postgres@3.4.9';
import { decodeCanonicalBase64Url, encodeBase64Url } from '../../../../shared/encoding/base64url.ts';
import { decodeCapability, resolveGoalNotificationAuthority, sha256Hex } from './authorize.ts';
import type { GoalNotificationRequest, GoalNotificationTarget } from './contracts.ts';
import { selectPushDestination, sendGoalPush, type VerifiedPushDestination } from './webPush.ts';

interface TestReservation {
  status: 'not_eligible' | 'rate_limited' | 'pending' | 'accepted' | 'failed' | 'reserved';
  target: GoalNotificationTarget;
  endpoint: string;
  p256dh: string;
  authKey: string;
  vapidKeyId: string;
}

export interface GoalEnrollmentConfig {
  databaseUrl: string;
  environment: string;
  authUrl: string;
  controlKey: Uint8Array<ArrayBuffer>;
  vapid: { keyId: string; subject: string; publicKey: string; privateKey: string };
  destinations: Partial<Record<GoalNotificationTarget, VerifiedPushDestination[]>>;
  fetch?: typeof fetch;
}

export function createGoalEnrollment(config: GoalEnrollmentConfig) {
  const address = new URL(config.databaseUrl);
  const local = config.environment === 'local' &&
    ['localhost', '127.0.0.1', '[::1]', 'db'].includes(address.hostname);
  if (
    !['postgres:', 'postgresql:'].includes(address.protocol) ||
    (!local && address.searchParams.has('sslmode') && address.searchParams.get('sslmode') !== 'verify-full')
  ) throw new Error('configuration_required');

  const options = {
    prepare: false, max: 2, idle_timeout: 20, connect_timeout: 5,
    max_pipeline: 0, ssl: !local,
    connection: { application_name: 'dong-goal-notifications' },
  };
  const sql = postgres(config.databaseUrl, options);
  const hmacKey = crypto.subtle.importKey('raw', config.controlKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  async function handle(input: GoalNotificationRequest, request: Request, apiKey: string): Promise<Response> {
    const installation = 'installation' in input ? input.installation : undefined;
    const control = installation ? await sha256Hex(decodeCapability(installation.credential)) : null;
    if (input.operation === 'status') {
      if (!config.destinations[input.target]?.length) {
        return result({ status: 'unavailable' });
      }
      const [row] = await sql<{ status: string }[]>`
        select private.goal_notification_status(${config.environment}, ${input.target},
          ${installation?.id ?? null}::uuid,
          decode(${control}, 'hex'), ${installation?.generation ?? null}::bigint) as status
      `;
      return result({
        status: row.status,
        ...(row.status === 'available' ? { publicKey: config.vapid.publicKey } : {}),
      });
    }
    if (input.operation === 'disable') {
      const [row] = await sql<{ stopped: boolean }[]>`
        select private.disable_goal_notification_installation(${input.installation.id}::uuid,
          decode(${control}, 'hex'), ${input.installation.generation}::bigint, ${config.environment}) as stopped
      `;
      return row.stopped ? result({ status: 'disabled' }) : failure('not_eligible', 403);
    }
    if (input.operation !== 'register' && input.operation !== 'test') return failure('not_eligible', 403);
    const identity = await resolveGoalNotificationAuthority(input.proof, request, {
      authUrl: config.authUrl, publicKey: apiKey, fetch: config.fetch,
    });
    if (!identity) return failure('unauthorized', 401);

    if (input.operation === 'register') {
      const destination = selectPushDestination(input.subscription.endpoint, config.destinations[input.target] ?? []);
      if (!destination) return failure('invalid_destination', 400);
      if (installation && installation.id !== input.requestId) return failure('not_eligible', 403);
      const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey,
        new TextEncoder().encode(JSON.stringify([config.environment, input.requestId]))));
      const secret = encodeBase64Url(signature);
      const controlDigest = await sha256Hex(signature);
      const p256dh = decodeCanonicalBase64Url(input.subscription.keys.p256dh);
      const auth = decodeCanonicalBase64Url(input.subscription.keys.auth);
      if (!p256dh || !auth) return failure('invalid_request', 400);
      const key = Buffer.from(p256dh).toString('hex');
      const authKey = Buffer.from(auth).toString('hex');
      const [row] = await sql<{ generation: string | null }[]>`
        select private.register_goal_notification_installation(${input.requestId}::uuid, ${config.environment},
          ${input.target}, ${identity.kind}, ${identity.game}::uuid, ${identity.account}::uuid,
          ${identity.authSession}::uuid, decode(${identity.grantDigest}, 'hex'), decode(${controlDigest}, 'hex'),
          ${input.subscription.endpoint}, decode(${key}, 'hex'), decode(${authKey}, 'hex'), ${config.vapid.keyId}) as generation
      `;
      if (row.generation === null) return failure('not_eligible', 403);
      return result({ installation: { id: input.requestId, credential: secret, generation: Number(row.generation) } });
    }

    const [row] = await sql<{ reservation: TestReservation }[]>`
      select private.reserve_goal_notification_test(${input.installation.id}::uuid, decode(${control}, 'hex'),
        ${input.installation.generation}::bigint, ${config.environment}, ${input.requestId}::uuid, ${identity.kind},
        ${identity.game}::uuid, ${identity.account}::uuid, ${identity.authSession}::uuid,
        decode(${identity.grantDigest}, 'hex')) as reservation
    `;
    const reservation = row.reservation;
    if (reservation.status === 'rate_limited') return failure('rate_limited', 429);
    if (reservation.status === 'not_eligible') return failure('not_eligible', 403);
    if (reservation.status !== 'reserved') return result({ outcome: reservation.status });
    const outcome = reservation.vapidKeyId === config.vapid.keyId
      ? await sendGoalPush({
        subscription: {
          endpoint: reservation.endpoint,
          keys: {
            p256dh: encodeBase64Url(Buffer.from(reservation.p256dh, 'hex')),
            auth: encodeBase64Url(Buffer.from(reservation.authKey, 'hex')),
          },
        },
        payload: { version: 1, kind: 'test', id: input.requestId },
        deadline: Date.now() + 60_000,
        destinations: config.destinations[reservation.target] ?? [],
        authorization: async destination => {
          const header = webPush.getVapidHeaders(destination.origin, config.vapid.subject, config.vapid.publicKey,
            config.vapid.privateKey, 'aes128gcm', Math.floor(Date.now() / 1000) + 7200).Authorization;
          if (destination.provider !== 'apple') return header;
          const [cached] = await sql<{ vapid_header: string }[]>`
            select private.cache_goal_notification_apple_authorization(${destination.origin},
              ${config.vapid.publicKey}, ${header}) as vapid_header
          `;
          return cached.vapid_header;
        },
        fetch: config.fetch,
      })
      : { kind: 'failed' } as const;

    const kind = outcome.kind === 'accepted' || outcome.kind === 'invalid_endpoint' ? outcome.kind : 'failed';
    await sql`select private.complete_goal_notification_test(${input.installation.id}::uuid,
      ${input.installation.generation}::bigint, ${input.requestId}::uuid, ${kind})`;
    return result({ outcome: kind === 'accepted' ? 'accepted' : 'failed' });
  }

  return { handle, close: () => sql.end() };
}

function result(value: object) {
  return Response.json({ ok: true, ...value }, { headers: { 'cache-control': 'no-store' } });
}

function failure(code: string, status: number) {
  return Response.json({ ok: false, code }, { status, headers: { 'cache-control': 'no-store' } });
}
