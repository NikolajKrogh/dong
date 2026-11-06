import { z } from 'npm:zod@4.4.3';
import { decodeCanonicalBase64Url } from '../../../../shared/encoding/base64url.ts';

export const MAX_GOAL_NOTIFICATION_REQUEST_BYTES = 4096;
export const MAX_PUSH_ENDPOINT_LENGTH = 2048;

const opaqueId = z.uuid().transform(value => value.toLowerCase());
const generation = z.int().positive();
const revision = z.int().nonnegative();

function base64Key(length: number, prefix?: number) {
  return z.string().length(Math.ceil(length * 4 / 3)).refine(value => {
    const bytes = decodeCanonicalBase64Url(value);
    return bytes?.length === length && (prefix === undefined || bytes[0] === prefix);
  }, 'Invalid key');
}

const capability = base64Key(32);
const registeredProof = z.strictObject({ kind: z.literal('registered'), sessionId: opaqueId });
const guestProof = z.strictObject({
  kind: z.literal('guest'),
  sessionId: opaqueId,
  guestToken: z.string().regex(/^[0-9a-f]{64}$/i),
});
const soloProof = z.strictObject({ kind: z.literal('solo'), grantToken: capability });
const proof = z.discriminatedUnion('kind', [registeredProof, guestProof, soloProof]);
const roomProof = z.discriminatedUnion('kind', [registeredProof, guestProof]);

const target = z.enum(['android_chrome', 'android_firefox', 'android_samsung', 'iphone_home_screen', 'other']);
const installation = z.strictObject({ id: opaqueId, credential: capability, generation });
const subscription = z.strictObject({
  endpoint: z.string().max(MAX_PUSH_ENDPOINT_LENGTH).regex(/^https:\/\/[^\s]+$/),
  keys: z.strictObject({ p256dh: base64Key(65, 4), auth: base64Key(16) }),
});

export const goalNotificationRequest = z.discriminatedUnion('operation', [
  z.strictObject({
    operation: z.literal('status'),
    target,
    installation: installation.optional(),
  }),
  z.strictObject({
    operation: z.literal('register'),
    requestId: opaqueId,
    target,
    proof,
    subscription,
    installation: installation.optional(),
  }),
  z.strictObject({
    operation: z.literal('bind'),
    installation,
    proof,
    expectedAssociationRevision: revision.nullable(),
    notifyCommonMatch: z.boolean().optional(),
    commonCatalogMatchId: z.int().positive().optional(),
  }),
  z.strictObject({
    operation: z.literal('scope'),
    installation,
    proof: roomProof,
    expectedScopeRevision: revision,
    scope: z.enum(['assigned_and_common', 'all_room_matches']),
  }),
  z.strictObject({ operation: z.literal('disable'), installation }),
  z.strictObject({ operation: z.literal('repair'), installation, proof, subscription }),
  z.strictObject({ operation: z.literal('test'), installation, proof, requestId: opaqueId }),
  z.strictObject({ operation: z.literal('resolve'), deliveryId: opaqueId, proof }),
]);

export type GoalNotificationRequest = z.infer<typeof goalNotificationRequest>;
export type GoalNotificationProof = z.infer<typeof proof>;
export type GoalNotificationTarget = z.infer<typeof target>;
export type GoalPushSubscription = z.infer<typeof subscription>;

export const goalPushPayload = z.discriminatedUnion('kind', [
  z.strictObject({ version: z.literal(1), kind: z.literal('test'), id: opaqueId }),
  z.strictObject({
    version: z.literal(1),
    kind: z.literal('goal'),
    id: opaqueId,
    title: z.string().min(1).max(100),
    body: z.string().min(1).max(180),
  }),
]);

export type GoalPushPayload = z.infer<typeof goalPushPayload>;

export type GoalNotificationErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'invalid_destination'
  | 'not_eligible'
  | 'stale_revision'
  | 'rate_limited'
  | 'unavailable';
