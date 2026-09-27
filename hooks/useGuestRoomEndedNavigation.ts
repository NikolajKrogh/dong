import { useEffect, useRef } from "react";
import { useRootNavigationState, useRouter } from "expo-router";
import { useGameStore } from "../store/store";

/** One navigation owner prevents competing Home/game pollers restarting the timer. */
export const useGuestRoomEndedNavigation = () => {
  const sessionId = useGameStore((state) => state.endedGuestSessionId);
  const navigation = useRootNavigationState();
  const router = useRouter();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!navigation?.key || !sessionId || handled.current === sessionId) return;
    handled.current = sessionId;
    router.replace("/roomEnded");
  }, [navigation?.key, router, sessionId]);
};
