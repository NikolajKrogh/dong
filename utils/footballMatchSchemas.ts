import { z } from 'zod';
import { FOOTBALL_MATCH_PROVIDER } from '../types/footballMatch';
import type {
  MatchDiscoveryResult,
  MatchDiscoverySelection,
  SavedMatch,
  SavedMatchesResult,
  SoloTrackingGrant,
  SoloTrackingSelection,
} from '../types/footballMatch';
import { FootballMatchError, parseRetryAfterSeconds, toFootballMatchError } from './footballMatchError';
import { isPositivePostgresBigint, isUnsignedDecimal } from '../shared/validation/identifiers';

export const MAX_SAVED_MATCH_IDS = 100;
const MAX_SOLO_TRACKING_MATCHES = 20;
const MAX_DISCOVERY_LEAGUE_CODES = 128;
const MAX_DATABASE_ID_DIGITS = 19;
const TRACKING_TOKEN_LENGTH = 43;
const MAX_MATCH_SCORE = 999;
const savedMatchIdSchema = z.string().refine(isPositivePostgresBigint);
const observationVersionSchema = z.string()
  .max(MAX_DATABASE_ID_DIGITS)
  .refine(isUnsignedDecimal);

const availabilitySchema = z.enum(['available', 'partial', 'pending', 'unavailable', 'deferred']);
const savedMatchProjectionSchema = z.enum(['live', 'history']);
const nullableTextSchema = z.string().nullable();
const nullableNumberSchema = z.number().nullable();
const matchSideSchema = z.enum(['home', 'away']);
const trackingTokenSchema = z.base64url().length(TRACKING_TOKEN_LENGTH);
const positiveVersionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const retryAfterSecondsSchema = z.preprocess(parseRetryAfterSeconds, z.number().nullable());

const teamSchema = z.looseObject({
  sourceTeamId: nullableTextSchema,
  name: z.string(),
  shortName: nullableTextSchema,
});

const teamStatisticsSchema = z.looseObject({
  shotAttempts: nullableNumberSchema,
  shotsOnGoal: nullableNumberSchema,
  fouls: nullableNumberSchema,
  yellowCards: nullableNumberSchema,
  redCards: nullableNumberSchema,
  cornerKicks: nullableNumberSchema,
  possession: nullableNumberSchema,
});

// The database can return one missing side in a partial history projection.
const historyTeamStatisticsSchema = z.record(z.string(), nullableNumberSchema)
  .nullable().transform(statistics => statistics ?? {});

const goalSchema = z.looseObject({
  sourcePlayId: nullableTextSchema,
  side: matchSideSchema.nullable(),
  sourceAthleteId: nullableTextSchema,
  athleteName: nullableTextSchema,
  sourceTeamId: nullableTextSchema,
  clock: nullableTextSchema,
  period: nullableNumberSchema,
  occurredAt: nullableTextSchema,
  kind: z.enum(['goal', 'penalty', 'own_goal', 'shootout', 'unknown']),
  isRetracted: z.boolean(),
});

const rosterEntrySchema = z.looseObject({
  sourceAthleteId: nullableTextSchema,
  athleteName: z.string(),
  side: matchSideSchema,
  jersey: nullableTextSchema,
  position: nullableTextSchema,
  isStarter: z.boolean().nullable(),
  didPlay: z.boolean().nullable(),
  minutesPlayed: nullableNumberSchema,
});

const savedMatchSchema: z.ZodType<SavedMatch> = z.looseObject({
  catalogMatchId: savedMatchIdSchema,
  identity: z.looseObject({
    provider: z.literal(FOOTBALL_MATCH_PROVIDER),
    leagueCode: z.string(),
    sourceEventId: z.string(),
    sourceCompetitionId: nullableTextSchema,
  }),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
  kickoffAt: nullableTextSchema,
  kickoffValidity: z.enum(['confirmed', 'tentative', 'unknown']),
  lifecycle: z.enum([
    'scheduled', 'live', 'delayed', 'suspended', 'postponed',
    'finished', 'canceled', 'abandoned', 'unknown',
  ]),
  rawStatus: nullableTextSchema,
  isCompleted: z.boolean().nullable(),
  homeScore: z.number().int().min(0).max(MAX_MATCH_SCORE).nullable(),
  awayScore: z.number().int().min(0).max(MAX_MATCH_SCORE).nullable(),
  shootoutHomeScore: nullableNumberSchema,
  shootoutAwayScore: nullableNumberSchema,
  aggregateHomeScore: nullableNumberSchema,
  aggregateAwayScore: nullableNumberSchema,
  period: nullableNumberSchema,
  clockSeconds: nullableNumberSchema,
  displayClock: nullableTextSchema,
  season: z.looseObject({
    sourceId: nullableTextSchema,
    year: nullableNumberSchema,
    type: nullableTextSchema,
  }).nullable(),
  venue: z.looseObject({ sourceId: nullableTextSchema, name: nullableTextSchema }).nullable(),
  observationVersion: observationVersionSchema,
  availability: availabilitySchema,
  freshness: z.looseObject({
    lastAttemptAt: nullableTextSchema,
    lastSuccessfulCheckAt: nullableTextSchema,
    observedAt: nullableTextSchema,
    isStale: z.boolean(),
    availabilityReason: nullableTextSchema,
  }),
  goals: z.array(goalSchema).nullable(),
  goalsAvailability: availabilitySchema,
  hasMoreGoals: z.boolean(),
  homeTeamStatistics: teamStatisticsSchema.nullable(),
  awayTeamStatistics: teamStatisticsSchema.nullable(),
  historyDetails: z.looseObject({
    rosterEntries: z.array(rosterEntrySchema).nullable(),
    teamStats: z.looseObject({
      home: historyTeamStatisticsSchema,
      away: historyTeamStatisticsSchema,
    }).nullable(),
    availability: availabilitySchema,
    isFinal: z.boolean().nullable(),
    hasMoreRosterEntries: z.boolean(),
  }).optional(),
});

