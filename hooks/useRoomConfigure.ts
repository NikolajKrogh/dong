import { useCallback, useRef, useState } from "react";

import {
  ROOM_ERROR,
  type AddRoomMatchRequest,
  type AssignmentMode,
  type RoomAssignmentInput,
  type RoomAssignmentSettingsRequest,
  type RoomSnapshot,
} from "../types/room";
import {
  generateIdempotencyKey,
  getStartGameApiClient,
} from "../utils/commandApiClient";
import { getRoomRpcClient, getSupabaseClient } from "../utils/supabaseClient";

export interface UseRoomConfigureResult {
  isBusy: boolean;
  error: string | null;
  addMatch: (request: AddRoomMatchRequest) => Promise<void>;
  removeMatch: (matchId: string) => Promise<void>;
  setCommonMatch: (matchId: string) => Promise<void>;
  setAssignments: (assignments: RoomAssignmentInput[]) => Promise<void>;
  /** Sets the room's per-player match count and shared-per-pair count (FR-028 to FR-031).
   * Only meaningful while the room is `joinable`; only the host may call it. */
  setAssignmentSettings: (
    settings: RoomAssignmentSettingsRequest,
  ) => Promise<void>;
  /** Sets the room's assignment mode (FR-026, FR-029, FR-030). Only
   * meaningful while the room is `joinable`; only the host may call it. The
   * caller is responsible for the discard-draft confirmation (FR-030a) —
   * this method performs the mutation unconditionally once invoked. */
  setAssignmentMode: (mode: AssignmentMode) => Promise<void>;
  /**
   * Replaces the signed-in viewer's **own** player-picked selections (FR-038).
   * Applies to the host as much as to a member — the host is an ordinary
   * participant who picks their own matches. Replace-all: pass the complete
   * next set, so releasing means submitting without that match (FR-040).
   *
   * The server derives the acting participant from the caller's JWT, so there
   * is no participant id to pass and no way to write someone else's picks
   * (FR-038a, FR-039). Callers must gate on `isBusy` — the refresh completes
   * before it clears, which is what keeps rapid taps from clobbering each other
   * under replace-all.
   */
  setMyPicks: (matchIds: string[]) => Promise<void>;
  /**
   * Starts the game. `relaxConstraints` MUST only be passed as `true` after
   * the host has been shown the room's assignment-plan shortfall (from the
   * polled snapshot's `assignmentPlan`) and explicitly chosen to proceed —
   * there is no separate preview call (FR-013 to FR-015, research.md R2).
   * Returns true once the server accepts the start (clients then detect the
   * `in_progress` transition via the regular lobby snapshot poll, per FR-024).
   */
  startGame: (relaxConstraints?: boolean) => Promise<boolean>;
}

const CLIENT_SAFE_ERROR_MESSAGE_REGEX = /fetch failed|network request failed|load failed/i;

/**
 * Postgres exception codes (`PostgrestError.message`) that read as raw
 * snake_case to a host rather than an actionable instruction — mapped to a
 * friendlier sentence. Every other code (e.g. `not_host`) is already a plain
 * enough phrase to show as-is.
 */
const ROOM_ERROR_MESSAGES: Partial<Record<string, string>> = {
  [ROOM_ERROR.matchNotFound]:
    "That match is no longer in the room. Refresh and try again.",
  [ROOM_ERROR.invalidAssignment]:
    "One of those assignments referenced a participant or match that's no longer in the room.",
  [ROOM_ERROR.invalidAssignmentSettings]:
    "Match counts must be zero or a positive number.",
  [ROOM_ERROR.perPlayerCountBelowMinimum]:
    "That per-player count is too low for the current shared-matches setting and roster size.",
  [ROOM_ERROR.invalidAssignmentMode]:
    "That isn't a valid assignment mode. Refresh and try again.",
  [ROOM_ERROR.pickLimitExceeded]:
    "You've already picked all your matches. Release one to pick another.",
  [ROOM_ERROR.roomNotPlayerPicked]:
    "This room isn't letting players pick their own matches. Refresh and try again.",
  [ROOM_ERROR.notAParticipant]:
    "You're no longer in this room, so your picks couldn't be saved.",
};

