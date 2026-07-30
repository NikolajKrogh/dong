import { useCallback, useMemo } from "react";

import type {
  AddRoomMatchRequest,
  BatchRoomMatchResult,
  RoomMatchSummary,
} from "../types/room";
import type { Match } from "../store/store";

/** Provider recorded for a fixture a host typed in by hand rather than picked from the catalogue. */
export const MANUAL_SOURCE_PROVIDER = "manual";

interface RoomMatchPoolOptions {
  /** The room's current pool, straight from the snapshot. */
  roomMatches: RoomMatchSummary[];
  /** Batched add. Resolves to null when the batch failed; the caller holds the reason. */
  addMatches: (
    requests: AddRoomMatchRequest[],
  ) => Promise<BatchRoomMatchResult | null>;
  /** Single removal, for a per-match Remove control. */
  removeMatch: (matchId: string) => Promise<void>;
  /** Batched removal, used by clear-all. */
  removeMatches: (matchIds: string[]) => Promise<void>;
  /** Notified after a successful batch so the caller can report added/skipped counts. */
  onBatchAdded?: (result: BatchRoomMatchResult) => void;
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
  kickoffAt: match.kickoffAt ?? undefined,
});

/**
 * Recovers a fixture's provenance, which the store's `Match` shape does not state
 * outright.
 *
 * The room needs to know whether a row came from the discovery catalogue, because
 * that linkage is what lets scores be synced back later. `kickoffAt` is the
 * discriminator: match discovery populates it with the provider's ISO instant
 * (`useMatchProcessing`), while a fixture typed by hand has no kickoff at all.
 *
 * Deliberately NOT keyed on `startTime`, which looks like the obvious choice and is
 * wrong twice over: discovery puts a *local* `"HH:MM"` display string there, so it
 * is neither a valid `timestamptz` — passing it to `add_room_match` fails the
 * insert, which is exactly the bug this replaced — nor safely reassembled from the
 * accompanying UTC `date`.
 */
const toAddRequest = (match: Match): AddRoomMatchRequest =>
  match.kickoffAt
    ? {
        sourceProvider: CATALOGUE_SOURCE_PROVIDER,
        sourceMatchId: match.id,
        homeTeamName: match.homeTeam,
        awayTeamName: match.awayTeam,
        kickoffAt: match.kickoffAt,
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
 * the wizard's writes land in the Zustand store and these land on the room's
 * match RPCs. Nothing about `MatchList` changes.
 *
 * Both bulk gestures issue exactly one call. They used to loop the singular RPCs,
 * which cost a room-row lock and a full snapshot refresh per fixture, and — because
 * the caller resets its error slot on every call — silently swallowed any failure
 * that was not the last one. Batching removes both problems at once.
 */
export const useRoomMatchPool = ({
  roomMatches,
  addMatches,
  removeMatch,
  removeMatches,
  onBatchAdded,
}: RoomMatchPoolOptions): RoomMatchPool => {
  const matches = useMemo(
    () => roomMatches.map(toDisplayMatch),
    [roomMatches],
  );

  const setMatches = useCallback(
    (next: Match[]) => {
      if (next.length === 0) {
        // Clear-all. Ids are snapshotted before the call because `roomMatches` is
        // replaced by the refresh that follows it.
        void removeMatches(roomMatches.map((match) => match.id));
        return;
      }

      // Append: everything in `next` that the room does not already hold. Compared
      // by id because both discovered and manual additions arrive with an id the
      // room pool has never seen (the catalogue's or a local timestamp).
      const known = new Set(roomMatches.map((match) => match.id));
      const added = next.filter((match) => !known.has(match.id));
      if (added.length === 0) {
        return;
      }

      // One call, not one per fixture. Beyond the round trips saved, this is what
      // makes a partial failure visible: the caller's error slot is reset per
      // call, so in a loop the failures were overwritten by whatever came after.
      void (async () => {
        const result = await addMatches(added.map(toAddRequest));
        if (result) {
          onBatchAdded?.(result);
        }
      })();
    },
    [addMatches, removeMatches, roomMatches, onBatchAdded],
  );

  const handleRemove = useCallback(
    (matchId: string) => {
      void removeMatch(matchId);
    },
    [removeMatch],
  );

  return { matches, setMatches, removeMatch: handleRemove };
};
