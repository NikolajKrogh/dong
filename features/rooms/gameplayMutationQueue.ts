import {
  type MutableRefObject
} from "react";
import type { GuestRoomSessionGrant } from "../../types/guestRoom";
import type {
  ActiveGameContext,
  GameplayActionResult
} from "../../types/room";
import {
  GameplayRpcError as GameplayRpcErrorClass
} from "../../types/room";
import { getSequence } from "./activeGameSnapshot";
import type { ActiveGameSyncStatus, GameplayAction, PendingGameplayMutation, StateSetter } from "./activeGameTypes";
import {
  readGuestRoomSessionGrant
} from "./guestRoomService";
import { isGuestRoomEnded } from "./guestRoomTermination";
import { getGuestRoomRpcClient, getRoomRpcClient } from "./roomRpcClient";
import {
  type CompatibleRoomSnapshot
} from "./roomSnapshotAdapter";

const isStableGameplayError = (error: unknown) =>
  error instanceof GameplayRpcErrorClass;

interface ApplyGameplayActionResultParams {
  mutation: PendingGameplayMutation;
  result: GameplayActionResult;
  snapshotRef: MutableRefObject<CompatibleRoomSnapshot | null>;
  pendingRef: MutableRefObject<PendingGameplayMutation[]>;
  setSnapshot: StateSetter<CompatibleRoomSnapshot | null>;
  setStatus: StateSetter<ActiveGameSyncStatus>;
  setError: StateSetter<string | null>;
  setActiveGameContext: (context: Partial<ActiveGameContext>) => void;
  updatePending: (next: PendingGameplayMutation[]) => void;
}

export const applyGameplayActionResult = ({
  mutation,
  result,
  snapshotRef,
  pendingRef,
  setSnapshot,
  setStatus,
  setError,
  setActiveGameContext,
  updatePending,
}: ApplyGameplayActionResultParams) => {
  const currentSnapshot = snapshotRef.current;
  if (!currentSnapshot) return;

  const resultSequence = result.sequenceNumber ?? 0;
  let nextSnapshot = currentSnapshot;
  if (resultSequence >= getSequence(currentSnapshot)) {
    if (mutation.kind === "manual_score") {
      const matchId = String(result.matchId ?? mutation.matchId ?? "");
      nextSnapshot = {
        ...currentSnapshot,
        lastEventSequence: resultSequence,
        matches: currentSnapshot.matches.map((match) =>
          match.id === matchId
            ? {
              ...match,
              homeScore: Number(result.homeScore ?? match.homeScore ?? 0),
              awayScore: Number(result.awayScore ?? match.awayScore ?? 0),
            }
            : match,
        ),
      };
    } else if (mutation.kind === "drink") {
      const participantId = String(
        result.participantId ?? mutation.participantId ?? "",
      );
      nextSnapshot = {
        ...currentSnapshot,
        lastEventSequence: resultSequence,
        participants: currentSnapshot.participants.map((participant) =>
          participant.id === participantId
            ? {
              ...participant,
              currentDrinkTotal: Number(
                result.currentDrinkTotal ?? participant.currentDrinkTotal,
              ),
            }
            : participant,
        ),
      };
    }
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
    setActiveGameContext({ lastAppliedSequence: resultSequence });
  }

  // A successful explicit retry resolves the offline/uncertain banner; the
  // canonical result is now known even if the next poll is pending.
  setStatus("ready");
  setError(null);
  updatePending(
    pendingRef.current.filter((candidate) => candidate.id !== mutation.id),
  );
};

interface RunGameplayMutationParams {
  mutation: PendingGameplayMutation;
  action: GameplayAction;
  status: ActiveGameSyncStatus;
  isInteractive: boolean;
  contextRef: MutableRefObject<ActiveGameContext>;
  generationRef: MutableRefObject<number>;
  snapshotRef: MutableRefObject<CompatibleRoomSnapshot | null>;
  pendingRef: MutableRefObject<PendingGameplayMutation[]>;
  actionsRef: MutableRefObject<Map<string, GameplayAction>>;
  updatePending: (next: PendingGameplayMutation[]) => void;
  setStatus: StateSetter<ActiveGameSyncStatus>;
  setError: StateSetter<string | null>;
  applyRoomActionResult: (
    mutation: PendingGameplayMutation,
    result: GameplayActionResult,
  ) => void;
}

