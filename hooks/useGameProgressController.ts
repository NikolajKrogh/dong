import { useCallback, useEffect, useMemo, useReducer } from "react";
import { useRouter } from "expo-router";

import { useLiveScores } from "./useLiveScores";
import { usePersistedTeamLogos } from "./usePersistedTeamLogos";
import { useGoalToastQueue } from "./useGoalToastQueue";
import {
  gameProgressUiReducer,
  initialGameProgressUiState,
} from "./gameProgress/uiReducer";
import { migrateLegacyMatch } from "./gameProgress/matchMigration";
import { LastGoalInfo, updateMatchForGoal } from "./gameProgress/goalScoring";
import { createGameProgressStyles } from "../styles/gameProgressStyles";
import { useColors } from "../styles/theme";
import { useGameStore } from "../store/store";
import { useAppVisibility, useGoalSound } from "../platform";

const useGameProgressController = () => {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createGameProgressStyles(colors), [colors]);

  usePersistedTeamLogos();

  const [uiState, dispatchUi] = useReducer(
    gameProgressUiReducer,
    initialGameProgressUiState,
  );
  const {
    activeTab,
    isAlertVisible,
    selectedMatchId,
    isQuickActionsVisible,
    refreshing,
  } = uiState;
  const { visibilityState } = useAppVisibility();

  const {
    players,
    matches,
    commonMatchId,
    playerAssignments,
    setPlayers,
    setMatches,
    saveGameToHistory,
    resetState,
    soundEnabled,
    commonMatchNotificationsEnabled,
  } = useGameStore();
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
    [handleGoalNotification, setMatches],
  );

  const handleGoalDecrement = useCallback(
    (matchId: string, team: "home" | "away") => {
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
    [setMatches],
  );

  const handleDrinkIncrement = useCallback(
    (playerId: string) => {
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
    [setPlayers],
  );

  const handleDrinkDecrement = useCallback(
    (playerId: string) => {
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
    [setPlayers],
  );

  const setActiveTab = useCallback((tab: string) => {
    dispatchUi({
      type: "setActiveTab",
      tab: tab === "players" ? "players" : "matches",
    });
  }, []);

  const handleEndGame = useCallback(() => {
    dispatchUi({ type: "setAlertVisible", visible: true });
  }, []);

  const confirmEndGame = useCallback(() => {
    dispatchUi({ type: "setAlertVisible", visible: false });
    saveGameToHistory();
    resetState();
    router.replace("/");
  }, [resetState, router, saveGameToHistory]);

  const cancelEndGame = useCallback(() => {
    dispatchUi({ type: "setAlertVisible", visible: false });
  }, []);

  const handleBackToSetup = useCallback(() => {
    router.push("/setupGame");
  }, [router]);

  const openQuickActions = useCallback((matchId: string) => {
    dispatchUi({ type: "openQuickActions", matchId });
  }, []);

  const closeQuickActions = useCallback(() => {
    dispatchUi({ type: "closeQuickActions" });
  }, []);

  const migrateMatchData = useCallback(() => {
    setMatches((prevMatches) => prevMatches.map(migrateLegacyMatch));
  }, [setMatches]);

  const {
    liveMatches,
    isPolling,
    lastUpdated,
    startPolling,
    stopPolling,
    fetchCurrentScores,
  } = useLiveScores(matches, handleGoalIncrement, 60000);

  useEffect(() => {
    if (matches.length === 0) {
      return;
    }

    startPolling();

    return () => {
      stopPolling();
    };
  }, [matches.length, startPolling, stopPolling]);

  useEffect(() => {
    migrateMatchData();
  }, [migrateMatchData]);

  const onRefresh = useCallback(async () => {
    dispatchUi({ type: "setRefreshing", refreshing: true });
    try {
      await fetchCurrentScores();
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      dispatchUi({ type: "setRefreshing", refreshing: false });
    }
  }, [fetchCurrentScores]);

  return {
    colors,
    styles,
    activeTab,
    isAlertVisible,
    selectedMatchId,
    isQuickActionsVisible,
    refreshing,
    players,
    matches,
    commonMatchId: commonMatchId ?? "",
    playerAssignments,
    liveMatches,
    isPolling,
    lastUpdated,
    setActiveTab,
    openQuickActions,
    closeQuickActions,
    onRefresh,
    handleDrinkIncrement,
    handleDrinkDecrement,
    handleBackToSetup,
    handleEndGame,
    handleGoalIncrement,
    handleGoalDecrement,
    cancelEndGame,
    confirmEndGame,
  };
};

export default useGameProgressController;
