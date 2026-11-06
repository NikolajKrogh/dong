import postgres from 'npm:postgres@3.4.9';
import { decodeCanonicalBase64Url } from '../../../../shared/encoding/base64url.ts';
import type { GoalNotificationTarget } from './contracts.ts';
import type { VerifiedPushDestination } from './webPush.ts';

type PushDestinations = Partial<Record<GoalNotificationTarget, VerifiedPushDestination[]>>;

export function readGoalPushConfiguration() {
  const environment = Deno.env.get('GOAL_NOTIFICATION_ENVIRONMENT') ?? '';
  const vapid = {
    keyId: Deno.env.get('GOAL_NOTIFICATION_VAPID_KEY_ID') ?? '',
    subject: Deno.env.get('GOAL_NOTIFICATION_VAPID_SUBJECT') ?? '',
    publicKey: Deno.env.get('GOAL_NOTIFICATION_VAPID_PUBLIC_KEY') ?? '',
    privateKey: Deno.env.get('GOAL_NOTIFICATION_VAPID_PRIVATE_KEY') ?? '',
  };
  if (
    !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(environment) ||
    decodeCanonicalBase64Url(vapid.publicKey)?.length !== 65 ||
    decodeCanonicalBase64Url(vapid.privateKey)?.length !== 32 || !vapid.keyId || !vapid.subject
  ) throw new Error('configuration_required');

  const destinations = parseDestinations(Deno.env.get('GOAL_NOTIFICATION_DESTINATIONS') ?? '{}');
  return { environment, vapid, destinations };
}

function parseDestinations(raw: string): PushDestinations {
  const config: unknown = JSON.parse(raw);
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('configuration_required');
  const result: PushDestinations = {};
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

export function connectGoalNotificationDatabase(databaseUrl: string, environment: string, applicationName: string) {
  const address = new URL(databaseUrl);
  const local = environment === 'local' &&
    ['localhost', '127.0.0.1', '[::1]', 'db'].includes(address.hostname);
  if (
    !['postgres:', 'postgresql:'].includes(address.protocol) ||
    (!local && address.searchParams.has('sslmode') && address.searchParams.get('sslmode') !== 'verify-full')
  ) throw new Error('configuration_required');

  const options = {
    prepare: false, max: 2, idle_timeout: 20, connect_timeout: 5,
    max_pipeline: 0, ssl: !local,
    connection: { application_name: applicationName },
  };
  return postgres(databaseUrl, options);
}
