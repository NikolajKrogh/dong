import {
  type MutableRefObject
} from "react";
import type { GuestRoomSessionGrant } from "../../types/guestRoom";
import type {
  ActiveGameContext,
  ReassignParticipantMatchesResponse
} from "../../types/room";
import {
  GameplayRpcError as GameplayRpcErrorClass,
  ReassignmentRpcError,
} from "../../types/room";
import { generateIdempotencyKey } from "../../utils/idempotencyKey";
import type { ActiveGameSyncStatus, GameplayAction, PendingGameplayMutation, StateSetter } from "./activeGameTypes";
import {
  getGuestRoomErrorCode,
  isExpiredGuestRoomError,
  readGuestRoomPendingLeave,
  readGuestRoomSessionGrant,
} from "./guestRoomService";
import { confirmGuestRoomEnded, isGuestRoomEnded } from "./guestRoomTermination";
import { getGuestRoomRpcClient, getRoomRpcClient, mapGameplayError } from "./roomRpcClient";
import {
  type CompatibleRoomSnapshot
} from "./roomSnapshotAdapter";

interface RefreshActiveGameRoomParams {
  contextRef: MutableRefObject<ActiveGameContext>;
  generationRef: MutableRefObject<number>;
  refreshInFlightRef: MutableRefObject<number | null>;
  guestGrantRef: MutableRefObject<GuestRoomSessionGrant | null>;
  pendingRef: MutableRefObject<PendingGameplayMutation[]>;
  actionsRef: MutableRefObject<Map<string, GameplayAction>>;
  snapshotRef: MutableRefObject<CompatibleRoomSnapshot | null>;
  setStatus: StateSetter<ActiveGameSyncStatus>;
  setError: StateSetter<string | null>;
  setPendingMutations: StateSetter<PendingGameplayMutation[]>;
  setAccessLost: StateSetter<boolean>;
  clearActiveGameContext: () => void;
  applySnapshot: (
    nextSnapshot: CompatibleRoomSnapshot,
    expectedGeneration: number,
    expectedSessionId: string,
  ) => boolean;
}

/** Loads the latest room snapshot and applies access-loss and guest-end policy. */
export const refreshActiveGameRoom = async ({
  contextRef,
  generationRef,
  refreshInFlightRef,
  guestGrantRef,
  pendingRef,
  actionsRef,
  snapshotRef,
  setStatus,
  setError,
  setPendingMutations,
  setAccessLost,
  clearActiveGameContext,
  applySnapshot,
}: RefreshActiveGameRoomParams) => {
  const currentContext = contextRef.current;
  if (currentContext.mode !== "multiplayer" || !currentContext.sessionId) {
    return null;
  }

  const generation = generationRef.current;
  const sessionId = currentContext.sessionId;
  if (currentContext.accessKind === "guest" && isGuestRoomEnded(sessionId)) {
    return null;
  }
  if (refreshInFlightRef.current === generation) return snapshotRef.current;

  refreshInFlightRef.current = generation;
  setStatus((current) => (current === "ready" ? "refreshing" : "hydrating"));
  try {
    let nextSnapshot: CompatibleRoomSnapshot;
    if (currentContext.accessKind === "guest") {
      const pendingLeave = await readGuestRoomPendingLeave();
      if (generationRef.current !== generation) return null;
      if (pendingLeave?.sessionId === sessionId) {
        setStatus("offline");
        setError("Your guest departure is awaiting confirmation. Gameplay is paused.");
        return snapshotRef.current;
      }
      guestGrantRef.current ??= await readGuestRoomSessionGrant();
      if (generationRef.current !== generation) return null;
      const grant = guestGrantRef.current;
      if (!grant || grant.sessionId !== currentContext.sessionId) {
        throw new GameplayRpcErrorClass(
          "guest_token_expired",
          "Your guest room session has expired.",
        );
      }
      nextSnapshot = await getGuestRoomRpcClient().getGuestRoomSnapshot(
        grant.guestToken,
      );
    } else {
      if (generationRef.current !== generation) return null;
      nextSnapshot = await getRoomRpcClient().getRoomSnapshot(sessionId);
    }

    if (currentContext.accessKind === "guest") {
      const pendingLeave = await readGuestRoomPendingLeave();
      if (generationRef.current !== generation) return null;
      if (pendingLeave?.sessionId === sessionId) {
        setStatus("offline");
        setError("Your guest departure is awaiting confirmation. Gameplay is paused.");
        return snapshotRef.current;
      }
    }
    applySnapshot(nextSnapshot, generation, sessionId);
    return nextSnapshot;
  } catch (refreshError) {
    if (generationRef.current !== generation) return null;
    if (
      currentContext.accessKind === "guest" &&
      getGuestRoomErrorCode(refreshError) === "room_ended"
    ) {
      generationRef.current += 1;
      pendingRef.current = [];
      actionsRef.current.clear();
      setPendingMutations([]);
      try {
        await confirmGuestRoomEnded(sessionId);
      } catch {
        setError("Secure guest storage could not be cleared.");
      }
      return null;
    }

    const mapped =
      refreshError instanceof GameplayRpcErrorClass
        ? refreshError
        : mapGameplayError(refreshError);
    if (
      currentContext.accessKind === "guest" &&
      isExpiredGuestRoomError(refreshError)
    ) {
      try {
        const pendingLeave = await readGuestRoomPendingLeave();
        if (pendingLeave?.sessionId === sessionId) {
          setStatus("offline");
          setError("Your guest departure is awaiting confirmation. Gameplay is paused.");
          return null;
        }
      } catch {
        // If protected storage is unavailable, keep the regular access-loss path.
      }
    }

    const accessWasLost =
      (currentContext.accessKind === "guest" &&
        isExpiredGuestRoomError(refreshError)) ||
      Boolean(
        mapped &&
        [
          "not_authenticated",
          "not_room_participant",
          "participant_inactive",
          "room_not_found",
          "guest_token_expired",
          "forbidden",
        ].includes(mapped.code),
      );
    if (accessWasLost) {
      setStatus("access_lost");
      setAccessLost(true);
      pendingRef.current = [];
      actionsRef.current.clear();
      setPendingMutations([]);
      clearActiveGameContext();
    } else {
      setStatus("offline");
    }
    setError(
      mapped?.message ??
      (refreshError instanceof Error
        ? refreshError.message
        : "Unable to refresh the shared game."),
    );
    return null;
  } finally {
    if (refreshInFlightRef.current === generation) {
      refreshInFlightRef.current = null;
    }
  }
};

