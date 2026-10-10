import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database";
import { throwIfAborted } from "../../platform/abort";
import * as z from "zod/mini";

import type { GameSession, Match, Player } from "../../components/history/historyTypes";

const HISTORY_PAGE_SIZE = 500;

export interface CloudHistoryData {
  sessions: GameSession[];
}

type CompletedSessionSummaryRow = Pick<Database['public']['Views']['completed_session_summaries']['Row'], 'session_id' | 'completed_at' | 'common_match_id' | 'matches_per_player' | 'players' | 'matches' | 'player_assignments'>;
type EarlyLeaveRow = Database['public']['Views']['early_leave_results']['Row'];

interface PageResult<T> {
  data: T[] | null;
  error: unknown | null;
}

type PageRequest<T> = (
  from: number,
  to: number,
) => PromiseLike<PageResult<T>>;

const recordSchema = z.record(z.string(), z.unknown());
const recordOrEmptySchema = z.catch(recordSchema, {});
const stringSchema = z.string();
const stringOrEmptySchema = z.catch(stringSchema, "");
const nullableStringOrNullSchema = z.catch(z.nullable(stringSchema), null);
const numberOrZeroSchema = z.catch(z.number(), 0);
const arrayOrEmptySchema = z.catch(z.array(z.unknown()), []);
const membershipTypeOrUndefinedSchema = z.catch(
  z.optional(z.enum(["registered", "guest"])),
  undefined,
);
const nonEmptyStringSchema = stringSchema.check(z.minLength(1));
const dateSchema = z.coerce.date();
const departureTimestampSchema = stringSchema.check(
  z.refine<string>((value) => dateSchema.safeParse(value).success),
);

const departureResultSchema = z.looseObject({
  sessionId: stringSchema,
  state: z.literal("in_progress"),
  participants: z.array(z.unknown()),
  matches: z.array(z.unknown()),
  assignments: z.array(z.unknown()),
  assignmentPlan: recordSchema,
});
const departureParticipantSchema = z.looseObject({ id: stringSchema });
const departureMatchSchema = z.looseObject({ id: stringSchema });
const departureAssignmentSchema = z.looseObject({
  participantId: z.unknown(),
  matchId: stringSchema,
});

const earlyLeaveRowSchema = z.object({
  session_id: nonEmptyStringSchema,
  left_at: stringSchema,
});

const mapPlayer = (value: unknown): Player => {
  const player = recordOrEmptySchema.parse(value);
  return {
    id: stringOrEmptySchema.parse(player.id),
    name: stringOrEmptySchema.parse(player.name),
    drinksTaken: numberOrZeroSchema.parse(player.drinksTaken),
    accountId: nullableStringOrNullSchema.parse(player.accountId),
    membershipType: membershipTypeOrUndefinedSchema.parse(player.membershipType),
    leftAt: nullableStringOrNullSchema.parse(player.leftAt),
  };
};

const mapMatch = (value: unknown): Match => {
  const match = recordOrEmptySchema.parse(value);
  return {
    id: stringOrEmptySchema.parse(match.id),
    homeTeam: stringOrEmptySchema.parse(match.homeTeam),
    awayTeam: stringOrEmptySchema.parse(match.awayTeam),
    homeGoals: numberOrZeroSchema.parse(match.homeGoals),
    awayGoals: numberOrZeroSchema.parse(match.awayGoals),
    goals: numberOrZeroSchema.parse(match.goals),
  };
};

const mapAssignments = (value: unknown): Record<string, string[]> => {
  const assignments = recordOrEmptySchema.parse(value);

  return Object.fromEntries(
    Object.entries(assignments).map(([playerId, matchIds]) => [
      playerId,
      arrayOrEmptySchema.parse(matchIds).flatMap((matchId) => {
        const parsedMatchId = stringSchema.safeParse(matchId);
        return parsedMatchId.success ? [parsedMatchId.data] : [];
      }),
    ]),
  );
};

export const mapCompletedSession = (row: CompletedSessionSummaryRow): GameSession => ({
  id: row.session_id ?? "",
  date: row.completed_at ?? "",
  players: arrayOrEmptySchema.parse(row.players).map(mapPlayer),
  matches: arrayOrEmptySchema.parse(row.matches).map(mapMatch),
  commonMatchId: row.common_match_id,
  playerAssignments: mapAssignments(row.player_assignments),
  matchesPerPlayer: numberOrZeroSchema.parse(row.matches_per_player),
});

