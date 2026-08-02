import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useGameStore } from "../store/store";
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
  const hasHydratedGuestGameplayRef = useRef(false);
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
      hasHydratedGuestGameplayRef.current
    ) {
      return;
    }
    hasHydratedGuestGameplayRef.current = true;

    setPlayers(
      guestSnapshot.participants.map((participant) => ({
        id: participant.id,
        name: participant.displayName,
        drinksTaken: participant.currentDrinkTotal,
      })),
    );
    setMatches(
      guestSnapshot.matches.map((match) => ({
        id: match.id,
        homeTeam: match.homeTeamName,
        awayTeam: match.awayTeamName,
        // Coalesced: a guest's scores are nullable where the registered
        // snapshot's are not, and the game screen increments these.
        homeGoals: match.homeScore ?? 0,
        awayGoals: match.awayScore ?? 0,
        startTime: match.kickoffAt ?? undefined,
      })),
    );
    setCommonMatchId(guestSnapshot.commonMatchId);
    setPlayerAssignments(
      guestSnapshot.participants.reduce<Record<string, string[]>>(
        (accumulator, participant) => {
          accumulator[participant.id] = guestSnapshot.assignments
            .filter(
              (assignment) =>
                assignment.participantId === participant.id &&
                assignment.matchId !== guestSnapshot.commonMatchId,
            )
            .map((assignment) => assignment.matchId);
          return accumulator;
        },
        {},
      ),
    );

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
  ]);

  useEffect(() => {
    if (!guestRoomSession) {
      setHasDismissedGuestJoinModal(false);
      return;
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
  }, [guestGameStarted, guestRoomSession, hasDismissedGuestJoinModal]);

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
    setGuestPicks,
    isGuestPickBusy,
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
