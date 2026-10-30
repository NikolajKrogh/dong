import { useEffect, useRef } from "react";
import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useGameStore } from "../../store/gameStore";
import { roomSnapshotToGameState } from "./roomSnapshotAdapter";
import { useGuestRoomSession } from "./useGuestRoomSession";

/** Navigation and hydration outlive any individual guest screen. */
export function GuestRoomLifecycle(): null {
  const { session, status } = useGuestRoomSession();
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useRootNavigationState();
  const endedSessionId = useGameStore((state) => state.endedGuestSessionId);
  const seenPreStartSessionId = useRef<string | null>(null);
  const hydratedSessionId = useRef<string | null>(null);
  const openedRoomSessionId = useRef<string | null>(null);
  const hasHandledDeparture = useRef(false);
  const recoveryOpened = useRef(false);

  useEffect(() => {
    if (!navigation?.key) return;
    if (status === "ended") {
      seenPreStartSessionId.current = null;
      hydratedSessionId.current = null;
      openedRoomSessionId.current = null;
      return;
    }
    if (status === "left") {
      if (!hasHandledDeparture.current) {
        hasHandledDeparture.current = true;
        const store = useGameStore.getState();
        if (store.activeGameContext.accessKind === "guest") store.resetState();
        seenPreStartSessionId.current = null;
        hydratedSessionId.current = null;
        openedRoomSessionId.current = null;
        router.replace("/");
      }
      return;
    }
    hasHandledDeparture.current = false;
    if (["renewing", "pending_leave", "expired"].includes(status)) {
      if (pathname === "/" && !recoveryOpened.current) {
        recoveryOpened.current = true;
        router.push("/guestRoom?tab=matches");
      }
      return;
    }
    recoveryOpened.current = false;
    if (!session || session.snapshot.sessionId === endedSessionId) return;
    const { snapshot, grant } = session;
    if (snapshot.state === "joinable") {
      seenPreStartSessionId.current = snapshot.sessionId;
      if (pathname === "/" && openedRoomSessionId.current !== snapshot.sessionId) {
        openedRoomSessionId.current = snapshot.sessionId;
        router.push("/guestRoom?tab=matches");
      }
      return;
    }
    if (snapshot.state !== "in_progress" || hydratedSessionId.current === snapshot.sessionId) return;
    hydratedSessionId.current = snapshot.sessionId;
    const game = roomSnapshotToGameState(snapshot);
    const store = useGameStore.getState();
    store.setPlayers(game.players);
    store.setMatches(game.matches);
    store.setCommonMatchId(game.commonMatchId);
    store.setPlayerAssignments(game.playerAssignments);
    store.setActiveGameContext({
      mode: "multiplayer",
      sessionId: snapshot.sessionId,
      participantId: grant.participantId,
      accessKind: "guest",
      lastAppliedSequence: snapshot.lastEventSequence ?? 0,
    });
    if (seenPreStartSessionId.current === snapshot.sessionId && pathname !== "/gameProgress") {
      if (pathname === "/guestRoom") router.replace("/gameProgress");
      else router.push("/gameProgress");
    }
  }, [session, status, router, pathname, navigation?.key, endedSessionId]);
  return null;
}