/** Maps the server's immutable departure capture into the existing history shape. */
export const mapDepartureResult = (
  sessionId: string,
  leftAt: string,
  value: unknown,
): GameSession => {
  const parsedDeparture = departureResultSchema.safeParse(value);
  if (!parsedDeparture.success
    || parsedDeparture.data.sessionId !== sessionId
    || !departureTimestampSchema.safeParse(leftAt).success) {
    throw new Error("Invalid departure result.");
  }

  const departure = parsedDeparture.data;
  const players: Player[] = departure.participants.map((item) => {
    const participant = departureParticipantSchema.safeParse(item);
    if (!participant.success) {
      throw new Error("Invalid departure participant.");
    }
    return {
      id: participant.data.id,
      name: stringOrEmptySchema.parse(participant.data.displayName),
      drinksTaken: numberOrZeroSchema.parse(participant.data.currentDrinkTotal),
      membershipType: membershipTypeOrUndefinedSchema.parse(participant.data.membershipType),
      leftAt: nullableStringOrNullSchema.parse(participant.data.leftAt),
    };
  });
  const matches: Match[] = departure.matches.map((item) => {
    const match = departureMatchSchema.safeParse(item);
    if (!match.success) {
      throw new Error("Invalid departure match.");
    }
    const homeGoals = numberOrZeroSchema.parse(match.data.homeScore);
    const awayGoals = numberOrZeroSchema.parse(match.data.awayScore);
    return {
      id: match.data.id,
      homeTeam: stringOrEmptySchema.parse(match.data.homeTeamName),
      awayTeam: stringOrEmptySchema.parse(match.data.awayTeamName),
      homeGoals,
      awayGoals,
      goals: homeGoals + awayGoals,
    };
  });
  const commonMatchId = nullableStringOrNullSchema.parse(departure.commonMatchId);
  const playerAssignments = Object.fromEntries(players.map((player) => [
    player.id,
    departure.assignments.flatMap((item) => {
      const assignment = departureAssignmentSchema.safeParse(item);
      if (!assignment.success
        || assignment.data.participantId !== player.id
        || assignment.data.matchId === commonMatchId) {
        return [];
      }
      return [assignment.data.matchId];
    }),
  ]));

  return {
    id: sessionId,
    date: leftAt,
    players,
    matches,
    commonMatchId,
    playerAssignments,
    matchesPerPlayer: numberOrZeroSchema.parse(departure.assignmentPlan.matchesPerPlayer),
    isEarlyLeaveResult: true,
  };
};

const readAllPages = async <T>(requestPage: PageRequest<T>, signal?: AbortSignal): Promise<T[]> => {
  const rows: T[] = [];

  for (let from = 0; ; from += HISTORY_PAGE_SIZE) {
    throwIfAborted(signal);
    const { data, error } = await requestPage(from, from + HISTORY_PAGE_SIZE - 1);
    throwIfAborted(signal);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);
    if (page.length < HISTORY_PAGE_SIZE) return rows;
  }
};

/** Loads the current user's completed and frozen departure history as one dataset. */
export const loadCloudHistory = async (
  client: SupabaseClient<Database>,
  signal: AbortSignal = new AbortController().signal,
): Promise<CloudHistoryData> => {
  const [summaryRows, earlyLeaveRows] = await Promise.all([
    readAllPages<CompletedSessionSummaryRow>((from, to) =>
      client
        .from("completed_session_summaries")
        .select(
          "session_id, completed_at, common_match_id, matches_per_player, players, matches, player_assignments",
        )
        .order("session_id", { ascending: true })
        .range(from, to).abortSignal(signal), signal,
    ),
    readAllPages<EarlyLeaveRow>((from, to) =>
      client
        .from("early_leave_results")
        .select("session_id, left_at, snapshot")
        .order("session_id", { ascending: true })
        .range(from, to).abortSignal(signal), signal,
    ),
  ]);

  return {
    sessions: [
      ...earlyLeaveRows
        .filter((row): row is EarlyLeaveRow & { session_id: string; left_at: string } =>
          earlyLeaveRowSchema.safeParse(row).success,
        )
        .map((row) => mapDepartureResult(row.session_id, row.left_at, row.snapshot)),
      ...summaryRows
        .filter((row) => nonEmptyStringSchema.safeParse(row.session_id).success)
        .map(mapCompletedSession),
    ],
  };
};

/**
 * Keeps local-only sessions while replacing cloud copies by stable IDs and
 * canonical cloud snapshots. Names and dates are deliberately not identities.
 */
export const mergeHistory = (
  localHistory: readonly GameSession[],
  cloudHistory: readonly GameSession[],
): GameSession[] => {
  // Offset pagination can return the same row on adjacent pages if a new
  // completion is inserted between requests. Collapse those rows by their
  // canonical ID before merging.
  const canonicalCloudHistory = Array.from(
    new Map(cloudHistory.map((session) => [session.id, session])).values(),
  );
  const cloudIds = new Set(canonicalCloudHistory.map((session) => session.id));

  return [
    ...localHistory.filter(
      (session) =>
        cloudIds.has(session.id) === false,
    ),
    ...canonicalCloudHistory,
  ];
};
