import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useLiveScores } from "./useLiveScores";
import { usePersistedTeamLogos } from "./usePersistedTeamLogos";
import { useGoalToastQueue } from "./useGoalToastQueue";
import {
  gameProgressUiReducer,
  initialGameProgressUiState,
} from "./gameProgress/uiReducer";
import { migrateLegacyMatch } from "./gameProgress/matchMigration";
import { getMatchSourceStatusMessage } from "./gameProgress/sourceStatus";
import { LastGoalInfo, updateMatchForGoal } from "./gameProgress/goalScoring";
import { createGameProgressStyles } from "../styles/gameProgressStyles";
import { useColors } from "../styles/theme";
import { useGameStore } from "../store/store";
import { useAppVisibility, useGoalSound } from "../platform";
import { useActiveGameRoomSync } from "./useActiveGameRoomSync";
import { useNavigationReady } from "../utils/navigation/useNavigationReady";

const subscribeGameHydration = (onChange: () => void) => {
  const begin = useGameStore.persist.onHydrate(onChange);
  const finish = useGameStore.persist.onFinishHydration(onChange);
  return () => { begin(); finish(); };
};

const useGameProgressController = () => {
  const hasHydrated = useSyncExternalStore(subscribeGameHydration, useGameStore.persist.hasHydrated, () => false);
  const router = useRouter();
  const navigationReady = useNavigationReady();
  const params = useLocalSearchParams<{ gameTab?: string | string[] }>();
  const activeTab = params.gameTab === "players" ? "players" : "matches";
  const [isRoomStatusVisible, setRoomStatusVisible] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createGameProgressStyles(colors), [colors]);

  usePersistedTeamLogos();

  const [uiState, dispatchUi] = useReducer(
    gameProgressUiReducer,
    initialGameProgressUiState,
  );
  const {
    isAlertVisible,
    selectedMatchId,
    isQuickActionsVisible,
    refreshing,
  } = uiState;
  const { visibilityState } = useAppVisibility();
  const activeGame = useActiveGameRoomSync();
  const lastActiveSessionIdRef = useRef<string | null>(null);
  const terminalSessionIdRef = useRef<string | null>(null);

  const {
    activeGameContext,
    endedGuestSessionId,
    players,
    matches,
    commonMatchId,
    playerAssignments,
    setPlayers,
    setMatches,
    saveGameToHistory,
    resetState,
    clearActiveGameContext,
    soundEnabled,
    commonMatchNotificationsEnabled,
  } = useGameStore();

  useEffect(() => {
    if (activeGameContext.sessionId) {
      lastActiveSessionIdRef.current = activeGameContext.sessionId;
    }
  }, [activeGameContext.sessionId]);

  useEffect(() => {
    const isTerminal = activeGame.status === "ended"
      || activeGame.status === "access_lost"
      || activeGame.snapshot?.state === "completed"
      || activeGame.snapshot?.state === "closed";
    const sessionId = activeGame.snapshot?.sessionId
      ?? activeGameContext.sessionId
      ?? lastActiveSessionIdRef.current;
    if (!activeGame.isMultiplayer || !isTerminal || !sessionId
      || endedGuestSessionId === sessionId
      || terminalSessionIdRef.current === sessionId) {
      return;
    }

    terminalSessionIdRef.current = sessionId;
    resetState();
    router.replace("/");
  }, [
    activeGame.isMultiplayer,
    activeGame.snapshot?.sessionId,
    activeGame.snapshot?.state,
    activeGame.status,
    activeGameContext.sessionId,
    resetState,
    router,
    endedGuestSessionId,
  ]);
  const { playGoalSound } = useGoalSound({
    enabled: soundEnabled,
    visibilityState,
    onError: (error) => {
      console.error("Error playing sound:", error);
    },
  });

  const getPlayersWhoDrink = useCallback(
    (matchId: string): string[] => {
      if (matchId === commonMatchId) {
        return players.map((player) => player.name);
      }

      return players
        .filter((player) => playerAssignments[player.id]?.includes(matchId))
        .map((player) => player.name);
    },
    [commonMatchId, playerAssignments, players],
  );

  const { enqueueGoalToast } = useGoalToastQueue(getPlayersWhoDrink);

  const handleGoalNotification = useCallback(
    (goalInfo: LastGoalInfo) => {
      if (
        goalInfo.matchId === commonMatchId &&
        !commonMatchNotificationsEnabled
      ) {
        return;
      }

      void playGoalSound();
      enqueueGoalToast(goalInfo);
    },
    [
      commonMatchId,
      commonMatchNotificationsEnabled,
      playGoalSound,
      enqueueGoalToast,
    ],
  );

  const handleGoalIncrement = useCallback(
    (matchId: string, team: "home" | "away", newTotal?: number) => {
      if (activeGame.isMultiplayer) {
        // Provider observations are accepted through the authenticated Edge
        // Function path; a live-score callback must never fabricate participant
        // goals.
        if (typeof newTotal === "number" || !activeGame.isEditable) {
          return;
        }
        void activeGame.changeManualScore(matchId, team, 1).catch(() => undefined);
        return;
      }

      let goalScoredInfo: LastGoalInfo | null = null;

      setMatches((prevMatches) =>
        prevMatches.map((match) => {
          if (match.id !== matchId) {
            return match;
          }

          const { updatedMatch, goalInfo } = updateMatchForGoal(
            match,
            team,
            newTotal,
          );

          goalScoredInfo = goalInfo;
          return updatedMatch;
        }),
      );

      if (goalScoredInfo) {
        handleGoalNotification(goalScoredInfo);
      }
    },
    [activeGame, handleGoalNotification, setMatches],
  );

  const handleGoalDecrement = useCallback(
    (matchId: string, team: "home" | "away") => {
      if (activeGame.isMultiplayer) {
        if (!activeGame.isEditable) return;
        void activeGame.changeManualScore(matchId, team, -1).catch(() => undefined);
        return;
      }
      setMatches((prevMatches) =>
        prevMatches.map((match) => {
          if (match.id === matchId) {
            if (team === "home" && (match.homeGoals || 0) > 0) {
              return { ...match, homeGoals: (match.homeGoals || 0) - 1 };
            }

            if (team === "away" && (match.awayGoals || 0) > 0) {
              return { ...match, awayGoals: (match.awayGoals || 0) - 1 };
            }
          }

          return match;
        }),
      );
    },
    [activeGame, setMatches],
  );

  const handleDrinkIncrement = useCallback(
    (playerId: string) => {
      if (activeGame.isMultiplayer) {
        if (!activeGame.isEditable) return;
        void activeGame.changeParticipantDrink(playerId, 1).catch(() => undefined);
        return;
      }
      setPlayers((prevPlayers) =>
        prevPlayers.map((player) => {
          return player.id === playerId
            ? {
                ...player,
                drinksTaken: (player.drinksTaken || 0) + 0.5,
              }
            : player;
        }),
      );
    },
    [activeGame, setPlayers],
  );

  const handleDrinkDecrement = useCallback(
    (playerId: string) => {
      if (activeGame.isMultiplayer) {
        if (!activeGame.isEditable) return;
        void activeGame.changeParticipantDrink(playerId, -1).catch(() => undefined);
        return;
      }
      setPlayers((prevPlayers) =>
        prevPlayers.map((player) => {
          return player.id === playerId && (player.drinksTaken ?? 0) > 0
            ? {
                ...player,
                drinksTaken: (player.drinksTaken ?? 0) - 0.5,
              }
            : player;
        }),
      );
    },
    [activeGame, setPlayers],
  );

  useEffect(() => {
    if (navigationReady && params.gameTab !== undefined && params.gameTab !== "players" && params.gameTab !== "matches") {
      router.setParams({ gameTab: undefined });
    }
  }, [navigationReady, params.gameTab, router]);

  const setActiveTab = useCallback((tab: string) => {
    const gameTab = tab === "players" ? "players" : undefined;
    if (activeTab !== (gameTab ?? "matches")) router.setParams({ gameTab });
  }, [activeTab, router]);

  const {
    liveMatches,
    isPolling,
    lastUpdated,
    error: sourceError,
    startPolling,
    stopPolling,
    fetchCurrentScores,
    captureHistoryDetails,
    endTracking,
  } = useLiveScores(matches, handleGoalIncrement, 60000, !activeGame.isMultiplayer);

  const handleEndGame = useCallback(() => {
    if (!activeGame.isMultiplayer && matches.length === 0) return;
    if (activeGame.isMultiplayer && (!activeGame.isHost || !activeGame.isEditable)) {
      return;
    }
    dispatchUi({ type: "setAlertVisible", visible: true });
  }, [activeGame.isEditable, activeGame.isHost, activeGame.isMultiplayer, matches.length]);

  const confirmEndGame = useCallback(async () => {
    dispatchUi({ type: "setAlertVisible", visible: false });
    if (activeGame.isMultiplayer) {
      if (!activeGame.isHost || !activeGame.isEditable) {
        return;
      }
      void activeGame.completeGame().catch(() => undefined);
      return;
    }
    await captureHistoryDetails?.();
    saveGameToHistory();
    void endTracking?.();
    resetState();
    router.replace("/");
  }, [activeGame, resetState, router, saveGameToHistory, captureHistoryDetails, endTracking]);

  const cancelEndGame = useCallback(() => {
    dispatchUi({ type: "setAlertVisible", visible: false });
  }, []);

  const isMultiplayerContext = activeGameContext.mode === "multiplayer" || activeGame.isMultiplayer;
  let configurationLabel = "Setup";
  if (isMultiplayerContext) {
    configurationLabel = activeGame.isHost && activeGameContext.accessKind === "registered" ? "Reassign matches" : "Room status";
  }

  const handleBackToSetup = useCallback(() => {
    if (!isMultiplayerContext) {
      router.push("/setupGame");
      return;
    }
    if (activeGame.isHost && activeGame.isEditable && activeGameContext.accessKind === "registered") {
      router.push("/editGame");
      return;
    }
    if (activeGameContext.accessKind === "registered" && activeGameContext.sessionId
      && activeGame.status !== "ended" && activeGame.status !== "access_lost") {
      router.push({ pathname: "/lobby/[sessionId]", params: { sessionId: activeGameContext.sessionId } });
      return;
    }
    setRoomStatusVisible(true);
  }, [activeGame.status, activeGame.isHost, activeGame.isEditable, activeGameContext.accessKind, activeGameContext.sessionId, isMultiplayerContext, router]);

  const closeRoomStatus = useCallback(() => setRoomStatusVisible(false), []);

  const handleGoHome = useCallback(() => {
    const isTerminalRoom =
      activeGame.status === "ended" ||
      activeGame.status === "access_lost" ||
      activeGame.snapshot?.state === "completed" ||
      activeGame.snapshot?.state === "closed";
    if (activeGame.isMultiplayer && isTerminalRoom) {
      clearActiveGameContext();
    }
  }, [
    activeGame.isMultiplayer,
    activeGame.snapshot?.state,
    activeGame.status,
    clearActiveGameContext,
  ]);

  const openQuickActions = useCallback((matchId: string) => {
    dispatchUi({ type: "openQuickActions", matchId });
  }, []);

  const closeQuickActions = useCallback(() => {
    dispatchUi({ type: "closeQuickActions" });
  }, []);

  const migrateMatchData = useCallback(() => {
    setMatches((prevMatches) => prevMatches.map(migrateLegacyMatch));
  }, [setMatches]);

  useEffect(() => {
    if (matches.length === 0 || activeGame.isMultiplayer) {
      return;
    }

    startPolling();

    return () => {
      stopPolling();
    };
  }, [activeGame.isMultiplayer, matches.length, startPolling, stopPolling]);

  useEffect(() => {
    migrateMatchData();
  }, [migrateMatchData]);

  const onRefresh = useCallback(async () => {
    dispatchUi({ type: "setRefreshing", refreshing: true });
    try {
      if (activeGame.isMultiplayer) {
        await activeGame.refresh();
      } else {
        await fetchCurrentScores();
      }
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      dispatchUi({ type: "setRefreshing", refreshing: false });
    }
  }, [activeGame, fetchCurrentScores]);

  const sourceStatus = activeGame.isMultiplayer
    ? activeGame.snapshot ?? {}
    : {
        error: sourceError,
        savedMatches: matches.flatMap(match => match.catalogSnapshot ? [match.catalogSnapshot] : []),
      };
  const sourceStatusMessage = getMatchSourceStatusMessage(sourceStatus);

  return {
    colors,
    styles,
    hasHydrated,
    activeTab,
    isAlertVisible,
    selectedMatchId,
    isQuickActionsVisible,
    refreshing,
    configurationLabel,
    isRoomStatusVisible,
    closeRoomStatus,
    players,
    matches,
    commonMatchId: commonMatchId ?? "",
    playerAssignments,
    liveMatches,
    isPolling: !sourceStatusMessage && (activeGame.isMultiplayer ? activeGame.isEditable : isPolling),
    sourceStatusMessage,
    lastUpdated: activeGame.isMultiplayer
      ? (activeGame.snapshot?.lastScoresCheckedAt ? new Date(activeGame.snapshot.lastScoresCheckedAt) : null)
      : lastUpdated,
    setActiveTab,
    openQuickActions,
    closeQuickActions,
    onRefresh,
    handleDrinkIncrement,
    handleDrinkDecrement,
    handleBackToSetup,
    handleGoHome,
    handleEndGame,
    handleGoalIncrement,
    handleGoalDecrement,
    cancelEndGame,
    confirmEndGame,
    activeGame,
  };
};

export default useGameProgressController;