const friendlyMessage = (err: unknown): string => {
  if (err instanceof Error) {
    const trimmed = err.message.trim();
    if (trimmed.length > 0) {
      const mapped = ROOM_ERROR_MESSAGES[trimmed];
      if (mapped) {
        return mapped;
      }
      if (!CLIENT_SAFE_ERROR_MESSAGE_REGEX.test(trimmed)) {
        return trimmed;
      }
    }
  }
  return "Something went wrong. Please try again.";
};

/**
 * Mutation actions for the host's room-configuration lobby. Operates on
 * a `RoomSnapshot` supplied by the caller (typically `useRoomLobby`'s polled
 * snapshot) rather than fetching its own — every successful mutation calls
 * `onMutated` so the caller can immediately refresh that snapshot.
 */
export const useRoomConfigure = (
  snapshot: RoomSnapshot | null,
  onMutated?: () => void | Promise<void>,
): UseRoomConfigureResult => {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startGameIdempotencyKeyRef = useRef<string | null>(null);

  const run = useCallback(
    async (action: (sessionId: string) => Promise<void>) => {
      if (!snapshot) {
        return;
      }
      setIsBusy(true);
      setError(null);
      try {
        await action(snapshot.sessionId);
        await onMutated?.();
      } catch (actionError) {
        setError(friendlyMessage(actionError));
      } finally {
        setIsBusy(false);
      }
    },
    [snapshot, onMutated],
  );

  const addMatch = useCallback(
    (request: AddRoomMatchRequest) =>
      run(async (sessionId) => {
        await getRoomRpcClient().addRoomMatch(sessionId, request);
      }),
    [run],
  );

  const removeMatch = useCallback(
    (matchId: string) =>
      run(async (sessionId) => {
        await getRoomRpcClient().removeRoomMatch(sessionId, matchId);
      }),
    [run],
  );

  const setCommonMatch = useCallback(
    (matchId: string) =>
      run(async (sessionId) => {
        await getRoomRpcClient().setCommonMatch(sessionId, matchId);
      }),
    [run],
  );

  const setAssignments = useCallback(
    (assignments: RoomAssignmentInput[]) =>
      run(async (sessionId) => {
        await getRoomRpcClient().setRoomAssignments(sessionId, assignments);
      }),
    [run],
  );

  const setAssignmentSettings = useCallback(
    (settings: RoomAssignmentSettingsRequest) =>
      run(async (sessionId) => {
        await getRoomRpcClient().setRoomAssignmentSettings(
          sessionId,
          settings,
        );
      }),
    [run],
  );

  const setAssignmentMode = useCallback(
    (mode: AssignmentMode) =>
      run(async (sessionId) => {
        await getRoomRpcClient().setRoomAssignmentMode(sessionId, mode);
      }),
    [run],
  );

  const setMyPicks = useCallback(
    (matchIds: string[]) =>
      run(async (sessionId) => {
        await getRoomRpcClient().setMyRoomPicks(sessionId, matchIds);
      }),
    [run],
  );

  const startGame = useCallback(
    async (relaxConstraints?: boolean): Promise<boolean> => {
      if (!snapshot) {
        return false;
      }
      setIsBusy(true);
      setError(null);
      try {
        const { data: sessionData, error: sessionError } =
          await getSupabaseClient().auth.getSession();
        if (sessionError || !sessionData.session) {
          setError("You must be signed in to start the game.");
          return false;
        }

        startGameIdempotencyKeyRef.current ??= generateIdempotencyKey();

        await getStartGameApiClient().startGame(
          snapshot.sessionId,
          sessionData.session.access_token,
          startGameIdempotencyKeyRef.current,
          relaxConstraints ?? false,
        );

        // Success clears the key: a future distinct "Start Game" click is a new
        // logical attempt and must get a fresh key.
        startGameIdempotencyKeyRef.current = null;
        return true;
      } catch (startError) {
        setError(friendlyMessage(startError));
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [snapshot],
  );

  return {
    isBusy,
    error,
    addMatch,
    removeMatch,
    setCommonMatch,
    setAssignments,
    setAssignmentSettings,
    setAssignmentMode,
    setMyPicks,
    startGame,
  };
};