const savedMatchesResponseSchema: z.ZodType<SavedMatchesResult> = z.object({
  matches: z.array(savedMatchSchema),
  missingCatalogMatchIds: z.array(savedMatchIdSchema),
  availability: availabilitySchema,
  retryAfterSeconds: retryAfterSecondsSchema,
});

const optionalResponseTextSchema = z.unknown().transform(value => typeof value === 'string' ? value : null);
const discoveryResponseSchema: z.ZodType<MatchDiscoveryResult> = z.object({
  matches: z.array(savedMatchSchema),
  availability: availabilitySchema,
  groups: z.array(z.object({
    leagueCode: z.string(),
    date: z.string(),
    availability: availabilitySchema,
    lastSuccessfulCheckAt: optionalResponseTextSchema,
    isStale: z.boolean(),
    reason: optionalResponseTextSchema,
    retryAfterSeconds: retryAfterSecondsSchema,
  })),
  retryAfterSeconds: retryAfterSecondsSchema,
});

const soloTrackingGrantSchema: z.ZodType<SoloTrackingGrant> = z.looseObject({
  grantToken: trackingTokenSchema,
  selectionVersion: positiveVersionSchema,
  isReplay: z.boolean(),
  catalogMatchIds: z.array(savedMatchIdSchema).max(MAX_SOLO_TRACKING_MATCHES),
  expiresAt: z.string().refine(value => Number.isFinite(Date.parse(value))),
  state: z.enum(['active', 'ended']),
});

const normalizedSavedMatchIdsSchema = z.array(savedMatchIdSchema).max(MAX_SAVED_MATCH_IDS)
  .transform(ids => [...new Set(ids)].sort());
const trackingMatchIdsSchema = normalizedSavedMatchIdsSchema
  .refine(ids => ids.length <= MAX_SOLO_TRACKING_MATCHES);

const calendarDateSchema = z.iso.date();
const discoverySelectionSchema: z.ZodType<MatchDiscoverySelection> = z.object({
  leagueCodes: z.array(z.string()).max(MAX_DISCOVERY_LEAGUE_CODES)
    .transform(codes => [...new Set(codes.map(code => code.trim()).filter(Boolean))].sort()),
  date: calendarDateSchema,
});

const soloTrackingSelectionSchema: z.ZodType<SoloTrackingSelection> = z.union([
  z.object({
    operationId: z.uuidv4(),
    catalogMatchIds: trackingMatchIdsSchema.refine(ids => ids.length > 0),
    creationNonce: trackingTokenSchema,
    grantToken: z.undefined().optional(),
    expectedSelectionVersion: z.undefined().optional(),
  }),
  z.object({
    operationId: z.uuidv4(),
    catalogMatchIds: trackingMatchIdsSchema,
    grantToken: trackingTokenSchema,
    expectedSelectionVersion: positiveVersionSchema,
    creationNonce: z.undefined().optional(),
  }),
]);

function parseSelection<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new FootballMatchError('invalid_selection');
  return result.data;
}

function parseResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  if (value !== null && typeof value === 'object' && 'ok' in value && value.ok === false) {
    throw toFootballMatchError(value);
  }
  const result = schema.safeParse(value);
  if (!result.success) throw new FootballMatchError('transport_unavailable');
  return result.data;
}

export function normalizeSavedMatchIds(value: unknown): string[] {
  return parseSelection(normalizedSavedMatchIdsSchema, value);
}

export function normalizeDiscoverySelection(value: unknown): MatchDiscoverySelection {
  return parseSelection(discoverySelectionSchema, value);
}

export function normalizeSoloTrackingSelection(value: unknown): SoloTrackingSelection {
  const selection = parseSelection(soloTrackingSelectionSchema, value);
  const { operationId, catalogMatchIds } = selection;
  if (selection.creationNonce !== undefined) {
    return { operationId, catalogMatchIds, creationNonce: selection.creationNonce };
  }
  return {
    operationId,
    catalogMatchIds,
    grantToken: selection.grantToken,
    expectedSelectionVersion: selection.expectedSelectionVersion,
  };
}

export function parseSavedMatchProjection(value: unknown): 'live' | 'history' {
  return parseSelection(savedMatchProjectionSchema, value);
}

export function parseSavedMatchesResponse(value: unknown): SavedMatchesResult {
  return parseResponse(savedMatchesResponseSchema, value);
}

export function parseDiscoveryResponse(value: unknown): MatchDiscoveryResult {
  return parseResponse(discoveryResponseSchema, value);
}

export function parseSoloTrackingGrant(value: unknown): SoloTrackingGrant {
  return parseResponse(soloTrackingGrantSchema, value);
}
