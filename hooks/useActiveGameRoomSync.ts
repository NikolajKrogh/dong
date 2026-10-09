import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import { useAppVisibility } from "../platform";
import { useGameStore, type Match, type Player } from "../store/store";
import type { GuestRoomSessionGrant } from "../types/guestRoom";
import type {
  ActiveGameContext,
  GameplayCommandResult,
  GameplayCommandType,
  ReassignParticipantMatchesResponse,
} from "../types/room";
import {
  GameplayRpcError as GameplayRpcErrorClass,
  ReassignmentRpcError,
} from "../types/room";
import {
  getGuestRoomErrorCode,
  isExpiredGuestRoomError,
  readGuestRoomPendingLeave,
  readGuestRoomSessionGrant,
} from "../utils/guestRoom";
import { confirmGuestRoomEnded, isGuestRoomEnded } from "../utils/guestRoomTermination";
import { getSupabaseClient } from "../lib/supabase";
import { getGuestRoomRpcClient, getProviderScoreRefreshClient, getRoomRpcClient, mapGameplayError } from "../utils/supabaseClient";
import { generateIdempotencyKey } from "../utils/commandApiClient";
import {
  roomSnapshotToGameState,
  type CompatibleRoomSnapshot,
} from "../utils/roomSnapshot";

const ACTIVE_GAME_POLL_INTERVAL_MS = 4000;

export type ActiveGameSyncStatus =
  | "idle"
  | "hydrating"
  | "ready"
  | "refreshing"
  | "offline"
  | "ended"
  | "access_lost"
  | "error";

export interface PendingGameplayMutation {
  id: string;
  kind: Extract<GameplayCommandType, "manual_score" | "drink">;
  matchId?: string;
  participantId?: string;
  team?: "home" | "away";
  deltaGoals?: -1 | 1;
  deltaHalfDrinks?: -1 | 1;
  status: "pending" | "uncertain";
}

type GameplayCommand = () => Promise<GameplayCommandResult>;

const getSequence = (snapshot: CompatibleRoomSnapshot | null) =>
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

const isStableGameplayError = (error: unknown) =>
  error instanceof GameplayRpcErrorClass;

const subscribeToRoomChanges = (
  sessionId: string,
  participantId: string,
  refresh: () => unknown,
) => {
  const client = getSupabaseClient();
  const channel = client.channel(`room:${sessionId}`, {
    config: { private: true, presence: { key: participantId } },
  });
  let active = true;
  let previousPresence = "";
  channel.on("broadcast", { event: "room_changed" }, () => {
    if (!active) return;
    void refresh();
  });
  channel.on("presence", { event: "sync" }, () => {
    if (!active) return;
    const currentPresence = Object.keys(channel.presenceState()).sort().join("|");
    if (currentPresence === previousPresence) return;
    previousPresence = currentPresence;
    if (currentPresence) void refresh();
  });
  channel.subscribe((state) => {
    if (active && state === "SUBSCRIBED") void channel.track({});
  });

  return () => {
    active = false;
    void client.removeChannel(channel);
  };
};

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface SyncIdentityStateParams {
  identity: string;
  previousIdentity: string;
  context: Pick<ActiveGameContext, "mode">;
  accessLost: boolean;
  setPreviousIdentity: StateSetter<string>;
  setPendingMutations: StateSetter<PendingGameplayMutation[]>;
  setSnapshot: StateSetter<CompatibleRoomSnapshot | null>;
  setStatus: StateSetter<ActiveGameSyncStatus>;
  setError: StateSetter<string | null>;
  setAccessLost: StateSetter<boolean>;
}

const syncIdentityStateDuringRender = ({
  identity,
  previousIdentity,
  context,
  accessLost,
  setPreviousIdentity,
  setPendingMutations,
  setSnapshot,
  setStatus,
  setError,
  setAccessLost,
}: SyncIdentityStateParams) => {
  if (previousIdentity === identity) return;
  setPreviousIdentity(identity);
  setPendingMutations([]);
  if (context.mode === "multiplayer" || !accessLost) {
    setSnapshot(null);
    setStatus(context.mode === "multiplayer" ? "hydrating" : "idle");
    setError(null);
  }
  if (context.mode === "multiplayer" && accessLost) setAccessLost(false);
};

