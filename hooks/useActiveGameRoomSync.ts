import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppVisibility } from "../platform";
import { useGameStore, type Match, type Player } from "../store/store";
import type { GuestRoomSessionGrant } from "../types/guestRoom";
import type {
  GameplayCommandResult,
  GameplayCommandType,
  ReassignParticipantMatchesResponse,
} from "../types/room";
import {
  GameplayRpcError as GameplayRpcErrorClass,
  ReassignmentRpcError,
} from "../types/room";
import { readGuestRoomSessionGrant } from "../utils/guestRoom";
import {
  getGuestRoomRpcClient,
  getProviderScoreRefreshClient,
  getRoomRpcClient,
  mapGameplayError,
} from "../utils/supabaseClient";
import { generateIdempotencyKey } from "../utils/commandApiClient";
import {
  roomSnapshotToGameState,
  type CompatibleRoomSnapshot,
} from "../utils/roomSnapshot";

export const ACTIVE_GAME_POLL_INTERVAL_MS = 4000;

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

const isStableGameplayError = (error: unknown) =>
  error instanceof GameplayRpcErrorClass;

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

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    generationRef.current += 1;
    refreshInFlightRef.current = null;
    guestGrantRef.current = null;
    lastProviderRefreshAtRef.current = 0;
    completionInFlightRef.current = false;
    pendingRef.current = [];
    commandsRef.current.clear();
    setPendingMutations([]);
    if (context.mode === "multiplayer") {
      snapshotRef.current = null;
      setSnapshot(null);
      setStatus("hydrating");
      setError(null);
    } else if (!accessLost) {
      snapshotRef.current = null;
      setSnapshot(null);
      setStatus("idle");
      setError(null);
    }
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
    ) => {
      const currentContext = contextRef.current;
      if (
        generationRef.current !== expectedGeneration ||
        currentContext.mode !== "multiplayer" ||
        !expectedSessionId ||
        currentContext.sessionId !== expectedSessionId ||
        nextSnapshot.sessionId !== expectedSessionId
      ) {
        return false;
      }
      const incomingSequence = getSequence(nextSnapshot);
      const currentSequence = currentContext.lastAppliedSequence;
      if (!canApplySnapshot(currentSequence, nextSnapshot)) {
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
      setStatus(
        nextSnapshot.state === "completed" || nextSnapshot.state === "closed"
          ? "ended"
          : "ready",
      );
      if (nextSnapshot.state === "completed" || nextSnapshot.state === "closed") {
        pendingRef.current = [];
        commandsRef.current.clear();
        setPendingMutations([]);
      }
      setError(null);
      return true;
    },
    [
      setActiveGameContext,
      setCommonMatchId,
      setMatches,
      setPlayerAssignments,
      setPlayers,
    ],
  );

  const refresh = useCallback(async () => {
    const currentContext = contextRef.current;
    if (currentContext.mode !== "multiplayer" || !currentContext.sessionId) {
      return null;
    }
    const generation = generationRef.current;
    const sessionId = currentContext.sessionId;
    if (refreshInFlightRef.current === generation) {
      return snapshotRef.current;
    }

    refreshInFlightRef.current = generation;
    setStatus((current) => (current === "ready" ? "refreshing" : "hydrating"));
    try {
      let nextSnapshot: CompatibleRoomSnapshot;
      if (currentContext.accessKind === "guest") {
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
        if (
          now - lastProviderRefreshAtRef.current >= 60_000
        ) {
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
        nextSnapshot = await getRoomRpcClient().getRoomSnapshot(
          sessionId,
        );
      }
      applySnapshot(nextSnapshot, generation, sessionId);
      return nextSnapshot;
    } catch (refreshError) {
      if (generationRef.current !== generation) return null;
      const mapped = refreshError instanceof GameplayRpcErrorClass
        ? refreshError
        : mapGameplayError(refreshError);
      if (
        mapped &&
        [
          "not_authenticated",
          "not_room_participant",
          "participant_inactive",
          "room_not_found",
          "guest_token_expired",
          "forbidden",
        ].includes(mapped.code)
      ) {
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
            : "Unable to refresh the shared game.")
      );
      return null;
    } finally {
      if (refreshInFlightRef.current === generation) {
        refreshInFlightRef.current = null;
      }
    }
  }, [applySnapshot, clearActiveGameContext]);

  const updatePending = useCallback(
    (next: PendingGameplayMutation[]) => {
      pendingRef.current = next;
      setPendingMutations(next);
      const currentSnapshot = snapshotRef.current;
      if (currentSnapshot) {
        applyStoreState(currentSnapshot, next, {
          setPlayers,
          setMatches,
          setCommonMatchId,
          setPlayerAssignments,
        });
      }
    },
    [setCommonMatchId, setMatches, setPlayerAssignments, setPlayers],
  );

  const applyCommandResult = useCallback(
    (
      mutation: PendingGameplayMutation,
      result: GameplayCommandResult,
    ) => {
      const currentSnapshot = snapshotRef.current;
      if (!currentSnapshot) {
        return;
      }

      const resultSequence = result.sequenceNumber ?? 0;
      const currentSequence = getSequence(currentSnapshot);
      let nextSnapshot = currentSnapshot;

      if (resultSequence >= currentSequence) {
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

      // A successful explicit retry resolves the offline/uncertain banner;
      // the canonical result is now known even if the next poll is pending.
      setStatus("ready");
      setError(null);

      updatePending(
        pendingRef.current.filter((candidate) => candidate.id !== mutation.id),
      );
    },
    [setActiveGameContext, updatePending],
  );

  const runMutation = useCallback(
    async (mutation: PendingGameplayMutation, command: GameplayCommand) => {
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
      updatePending(
        pendingRef.current.some((candidate) => candidate.id === mutation.id)
          ? pendingRef.current.map((candidate) =>
              candidate.id === mutation.id ? mutation : candidate,
            )
          : [...pendingRef.current, mutation],
      );
      try {
        const result = await command();
        applyCommandResult(mutation, result);
        commandsRef.current.delete(mutation.id);
        return result;
      } catch (mutationError) {
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
    },
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
      const command = async () => {
        const currentContext = contextRef.current;
        if (currentContext.accessKind === "guest") {
          const grant = guestGrantRef.current ?? (await readGuestRoomSessionGrant());
          if (!grant) throw new GameplayRpcErrorClass("guest_token_expired", "Your guest room session has expired.");
          guestGrantRef.current = grant;
          return getGuestRoomRpcClient().changeManualScoreAsGuest({
            guestToken: grant.guestToken,
            matchId,
            team,
            deltaGoals,
            idempotencyKey: id,
          });
        }
        if (!currentContext.sessionId) throw new GameplayRpcErrorClass("room_not_found", "The room no longer exists.");
        return getRoomRpcClient().changeManualScore({
          sessionId: currentContext.sessionId,
          matchId,
          team,
          deltaGoals,
          idempotencyKey: id,
        });
      };
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
      const command = async () => {
        const currentContext = contextRef.current;
        if (currentContext.accessKind === "guest") {
          const grant = guestGrantRef.current ?? (await readGuestRoomSessionGrant());
          if (!grant) throw new GameplayRpcErrorClass("guest_token_expired", "Your guest room session has expired.");
          guestGrantRef.current = grant;
          return getGuestRoomRpcClient().changeParticipantDrinkAsGuest({
            guestToken: grant.guestToken,
            participantId,
            deltaHalfDrinks,
            idempotencyKey: id,
          });
        }
        if (!currentContext.sessionId) throw new GameplayRpcErrorClass("room_not_found", "The room no longer exists.");
        return getRoomRpcClient().changeParticipantDrink({
          sessionId: currentContext.sessionId,
          participantId,
          deltaHalfDrinks,
          idempotencyKey: id,
        });
      };
      return runMutation(mutation, command);
    },
    [runMutation],
  );

  const retryMutation = useCallback(
    async (id: string) => {
      const mutation = pendingRef.current.find((candidate) => candidate.id === id);
      const command = commandsRef.current.get(id);
      if (!mutation || !command) {
        return null;
      }
      updatePending(
        pendingRef.current.map((candidate) =>
          candidate.id === id ? { ...candidate, status: "pending" } : candidate,
        ),
      );
      return runMutation(mutation, command);
    },
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

  const completeGame = useCallback(async () => {
    const currentContext = contextRef.current;
    if (completionInFlightRef.current) {
      throw new GameplayRpcErrorClass(
        "invalid_room_state",
        "Game completion is already in progress.",
      );
    }
    if (!currentContext.sessionId || currentContext.accessKind === "guest") {
      throw new GameplayRpcErrorClass("not_host", "Only the current host can end the shared game.");
    }
    if (!isHost || !isEditable) {
      throw new GameplayRpcErrorClass("not_host", "Only the current host can end the shared game.");
    }
    completionInFlightRef.current = true;
    setStatus("refreshing");
    try {
      const result = await getRoomRpcClient().endGameSession(currentContext.sessionId);
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
  }, [isEditable, isHost, refresh]);

  const reassignParticipantMatches = useCallback(
    async (
      participantId: string,
      matchIds: string[],
    ): Promise<ReassignParticipantMatchesResponse> => {
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
    },
    [isEditable, isHost, refresh],
  );

  useEffect(() => {
    if (context.mode === "multiplayer" && accessLost) {
      setAccessLost(false);
    }
  }, [accessLost, context.mode, context.sessionId]);

  useEffect(() => {
    if (!isMultiplayer) {
      setStatus("idle");
      return;
    }
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
