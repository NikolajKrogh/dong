import type { EspnHttpClient, EspnResource, EspnResult } from './espnHttpClient.ts';
import {
  normalizeEspnScoreboard,
  normalizeEspnSummary,
  type NormalizedScoreboard,
} from './espnMatchNormalizer.ts';
import {
  type FootballMatchService,
  type FootballMatchErrorCode,
  type MatchDiscoveryResult,
  type MatchDiscoverySelection,
  type SavedMatchesResult,
  type SoloTrackingGrant,
  type SoloTrackingSelection,
} from '../../../../types/footballMatch.ts';
import { decodeCanonicalBase64Url, encodeBase64Url } from '../../../../shared/encoding/base64url.ts';
import {
  footballMatchErrorCodeSchema,
  databaseResultSchema,
  newTrackingGrantSelectionSchema,
  preparedDiscoverySchema,
  preparedTrackingIssuanceSchema,
  trackingGrantReplacementSchema,
  trackingGrantResultSchema,
  trackingSelectionSchema,
  workGroupIdsSchema,
} from './footballMatchSchemas.ts';

export class FootballMatchOperationError extends Error {
  constructor(
    readonly code: FootballMatchErrorCode,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
    this.name = 'FootballMatchOperationError';
  }
}

export interface SoloTrackingDatabase {
  prepareSolo(input: {
    nonceDigest: string;
    creationDigest: string;
    operationId: string;
    signingKeyId: string;
    catalogMatchIds: string[];
  }): Promise<unknown>;
  finalizeSolo(input: {
    issuanceId: string;
    nonceDigest: string;
    tokenDigest: string;
    isReplay: boolean;
  }): Promise<unknown>;
  replaceSolo(input: {
    tokenDigest: string;
    expectedVersion: number;
    operationId: string;
    requestDigest: string;
    catalogMatchIds: string[];
  }): Promise<unknown>;
}
export interface TrackingKeyring {
  currentKeyId: string;
  keys: Record<string, string>;
}
const MAX_CONCURRENT_PROVIDER_REQUESTS = 4;
const MAX_CONCURRENT_ROOM_UPDATES = 4;
const MAX_ROOMS_PER_PASS = 100;
const ROOM_PROCESSING_MARGIN_MS = 5_000;
const NETWORK_WAVE_MIN_REMAINING_MS = 15_000;
const OPERATION_TIMEOUT_MS = 35_000;
const PRELIMINARY_REPLAY_WINDOW_MS = 7_000;
const TRACKING_CAPABILITY_BYTES = 32;
const TRACKING_CAPABILITY_LENGTH = 43;
function requireSuccessfulDatabaseResult(value: unknown): Record<string, unknown> {
  const parsed = databaseResultSchema.safeParse(value);
  if (!parsed.success) {
    throw new FootballMatchOperationError('transport_unavailable');
  }
  const result = parsed.data;
  if (result.ok !== true) {
    const parsedCode = footballMatchErrorCodeSchema.safeParse(result.code);
    throw new FootballMatchOperationError(
      parsedCode.success ? parsedCode.data : 'transport_unavailable',
      typeof result.retryAfterSeconds === 'number' ? result.retryAfterSeconds : null,
    );
  }
  return result;
}
function decodeCapability(value: unknown, code: FootballMatchErrorCode): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || value.length !== TRACKING_CAPABILITY_LENGTH) {
    throw new FootballMatchOperationError(code);
  }
  const bytes = decodeCanonicalBase64Url(value);
  if (bytes === null || bytes.length !== TRACKING_CAPABILITY_BYTES) {
    throw new FootballMatchOperationError(code);
  }
  return bytes;
}
async function sha256Hex(
  bytes: Uint8Array<ArrayBuffer>,
  crypto: Pick<Crypto, 'subtle'>,
): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function toPublicTrackingGrant(
  result: Record<string, unknown>,
  grantToken: string,
): SoloTrackingGrant {
  const parsed = trackingGrantResultSchema.safeParse(result);
  if (!parsed.success) {
    throw new FootballMatchOperationError('transport_unavailable');
  }
  return {
    grantToken,
    ...parsed.data,
  };
}

interface SoloTrackingDependencies {
  database: SoloTrackingDatabase;
  keyring: TrackingKeyring;
  crypto: Pick<Crypto, 'subtle'>;
}

interface NormalizedTrackingSelection {
  catalogMatchIds: string[];
  operationId: string;
}

