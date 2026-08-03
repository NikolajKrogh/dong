import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { ROOM_ERROR } from "../types/room";
import { getHostRoomRpcClient } from "../utils/supabaseClient";

/**
 * Turns the RPC's raised code into something a host can act on.
 *
 * Reads `error.message`, matching every other room hook. The previous
 * `err instanceof Error ? err.message : "Failed to create room."` never took
 * its first branch: Supabase rejects with a PostgrestError, which is a plain
 * object and not an Error. So every failure — already in a room, signed out,
 * network down — surfaced as the same "Failed to create room." and the actual
 * reason only existed in the Postgres log.
 */
const messageFor = (error: unknown): string => {
  const code = (error as { message?: string } | null)?.message ?? "";
  switch (code) {
    case ROOM_ERROR.alreadyInActiveRoom:
      return "You're already in a room. Leave or end it before creating another.";
    case ROOM_ERROR.notAuthenticated:
      return "Sign in to create a room.";
    case "create_room_code_exhausted":
      return "Couldn't allocate a join code just now. Try again.";
    default:
      return "Failed to create room.";
  }
};

export interface UseHostRoomCreateResult {
  isCreating: boolean;
  error: string | null;
  createRoom: () => Promise<void>;
}

export const useHostRoomCreate = (): UseHostRoomCreateResult => {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = useCallback(async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await getHostRoomRpcClient().createRoomAsHost();

      router.push({
        pathname: "/lobby/[sessionId]",
        params: {
          sessionId: response.sessionId,
          participantId: response.hostParticipantId,
        },
      });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setIsCreating(false);
    }
  }, [router]);

  return { isCreating, error, createRoom };
};
