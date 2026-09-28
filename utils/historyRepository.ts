import type { SupabaseClient } from "@supabase/supabase-js";

import type { GameSession, Match, Player } from "../components/history/historyTypes";

const HISTORY_PAGE_SIZE = 500;

export interface HistoryImportLink {
  source_local_session_id: string;
  cloud_session_id: string;
}

export interface CloudHistoryData {
  sessions: GameSession[];
  importLinks: HistoryImportLink[];
}

interface CompletedSessionSummaryRow {
  session_id: string;
  completed_at: string | null;
  common_match_id: string | null;
  matches_per_player: number | null;
  players: unknown;
  matches: unknown;
  player_assignments: unknown;
}

interface EarlyLeaveRow {
  session_id: string;
  left_at: string;
  snapshot: unknown;
}

interface PageResult<T> {
  data: T[] | null;
  error: unknown | null;
}

type PageRequest<T> = (
  from: number,
  to: number,
) => PromiseLike<PageResult<T>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && Array.isArray(value) === false;

const readString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const readNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const mapPlayer = (value: unknown): Player => {
  const player = isRecord(value) ? value : {};
  const membershipType =
    player.membershipType === "registered" || player.membershipType === "guest"
      ? player.membershipType
      : undefined;
  return {
    id: readString(player.id),
    name: readString(player.name),
    drinksTaken: readNumber(player.drinksTaken),
    accountId:
      typeof player.accountId === "string" ? player.accountId : null,
    membershipType,
    leftAt: typeof player.leftAt === "string" ? player.leftAt : null,
  };
};

const mapMatch = (value: unknown): Match => {
  const match = isRecord(value) ? value : {};
  return {
    id: readString(match.id),
    homeTeam: readString(match.homeTeam),
    awayTeam: readString(match.awayTeam),
    homeGoals: readNumber(match.homeGoals),
    awayGoals: readNumber(match.awayGoals),
    goals: readNumber(match.goals),
  };
};

const mapAssignments = (value: unknown): Record<string, string[]> => {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).map(([playerId, matchIds]) => [
      playerId,
      readArray(matchIds).filter(
        (matchId): matchId is string => typeof matchId === "string",
      ),
    ]),
  );
};

const mapCompletedSession = (row: CompletedSessionSummaryRow): GameSession => ({
  id: row.session_id,
  date: row.completed_at ?? "",
  players: readArray(row.players).map(mapPlayer),
  matches: readArray(row.matches).map(mapMatch),
  commonMatchId: row.common_match_id,
  playerAssignments: mapAssignments(row.player_assignments),
  matchesPerPlayer: readNumber(row.matches_per_player),
});

/** Maps the server's immutable departure capture into the existing history shape. */
export const mapDepartureResult = (
  sessionId: string,
  leftAt: string,
  value: unknown,
): GameSession => {
  if (!isRecord(value) || value.sessionId !== sessionId
    || value.state !== "in_progress"
    || !Array.isArray(value.participants)
    || !Array.isArray(value.matches)
    || !Array.isArray(value.assignments)
    || !isRecord(value.assignmentPlan)
    || !Number.isFinite(Date.parse(leftAt))) {
    throw new Error("Invalid departure result.");
  }

  const players: Player[] = value.participants.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string") {
      throw new Error("Invalid departure participant.");
    }
    return {
      id: item.id,
      name: readString(item.displayName),
      drinksTaken: readNumber(item.currentDrinkTotal),
      membershipType: item.membershipType === "registered" || item.membershipType === "guest"
        ? item.membershipType : undefined,
      leftAt: typeof item.leftAt === "string" ? item.leftAt : null,
    };
  });
  const matches: Match[] = value.matches.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string") {
      throw new Error("Invalid departure match.");
    }
    const homeGoals = readNumber(item.homeScore);
    const awayGoals = readNumber(item.awayScore);
    return {
      id: item.id,
      homeTeam: readString(item.homeTeamName),
      awayTeam: readString(item.awayTeamName),
      homeGoals,
      awayGoals,
      goals: homeGoals + awayGoals,
    };
  });
  const assignments = value.assignments as unknown[];
  const playerAssignments = Object.fromEntries(players.map((player) => [
    player.id,
    assignments
      .filter((item): item is Record<string, unknown> => isRecord(item)
        && item.participantId === player.id
        && typeof item.matchId === "string")
      .map((item) => item.matchId as string)
      .filter((id) => id !== value.commonMatchId),
  ]));

  return {
    id: sessionId,
    date: leftAt,
    players,
    matches,
    commonMatchId: typeof value.commonMatchId === "string" ? value.commonMatchId : null,
    playerAssignments,
    matchesPerPlayer: readNumber(value.assignmentPlan.matchesPerPlayer),
    isEarlyLeaveResult: true,
  };
};

