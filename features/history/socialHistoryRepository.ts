import type { SupabaseClient } from '@supabase/supabase-js';
import * as z from 'zod/mini';
import { throwIfAborted } from '../../platform/abort';
import type { Database } from '../../types/database';
import type { GameSession } from '../../components/history/historyTypes';
import { mapCompletedSession } from './historyRepository';
import type { Person } from '../friends';

export interface AccountStats {
  account_id: string;
  username: string;
  games_participated: number;
  total_drinks: number;
  average_drinks: number | null;
}

interface SharedStats {
  shared_games: number;
  viewer_total_drinks: number;
  target_total_drinks: number;
  viewer_average_drinks: number | null;
  target_average_drinks: number | null;
  viewer_higher_count: number;
  target_higher_count: number;
  tied_count: number;
}

export interface TimelinePoint {
  session_id: string;
  completed_at: string;
  viewer_drinks: number;
  target_drinks: number;
  viewer_left_at: string | null;
  target_left_at: string | null;
}

export interface SocialPage<T> {
  items: T[];
  next_cursor: string | null;
}

export interface SocialHistory {
  scope: 'all_time_completed_online';
  viewer: AccountStats;
  target: AccountStats;
  shared: SharedStats;
  games: SocialPage<GameSession>;
}
const accountIdSchema = z.guid();
const dateInputSchema = z.coerce.date();
const dateStringSchema = z.string().check(
  z.refine(value => dateInputSchema.safeParse(value).success),
);
const trimmedNonBlankStringSchema = z.string().check(z.trim(), z.minLength(1));
const nonBlankStringSchema = z.string().check(
  z.refine(value => trimmedNonBlankStringSchema.safeParse(value).success),
);
const nonNegativeNumberSchema = z.number().check(z.nonnegative());
const countSchema = z.int().check(z.nonnegative());
const nullableDateStringSchema = z.nullable(dateStringSchema);
const nullableNonNegativeNumberSchema = z.nullable(nonNegativeNumberSchema);
const nullableAccountIdSchema = z.nullable(accountIdSchema);

const cursorPayloadSchema = z.object({
  session_id: accountIdSchema,
  completed_at: dateStringSchema,
});
const boundedCursorStringSchema = z.string().check(z.maxLength(300));
const cursorStringSchema = z.pipe(
  boundedCursorStringSchema,
  z.string().check(
    z.refine(value => {
      try {
        return cursorPayloadSchema.safeParse(JSON.parse(value)).success;
      } catch {
        return false;
      }
    }),
  ),
);
const cursorSchema = z.nullable(cursorStringSchema);

const accountStatsSchema = z.strictObject({
  account_id: accountIdSchema,
  username: nonBlankStringSchema,
  games_participated: countSchema,
  total_drinks: nonNegativeNumberSchema,
  average_drinks: nullableNonNegativeNumberSchema,
});

const sharedStatsSchema = z.object({
  shared_games: countSchema,
  viewer_total_drinks: nonNegativeNumberSchema,
  target_total_drinks: nonNegativeNumberSchema,
  viewer_average_drinks: nullableNonNegativeNumberSchema,
  target_average_drinks: nullableNonNegativeNumberSchema,
  viewer_higher_count: countSchema,
  target_higher_count: countSchema,
  tied_count: countSchema,
});

const playerSchema = z.object({
  id: accountIdSchema,
  name: z.string(),
  membershipType: z.enum(['registered', 'guest']),
  accountId: nullableAccountIdSchema,
  drinksTaken: nonNegativeNumberSchema,
  leftAt: nullableDateStringSchema,
});

const matchSchema = z.object({
  id: accountIdSchema,
  homeTeam: z.string(),
  awayTeam: z.string(),
  homeGoals: nonNegativeNumberSchema,
  awayGoals: nonNegativeNumberSchema,
  goals: nonNegativeNumberSchema,
});

const sharedGameSchema = z.object({
  session_id: accountIdSchema,
  completed_at: dateStringSchema,
  players: z.array(playerSchema),
  matches: z.array(matchSchema),
  player_assignments: z.record(z.string(), z.array(accountIdSchema)),
  common_match_id: nullableAccountIdSchema,
  matches_per_player: nonNegativeNumberSchema,
});

const timelinePointSchema = z.object({
  session_id: accountIdSchema,
  completed_at: dateStringSchema,
  viewer_drinks: nonNegativeNumberSchema,
  target_drinks: nonNegativeNumberSchema,
  viewer_left_at: nullableDateStringSchema,
  target_left_at: nullableDateStringSchema,
});