function normalizeTrackingSelection(selection: SoloTrackingSelection): NormalizedTrackingSelection {
  const parsed = trackingSelectionSchema.safeParse(selection);
  if (!parsed.success) {
    throw new FootballMatchOperationError('invalid_selection');
  }
  return parsed.data;
}

async function issueSoloTrackingGrant(
  creationNonce: string,
  selection: NormalizedTrackingSelection,
  dependencies: SoloTrackingDependencies,
): Promise<SoloTrackingGrant> {
  const { catalogMatchIds, operationId } = selection;
  const { database, crypto, keyring } = dependencies;
  const encoder = new TextEncoder();
  const nonce = decodeCapability(creationNonce, 'invalid_selection');
  const currentKey = keyring.keys[keyring.currentKeyId];
  if (!Object.hasOwn(keyring.keys, keyring.currentKeyId)) {
    throw new FootballMatchOperationError('configuration_required');
  }
  decodeCapability(currentKey, 'configuration_required');
  const nonceDigest = await sha256Hex(nonce, crypto);
  const creationDigest = await sha256Hex(
    encoder.encode(JSON.stringify({ operationId, catalogMatchIds, creationNonce })),
    crypto,
  );
  const prepared = preparedTrackingIssuanceSchema.safeParse(
    requireSuccessfulDatabaseResult(
      await database.prepareSolo({
        nonceDigest,
        creationDigest,
        operationId,
        signingKeyId: keyring.currentKeyId,
        catalogMatchIds,
      }),
    ),
  );
  if (!prepared.success || !Object.hasOwn(keyring.keys, prepared.data.signingKeyId)) {
    throw new FootballMatchOperationError('configuration_required');
  }
  const preparedIssuance = prepared.data;
  const keyBytes = decodeCapability(
    keyring.keys[preparedIssuance.signingKeyId],
    'configuration_required',
  );
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const message = encoder.encode(
    `dong.solo-tracking/v1\0${preparedIssuance.issuanceId.toLowerCase()}\0${creationNonce}`,
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  const grantToken = encodeBase64Url(signature);
  const finalized = requireSuccessfulDatabaseResult(
    await database.finalizeSolo({
      issuanceId: preparedIssuance.issuanceId,
      nonceDigest,
      tokenDigest: await sha256Hex(signature, crypto),
      isReplay: preparedIssuance.isReplay,
    }),
  );
  return toPublicTrackingGrant(finalized, grantToken);
}

async function updateSoloTrackingGrant(
  selection: SoloTrackingSelection,
  normalized: NormalizedTrackingSelection,
  dependencies: SoloTrackingDependencies,
): Promise<SoloTrackingGrant> {
  const replacement = trackingGrantReplacementSchema.safeParse(selection);
  if (!replacement.success) {
    throw new FootballMatchOperationError('invalid_tracking_grant');
  }
  const { grantToken, expectedSelectionVersion } = replacement.data;
  const { catalogMatchIds, operationId } = normalized;
  const { database, crypto } = dependencies;
  const encoder = new TextEncoder();
  const token = decodeCapability(grantToken, 'invalid_tracking_grant');
  const requestDigest = await sha256Hex(
    encoder.encode(
      JSON.stringify({
        operationId,
        catalogMatchIds,
        expectedSelectionVersion,
      }),
    ),
    crypto,
  );
  const result = requireSuccessfulDatabaseResult(
    await database.replaceSolo({
      tokenDigest: await sha256Hex(token, crypto),
      expectedVersion: expectedSelectionVersion,
      operationId,
      requestDigest,
      catalogMatchIds,
    }),
  );
  return toPublicTrackingGrant(result, grantToken);
}

export async function replaceSoloTracking(
  selection: SoloTrackingSelection,
  dependencies: SoloTrackingDependencies,
): Promise<SoloTrackingGrant> {
  try {
    const normalized = normalizeTrackingSelection(selection);
    if ('creationNonce' in selection && selection.creationNonce !== undefined) {
      if (!newTrackingGrantSelectionSchema.safeParse(selection).success) {
        throw new FootballMatchOperationError('invalid_selection');
      }
      return await issueSoloTrackingGrant(selection.creationNonce, normalized, dependencies);
    }
    return await updateSoloTrackingGrant(selection, normalized, dependencies);
  } catch (error) {
    if (error instanceof FootballMatchOperationError) {
      throw error;
    }
    throw new FootballMatchOperationError('transport_unavailable');
  }
}

export type RequestPurpose = 'live' | 'discovery' | 'completion';
export type DeferredWork = { ok: false; code: string };
export interface WorkerSlot {
  ok: true;
  dispatchToken: string;
  workerGeneration: number;
}
export interface ClaimedRequest {
  ok: true;
  attemptId: string;
  leaseToken: string;
  workerGeneration: number;
  resource: EspnResource;
}

/** Owned database operations, unavailable to the public FootballMatchService client. */
export interface AcquisitionDatabase {
  acquireSlot(purpose: RequestPurpose, generation: number): Promise<WorkerSlot | DeferredWork>;
  releaseSlot(
    token: string,
    generation: number,
    outcome: 'completed' | 'deadline' | 'failed',
  ): Promise<void>;
  claimBatch(
    groupIds: string[],
    purpose: RequestPurpose,
    workerToken: string,
    generation: number,
  ): Promise<ClaimedRequest[]>;
  accept(claim: ClaimedRequest, projection: NormalizedScoreboard): Promise<{ ok: boolean }>;
  fail(claim: ClaimedRequest, failure: Extract<EspnResult, { ok: false }>): Promise<void>;
}

export interface AcquisitionCounts {
  attemptedGroups: number;
  acceptedGroups: number;
  deferredGroups: number;
  failedGroups: number;
}

export interface FootballMatchRepository extends AcquisitionDatabase, SoloTrackingDatabase {
  prepareDiscovery(selection: MatchDiscoverySelection): Promise<unknown>;
  readDiscovery(selection: MatchDiscoverySelection): Promise<MatchDiscoveryResult>;
  readSaved(ids: string[], projection: 'live' | 'history'): Promise<SavedMatchesResult>;
  pendingRooms(groupIds: string[] | null): Promise<string[]>;
  processRoom(roomId: string, workerToken: string, generation: number): Promise<unknown>;
  beginDispatch(
    token: string,
    generation: number,
  ): Promise<{ ok: true; groupIds: string[] } | DeferredWork>;
}

type FootballMatchDependencies = {
  database: FootballMatchRepository;
  provider: EspnHttpClient;
  keyring: TrackingKeyring;
  crypto: Pick<Crypto, 'subtle'>;
  now?: () => number;
};

/** Includes pool/transport waits, which a PostgreSQL statement timeout cannot bound. */
function withDeadline<T>(work: Promise<T>, deadline: number, now: () => number): Promise<T> {
  const remaining = deadline - now();
  if (remaining <= 0) {
    void work.catch(() => undefined);
    return Promise.reject(new FootballMatchOperationError('transport_unavailable'));
  }
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new FootballMatchOperationError('transport_unavailable')), remaining);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Source commits and room application have separate transactions and failure scopes. */
async function replaySavedRooms(input: {
  database: FootballMatchRepository;
  groupIds: string[] | null;
  token: string;
  generation: number;
  deadline: number;
  now: () => number;
  visited?: Set<string>;
}): Promise<{ processedRooms: number; failedRooms: number }> {
  const counts = { processedRooms: 0, failedRooms: 0 };
  if (input.deadline - input.now() < ROOM_PROCESSING_MARGIN_MS) {
    return counts;
  }
  const visited = input.visited ?? new Set<string>();
  let pendingRoomIds: string[];
  try {
    pendingRoomIds = await withDeadline(
      input.database.pendingRooms(input.groupIds),
      input.deadline - ROOM_PROCESSING_MARGIN_MS,
      input.now,
    );
  } catch {
    return counts;
  }
  const roomIds = [...new Set(pendingRoomIds)]
    .filter((roomId) => !visited.has(roomId))
    .slice(0, MAX_ROOMS_PER_PASS - visited.size);
  let nextRoomIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_ROOM_UPDATES, roomIds.length) }, async () => {
      while (
        nextRoomIndex < roomIds.length &&
        input.deadline - input.now() >= ROOM_PROCESSING_MARGIN_MS
      ) {
        const roomId = roomIds[nextRoomIndex++];
        visited.add(roomId);
        try {
          // Each worker processes one room at a time to preserve the shared concurrency limit.
          // react-doctor-disable-next-line react-doctor/async-await-in-loop
          const result = await input.database.processRoom(roomId, input.token, input.generation);
          if (result && typeof result === 'object' && 'ok' in result && result.ok === true) {
            counts.processedRooms++;
          } else {
            counts.failedRooms++;
          }
        } catch {
          counts.failedRooms++;
        }
      }
    }),
  );
  return counts;
}

