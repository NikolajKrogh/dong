import { useCallback, useEffect, useRef, useState } from "react";

import type { MyActiveRoom } from "../types/room";
import { getRoomRpcClient } from "../utils/supabaseClient";

export interface UseMyActiveRoomResult {
  activeRoom: MyActiveRoom | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Resolves the signed-in user's current active room from durable server state
 * (FR-0A6), powering Home and direct lobby entry. Account-scoped state prevents
 * an earlier account's response from restoring its room after a switch.
 */
export const useMyActiveRoom = (accountId: string | null): UseMyActiveRoomResult => {
  const [state, setState] = useState<{
    accountId: string | null;
    activeRoom: MyActiveRoom | null;
    isLoading: boolean;
    error: string | null;
  }>({ accountId: null, activeRoom: null, isLoading: false, error: null });
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!accountId) {
      setState({ accountId: null, activeRoom: null, isLoading: false, error: null });
      return;
    }
    setState({ accountId, activeRoom: null, isLoading: true, error: null });
    try {
      const room = await getRoomRpcClient().getMyActiveRoom();
      if (version !== requestVersion.current) return;
      setState({ accountId, activeRoom: room, isLoading: false, error: null });
    } catch {
      if (version !== requestVersion.current) return;
      setState({
        accountId, activeRoom: null, isLoading: false,
        error: "Unable to load your room. Check your connection and try again.",
      });
    }
  }, [accountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize the external room/request lifecycle; this is not derived render state.
    void refresh();
    return () => { requestVersion.current += 1; };
  }, [refresh]);

  const belongsToAccount = state.accountId === accountId;
  return {
    activeRoom: belongsToAccount ? state.activeRoom : null,
    isLoading: accountId !== null && (!belongsToAccount || state.isLoading),
    error: belongsToAccount ? state.error : null,
    refresh,
  };
};