const socialHistorySchema = z.object({
  scope: z.literal('all_time_completed_online'),
  viewer: z.unknown(),
  target: z.unknown(),
  shared: z.unknown(),
  games: z.unknown(),
});

const coplayerContextSchema = z.object({
  account_id: accountIdSchema,
  username: nonBlankStringSchema,
  relationship: z.enum(['none', 'incoming', 'outgoing', 'friends']),
  request_id: nullableAccountIdSchema,
});

const createPageSchema = (limit: number) => z.object({
  items: z.array(z.unknown()).check(z.maxLength(limit)),
  next_cursor: cursorSchema,
});

const coplayerIdsSchema = z.array(accountIdSchema).check(z.maxLength(100));
const coplayerRowsSchema = z.array(coplayerContextSchema).check(z.maxLength(100));

export function isAccountId(value: unknown): value is string {
  return accountIdSchema.safeParse(value).success;
}

const throwInvalidSocialHistoryResponse = (): never => {
  throw new Error('Invalid social history response.');
};

const parseAverage = (value: number | null, games: number): number | null => {
  if (games === 0 && value !== null) return throwInvalidSocialHistoryResponse();
  if (games > 0 && value === null) return throwInvalidSocialHistoryResponse();
  return value;
};

const parseAccountStats = (value: unknown, id: string): AccountStats => {
  const result = accountStatsSchema.safeParse(value);
  if (!result.success || result.data.account_id !== id || !isAccountId(id)) {
    return throwInvalidSocialHistoryResponse();
  }

  const row = result.data;
  const gamesParticipated = row.games_participated;
  const totalDrinks = row.total_drinks;
  if (gamesParticipated === 0 && totalDrinks !== 0) {
    return throwInvalidSocialHistoryResponse();
  }

  return {
    account_id: id,
    username: row.username,
    games_participated: gamesParticipated,
    total_drinks: totalDrinks,
    average_drinks: parseAverage(row.average_drinks, gamesParticipated),
  };
};

const parseSharedStats = (value: unknown): SharedStats => {
  const result = sharedStatsSchema.safeParse(value);
  if (!result.success) return throwInvalidSocialHistoryResponse();

  const row = result.data;
  const games = row.shared_games;
  const viewerHigherCount = row.viewer_higher_count;
  const targetHigherCount = row.target_higher_count;
  const tiedCount = row.tied_count;
  const viewerTotalDrinks = row.viewer_total_drinks;
  const targetTotalDrinks = row.target_total_drinks;

  if (
    viewerHigherCount + targetHigherCount + tiedCount !== games
    || (games === 0 && (viewerTotalDrinks !== 0 || targetTotalDrinks !== 0))
  ) {
    return throwInvalidSocialHistoryResponse();
  }

  return {
    shared_games: games,
    viewer_total_drinks: viewerTotalDrinks,
    target_total_drinks: targetTotalDrinks,
    viewer_average_drinks: parseAverage(row.viewer_average_drinks, games),
    target_average_drinks: parseAverage(row.target_average_drinks, games),
    viewer_higher_count: viewerHigherCount,
    target_higher_count: targetHigherCount,
    tied_count: tiedCount,
  };
};
const parseSharedGame = (value: unknown, viewerId: string, targetId: string): GameSession => {
  const result = sharedGameSchema.safeParse(value);
  if (!result.success) return throwInvalidSocialHistoryResponse();

  const row = result.data;
  if (row.players.some(player => player.membershipType === 'guest' && player.accountId !== null)) {
    return throwInvalidSocialHistoryResponse();
  }

  if (![viewerId, targetId].every(id => row.players.some(player => player.accountId === id))) {
    return throwInvalidSocialHistoryResponse();
  }

  return mapCompletedSession(row);
};

const parseTimelinePoint = (value: unknown): TimelinePoint => {
  const result = timelinePointSchema.safeParse(value);
  if (!result.success) return throwInvalidSocialHistoryResponse();
  return result.data;
};

function parsePage<T>(value: unknown, parse: (item: unknown) => T, limit: number): SocialPage<T> {
  const result = createPageSchema(limit).safeParse(value);
  if (!result.success) return throwInvalidSocialHistoryResponse();

  return { items: result.data.items.map(parse), next_cursor: result.data.next_cursor };
}

