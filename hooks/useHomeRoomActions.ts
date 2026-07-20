import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { useAccountAuth } from "./useAccountAuth";
import { useGuestRoomJoin } from "./useGuestRoomJoin";
import { useHostRoomCreate } from "./useHostRoomCreate";
import { useMyActiveRoom } from "./useMyActiveRoom";
import { useRegisteredRoomJoin } from "./useRegisteredRoomJoin";
import { useRoomExit } from "./useRoomExit";

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
  const { activeRoom, refresh: refreshActiveRoom } = useMyActiveRoom(
    account !== null,
  );
  const {
    isJoining: isJoiningRoom,
    error: joinRoomError,
    conflictRoom,
    joinRoom: joinRegisteredRoom,
    clearConflict,
  } = useRegisteredRoomJoin();
  const exit = useRoomExit();
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [registeredJoinCode, setRegisteredJoinCode] = useState("");
  const {
    session: guestRoomSession,
    error: guestRoomError,
    isSubmitting: isGuestJoinSubmitting,
    leaveRoom: leaveGuestRoom,
    submitGuestJoin,
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
        participantId: activeRoom.participantId,
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
          participantId: response.participantId,
        },
      });
    }
    // On already_in_active_room, joinRegisteredRoom returns null and sets
    // conflictRoom — the modal renders the "Leave current room & switch" affordance.
  }, [joinRegisteredRoom, registeredJoinCode, router]);

  const handleLeaveCurrentAndSwitch = useCallback(async () => {
    if (!conflictRoom) {
      return;
    }
    const result = await exit.exitRoom(
      conflictRoom.sessionId,
      conflictRoom.role,
    );
    // If exit needs a host successor choice, the modal stays open; the chooser
    // surfaces via exit.pendingSuccessorChoice (rendered below).
    if (!result) {
      return;
    }
    await refreshActiveRoom();
    clearConflict();
    // Retry the original join with the same code.
    const response = await joinRegisteredRoom(registeredJoinCode);
    if (response) {
      setIsJoinModalVisible(false);
      setRegisteredJoinCode("");
      router.push({
        pathname: "/lobby/[sessionId]",
        params: {
          sessionId: response.sessionId,
          participantId: response.participantId,
        },
      });
    }
  }, [
    clearConflict,
    conflictRoom,
    exit,
    joinRegisteredRoom,
    refreshActiveRoom,
    registeredJoinCode,
    router,
  ]);

  const handleChooseSuccessorOnHome = useCallback(
    async (participantId: string) => {
      if (!conflictRoom) {
        return;
      }
      const result = await exit.confirmSuccessor(
        conflictRoom.sessionId,
        participantId,
      );
      if (!result) {
        return;
      }
      await refreshActiveRoom();
      clearConflict();
      const response = await joinRegisteredRoom(registeredJoinCode);
      if (response) {
        setIsJoinModalVisible(false);
        setRegisteredJoinCode("");
        router.push({
          pathname: "/lobby/[sessionId]",
          params: {
            sessionId: response.sessionId,
            participantId: response.participantId,
          },
        });
      }
    },
    [
      clearConflict,
      conflictRoom,
      exit,
      joinRegisteredRoom,
      refreshActiveRoom,
      registeredJoinCode,
      router,
    ],
  );

  const handleConfirmCloseOnHome = useCallback(async () => {
    if (!conflictRoom) {
      return;
    }
    const result = await exit.confirmClose(conflictRoom.sessionId);
    if (!result) {
      return;
    }
    await refreshActiveRoom();
    clearConflict();
    const response = await joinRegisteredRoom(registeredJoinCode);
    if (response) {
      setIsJoinModalVisible(false);
      setRegisteredJoinCode("");
      router.push({
        pathname: "/lobby/[sessionId]",
        params: {
          sessionId: response.sessionId,
          participantId: response.participantId,
        },
      });
    }
  }, [
    clearConflict,
    conflictRoom,
    exit,
    joinRegisteredRoom,
    refreshActiveRoom,
    registeredJoinCode,
    router,
  ]);

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
    setGuestJoinCode("");
    setGuestName("");
    setHasDismissedGuestJoinModal(false);
    setIsGuestJoinModalVisible(false);
  }, [leaveGuestRoom]);

  const guestJoinActionLabel = guestRoomSession
    ? "Return to Guest Room"
    : "Join Room as Guest";

  useEffect(() => {
    if (!guestRoomSession) {
      setHasDismissedGuestJoinModal(false);
      return;
    }

    if (!hasDismissedGuestJoinModal) {
      setIsGuestJoinModalVisible(true);
    }
  }, [guestRoomSession, hasDismissedGuestJoinModal]);

  return {
    account,
    activeRoom,
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
    guestRoomError,
    isGuestJoinSubmitting,
    submitGuestJoin,
    isGuestJoinModalVisible,
    guestJoinCode,
    setGuestJoinCode,
    guestName,
    setGuestName,
    guestJoinActionLabel,
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

export default useHomeRoomActions;
