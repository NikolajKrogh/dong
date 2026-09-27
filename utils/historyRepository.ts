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
  return {
    id: readString(player.id),
    name: readString(player.name),
    drinksTaken: readNumber(player.drinksTaken),
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
  const [summaryRows, importLinks] = await Promise.all([
    readAllPages<CompletedSessionSummaryRow>((from, to) =>
      client
        .from("completed_session_summaries")
        .select(
          "session_id, completed_at, common_match_id, matches_per_player, players, matches, player_assignments",
        )
        .order("session_id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<PageResult<CompletedSessionSummaryRow>>,
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
    sessions: summaryRows
      .filter((row) => typeof row.session_id === "string" && row.session_id.length > 0)
      .map(mapCompletedSession),
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