export function parseSocialHistory(value: unknown, viewerId: string, targetId: string): SocialHistory {
  const result = socialHistorySchema.safeParse(value);
  if (!result.success || viewerId === targetId) {
    return throwInvalidSocialHistoryResponse();
  }

  const row = result.data;
  return {
    scope: 'all_time_completed_online',
    viewer: parseAccountStats(row.viewer, viewerId),
    target: parseAccountStats(row.target, targetId),
    shared: parseSharedStats(row.shared),
    games: parsePage(row.games, item => parseSharedGame(item, viewerId, targetId), 50),
  };
}
const messages: Record<string, string> = {
  PGRST202: 'Shared statistics are not available yet. Please try again later.',
  authentication_required: 'Sign in to view shared history.',
  username_required: 'Sign in and choose a username to view shared history.',
  target_unavailable: 'This shared history is unavailable.',
  comparison_not_allowed: 'Shared history is only available for current friends.',
  invalid_input: 'This shared history link is invalid.',
};

export const SOCIAL_HISTORY_CONNECTION_ERROR = 'Could not connect. Retry to check access and load shared history.';

export class SocialHistoryError extends Error {
  constructor(public code: string) {
    super(messages[code] ?? SOCIAL_HISTORY_CONNECTION_ERROR);
  }
}

type SupabaseDatabaseClient = SupabaseClient<Database>;

export async function loadPersonalHistoryStats(
  client: SupabaseDatabaseClient,
  accountId: string,
  signal: AbortSignal,
): Promise<AccountStats> {
  throwIfAborted(signal);
  const { data, error } = await client
    .rpc('get_personal_history_stats')
    .abortSignal(signal);

  return parseAccountStats(requireRpcData(data, error, signal), accountId);
}

function requireRpcData(
  data: unknown,
  error: { message: string; code?: string } | null,
  signal: AbortSignal,
): unknown {
  throwIfAborted(signal);
  if (error) {
    throw new SocialHistoryError(error.code === 'PGRST202' ? 'PGRST202' : error.message);
  }
  if (data === null) return throwInvalidSocialHistoryResponse();

  return data;
}

export async function loadSocialHistory(
  client: SupabaseDatabaseClient,
  viewerId: string,
  targetId: string,
  signal: AbortSignal,
): Promise<SocialHistory> {
  throwIfAborted(signal);
  const { data, error } = await client
    .rpc('get_social_history', { target_account_id: targetId, page_size: 20 })
    .abortSignal(signal);

  return parseSocialHistory(requireRpcData(data, error, signal), viewerId, targetId);
}

export async function loadSharedGames(
  client: SupabaseDatabaseClient,
  viewerId: string,
  targetId: string,
  cursor: string,
  signal: AbortSignal,
): Promise<SocialPage<GameSession>> {
  throwIfAborted(signal);
  const { data, error } = await client
    .rpc('list_social_shared_games', { target_account_id: targetId, cursor, page_size: 20 })
    .abortSignal(signal);

  return parsePage(requireRpcData(data, error, signal), item => parseSharedGame(item, viewerId, targetId), 20);
}

export async function loadSharedTimeline(
  client: SupabaseDatabaseClient,
  targetId: string,
  cursor: string | null,
  signal: AbortSignal,
): Promise<SocialPage<TimelinePoint>> {
  throwIfAborted(signal);
  const { data, error } = await client
    .rpc('list_social_shared_timeline', {
      target_account_id: targetId,
      cursor: cursor ?? undefined,
      page_size: 50,
    })
    .abortSignal(signal);

  return parsePage(requireRpcData(data, error, signal), parseTimelinePoint, 50);
}

export async function loadCoplayerContext(
  client: SupabaseDatabaseClient,
  ids: string[],
  signal: AbortSignal,
): Promise<Person[]> {
  if (!coplayerIdsSchema.safeParse(ids).success) {
    return throwInvalidSocialHistoryResponse();
  }

  throwIfAborted(signal);
  const { data, error } = await client
    .rpc('get_history_coplayer_context', { target_account_ids: ids })
    .abortSignal(signal);
  const rows = requireRpcData(data, error, signal);
  const result = coplayerRowsSchema.safeParse(rows);

  if (!result.success) return throwInvalidSocialHistoryResponse();

  const requestedIds = new Set(ids);
  return result.data.map(row => {
    if (!requestedIds.has(row.account_id)) return throwInvalidSocialHistoryResponse();
    return row;
  });
}
