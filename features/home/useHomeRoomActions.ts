import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useGameStore } from "../../store/gameStore";
import { roomSnapshotToGameState } from "../rooms/roomSnapshotAdapter";
import { useAccountAuth } from "../account";
import { useGuestRoomJoin } from "../rooms/useGuestRoomJoin";
import { useHostRoomCreate } from "../rooms/useHostRoomCreate";
import { useMyActiveRoom } from "../rooms/useMyActiveRoom";
import { useRegisteredRoomJoin } from "../rooms/useRegisteredRoomJoin";
import { useRoomExit } from "../rooms/useRoomExit";
import type { MyActiveRoom, RoomSnapshot } from "../../types/room";
import { getRoomRpcClient } from "../rooms/roomRpcClient";

/**
 * Composes the room join/host/exit hooks used by the home screen (registered
 * join, guest join, host-create, active-room lookup, and leave/handover) plus
 * the handlers and modal state that orchestrate them.
 */
export const useHomeRoomActions = () => {
  const router = useRouter();
  const endedGuestSessionId = useGameStore((state) => state.endedGuestSessionId);
  const clearActiveGameContext = useGameStore(
    (state) => state.clearActiveGameContext,
  );
  const { account } = useAccountAuth();
  const {
    isCreating: isCreatingRoom,
    error: createRoomError,
    createRoom,
  } = useHostRoomCreate();
  const { activeRoom, isLoading: isActiveRoomLoading, error: membershipError, refresh: refreshActiveRoom } = useMyActiveRoom(
    account?.id ?? null,
  );
  const [roomDetails, setRoomDetails] = useState<{
    accountId: string; sessionId: string; snapshot: RoomSnapshot | null; error: string | null;
  } | null>(null);
  const roomSessionId = activeRoom?.sessionId;
  const accountId = account?.id;
  useEffect(() => {
    if (!roomSessionId || !accountId) return;
    let cancelled = false;
    Promise.resolve().then(() => getRoomRpcClient().getRoomSnapshot(roomSessionId)).then(
      (snapshot) => {
        if (!cancelled) setRoomDetails({ accountId, sessionId: roomSessionId, snapshot, error: null });
      },
      () => {
        if (!cancelled) setRoomDetails({ accountId, sessionId: roomSessionId, snapshot: null,
          error: "Unable to load your room. Check your connection and try again." });
      },
    );
    return () => { cancelled = true; };
  }, [accountId, roomSessionId]);
  const currentDetails = roomDetails?.accountId === accountId && roomDetails?.sessionId === roomSessionId
    ? roomDetails : null;
  const activeRoomSnapshot = currentDetails?.snapshot ?? null;
  const activeRoomError = membershipError ?? currentDetails?.error ?? null;
  const {
    isJoining: isJoiningRoom,
    error: joinRoomError,
    conflictRoom,
    joinRoom: joinRegisteredRoom,
    clearConflict,
  } = useRegisteredRoomJoin();
  const exit = useRoomExit();
  const [roomToLeave, setRoomToLeave] = useState<MyActiveRoom | null>(null);
  const exitTarget = roomToLeave ?? conflictRoom;

  const cancelRoomExit = useCallback(() => {
    if (exit.isExiting) return;
    setRoomToLeave(null);
    exit.cancel();
  }, [exit]);

  const openRoomExit = useCallback(() => {
    if (!activeRoom) return;
    exit.cancel();
    setRoomToLeave(activeRoom);
  }, [activeRoom, exit]);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [registeredJoinCode, setRegisteredJoinCode] = useState("");
  const {
    session: guestRoomSession,
    status: guestRoomStatus,
    error: guestRoomError,
    isSubmitting: isGuestJoinSubmitting,
    leaveRoom: leaveGuestRoom,
    submitGuestJoin,
    setMyPicks: setGuestPicks,
    isBusy: isGuestPickBusy,
  } = useGuestRoomJoin();
  const [isGuestJoinModalVisible, setIsGuestJoinModalVisible] = useState(false);
  const [guestJoinCode, setGuestJoinCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [hasDismissedGuestJoinModal, setHasDismissedGuestJoinModal] =
    useState(false);

  const handleReturnToRoom = useCallback(() => {
    if (!activeRoom) {
      return;
    }
    router.push({
      pathname: "/lobby/[sessionId]",
      params: {
        sessionId: activeRoom.sessionId,
      },
    });
  }, [activeRoom, router]);

  const handleSubmitRegisteredJoin = useCallback(async () => {
    const response = await joinRegisteredRoom(registeredJoinCode);
    if (response) {
      setIsJoinModalVisible(false);
      setRegisteredJoinCode("");
      router.push({
        pathname: "/lobby/[sessionId]",
        params: {
          sessionId: response.sessionId,
        },
      });
    }
    // On already_in_active_room, joinRegisteredRoom returns null and sets
    // conflictRoom — the modal renders the "Leave current room & switch" affordance.
  }, [joinRegisteredRoom, registeredJoinCode, router]);

  const completeRoomExit = useCallback(async () => {
    if (!exitTarget) return;
    // A room exit must not erase an unrelated solo game or another room.
    const store = useGameStore.getState();
    if (store.activeGameContext.sessionId === exitTarget.sessionId) store.resetState();
    setRoomToLeave(null);
    await refreshActiveRoom();
    if (roomToLeave) return;
    clearConflict();
    await handleSubmitRegisteredJoin();
  }, [exitTarget, roomToLeave, refreshActiveRoom, clearConflict, handleSubmitRegisteredJoin]);

  const handleLeaveCurrentAndSwitch = useCallback(async () => {
    if (!exitTarget || exit.isExiting) return;
    const result = await exit.exitRoom(exitTarget.sessionId, exitTarget.role);
    if (result) await completeRoomExit();
  }, [exitTarget, exit, completeRoomExit]);

  const handleChooseSuccessorOnHome = useCallback(async (participantId: string) => {
    if (!exitTarget || exit.isExiting) return;
    const result = await exit.confirmSuccessor(exitTarget.sessionId, participantId);
    if (result) await completeRoomExit();
  }, [exitTarget, exit, completeRoomExit]);

  const handleConfirmCloseOnHome = useCallback(async () => {
    if (!exitTarget || exit.isExiting) return;
    const result = await exit.confirmClose(exitTarget.sessionId);
    if (result) await completeRoomExit();
  }, [exitTarget, exit, completeRoomExit]);

  const handleOpenGuestJoin = useCallback(() => {
    setHasDismissedGuestJoinModal(false);
    setIsGuestJoinModalVisible(true);
  }, []);

  const handleCloseGuestJoin = useCallback(() => {
    setIsGuestJoinModalVisible(false);
    setHasDismissedGuestJoinModal(Boolean(guestRoomSession));
  }, [guestRoomSession]);

  const handleLeaveGuestJoin = useCallback(async () => {
    await leaveGuestRoom();
  }, [leaveGuestRoom]);

  // ---------------------------------------------------------------------------
  // A guest joins the game when the host starts it (FR-012), the same way a
  // registered member does. Until this existed the guest card simply sat on
  // "Current state: in_progress" forever -- the comment in GuestJoinLobby even
  // said so ("the registered lobby redirects away at that point; this card
  // stays on screen").
  //
  // It lives here rather than in GuestJoinLobby because that component unmounts
  // with the modal: the "seen it pre-start" ref below would reset every time the
  // guest reopened it. The poll runs off the grant, not the modal, so a guest
  // who dismissed the card is still pulled in.
  // ---------------------------------------------------------------------------
  const setPlayers = useGameStore((state) => state.setPlayers);
  const setMatches = useGameStore((state) => state.setMatches);
  const setCommonMatchId = useGameStore((state) => state.setCommonMatchId);
  const setPlayerAssignments = useGameStore(
    (state) => state.setPlayerAssignments,
  );
  const setActiveGameContext = useGameStore(
    (state) => state.setActiveGameContext,
  );
  const hydratedGuestGameplaySessionIdRef = useRef<string | null>(null);
  const handledGuestDepartureRef = useRef(false);
  // Same discriminator as the registered lobby: without it, opening the guest
  // card on an already-running room bounces straight to the game, and "Leave
  // Guest Room" -- which lives inside that card -- becomes unreachable.
  const seenGuestPreStartRef = useRef(false);

  const guestSnapshot = guestRoomSession?.snapshot ?? null;
  const guestGameStarted = guestSnapshot?.state === "in_progress";

  useEffect(() => {
    if (guestSnapshot && !guestGameStarted) {
      seenGuestPreStartRef.current = true;
    }
  }, [guestGameStarted, guestSnapshot]);

  useEffect(() => {
    if (
      !guestGameStarted ||
      !guestSnapshot ||
      guestSnapshot.sessionId === endedGuestSessionId ||
      hydratedGuestGameplaySessionIdRef.current === guestSnapshot.sessionId
    ) {
      return;
    }
    hydratedGuestGameplaySessionIdRef.current = guestSnapshot.sessionId;

    const gameState = roomSnapshotToGameState(guestSnapshot);
    setPlayers(gameState.players);
    setMatches(gameState.matches);
    setCommonMatchId(gameState.commonMatchId);
    setPlayerAssignments(gameState.playerAssignments);
    setActiveGameContext?.({
      mode: "multiplayer",
      sessionId: guestSnapshot.sessionId,
      participantId: guestRoomSession?.grant.participantId ?? null,
      accessKind: "guest",
      lastAppliedSequence: guestSnapshot.lastEventSequence ?? 0,
    });

    if (!seenGuestPreStartRef.current) {
      return;
    }

    // Close the card before navigating. It is a portal-less RN Modal rendering
    // into its own root view, so leaving it visible paints it over the game.
    setIsGuestJoinModalVisible(false);
    setHasDismissedGuestJoinModal(true);
    // push, not replace: back returns Home, where the card can be reopened to
    // leave the room.
    router.push("/gameProgress");
  }, [
    guestGameStarted,
    guestSnapshot,
    router,
    setCommonMatchId,
    setMatches,
    setPlayerAssignments,
    setPlayers,
    setActiveGameContext,
    guestRoomSession,
    guestRoomStatus,
    endedGuestSessionId,
  ]);

  useEffect(() => {
    if (guestRoomStatus === "ended" || (guestRoomSession && guestRoomSession.grant.sessionId === endedGuestSessionId)) {
      hydratedGuestGameplaySessionIdRef.current = null;
      seenGuestPreStartRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize the external room/request lifecycle; this is not derived render state.
      setGuestJoinCode("");
      setGuestName("");
      setIsGuestJoinModalVisible(false);
      setHasDismissedGuestJoinModal(false);
      return;
    }
    if (guestRoomStatus !== "left") {
      handledGuestDepartureRef.current = false;
    }
    if (!guestRoomSession) {
      hydratedGuestGameplaySessionIdRef.current = null;
      seenGuestPreStartRef.current = false;
      setHasDismissedGuestJoinModal(false);
      if (guestRoomStatus === "left") {
        if (!handledGuestDepartureRef.current) {
          handledGuestDepartureRef.current = true;
          clearActiveGameContext?.();
          setGuestJoinCode("");
          setGuestName("");
          setIsGuestJoinModalVisible(false);
          router.replace("/");
        }
        return;
      }
      if (guestRoomStatus === "pending_leave" || guestRoomStatus === "renewing" || guestRoomStatus === "expired") {
        setIsGuestJoinModalVisible(true);
      }
      return;
    }

    if (
      hydratedGuestGameplaySessionIdRef.current !== null &&
      hydratedGuestGameplaySessionIdRef.current !== guestRoomSession.snapshot.sessionId
    ) {
      hydratedGuestGameplaySessionIdRef.current = null;
      seenGuestPreStartRef.current = false;
    }

    // Never auto-open over a running game. This effect re-runs on every poll
    // (each refresh yields a fresh session object), so once the game starts it
    // would otherwise keep re-raising the card on top of the game screen the
    // guest was just sent to. Reaching the card deliberately -- to leave the
    // room -- still works: handleOpenGuestJoin sets visibility directly.
    if (guestGameStarted) {
      return;
    }

    if (!hasDismissedGuestJoinModal) {
      setIsGuestJoinModalVisible(true);
    }
  }, [
    clearActiveGameContext,
    guestGameStarted,
    guestRoomSession,
    guestRoomStatus,
    hasDismissedGuestJoinModal,
    router,
    endedGuestSessionId,
  ]);

  return {
    account,
    activeRoom,
    activeRoomSnapshot,
    isActiveRoomLoading,
    activeRoomError,
    refreshActiveRoom,
    roomToLeave,
    openRoomExit,
    cancelRoomExit,
    isCreatingRoom,
    createRoomError,
    createRoom,
    isJoiningRoom,
    joinRoomError,
    conflictRoom,
    clearConflict,
    exit,
    isJoinModalVisible,
    setIsJoinModalVisible,
    registeredJoinCode,
    setRegisteredJoinCode,
    guestRoomSession,
    guestRoomStatus,
    guestRoomError,
    isGuestJoinSubmitting,
    submitGuestJoin,
    setGuestPicks,
    isGuestPickBusy,
    isGuestJoinModalVisible,
    guestJoinCode,
    setGuestJoinCode,
    guestName,
    setGuestName,
    handleReturnToRoom,
    handleSubmitRegisteredJoin,
    handleLeaveCurrentAndSwitch,
    handleChooseSuccessorOnHome,
    handleConfirmCloseOnHome,
    handleOpenGuestJoin,
    handleCloseGuestJoin,
    handleLeaveGuestJoin,
  };
};