const readAllPages = async <T>(requestPage: PageRequest<T>): Promise<T[]> => {
  const rows: T[] = [];

  for (let from = 0; ; from += HISTORY_PAGE_SIZE) {
    const { data, error } = await requestPage(from, from + HISTORY_PAGE_SIZE - 1);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);
    if (page.length < HISTORY_PAGE_SIZE) return rows;
  }
};

/** Loads the current user's completed history and import links as one dataset. */
export const loadCloudHistory = async (
  client: SupabaseClient,
): Promise<CloudHistoryData> => {
  const [summaryRows, earlyLeaveRows, importLinks] = await Promise.all([
    readAllPages<CompletedSessionSummaryRow>((from, to) =>
      client
        .from("completed_session_summaries")
        .select(
          "session_id, completed_at, common_match_id, matches_per_player, players, matches, player_assignments",
        )
        .order("session_id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<PageResult<CompletedSessionSummaryRow>>,
    ),
    readAllPages<EarlyLeaveRow>((from, to) =>
      client
        .from("early_leave_results")
        .select("session_id, left_at, snapshot")
        .order("session_id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<PageResult<EarlyLeaveRow>>,
    ),
    readAllPages<HistoryImportLink>((from, to) =>
      client
        .rpc("get_history_import_links")
        .order("source_local_session_id", { ascending: true })
        .order("cloud_session_id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<PageResult<HistoryImportLink>>,
    ),
  ]);

  return {
    sessions: [
      ...earlyLeaveRows
        .filter((row) => typeof row.session_id === "string" && row.session_id.length > 0)
        .map((row) => mapDepartureResult(row.session_id, row.left_at, row.snapshot)),
      ...summaryRows
        .filter((row) => typeof row.session_id === "string" && row.session_id.length > 0)
        .map(mapCompletedSession),
    ],
    importLinks: importLinks.filter(
      (link) =>
        typeof link.source_local_session_id === "string" &&
        link.source_local_session_id.length > 0 &&
        typeof link.cloud_session_id === "string" &&
        link.cloud_session_id.length > 0,
    ),
  };
};

/**
 * Keeps local-only sessions while replacing cloud copies by stable IDs and
 * successful import links. Names and dates are deliberately not identities.
 */
export const mergeHistory = (
  localHistory: readonly GameSession[],
  cloudHistory: readonly GameSession[],
  importLinks: readonly HistoryImportLink[],
): GameSession[] => {
  // Offset pagination can return the same row on adjacent pages if a new
  // completion is inserted between requests. Collapse those rows by their
  // canonical ID before merging.
  const canonicalCloudHistory = Array.from(
    new Map(cloudHistory.map((session) => [session.id, session])).values(),
  );
  const cloudIds = new Set(canonicalCloudHistory.map((session) => session.id));
  const linkedLocalIds = new Set(
    importLinks
      .filter((link) => cloudIds.has(link.cloud_session_id))
      .map((link) => link.source_local_session_id),
  );

  return [
    ...localHistory.filter(
      (session) =>
        cloudIds.has(session.id) === false &&
        linkedLocalIds.has(session.id) === false,
    ),
    ...canonicalCloudHistory,
  ];
};