async function discoverMatchesWithinDeadline(
  selection: MatchDiscoverySelection,
  dependencies: FootballMatchDependencies,
  deadline: number,
  now: () => number,
): Promise<MatchDiscoveryResult> {
  const { database } = dependencies;
  try {
    const prepared = preparedDiscoverySchema.safeParse(
      requireSuccessfulDatabaseResult(await database.prepareDiscovery(selection)),
    );
    if (!prepared.success) {
      throw new FootballMatchOperationError('transport_unavailable');
    }
    const preparedDiscovery = prepared.data;
    const groupIds = preparedDiscovery.workGroupIds;
    if (groupIds.length === 0) {
      return preparedDiscovery.result as unknown as MatchDiscoveryResult;
    }
    const generation = Number(preparedDiscovery.workerGeneration);
    const slot = await database.acquireSlot('discovery', generation);
    if (!slot.ok) {
      return database.readDiscovery(
        preparedDiscovery.selection as unknown as MatchDiscoverySelection,
      );
    }
    let outcome: 'completed' | 'failed' = 'completed';
    try {
      const counts = await acquireProviderGroups({
        ...dependencies,
        groupIds: groupIds,
        purpose: 'discovery',
        generation,
        workerToken: slot.dispatchToken,
        deadline,
        now,
      });
      if (counts.acceptedGroups > 0) {
        await replaySavedRooms({
          database,
          groupIds,
          token: slot.dispatchToken,
          generation,
          deadline,
          now,
        });
      }
    } catch {
      outcome = 'failed';
    } finally {
      await database.releaseSlot(slot.dispatchToken, generation, outcome);
    }
    return await database.readDiscovery(
      preparedDiscovery.selection as unknown as MatchDiscoverySelection,
    );
  } catch (error) {
    if (error instanceof FootballMatchOperationError) {
      throw error;
    }
    throw new FootballMatchOperationError('transport_unavailable');
  }
}

