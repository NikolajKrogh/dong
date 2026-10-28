import { getSupabaseClient } from '../../lib/supabase';
import type { MatchDiscoverySelection, SoloTrackingSelection } from '../../types/footballMatch';
import { FootballMatchError, toFootballMatchError } from './FootballMatchError';

export interface FootballMatchTransport {
  invoke(
    name: 'discover-matches' | 'solo-match-tracking',
    body: MatchDiscoverySelection | SoloTrackingSelection,
    signal?: AbortSignal,
  ): Promise<unknown>;
  readSaved(
    catalogMatchIds: string[],
    projection: 'live' | 'history',
    signal?: AbortSignal,
  ): Promise<unknown>;
  wait?(milliseconds: number, signal?: AbortSignal): Promise<void>;
  signal?: AbortSignal;
}

export function createSupabaseFootballMatchTransport(signal?: AbortSignal): FootballMatchTransport {
  let supabase: ReturnType<typeof getSupabaseClient>;
  try {
    supabase = getSupabaseClient();
  } catch {
    throw new FootballMatchError('configuration_required');
  }

  return {
    signal,
    async invoke(name, body, requestSignal) {
      const { data, error } = await supabase.functions.invoke(name, { body, signal: requestSignal });
      if (error) {
        if (error.context && typeof error.context.json === 'function') {
          const payload: unknown = await error.context.json().catch(() => null);
          throw toFootballMatchError(payload);
        }
        throw toFootballMatchError(error);
      }
      return data;
    },
    async readSaved(catalogMatchIds, projection, requestSignal) {
      const request = supabase.rpc('read_saved_matches', {
        catalog_match_ids: catalogMatchIds,
        projection,
      });
      const { data, error } = await (requestSignal ? request.abortSignal(requestSignal) : request);
      if (error) throw toFootballMatchError(error);
      return data;
    },
  };
}