export const runGameplayMutation = async ({
  mutation,
  action,
  status,
  isInteractive,
  contextRef,
  generationRef,
  snapshotRef,
  pendingRef,
  actionsRef,
  updatePending,
  setStatus,
  setError,
  applyRoomActionResult,
}: RunGameplayMutationParams) => {
  const currentContext = contextRef.current;
  const retryingUncertainMutation =
    mutation.status === "uncertain" &&
    pendingRef.current.some((candidate) => candidate.id === mutation.id);
  if (
    currentContext.mode !== "multiplayer" ||
    (status !== "ready" && !retryingUncertainMutation) ||
    snapshotRef.current?.state !== "in_progress" ||
    !isInteractive
  ) {
    throw new GameplayRpcErrorClass(
      "service_unavailable",
      "Reconnect and refresh before changing the shared game.",
    );
  }

  actionsRef.current.set(mutation.id, action);
  const generation = generationRef.current;
  updatePending(
    pendingRef.current.some((candidate) => candidate.id === mutation.id)
      ? pendingRef.current.map((candidate) =>
        candidate.id === mutation.id ? mutation : candidate,
      )
      : [...pendingRef.current, mutation],
  );

  try {
    const result = await action();
    if (
      generationRef.current !== generation ||
      (currentContext.accessKind === "guest" &&
        isGuestRoomEnded(currentContext.sessionId))
    ) {
      return result;
    }
    applyRoomActionResult(mutation, result);
    actionsRef.current.delete(mutation.id);
    return result;
  } catch (mutationError) {
    if (
      generationRef.current !== generation ||
      (currentContext.accessKind === "guest" &&
        isGuestRoomEnded(currentContext.sessionId))
    ) {
      throw mutationError;
    }
    if (isStableGameplayError(mutationError)) {
      actionsRef.current.delete(mutation.id);
      updatePending(
        pendingRef.current.filter((candidate) => candidate.id !== mutation.id),
      );
    } else {
      updatePending(
        pendingRef.current.map((candidate) =>
          candidate.id === mutation.id
            ? { ...candidate, status: "uncertain" }
            : candidate,
        ),
      );
      setStatus("offline");
    }
    setError(
      mutationError instanceof Error
        ? mutationError.message
        : "The shared game could not accept that action.",
    );
    throw mutationError;
  }
};

type GameplayActionInput =
  | {
    id: string;
    kind: "manual_score";
    matchId: string;
    team: "home" | "away";
    deltaGoals: -1 | 1;
  }
  | {
    id: string;
    kind: "drink";
    participantId: string;
    deltaHalfDrinks: -1 | 1;
  };

export const createGameplayAction = (
  input: GameplayActionInput,
  contextRef: MutableRefObject<ActiveGameContext>,
  guestGrantRef: MutableRefObject<GuestRoomSessionGrant | null>,
): GameplayAction =>
  async () => {
    const currentContext = contextRef.current;
    if (currentContext.accessKind === "guest") {
      const grant = guestGrantRef.current ?? (await readGuestRoomSessionGrant());
      if (!grant) {
        throw new GameplayRpcErrorClass(
          "guest_token_expired",
          "Your guest room session has expired.",
        );
      }
      guestGrantRef.current = grant;
      if (input.kind === "manual_score") {
        return getGuestRoomRpcClient().changeManualScoreAsGuest({
          guestToken: grant.guestToken,
          matchId: input.matchId,
          team: input.team,
          deltaGoals: input.deltaGoals,
          idempotencyKey: input.id,
        });
      }
      return getGuestRoomRpcClient().changeParticipantDrinkAsGuest({
        guestToken: grant.guestToken,
        participantId: input.participantId,
        deltaHalfDrinks: input.deltaHalfDrinks,
        idempotencyKey: input.id,
      });
    }

    if (!currentContext.sessionId) {
      throw new GameplayRpcErrorClass(
        "room_not_found",
        "The room no longer exists.",
      );
    }
    if (input.kind === "manual_score") {
      return getRoomRpcClient().changeManualScore({
        sessionId: currentContext.sessionId,
        matchId: input.matchId,
        team: input.team,
        deltaGoals: input.deltaGoals,
        idempotencyKey: input.id,
      });
    }
    return getRoomRpcClient().changeParticipantDrink({
      sessionId: currentContext.sessionId,
      participantId: input.participantId,
      deltaHalfDrinks: input.deltaHalfDrinks,
      idempotencyKey: input.id,
    });
  };

interface RetryGameplayMutationParams {
  id: string;
  pendingRef: MutableRefObject<PendingGameplayMutation[]>;
  actionsRef: MutableRefObject<Map<string, GameplayAction>>;
  updatePending: (next: PendingGameplayMutation[]) => void;
  runMutation: (
    mutation: PendingGameplayMutation,
    action: GameplayAction,
  ) => Promise<GameplayActionResult>;
}

export const retryGameplayMutation = async ({
  id,
  pendingRef,
  actionsRef,
  updatePending,
  runMutation,
}: RetryGameplayMutationParams) => {
  const mutation = pendingRef.current.find((candidate) => candidate.id === id);
  const action = actionsRef.current.get(id);
  if (!mutation || !action) return null;
  updatePending(
    pendingRef.current.map((candidate) =>
      candidate.id === id ? { ...candidate, status: "pending" } : candidate,
    ),
  );
  return runMutation(mutation, action);
};