export function createFootballMatchService(dependencies: FootballMatchDependencies): FootballMatchService {
  const { database } = dependencies;
  const now = dependencies.now ?? Date.now;
  return {
    discoverMatches(selection) {
      const deadline = now() + OPERATION_TIMEOUT_MS;
      return withDeadline(
        discoverMatchesWithinDeadline(selection, dependencies, deadline, now),
        deadline,
        now,
      );
    },
    readSavedMatches(ids, options) {
      return database.readSaved(ids, options?.projection ?? 'live');
    },
    replaceSoloTracking(selection) {
      return withDeadline(
        replaceSoloTracking(selection, dependencies),
        now() + OPERATION_TIMEOUT_MS,
        now,
      );
    },
  };
}

interface MatchWorkInput {
  database: FootballMatchRepository;
  provider: FootballMatchDependencies['provider'];
  dispatchToken: string;
  generation: number;
  deadline: number;
  now?: () => number;
}

type MatchWorkCounts = AcquisitionCounts & { processedRooms: number; failedRooms: number };

async function runMonitorDispatch(
  input: MatchWorkInput,
  deadline: number,
  now: () => number,
): Promise<MatchWorkCounts> {
  const dispatch = await input.database.beginDispatch(input.dispatchToken, input.generation);
  if (!dispatch.ok) {
    throw new FootballMatchOperationError('not_permitted');
  }
  let outcome: 'completed' | 'failed' | 'deadline' = 'completed';
  try {
    const visited = new Set<string>();
    // Leave two seconds for existing accepted room gaps before beginning new HTTP.
    // Replay saved updates before acquisition, then replay newly accepted updates afterward.
    // react-doctor-disable-next-line react-doctor/async-parallel
    const firstReplay = await replaySavedRooms({
      database: input.database,
      groupIds: null,
      token: input.dispatchToken,
      generation: input.generation,
      deadline: Math.min(deadline, now() + PRELIMINARY_REPLAY_WINDOW_MS),
      now,
      visited,
    });
    const counts = await acquireProviderGroups({
      ...input,
      groupIds: dispatch.groupIds,
      purpose: 'live',
      workerToken: input.dispatchToken,
      deadline,
      now,
    });
    const replay = await replaySavedRooms({
      database: input.database,
      groupIds: null,
      token: input.dispatchToken,
      generation: input.generation,
      deadline,
      now,
      visited,
    });
    if (now() >= deadline) {
      outcome = 'deadline';
    }
    return {
      ...counts,
      processedRooms: firstReplay.processedRooms + replay.processedRooms,
      failedRooms: firstReplay.failedRooms + replay.failedRooms,
    };
  } catch (error) {
    outcome = 'failed';
    throw error;
  } finally {
    await input.database.releaseSlot(input.dispatchToken, input.generation, outcome);
  }
}

