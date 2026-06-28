import { useCallback, useState } from "react";

import type { MyActiveRoom, RegisteredJoinResponse } from "../types/room";
import { ROOM_ERROR } from "../types/room";
import { getRoomRpcClient } from "../utils/supabaseClient";

export interface UseRegisteredRoomJoinResult {
  isJoining: boolean;
  error: string | null;
  /** Set when the join was blocked because the user is already in another active room. */
  conflictRoom: MyActiveRoom | null;
  joinRoom: (joinCode: string) => Promise<RegisteredJoinResponse | null>;
  clearConflict: () => void;
}

const messageFor = (error: unknown): string => {
  const code = (error as { message?: string } | null)?.message ?? "";
  switch (code) {
    case ROOM_ERROR.roomNotFound:
      return "We couldn't find that room. Check the code and try again.";
    case ROOM_ERROR.roomNotJoinable:
      return "This room is no longer accepting players.";
    case ROOM_ERROR.notAuthenticated:
      return "Sign in to join a room as a member.";
    default:
      return "Unable to join the room right now.";
  }
};

export const useRegisteredRoomJoin = (): UseRegisteredRoomJoinResult => {
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictRoom, setConflictRoom] = useState<MyActiveRoom | null>(null);

  const clearConflict = useCallback(() => setConflictRoom(null), []);

  const joinRoom = useCallback(async (joinCode: string) => {
    setIsJoining(true);
    setError(null);
    setConflictRoom(null);
    try {
      return await getRoomRpcClient().joinRoomAsRegistered(joinCode.trim());
    } catch (joinError) {
      const code = (joinError as { message?: string } | null)?.message ?? "";
      if (code === ROOM_ERROR.alreadyInActiveRoom) {
        // Surface the conflicting room so the caller can run the easy-exit flow.
        const active = await getRoomRpcClient()
          .getMyActiveRoom()
          .catch(() => null);
        setConflictRoom(active);
        setError(null);
        return null;
      }
      setError(messageFor(joinError));
      return null;
    } finally {
      setIsJoining(false);
    }
  }, []);

  return { isJoining, error, conflictRoom, joinRoom, clearConflict };
};
