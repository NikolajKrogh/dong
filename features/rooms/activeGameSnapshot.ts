import {
  type MutableRefObject
} from "react";
import { type Match, type Player } from "../../store/gameStore";
import type {
  ActiveGameContext
} from "../../types/room";
import type { ActiveGameSyncStatus, GameplayAction, PendingGameplayMutation, StateSetter } from "./activeGameTypes";
import { isGuestRoomEnded } from "./guestRoomTermination";
import {
  roomSnapshotToGameState,
  type CompatibleRoomSnapshot,
} from "./roomSnapshotAdapter";

export const getSequence = (snapshot: CompatibleRoomSnapshot | null) =>
  snapshot?.lastEventSequence ?? 0;

export const canApplySnapshot = (
  currentSequence: number,
  nextSnapshot: CompatibleRoomSnapshot,
) => getSequence(nextSnapshot) >= currentSequence;

export const applyPendingOverlay = (
  snapshot: CompatibleRoomSnapshot,
  pending: PendingGameplayMutation[],
) => {
  const base = roomSnapshotToGameState(snapshot);
  const matches = base.matches.map((match) => ({ ...match }));
  const players = base.players.map((player) => ({ ...player }));

  pending.filter((mutation) => mutation.status === "pending").forEach((mutation) => {
    if (mutation.kind === "manual_score" && mutation.matchId && mutation.team) {
      const match = matches.find((candidate) => candidate.id === mutation.matchId);
      if (match) {
        if (mutation.team === "home") {
          match.homeGoals = Math.max(0, match.homeGoals + (mutation.deltaGoals ?? 0));
        } else {
          match.awayGoals = Math.max(0, match.awayGoals + (mutation.deltaGoals ?? 0));
        }
      }
    }

    if (mutation.kind === "drink" && mutation.participantId) {
      const player = players.find(
        (candidate) => candidate.id === mutation.participantId,
      );
      if (player) {
        player.drinksTaken = Math.max(
          0,
          (player.drinksTaken ?? 0) + (mutation.deltaHalfDrinks ?? 0) * 0.5,
        );
      }
    }
  });

  return { ...base, matches, players };
};

const applyStoreState = (
  snapshot: CompatibleRoomSnapshot,
  pending: PendingGameplayMutation[],
  setters: {
    setPlayers: (players: Player[]) => void;
    setMatches: (matches: Match[]) => void;
    setCommonMatchId: (id: string | null) => void;
    setPlayerAssignments: (assignments: Record<string, string[]>) => void;
  },
) => {
  const next = applyPendingOverlay(snapshot, pending);
  setters.setPlayers(next.players);
  setters.setMatches(next.matches);
  setters.setCommonMatchId(next.commonMatchId);
  setters.setPlayerAssignments(next.playerAssignments);
};

interface UpdatePendingStateParams {
  next: PendingGameplayMutation[];
  pendingRef: MutableRefObject<PendingGameplayMutation[]>;
  snapshotRef: MutableRefObject<CompatibleRoomSnapshot | null>;
  setPendingMutations: StateSetter<PendingGameplayMutation[]>;
  setters: {
    setPlayers: (players: Player[]) => void;
    setMatches: (matches: Match[]) => void;
    setCommonMatchId: (id: string | null) => void;
    setPlayerAssignments: (assignments: Record<string, string[]>) => void;
  };
}

export const updatePendingGameplayState = ({
  next,
  pendingRef,
  snapshotRef,
  setPendingMutations,
  setters,
}: UpdatePendingStateParams) => {
  pendingRef.current = next;
  setPendingMutations(next);
  if (snapshotRef.current) {
    applyStoreState(snapshotRef.current, next, setters);
  }
};

interface ApplyActiveGameSnapshotParams {
  nextSnapshot: CompatibleRoomSnapshot;
  expectedGeneration: number;
  expectedSessionId: string | null;
  contextRef: MutableRefObject<ActiveGameContext>;
  generationRef: MutableRefObject<number>;
  pendingRef: MutableRefObject<PendingGameplayMutation[]>;
  actionsRef: MutableRefObject<Map<string, GameplayAction>>;
  snapshotRef: MutableRefObject<CompatibleRoomSnapshot | null>;
  setSnapshot: StateSetter<CompatibleRoomSnapshot | null>;
  setPendingMutations: StateSetter<PendingGameplayMutation[]>;
  setStatus: StateSetter<ActiveGameSyncStatus>;
  setError: StateSetter<string | null>;
  setActiveGameContext: (context: Partial<ActiveGameContext>) => void;
  setPlayers: (players: Player[]) => void;
  setMatches: (matches: Match[]) => void;
  setCommonMatchId: (id: string | null) => void;
  setPlayerAssignments: (assignments: Record<string, string[]>) => void;
}

export const applyActiveGameSnapshot = ({
  nextSnapshot,
  expectedGeneration,
  expectedSessionId,
  contextRef,
  generationRef,
  pendingRef,
  actionsRef,
  snapshotRef,
  setSnapshot,
  setPendingMutations,
  setStatus,
  setError,
  setActiveGameContext,
  setPlayers,
  setMatches,
  setCommonMatchId,
  setPlayerAssignments,
}: ApplyActiveGameSnapshotParams) => {
  const currentContext = contextRef.current;
  if (
    generationRef.current !== expectedGeneration ||
    currentContext.mode !== "multiplayer" ||
    !expectedSessionId ||
    currentContext.sessionId !== expectedSessionId ||
    (currentContext.accessKind === "guest" && isGuestRoomEnded(expectedSessionId)) ||
    nextSnapshot.sessionId !== expectedSessionId
  ) {
    return false;
  }
  const incomingSequence = getSequence(nextSnapshot);
  if (!canApplySnapshot(currentContext.lastAppliedSequence, nextSnapshot)) {
    return false;
  }

  snapshotRef.current = nextSnapshot;
  setSnapshot(nextSnapshot);
  applyStoreState(nextSnapshot, pendingRef.current, {
    setPlayers,
    setMatches,
    setCommonMatchId,
    setPlayerAssignments,
  });
  setActiveGameContext({
    mode: "multiplayer",
    sessionId: nextSnapshot.sessionId,
    lastAppliedSequence: incomingSequence,
  });
  const hasEnded =
    nextSnapshot.state === "completed" || nextSnapshot.state === "closed";
  setStatus(hasEnded ? "ended" : "ready");
  if (hasEnded) {
    pendingRef.current = [];
    actionsRef.current.clear();
    setPendingMutations([]);
  }
  setError(null);
  return true;
};
