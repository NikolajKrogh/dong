import { useGameStore } from "../store/store";
import { clearGuestRoomSessionGrant } from "./guestRoom";

export const isGuestRoomEnded = (sessionId: string | null | undefined) =>
  Boolean(sessionId && useGameStore.getState().endedGuestSessionId === sessionId);

/** Both room pollers can observe termination. Publish it once, before any await. */
export const confirmGuestRoomEnded = async (sessionId: string) => {
  const state = useGameStore.getState();
  if (state.activeGameContext.sessionId && state.activeGameContext.sessionId !== sessionId) return;
  if (!isGuestRoomEnded(sessionId)) {
    useGameStore.setState({ endedGuestSessionId: sessionId });
    state.resetState();
  }
  // Navigation is deduplicated; deletion remains retryable after a storage error.
  await clearGuestRoomSessionGrant(sessionId);
};