interface ResetRoomRuntimeParams {
  generationRef: MutableRefObject<number>;
  refreshInFlightRef: MutableRefObject<number | null>;
  guestGrantRef: MutableRefObject<GuestRoomSessionGrant | null>;
  lastProviderRefreshAtRef: MutableRefObject<number>;
  completionInFlightRef: MutableRefObject<boolean>;
  pendingRef: MutableRefObject<PendingGameplayMutation[]>;
  commandsRef: MutableRefObject<Map<string, GameplayCommand>>;
  snapshotRef: MutableRefObject<CompatibleRoomSnapshot | null>;
  context: Pick<ActiveGameContext, "mode">;
  accessLost: boolean;
}

const resetRoomRuntimeForIdentity = ({
  generationRef,
  refreshInFlightRef,
  guestGrantRef,
  lastProviderRefreshAtRef,
  completionInFlightRef,
  pendingRef,
  commandsRef,
  snapshotRef,
  context,
  accessLost,
}: ResetRoomRuntimeParams) => {
  generationRef.current += 1;
  refreshInFlightRef.current = null;
  guestGrantRef.current = null;
  lastProviderRefreshAtRef.current = 0;
  completionInFlightRef.current = false;
  pendingRef.current = [];
  commandsRef.current.clear();
  if (context.mode === "multiplayer" || !accessLost) snapshotRef.current = null;
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

const updatePendingGameplayState = ({
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
  commandsRef: MutableRefObject<Map<string, GameplayCommand>>;
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

const applyActiveGameSnapshot = ({
  nextSnapshot,
  expectedGeneration,
  expectedSessionId,
  contextRef,
  generationRef,
  pendingRef,
  commandsRef,
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
    commandsRef.current.clear();
    setPendingMutations([]);
  }
  setError(null);
  return true;
};

interface RefreshActiveGameRoomParams {
  contextRef: MutableRefObject<ActiveGameContext>;
  generationRef: MutableRefObject<number>;
  refreshInFlightRef: MutableRefObject<number | null>;
  guestGrantRef: MutableRefObject<GuestRoomSessionGrant | null>;
  lastProviderRefreshAtRef: MutableRefObject<number>;
  pendingRef: MutableRefObject<PendingGameplayMutation[]>;
  commandsRef: MutableRefObject<Map<string, GameplayCommand>>;
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
const refreshActiveGameRoom = async ({
  contextRef,
  generationRef,
  refreshInFlightRef,
  guestGrantRef,
  lastProviderRefreshAtRef,
  pendingRef,
  commandsRef,
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
      const now = Date.now();
      if (now - lastProviderRefreshAtRef.current >= 60_000) {
        lastProviderRefreshAtRef.current = now;
        try {
          await getProviderScoreRefreshClient().refreshProviderScores(
            sessionId,
            generateIdempotencyKey(),
          );
        } catch (providerError) {
          // A provider outage must not hide the last accepted room snapshot;
          // the next scheduled pass will retry the refresh.
          console.warn("Provider score refresh unavailable", providerError);
        }
      }
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
      commandsRef.current.clear();
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
      commandsRef.current.clear();
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

interface ApplyGameplayCommandResultParams {
  mutation: PendingGameplayMutation;
  result: GameplayCommandResult;
  snapshotRef: MutableRefObject<CompatibleRoomSnapshot | null>;
  pendingRef: MutableRefObject<PendingGameplayMutation[]>;
  setSnapshot: StateSetter<CompatibleRoomSnapshot | null>;
  setStatus: StateSetter<ActiveGameSyncStatus>;
  setError: StateSetter<string | null>;
  setActiveGameContext: (context: Partial<ActiveGameContext>) => void;
  updatePending: (next: PendingGameplayMutation[]) => void;
}

const applyGameplayCommandResult = ({
  mutation,
  result,
  snapshotRef,
  pendingRef,
  setSnapshot,
  setStatus,
  setError,
  setActiveGameContext,
  updatePending,
}: ApplyGameplayCommandResultParams) => {
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
  command: GameplayCommand;
  status: ActiveGameSyncStatus;
  isInteractive: boolean;
  contextRef: MutableRefObject<ActiveGameContext>;
  generationRef: MutableRefObject<number>;
  snapshotRef: MutableRefObject<CompatibleRoomSnapshot | null>;
  pendingRef: MutableRefObject<PendingGameplayMutation[]>;
  commandsRef: MutableRefObject<Map<string, GameplayCommand>>;
  updatePending: (next: PendingGameplayMutation[]) => void;
  setStatus: StateSetter<ActiveGameSyncStatus>;
  setError: StateSetter<string | null>;
  applyCommandResult: (
    mutation: PendingGameplayMutation,
    result: GameplayCommandResult,
  ) => void;
}

const runGameplayMutation = async ({
  mutation,
  command,
  status,
  isInteractive,
  contextRef,
  generationRef,
  snapshotRef,
  pendingRef,
  commandsRef,
  updatePending,
  setStatus,
  setError,
  applyCommandResult,
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

  commandsRef.current.set(mutation.id, command);
  const generation = generationRef.current;
  updatePending(
    pendingRef.current.some((candidate) => candidate.id === mutation.id)
      ? pendingRef.current.map((candidate) =>
          candidate.id === mutation.id ? mutation : candidate,
        )
      : [...pendingRef.current, mutation],
  );

  try {
    const result = await command();
    if (
      generationRef.current !== generation ||
      (currentContext.accessKind === "guest" &&
        isGuestRoomEnded(currentContext.sessionId))
    ) {
      return result;
    }
    applyCommandResult(mutation, result);
    commandsRef.current.delete(mutation.id);
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
      commandsRef.current.delete(mutation.id);
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

type GameplayCommandInput =
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

const createGameplayCommand = (
  input: GameplayCommandInput,
  contextRef: MutableRefObject<ActiveGameContext>,
  guestGrantRef: MutableRefObject<GuestRoomSessionGrant | null>,
): GameplayCommand =>
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
  commandsRef: MutableRefObject<Map<string, GameplayCommand>>;
  updatePending: (next: PendingGameplayMutation[]) => void;
  runMutation: (
    mutation: PendingGameplayMutation,
    command: GameplayCommand,
  ) => Promise<GameplayCommandResult>;
}

const retryGameplayMutation = async ({
  id,
  pendingRef,
  commandsRef,
  updatePending,
  runMutation,
}: RetryGameplayMutationParams) => {
  const mutation = pendingRef.current.find((candidate) => candidate.id === id);
  const command = commandsRef.current.get(id);
  if (!mutation || !command) return null;
  updatePending(
    pendingRef.current.map((candidate) =>
      candidate.id === id ? { ...candidate, status: "pending" } : candidate,
    ),
  );
  return runMutation(mutation, command);
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

const completeSharedGame = async ({
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

const reassignRoomMatches = async ({
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

export const useActiveGameRoomSync = () => {
  const context = useGameStore((state) => state.activeGameContext);
  const setPlayers = useGameStore((state) => state.setPlayers);
  const setMatches = useGameStore((state) => state.setMatches);
  const setCommonMatchId = useGameStore((state) => state.setCommonMatchId);
  const setPlayerAssignments = useGameStore(
    (state) => state.setPlayerAssignments,
  );
  const setActiveGameContext = useGameStore(
    (state) => state.setActiveGameContext,
  );
  const clearActiveGameContext = useGameStore(
    (state) => state.clearActiveGameContext,
  );
  const { isInteractive } = useAppVisibility();

  const [snapshot, setSnapshot] = useState<CompatibleRoomSnapshot | null>(null);
  const [status, setStatus] = useState<ActiveGameSyncStatus>(
    context.mode === "multiplayer" ? "hydrating" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingMutations, setPendingMutations] = useState<
    PendingGameplayMutation[]
  >([]);
  // Access loss is terminal for the persisted room identity, but the last
  // snapshot remains on screen so the participant can understand why editing
  // stopped. Keeping this bit separate prevents the store reset from turning
  // the access-lost notice into an unrelated solo screen.
  const [accessLost, setAccessLost] = useState(false);
  const snapshotRef = useRef<CompatibleRoomSnapshot | null>(null);
  const contextRef = useRef(context);
  const pendingRef = useRef<PendingGameplayMutation[]>([]);
  const commandsRef = useRef(new Map<string, GameplayCommand>());
  const generationRef = useRef(0);
  const refreshInFlightRef = useRef<number | null>(null);
  const guestGrantRef = useRef<GuestRoomSessionGrant | null>(null);
  const lastProviderRefreshAtRef = useRef(0);
  const completionInFlightRef = useRef(false);

  const identity = `${context.mode}:${context.accessKind}:${context.participantId}:${context.sessionId}:${accessLost}`;
  const [previousIdentity, setPreviousIdentity] = useState(identity);
  syncIdentityStateDuringRender({
    identity,
    previousIdentity,
    context,
    accessLost,
    setPreviousIdentity,
    setPendingMutations,
    setSnapshot,
    setStatus,
    setError,
    setAccessLost,
  });

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    resetRoomRuntimeForIdentity({
      generationRef,
      refreshInFlightRef,
      guestGrantRef,
      lastProviderRefreshAtRef,
      completionInFlightRef,
      pendingRef,
      commandsRef,
      snapshotRef,
      context: { mode: context.mode },
      accessLost,
    });
  }, [
    accessLost,
    context.accessKind,
    context.mode,
    context.participantId,
    context.sessionId,
  ]);

  const applySnapshot = useCallback(
    (
      nextSnapshot: CompatibleRoomSnapshot,
      expectedGeneration = generationRef.current,
      expectedSessionId = contextRef.current.sessionId,
    ) =>
      applyActiveGameSnapshot({
        nextSnapshot,
        expectedGeneration,
        expectedSessionId,
        contextRef,
        generationRef,
        pendingRef,
        commandsRef,
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
      }),
    [
      setActiveGameContext,
      setCommonMatchId,
      setMatches,
      setPlayerAssignments,
      setPlayers,
    ],
  );

  const refresh = useCallback(
    () =>
      refreshActiveGameRoom({
        contextRef,
        generationRef,
        refreshInFlightRef,
        guestGrantRef,
        lastProviderRefreshAtRef,
        pendingRef,
        commandsRef,
        snapshotRef,
        setStatus,
        setError,
        setPendingMutations,
        setAccessLost,
        clearActiveGameContext,
        applySnapshot,
      }),
    [applySnapshot, clearActiveGameContext],
  );

  const updatePending = useCallback(
    (next: PendingGameplayMutation[]) =>
      updatePendingGameplayState({
        next,
        pendingRef,
        snapshotRef,
        setPendingMutations,
        setters: {
          setPlayers,
          setMatches,
          setCommonMatchId,
          setPlayerAssignments,
        },
      }),
    [setCommonMatchId, setMatches, setPlayerAssignments, setPlayers],
  );

  const applyCommandResult = useCallback(
    (
      mutation: PendingGameplayMutation,
      result: GameplayCommandResult,
    ) =>
      applyGameplayCommandResult({
        mutation,
        result,
        snapshotRef,
        pendingRef,
        setSnapshot,
        setStatus,
        setError,
        setActiveGameContext,
        updatePending,
      }),
    [setActiveGameContext, updatePending],
  );

  const runMutation = useCallback(
    (mutation: PendingGameplayMutation, command: GameplayCommand) =>
      runGameplayMutation({
        mutation,
        command,
        status,
        isInteractive,
        contextRef,
        generationRef,
        snapshotRef,
        pendingRef,
        commandsRef,
        updatePending,
        setStatus,
        setError,
        applyCommandResult,
      }),
    [applyCommandResult, isInteractive, status, updatePending],
  );

  const changeManualScore = useCallback(
    (matchId: string, team: "home" | "away", deltaGoals: -1 | 1) => {
      const id = generateIdempotencyKey();
      const mutation: PendingGameplayMutation = {
        id,
        kind: "manual_score",
        matchId,
        team,
        deltaGoals,
        status: "pending",
      };
      const command = createGameplayCommand(
        {
          id,
          kind: "manual_score",
          matchId,
          team,
          deltaGoals,
        },
        contextRef,
        guestGrantRef,
      );
      return runMutation(mutation, command);
    },
    [runMutation],
  );

  const changeParticipantDrink = useCallback(
    (participantId: string, deltaHalfDrinks: -1 | 1) => {
      const id = generateIdempotencyKey();
      const mutation: PendingGameplayMutation = {
        id,
        kind: "drink",
        participantId,
        deltaHalfDrinks,
        status: "pending",
      };
      const command = createGameplayCommand(
        {
          id,
          kind: "drink",
          participantId,
          deltaHalfDrinks,
        },
        contextRef,
        guestGrantRef,
      );
      return runMutation(mutation, command);
    },
    [runMutation],
  );

  const retryMutation = useCallback(
    (id: string) =>
      retryGameplayMutation({
        id,
        pendingRef,
        commandsRef,
        updatePending,
        runMutation,
      }),
    [runMutation, updatePending],
  );

  const isMultiplayer = context.mode === "multiplayer" || accessLost;
  const ownerParticipantId =
    snapshot?.ownerParticipantId ??
    snapshot?.participants.find((participant) => participant.sessionRole === "owner")
      ?.id ??
    null;
  const isHost = Boolean(
    context.participantId && ownerParticipantId === context.participantId,
  );
  // Keep actions available against the last accepted snapshot while a poll is
  // in flight. A failed poll still moves to offline/access_lost and disables them.
  const isEditable =
    isMultiplayer &&
    (status === "ready" || status === "refreshing") &&
    snapshot?.state === "in_progress";

  const completeGame = useCallback(
    () =>
      completeSharedGame({
        contextRef,
        completionInFlightRef,
        isHost,
        isEditable,
        setStatus,
        setError,
        refresh,
      }),
    [isEditable, isHost, refresh],
  );

  const reassignParticipantMatches = useCallback(
    (
      participantId: string,
      matchIds: string[],
    ): Promise<ReassignParticipantMatchesResponse> =>
      reassignRoomMatches({
        contextRef,
        isHost,
        isEditable,
        setStatus,
        setError,
        refresh,
        participantId,
        matchIds,
      }),
    [isEditable, isHost, refresh],
  );


  useEffect(() => {
    if (
      !isMultiplayer ||
      context.accessKind !== "registered" ||
      !context.sessionId ||
      !context.participantId ||
      !isInteractive
    ) {
      return;
    }

    return subscribeToRoomChanges(
      context.sessionId,
      context.participantId,
      refresh,
    );
  }, [
    context.accessKind,
    context.participantId,
    context.sessionId,
    isInteractive,
    isMultiplayer,
    refresh,
  ]);

  useEffect(() => {
    if (!isMultiplayer) return;
    void refresh();
    const interval = setInterval(() => {
      if (isInteractive) void refresh();
    }, ACTIVE_GAME_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [
    context.accessKind,
    context.sessionId,
    isInteractive,
    isMultiplayer,
    refresh,
  ]);

  useEffect(() => {
    if (isMultiplayer && isInteractive) {
      void refresh();
    }
  }, [
    context.accessKind,
    context.sessionId,
    isInteractive,
    isMultiplayer,
    refresh,
  ]);

  return useMemo(
    () => ({
      isMultiplayer,
      isHost,
      isEditable,
      status,
      error,
      snapshot,
      ownerParticipantId,
      participantId: context.participantId,
      pendingMutations,
      lastAppliedSequence: context.lastAppliedSequence,
      refresh,
      changeManualScore,
      changeParticipantDrink,
      retryMutation,
      completeGame,
      reassignParticipantMatches,
    }),
    [
      changeManualScore,
      changeParticipantDrink,
      completeGame,
      context.lastAppliedSequence,
      context.participantId,
      error,
      isEditable,
      isHost,
      isMultiplayer,
      ownerParticipantId,
      pendingMutations,
      refresh,
      retryMutation,
      reassignParticipantMatches,
      snapshot,
      status,
    ],
  );
};

export type ActiveGameRoomSync = ReturnType<typeof useActiveGameRoomSync>;
