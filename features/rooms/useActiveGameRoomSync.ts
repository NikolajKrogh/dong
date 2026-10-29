import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { resetRoomRuntimeForIdentity, syncIdentityStateDuringRender } from "./activeGameIdentity";
import { completeSharedGame, reassignRoomMatches, refreshActiveGameRoom } from "./activeGameLifecycle";
import { applyActiveGameSnapshot, updatePendingGameplayState } from "./activeGameSnapshot";
import { ActiveGameSyncStatus, GameplayAction, PendingGameplayMutation } from "./activeGameTypes";
import { applyGameplayActionResult, createGameplayAction, retryGameplayMutation, runGameplayMutation } from "./gameplayMutationQueue";
import { subscribeToRoomChanges } from "./roomRealtimeSubscription";

import { useAppVisibility } from "../../platform";
import { useGameStore } from "../../store/gameStore";
import type { GuestRoomSessionGrant } from "../../types/guestRoom";
import type {
  GameplayActionResult,
  ReassignParticipantMatchesResponse
} from "../../types/room";
import {
  GameplayRpcError as GameplayRpcErrorClass
} from "../../types/room";
import { generateIdempotencyKey } from "../../utils/idempotencyKey";
import {
  type CompatibleRoomSnapshot
} from "./roomSnapshotAdapter";

const ACTIVE_GAME_POLL_INTERVAL_MS = 4000;

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
  const actionsRef = useRef(new Map<string, GameplayAction>());
  const generationRef = useRef(0);
  const mountedRef = useRef(false);
  const refreshInFlightRef = useRef<number | null>(null);
  const guestGrantRef = useRef<GuestRoomSessionGrant | null>(null);
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
    mountedRef.current = true;
    resetRoomRuntimeForIdentity({
      generationRef,
      refreshInFlightRef,
      guestGrantRef,
      completionInFlightRef,
      pendingRef,
      actionsRef,
      snapshotRef,
      context: { mode: context.mode },
      accessLost,
    });
    // Retired screens must not commit in-flight snapshots or commands to the shared store.
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };
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
    () => {
      if (!mountedRef.current) return Promise.resolve(null);
      return refreshActiveGameRoom({
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
      });
    },
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

  const applyRoomActionResult = useCallback(
    (
      mutation: PendingGameplayMutation,
      result: GameplayActionResult,
    ) =>
      applyGameplayActionResult({
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
    async (mutation: PendingGameplayMutation, action: GameplayAction) => {
      if (!mountedRef.current) throw new GameplayRpcErrorClass("service_unavailable", "Return to the game before changing it.");
      return runGameplayMutation({
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
      });
    },
    [applyRoomActionResult, isInteractive, status, updatePending],
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
      const action = createGameplayAction(
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
      return runMutation(mutation, action);
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
      const action = createGameplayAction(
        {
          id,
          kind: "drink",
          participantId,
          deltaHalfDrinks,
        },
        contextRef,
        guestGrantRef,
      );
      return runMutation(mutation, action);
    },
    [runMutation],
  );

  const retryMutation = useCallback(
    async (id: string) => {
      if (!mountedRef.current) throw new GameplayRpcErrorClass("service_unavailable", "Return to the game before changing it.");
      return retryGameplayMutation({
        id,
        pendingRef,
        actionsRef,
        updatePending,
        runMutation,
      });
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

  const completeGame = useCallback(
    async () => {
      if (!mountedRef.current) throw new GameplayRpcErrorClass("service_unavailable", "Return to the game before changing it.");
      return completeSharedGame({
        contextRef,
        completionInFlightRef,
        isHost,
        isEditable,
        setStatus,
        setError,
        refresh,
      });
    },
    [isEditable, isHost, refresh],
  );

  const reassignParticipantMatches = useCallback(
    async (
      participantId: string,
      matchIds: string[],
    ): Promise<ReassignParticipantMatchesResponse> => {
      if (!mountedRef.current) throw new GameplayRpcErrorClass("service_unavailable", "Return to the game before changing it.");
      return reassignRoomMatches({
        contextRef,
        isHost,
        isEditable,
        setStatus,
        setError,
        refresh,
        participantId,
        matchIds,
      });
    },
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
      acceptSnapshot: applySnapshot,
    }),
    [
      applySnapshot,
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

export type { ActiveGameSyncStatus, PendingGameplayMutation } from "./activeGameTypes";
