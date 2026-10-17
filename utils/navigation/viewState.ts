import { isAccountId } from "../../features/history/socialHistoryRepository";

export type RouteParams = Record<string, string | string[] | undefined>;
export const SOLO_STEPS = ["players", "matches", "common", "assign"] as const;
export const LOBBY_STEPS = ["room", "matches", "common", "assign"] as const;
export type SoloStep = typeof SOLO_STEPS[number];
export type LobbyStep = typeof LOBBY_STEPS[number];
export type FriendsTab = "friends" | "requests";
export type HistoryTab = "games" | "players" | "stats";
export type HistorySort = "date" | "players" | "drinks" | "goals" | "matches";
export interface HistoryRouteState {
  tab: HistoryTab;
  friendId: string;
  gameId: string;
  sort: HistorySort;
  direction: "asc" | "desc";
}

function single(value: RouteParams[string]): string {
  return typeof value === "string" && value.length <= 256 ? value.trim() : "";
}
function choice<T extends string>(value: RouteParams[string], allowed: readonly T[], fallback: T): T {
  const normalized = single(value);
  return allowed.includes(normalized as T) ? normalized as T : fallback;
}
export const parseFriendsTab = (params: RouteParams): FriendsTab => choice(params.tab, ["friends", "requests"], "friends");
export const parseSoloStep = (params: RouteParams): SoloStep => choice(params.step, SOLO_STEPS, "players");
export const parseLobbyStep = (params: RouteParams): LobbyStep => choice(params.step, LOBBY_STEPS, "room");

export function parseHistoryState(params: RouteParams, selfId?: string | null): HistoryRouteState {
  const friend = single(params.friendId);
  const friendId = isAccountId(friend) && friend.toLowerCase() !== selfId?.toLowerCase() ? friend.toLowerCase() : "";
  const tab = choice(params.tab, ["games", "players", "stats"], params.tab === undefined && isAccountId(friend) ? "stats" : "games");
  const gameId = single(params.gameId);
  return {
    tab,
    friendId: tab === "stats" ? friendId : "",
    // Local completed games use timestamp/string IDs, not account UUIDs.
    gameId: tab === "games" && /^[a-zA-Z0-9_-]{1,128}$/.test(gameId) ? gameId : "",
    sort: choice(params.sort, ["date", "players", "drinks", "goals", "matches"], "date"),
    direction: choice(params.direction, ["asc", "desc"], "desc"),
  };
}

/** Canonicalize only the caller's view keys; keep unrelated route context. */
export function withViewParams(params: RouteParams, owned: Record<string, string | undefined>): RouteParams {
  const result = { ...params };
  for (const [key, value] of Object.entries(owned)) {
    if (value) result[key] = value;
    else delete result[key];
  }
  return result;
}
export function historyParams(state: HistoryRouteState): Record<string, string | undefined> {
  return { tab: state.tab === "games" ? undefined : state.tab,
    friendId: state.friendId || undefined, gameId: state.gameId || undefined,
    sort: state.sort === "date" ? undefined : state.sort,
    direction: state.direction === "desc" ? undefined : state.direction };
}
export function sameViewParams(left: RouteParams, right: RouteParams): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every(key => left[key] === right[key]);
}
/** Restoration validates prerequisites once; live editing must not be clamped. */
export function resolveStep<T extends string>(requested: T, keys: readonly T[], canEnter: readonly boolean[]): T {
  const requestedIndex = keys.indexOf(requested);
  const blocked = canEnter.findIndex((allowed, index) => index <= requestedIndex && !allowed);
  return blocked > 0 ? keys[blocked - 1] : keys[Math.max(0, requestedIndex)];
}
