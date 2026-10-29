import { useRouter } from "expo-router";
import {
  useEffect,
  useRef
} from "react";
import { useGameStore } from "../../store/gameStore";
import {
  roomSnapshotToGameState
} from "./roomSnapshotAdapter";
import { RoomLobbyState } from "./useLobbyAssignmentController";

type LobbyRouter = ReturnType<typeof useRouter>;

export function useLobbyGameplayHydration(
  lobby: RoomLobbyState,
  participantId: string,
  router: LobbyRouter,
) {
  const hasHydratedGameplayRef = useRef(false);
  // Only a start observed after this mount began in the lobby should redirect.
  const seenPreStartRef = useRef(false);
  const setPlayers = useGameStore((state) => state.setPlayers);
  const setMatches = useGameStore((state) => state.setMatches);
  const setCommonMatchId = useGameStore((state) => state.setCommonMatchId);
  const setPlayerAssignments = useGameStore((state) => state.setPlayerAssignments);
  const setActiveGameContext = useGameStore((state) => state.setActiveGameContext);

  useEffect(() => {
    if (lobby.snapshot && !lobby.gameStarted) seenPreStartRef.current = true;
  }, [lobby.gameStarted, lobby.snapshot]);

  useEffect(() => {
    const snapshot = lobby.snapshot;
    if (!lobby.gameStarted || !snapshot || hasHydratedGameplayRef.current) return;
    hasHydratedGameplayRef.current = true;
    const gameState = roomSnapshotToGameState(snapshot);
    setPlayers(gameState.players);
    setMatches(gameState.matches);
    setCommonMatchId(gameState.commonMatchId);
    setPlayerAssignments(gameState.playerAssignments);
    setActiveGameContext?.({
      mode: "multiplayer",
      sessionId: snapshot.sessionId,
      participantId,
      accessKind: "registered",
      lastAppliedSequence: snapshot.lastEventSequence ?? 0,
    });
    if (seenPreStartRef.current) router.replace("/gameProgress");
  }, [
    lobby.gameStarted,
    lobby.snapshot,
    participantId,
    router,
    setActiveGameContext,
    setCommonMatchId,
    setMatches,
    setPlayerAssignments,
    setPlayers,
  ]);
}
