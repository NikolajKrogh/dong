import { z } from 'npm:zod@4.4.3';
import { FOOTBALL_MATCH_ERROR_CODES } from '../../../../types/footballMatch.ts';
import {
  isPositivePostgresBigint,
  isUnsignedDecimal,
} from '../../../../shared/validation/identifiers.ts';

const MAX_SOLO_TRACKED_MATCHES = 20;
const MAX_WORK_GROUPS = 16;
const safeIntegerSchema = z.number().int();
const selectionVersionSchema = safeIntegerSchema.positive();
const savedMatchIdSchema = z.string().refine(isPositivePostgresBigint);
// Existing database projections accept any positive decimal spelling up to 19 digits.
const legacyDatabaseProjectionIdSchema = z.string().max(19)
  .refine(value => isUnsignedDecimal(value) && value[0] !== '0');

export const databaseResultSchema = z.looseObject({
  ok: z.unknown().optional(),
  code: z.unknown().optional(),
  retryAfterSeconds: z.unknown().optional(),
});

export const footballMatchErrorCodeSchema = z.enum(FOOTBALL_MATCH_ERROR_CODES);

export const trackingSelectionSchema = z.object({
  operationId: z.uuidv4().transform(value => value.toLowerCase()),
  catalogMatchIds: z.array(savedMatchIdSchema)
    .max(MAX_SOLO_TRACKED_MATCHES)
    .transform(ids => [...new Set(ids)].sort()),
});

export const newTrackingGrantSelectionSchema = z.object({
  catalogMatchIds: z.array(z.unknown()).min(1),
  grantToken: z.undefined().optional(),
  expectedSelectionVersion: z.undefined().optional(),
});

export const trackingGrantReplacementSchema = z.object({
  grantToken: z.string().min(1),
  expectedSelectionVersion: selectionVersionSchema,
});

export const preparedTrackingIssuanceSchema = z.object({
  issuanceId: z.uuidv4(),
  signingKeyId: z.string(),
  isReplay: z.boolean(),
});

export const trackingGrantResultSchema = z.object({
  selectionVersion: selectionVersionSchema,
  isReplay: z.boolean(),
  catalogMatchIds: z.array(legacyDatabaseProjectionIdSchema).max(MAX_SOLO_TRACKED_MATCHES),
  expiresAt: z.string().refine(value => Number.isFinite(Date.parse(value))),
  state: z.enum(['active', 'ended']),
});

export const workGroupIdsSchema = z.array(legacyDatabaseProjectionIdSchema).max(MAX_WORK_GROUPS);

export const preparedDiscoverySchema = z.looseObject({
  workGroupIds: workGroupIdsSchema,
  workerGeneration: safeIntegerSchema,
  selection: z.unknown().optional(),
  result: z.unknown().optional(),
});
