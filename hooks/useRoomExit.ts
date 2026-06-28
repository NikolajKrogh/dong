import { useCallback, useState } from "react";

import type {
  HostLeaveResponse,
  MemberLeaveResponse,
  RoomParticipantSummary,
  RoomSessionRole,
} from "../types/room";
import { ROOM_ERROR } from "../types/room";
import { getRoomRpcClient } from "../utils/supabaseClient";

export type RoomExitResult = HostLeaveResponse | MemberLeaveResponse;

export interface UseRoomExitResult {
  isExiting: boolean;
  error: string | null;
  /** Host must pick among several eligible registered members. */
  pendingSuccessorChoice: boolean;
  eligibleSuccessors: RoomParticipantSummary[];
  /** All eligible members vanished mid-choice — confirm closing instead. */
  needsCloseConfirm: boolean;
  exitRoom: (
    sessionId: string,
    myRole: RoomSessionRole,
  ) => Promise<RoomExitResult | null>;
  confirmSuccessor: (
    sessionId: string,
    participantId: string,
  ) => Promise<HostLeaveResponse | null>;
  confirmClose: (sessionId: string) => Promise<HostLeaveResponse | null>;
  cancel: () => void;
}

const loadEligibleSuccessors = async (
  sessionId: string,
): Promise<RoomParticipantSummary[]> => {
  const snapshot = await getRoomRpcClient().getRoomSnapshot(sessionId);
  return snapshot.participants.filter(
    (p) => p.membershipType === "registered" && p.sessionRole === "member",
  );
};

export const useRoomExit = (): UseRoomExitResult => {
  const [isExiting, setIsExiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSuccessorChoice, setPendingSuccessorChoice] = useState(false);
  const [eligibleSuccessors, setEligibleSuccessors] = useState<
    RoomParticipantSummary[]
  >([]);
  const [needsCloseConfirm, setNeedsCloseConfirm] = useState(false);

  const cancel = useCallback(() => {
    setPendingSuccessorChoice(false);
    setEligibleSuccessors([]);
    setNeedsCloseConfirm(false);
    setError(null);
  }, []);

  // When the server says a choice is needed (or a stale pick), re-derive UI state
  // from a fresh roster: 0 → confirm close, 1 → auto, >1 → prompt.
  const resolveSuccessorState = useCallback(async (sessionId: string) => {
    const eligible = await loadEligibleSuccessors(sessionId);
    if (eligible.length === 0) {
      setPendingSuccessorChoice(false);
      setNeedsCloseConfirm(true);
      return null;
    }
    if (eligible.length === 1) {
      const response = await getRoomRpcClient().leaveRoomAsHost(
        sessionId,
        eligible[0].id,
      );
      cancel();
      return response;
    }
    setEligibleSuccessors(eligible);
    setNeedsCloseConfirm(false);
    setPendingSuccessorChoice(true);
    return null;
  }, [cancel]);

  const exitRoom = useCallback(
    async (sessionId: string, myRole: RoomSessionRole) => {
      setIsExiting(true);
      setError(null);
      try {
        if (myRole !== "owner") {
          return await getRoomRpcClient().leaveRoomAsMember(sessionId);
        }
        try {
          return await getRoomRpcClient().leaveRoomAsHost(sessionId);
        } catch (hostError) {
          const code = (hostError as { message?: string } | null)?.message;
          if (code === ROOM_ERROR.successorRequired) {
            return await resolveSuccessorState(sessionId);
          }
          throw hostError;
        }
      } catch (exitError) {
        setError(
          exitError instanceof Error
            ? exitError.message
            : "Unable to leave the room right now.",
        );
        return null;
      } finally {
        setIsExiting(false);
      }
    },
    [resolveSuccessorState],
  );

  const confirmSuccessor = useCallback(
    async (sessionId: string, participantId: string) => {
      setIsExiting(true);
      setError(null);
      try {
        const response = await getRoomRpcClient().leaveRoomAsHost(
          sessionId,
          participantId,
        );
        cancel();
        return response;
      } catch (confirmError) {
        const code = (confirmError as { message?: string } | null)?.message;
        if (code === ROOM_ERROR.successorNotEligible) {
          // Candidate left meanwhile — re-resolve from a fresh roster.
          return (await resolveSuccessorState(sessionId)) as
            | HostLeaveResponse
            | null;
        }
        setError(
          confirmError instanceof Error
            ? confirmError.message
            : "Unable to hand over the room right now.",
        );
        return null;
      } finally {
        setIsExiting(false);
      }
    },
    [cancel, resolveSuccessorState],
  );

  const confirmClose = useCallback(
    async (sessionId: string) => {
      setIsExiting(true);
      setError(null);
      try {
        const response = await getRoomRpcClient().leaveRoomAsHost(sessionId);
        cancel();
        return response.status === "closed" ? response : response;
      } catch (closeError) {
        setError(
          closeError instanceof Error
            ? closeError.message
            : "Unable to close the room right now.",
        );
        return null;
      } finally {
        setIsExiting(false);
      }
    },
    [cancel],
  );

  return {
    isExiting,
    error,
    pendingSuccessorChoice,
    eligibleSuccessors,
    needsCloseConfirm,
    exitRoom,
    confirmSuccessor,
    confirmClose,
    cancel,
  };
};
