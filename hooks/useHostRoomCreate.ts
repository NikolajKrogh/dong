import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { getHostRoomRpcClient } from "../utils/supabaseClient";

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
      setError(
        err instanceof Error ? err.message : "Failed to create room.",
      );
    } finally {
      setIsCreating(false);
    }
  }, [router]);

  return { isCreating, error, createRoom };
};