export async function runDueMatchWork(input: MatchWorkInput): Promise<MatchWorkCounts> {
  const now = input.now ?? Date.now;
  const deadline = Math.min(input.deadline, now() + OPERATION_TIMEOUT_MS);
  return withDeadline(runMonitorDispatch(input, deadline, now), deadline, now);
}

async function processClaimedRequest(
  claim: ClaimedRequest,
  input: ProviderAcquisitionInput,
  counts: AcquisitionCounts,
  now: () => number,
): Promise<void> {
  if (input.deadline - now() < NETWORK_WAVE_MIN_REMAINING_MS) {
    counts.deferredGroups++;
    return;
  }
  try {
    counts.attemptedGroups++;
    const response = await input.provider.read(claim.resource);
    if (!response.ok) {
      await input.database.fail(claim, response);
      counts.failedGroups++;
      return;
    }
    let projection: NormalizedScoreboard;
    try {
      projection =
        claim.resource.kind === 'summary'
          ? normalizeEspnSummary(
              response.data,
              claim.resource.leagueCode,
              claim.resource.sourceEventId,
            )
          : normalizeEspnScoreboard(response.data, claim.resource.leagueCode);
      if (
        claim.resource.kind === 'summary' &&
        (projection.matches.length !== 1 ||
          projection.matches[0].identity.sourceEventId !== claim.resource.sourceEventId)
      ) {
        throw new Error('invalid_provider_response');
      }
    } catch {
      await input.database.fail(claim, {
        ok: false,
        code: 'invalid_provider_response',
        status: response.status,
        scope: 'group',
        retryAfterSeconds: null,
      });
      counts.failedGroups++;
      return;
    }
    const accepted = await input.database.accept(claim, projection);
    if (accepted.ok) {
      counts.acceptedGroups++;
    } else {
      counts.deferredGroups++;
    }
  } catch {
    // A lost commit is ambiguous. Never refund or retry its reservation inline.
    counts.failedGroups++;
  }
}

interface ProviderAcquisitionInput {
  database: AcquisitionDatabase;
  provider: EspnHttpClient;
  groupIds: string[];
  purpose: RequestPurpose;
  generation: number;
  workerToken?: string;
  deadline: number;
  now?: () => number;
}

export async function acquireProviderGroups(
  input: ProviderAcquisitionInput,
): Promise<AcquisitionCounts> {
  const now = input.now ?? Date.now;
  const groupIds = [...new Set(input.groupIds)];
  if (!workGroupIdsSchema.safeParse(groupIds).success) {
    throw new Error('invalid_work_batch');
  }
  const counts: AcquisitionCounts = {
    attemptedGroups: 0,
    acceptedGroups: 0,
    deferredGroups: 0,
    failedGroups: 0,
  };
  if (groupIds.length === 0) {
    return counts;
  }
  if (input.deadline - now() < NETWORK_WAVE_MIN_REMAINING_MS) {
    return { ...counts, deferredGroups: groupIds.length };
  }
  const slot = input.workerToken
    ? { ok: true as const, dispatchToken: input.workerToken, workerGeneration: input.generation }
    : await input.database.acquireSlot(input.purpose, input.generation);
  if (!slot.ok) {
    return { ...counts, deferredGroups: groupIds.length };
  }
  try {
    const claims = await input.database.claimBatch(
      groupIds,
      input.purpose,
      slot.dispatchToken,
      input.generation,
    );
    if (claims.length > MAX_CONCURRENT_PROVIDER_REQUESTS) {
      throw new Error('invalid_database_result');
    }
    counts.deferredGroups = groupIds.length - claims.length;
    await Promise.all(claims.map((claim) => processClaimedRequest(claim, input, counts, now)));
  } finally {
    if (!input.workerToken) {
      let outcome: 'completed' | 'deadline' | 'failed' = 'completed';
      if (counts.failedGroups > 0) {
        outcome = 'failed';
      } else if (now() >= input.deadline) {
        outcome = 'deadline';
      }
      await input.database.releaseSlot(slot.dispatchToken, input.generation, outcome);
    }
  }
  return counts;
}