interface CompleteSharedGameParams {
  contextRef: MutableRefObject<ActiveGameContext>;
  completionInFlightRef: MutableRefObject<boolean>;
  isHost: boolean;
  isEditable: boolean;
  setStatus: StateSetter<ActiveGameSyncStatus>;
  setError: StateSetter<string | null>;
  refresh: () => Promise<CompatibleRoomSnapshot | null>;
}

export const completeSharedGame = async ({
  contextRef,
  completionInFlightRef,
  isHost,
  isEditable,
  setStatus,
  setError,
  refresh,
}: CompleteSharedGameParams) => {
  const currentContext = contextRef.current;
  if (completionInFlightRef.current) {
    throw new GameplayRpcErrorClass(
      "invalid_room_state",
      "Game completion is already in progress.",
    );
  }
  if (!currentContext.sessionId || currentContext.accessKind === "guest") {
    throw new GameplayRpcErrorClass(
      "not_host",
      "Only the current host can end the shared game.",
    );
  }
  if (!isHost || !isEditable) {
    throw new GameplayRpcErrorClass(
      "not_host",
      "Only the current host can end the shared game.",
    );
  }

  completionInFlightRef.current = true;
  setStatus("refreshing");
  try {
    const result = await getRoomRpcClient().endGameSession(
      currentContext.sessionId,
    );
    await refresh();
    return result;
  } catch (completionError) {
    setStatus("error");
    setError(
      completionError instanceof Error
        ? completionError.message
        : "The shared game could not be completed.",
    );
    throw completionError;
  } finally {
    completionInFlightRef.current = false;
  }
};

interface ReassignRoomMatchesParams {
  contextRef: MutableRefObject<ActiveGameContext>;
  isHost: boolean;
  isEditable: boolean;
  setStatus: StateSetter<ActiveGameSyncStatus>;
  setError: StateSetter<string | null>;
  refresh: () => Promise<CompatibleRoomSnapshot | null>;
  participantId: string;
  matchIds: string[];
}

export const reassignRoomMatches = async ({
  contextRef,
  isHost,
  isEditable,
  setStatus,
  setError,
  refresh,
  participantId,
  matchIds,
}: ReassignRoomMatchesParams): Promise<ReassignParticipantMatchesResponse> => {
  const currentContext = contextRef.current;
  if (
    currentContext.mode !== "multiplayer" ||
    currentContext.accessKind !== "registered" ||
    !currentContext.sessionId ||
    !isHost ||
    !isEditable
  ) {
    const rejection = new ReassignmentRpcError(
      "not_host",
      "Only the current host can change assignments.",
    );
    setStatus("error");
    setError(rejection.message);
    throw rejection;
  }

  setStatus("refreshing");
  try {
    const response = await getRoomRpcClient().reassignParticipantMatches({
      sessionId: currentContext.sessionId,
      participantId,
      matchIds,
      idempotencyKey: generateIdempotencyKey(),
    });
    await refresh();
    return response;
  } catch (reassignmentError) {
    setStatus("error");
    setError(
      reassignmentError instanceof Error
        ? reassignmentError.message
        : "The shared assignments could not be changed.",
    );
    throw reassignmentError;
  }
};
