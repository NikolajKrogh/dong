import { useCallback, useMemo } from "react";

import type { AddRoomMatchRequest, RoomMatchSummary } from "../types/room";
import type { Match } from "../store/store";

/** Provider recorded for a fixture a host typed in by hand rather than picked from the catalogue. */
export const MANUAL_SOURCE_PROVIDER = "manual";

interface RoomMatchPoolOptions {
  /** The room's current pool, straight from the snapshot. */
  roomMatches: RoomMatchSummary[];
  addMatch: (request: AddRoomMatchRequest) => Promise<void>;
  removeMatch: (matchId: string) => Promise<void>;
}

export interface RoomMatchPool {
  /** The room pool in the shape `MatchList` renders. */
  matches: Match[];
  /**
   * Drop-in for the wizard's `setGlobalMatches`, reinterpreted as room mutations.
   *
   * `MatchList` and `useMatchProcessing` only ever call that setter in two ways:
   * with the current list plus new entries (append — `MatchList.tsx:224`,
   * `useMatchProcessing.ts:97`), or with `[]` to clear everything
   * (`MatchList.tsx:241`). So rather than attempting a general two-way diff — which
   * would need per-row identity the store shape does not carry — this handles
   * exactly those two cases and ignores anything else, which is why it can back a
   * server-owned pool safely.
   */
  setMatches: (next: Match[]) => void;
  removeMatch: (matchId: string) => void;
}

/** Provider recorded for a fixture taken from the discovery catalogue. */
export const CATALOGUE_SOURCE_PROVIDER = "espn";

const toDisplayMatch = (match: RoomMatchSummary): Match => ({
  id: match.id,
  homeTeam: match.homeTeamName,
  awayTeam: match.awayTeamName,
  homeGoals: match.homeScore,
  awayGoals: match.awayScore,
  startTime: match.kickoffAt ?? undefined,
});

/**
 * Recovers a fixture's provenance, which the store's `Match` shape cannot carry.
 *
 * The room pool needs to know whether a row came from the discovery catalogue —
 * that linkage is what lets scores be synced back later — but `Match` has no
 * provider field, so it has to be inferred from how the two code paths build it:
 *
 *  * discovered: `useMatchProcessing.ts:88` copies the catalogue's own id into
 *    `id` and always sets `startTime` from the fixture's kickoff.
 *  * typed by hand: `MatchList.tsx:216` uses `String(Date.now())` for `id` and
 *    sets no `startTime` at all.
 *
 * So the presence of `startTime` is the discriminator. A catalogue fixture with an
 * unknown kickoff would be filed as manual, losing its provider linkage but still
 * landing in the pool — the degradation is a missing score sync, not a lost match.
 * Passing provenance through explicitly needs `Match` to gain a source field,
 * which is the follow-up that removes this inference entirely.
 */
const toAddRequest = (match: Match): AddRoomMatchRequest =>
  match.startTime
    ? {
        sourceProvider: CATALOGUE_SOURCE_PROVIDER,
        sourceMatchId: match.id,
        homeTeamName: match.homeTeam,
        awayTeamName: match.awayTeam,
        kickoffAt: match.startTime,
      }
    : {
        // `source_match_id` is nullable and the pool's dedupe index is partial
        // (`WHERE source_match_id IS NOT NULL`), so manual rows coexist without
        // colliding — at the cost of no server-side dedupe for them.
        sourceProvider: MANUAL_SOURCE_PROVIDER,
        sourceMatchId: null,
        homeTeamName: match.homeTeam,
        awayTeamName: match.awayTeam,
        kickoffAt: null,
      };

/**
 * Backs the shared match-selection UI with a room's server-owned pool.
 *
 * Lets the lobby render the same `MatchList` the single-player wizard uses, where
 * the wizard's writes land in the Zustand store and these land on
 * `add_room_match` / `remove_room_match`. Nothing about `MatchList` changes.
 *
 * Writes are issued sequentially, not with `Promise.all`: `add_room_match` takes
 * the room row per call, and a burst of parallel writes would contend on that lock
 * for no gain. Sequential also means a mid-batch failure leaves the successful
 * adds committed, which matches how the host experiences it — the fixtures that
 * did land are really in the pool.
 */
export const useRoomMatchPool = ({
  roomMatches,
  addMatch,
  removeMatch,
}: RoomMatchPoolOptions): RoomMatchPool => {
  const matches = useMemo(
    () => roomMatches.map(toDisplayMatch),
    [roomMatches],
  );

  const setMatches = useCallback(
    (next: Match[]) => {
      if (next.length === 0) {
        // Clear-all. Snapshot the ids first: `roomMatches` is refreshed as the
        // removals land, so iterating it directly would skip entries.
        const ids = roomMatches.map((match) => match.id);
        void (async () => {
          for (const id of ids) {
            await removeMatch(id);
          }
        })();
        return;
      }

      // Append: everything in `next` that the room does not already hold. Compared
      // by id because both discovered and manual additions arrive with an id the
      // room pool has never seen (the catalogue's or a local timestamp).
      const known = new Set(roomMatches.map((match) => match.id));
      const added = next.filter((match) => !known.has(match.id));

      void (async () => {
        for (const match of added) {
          await addMatch(toAddRequest(match));
        }
      })();
    },
    [addMatch, removeMatch, roomMatches],
  );

  const handleRemove = useCallback(
    (matchId: string) => {
      void removeMatch(matchId);
    },
    [removeMatch],
  );

  return { matches, setMatches, removeMatch: handleRemove };
};
