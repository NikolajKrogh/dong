import { useCallback, useEffect, useState } from "react";

import type { MyActiveRoom } from "../types/room";
import { getRoomRpcClient } from "../utils/supabaseClient";

export interface UseMyActiveRoomResult {
  activeRoom: MyActiveRoom | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Resolves the signed-in user's current active room from durable server state
 * (FR-0A6), powering the home "Return to room" affordance. Returns null when the
 * user is not in any active room or is not signed in.
 */
export const useMyActiveRoom = (enabled: boolean): UseMyActiveRoomResult => {
  const [activeRoom, setActiveRoom] = useState<MyActiveRoom | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setActiveRoom(null);
      return;
    }
    setIsLoading(true);
    try {
      const room = await getRoomRpcClient().getMyActiveRoom();
      setActiveRoom(room);
    } catch {
      setActiveRoom(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { activeRoom, isLoading, refresh };
};
