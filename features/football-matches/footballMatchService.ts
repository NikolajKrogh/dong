import type {
  MatchAvailability,
  FootballMatchService,
  MatchDiscoveryResult,
  MatchDiscoverySelection,
  SavedMatchesResult,
} from '../../types/footballMatch';
import { FootballMatchError, toFootballMatchError } from './FootballMatchError';
import {
  MAX_SAVED_MATCH_IDS,
  normalizeSavedMatchIds,
  normalizeDiscoverySelection,
  normalizeSoloTrackingSelection,
  parseDiscoveryResponse,
  parseSavedMatchesResponse,
  parseSavedMatchProjection,
  parseSoloTrackingGrant,
} from './footballMatchSchemas';
import { createSupabaseFootballMatchTransport } from './footballMatchTransport';
import type { FootballMatchTransport } from './footballMatchTransport';

export { FootballMatchError } from './FootballMatchError';

const SAVED_MATCH_BATCH_SIZES = { live: MAX_SAVED_MATCH_IDS, history: 20 } as const;
const DISCOVERY_BATCH_SIZE = 16;
const MAX_DISCOVERY_FOLLOW_UPS = 2;
const MIN_DISCOVERY_RETRY_SECONDS = 15;
const MAX_FOREGROUND_RETRY_SECONDS = 60;
const MILLISECONDS_PER_SECOND = 1000;

function createAbortError(): Error {
  const error = new Error('Request canceled');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

function combineAvailability(values: MatchAvailability[]): MatchAvailability {
  if (values.every(value => value === 'available')) return 'available';
  if (values.some(value => value === 'available' || value === 'partial')) return 'partial';
  if (values.includes('pending')) return 'pending';
  if (values.includes('deferred')) return 'deferred';
  return 'unavailable';
}

function splitIntoBatches<T>(values: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let offset = 0; offset < values.length; offset += batchSize) {
    batches.push(values.slice(offset, offset + batchSize));
  }
  return batches;
}

function waitWithAbort(milliseconds: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    function handleAbort(): void {
      clearTimeout(timer);
      signal?.removeEventListener('abort', handleAbort);
      reject(createAbortError());
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

function hasPendingDiscovery(result: MatchDiscoveryResult): boolean {
  return result.availability === 'pending'
    || result.groups.some(group => group.availability === 'pending');
}

function getDiscoveryRetryDelaySeconds(result: MatchDiscoveryResult): number {
  return Math.max(
    MIN_DISCOVERY_RETRY_SECONDS,
    result.retryAfterSeconds ?? 0,
    ...result.groups.map(group => group.retryAfterSeconds ?? 0),
  );
}

function mergeSavedMatchResults(results: SavedMatchesResult[]): SavedMatchesResult {
  return {
    matches: results.flatMap(result => result.matches),
    missingCatalogMatchIds: [...new Set(results.flatMap(result => result.missingCatalogMatchIds))],
    availability: combineAvailability(results.map(result => result.availability)),
    retryAfterSeconds: null,
  };
}

function mergeDiscoveryResults(results: MatchDiscoveryResult[]): MatchDiscoveryResult {
  const matchesById = new Map(
    results.flatMap(result => result.matches).map(match => [match.catalogMatchId, match]),
  );
  const retryAfterSeconds = Math.max(0, ...results.map(result => result.retryAfterSeconds ?? 0));
  return {
    matches: [...matchesById.values()],
    groups: results.flatMap(result => result.groups),
    availability: combineAvailability(results.map(result => result.availability)),
    retryAfterSeconds: retryAfterSeconds || null,
  };
}

export function createFootballMatchService(transport: FootballMatchTransport): FootballMatchService {
  const { signal } = transport;

  async function runCancelableOperation<T>(operation: () => Promise<T>): Promise<T> {
    throwIfAborted(signal);
    try {
      const result = await operation();
      throwIfAborted(signal);
      return result;
    } catch (error) {
      throwIfAborted(signal);
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw toFootballMatchError(error);
    }
  }

  async function readSavedBatch(
    catalogMatchIds: string[],
    projection: 'live' | 'history',
  ): Promise<SavedMatchesResult[]> {
    try {
      const response = await runCancelableOperation(
        () => transport.readSaved(catalogMatchIds, projection, signal),
      );
      return [parseSavedMatchesResponse(response)];
    } catch (error) {
      const canSplitBatch = error instanceof FootballMatchError
        && error.code === 'projection_too_large'
        && catalogMatchIds.length > 1;
      if (!canSplitBatch) throw error;

      const midpoint = Math.ceil(catalogMatchIds.length / 2);
      const results = await Promise.all([
        readSavedBatch(catalogMatchIds.slice(0, midpoint), projection),
        readSavedBatch(catalogMatchIds.slice(midpoint), projection),
      ]);
      return results.flat();
    }
  }

  async function requestDiscovery(selection: MatchDiscoverySelection): Promise<MatchDiscoveryResult> {
    const response = await runCancelableOperation(
      () => transport.invoke('discover-matches', selection, signal),
    );
    return parseDiscoveryResponse(response);
  }

  async function discoverBatchWithFollowUps(
    selection: MatchDiscoverySelection,
  ): Promise<MatchDiscoveryResult> {
    let result = await requestDiscovery(selection);
    for (let followUp = 0; followUp < MAX_DISCOVERY_FOLLOW_UPS; followUp++) {
      if (!hasPendingDiscovery(result)) break;
      const retryAfterSeconds = getDiscoveryRetryDelaySeconds(result);
      // Return long deferrals instead of holding a foreground request indefinitely.
      if (retryAfterSeconds > MAX_FOREGROUND_RETRY_SECONDS) break;
      await runCancelableOperation(() => (transport.wait ?? waitWithAbort)(
        retryAfterSeconds * MILLISECONDS_PER_SECOND,
        signal,
      ));
      result = await requestDiscovery(selection);
    }
    return result;
  }

  return {
    async readSavedMatches(catalogMatchIds, options) {
      throwIfAborted(signal);
      const normalizedIds = normalizeSavedMatchIds(catalogMatchIds);
      const projection = parseSavedMatchProjection(options?.projection ?? 'live');
      const batches = splitIntoBatches(normalizedIds, SAVED_MATCH_BATCH_SIZES[projection]);
      const batchResults = await Promise.all(batches.map(batch => readSavedBatch(batch, projection)));
      return mergeSavedMatchResults(batchResults.flat());
    },

    async discoverMatches(selection) {
      throwIfAborted(signal);
      const { leagueCodes, date } = normalizeDiscoverySelection(selection);
      const batches = splitIntoBatches(leagueCodes, DISCOVERY_BATCH_SIZE);
      const results = await Promise.all(
        batches.map(batch => discoverBatchWithFollowUps({ leagueCodes: batch, date })),
      );
      return mergeDiscoveryResults(results);
    },

    async replaceSoloTracking(selection) {
      throwIfAborted(signal);
      const request = normalizeSoloTrackingSelection(selection);
      const response = await runCancelableOperation(
        () => transport.invoke('solo-match-tracking', request, signal),
      );
      return parseSoloTrackingGrant(response);
    },
  };
}

export function getFootballMatchService(options?: { signal?: AbortSignal }): FootballMatchService {
  return createFootballMatchService(createSupabaseFootballMatchTransport(options?.signal));
}
