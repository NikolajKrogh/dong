import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { useGameStore } from "../../store/gameStore";
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
    submitGuestJoin: joinGuestRoom,
    setMyPicks: setGuestPicks,
    isBusy: isGuestPickBusy,
  } = useGuestRoomJoin();
  const [isGuestJoinModalVisible, setIsGuestJoinModalVisible] = useState(false);
  const [guestJoinCode, setGuestJoinCode] = useState("");
  const [guestName, setGuestName] = useState("");
  useEffect(() => {
    if (guestRoomStatus !== "left" && guestRoomStatus !== "ended") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Clear the completed external guest flow.
    setGuestJoinCode("");
    setGuestName("");
    setIsGuestJoinModalVisible(false);
  }, [guestRoomStatus]);

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
    if (guestRoomSession || guestRoomStatus === "pending_leave" || guestRoomStatus === "renewing") {
      router.push("/guestRoom?tab=matches");
      return;
    }
    setIsGuestJoinModalVisible(true);
  }, [guestRoomSession, guestRoomStatus, router]);

  const handleCloseGuestJoin = useCallback(() => {
    setIsGuestJoinModalVisible(false);
  }, []);

  const submitGuestJoin = useCallback(async (code: string, name: string) => {
    const joined = await joinGuestRoom(code, name);
    if (joined) setIsGuestJoinModalVisible(false);
    return joined;
  }, [joinGuestRoom]);

  const handleLeaveGuestRoom = useCallback(async () => {
    await leaveGuestRoom();
  }, [leaveGuestRoom]);

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
    handleLeaveGuestRoom,
  };
};
