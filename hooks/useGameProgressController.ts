import { useCallback, useEffect, useMemo, useReducer } from "react";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { useLiveScores } from "./useLiveScores";
import { usePersistedTeamLogos } from "./usePersistedTeamLogos";
import { createGameProgressStyles } from "../app/style/gameProgressStyles";
import { useColors } from "../app/style/theme";
import { Match, useGameStore } from "../store/store";
import { useAppVisibility, useGoalSound } from "../platform";

interface LastGoalInfo {
  match: Match;
  matchId: string;
  team: "home" | "away";
  isLiveUpdate: boolean;
  newTotal?: number;
  otherTeamScore?: number;
  timestamp: number;
}

interface QueuedToastData {
  type: string;
  text1: string;
  text2?: string;
  props?: Record<string, unknown>;
  position?: "top" | "bottom";
  visibilityTime?: number;
}

type GameProgressTab = "matches" | "players";

interface GameProgressUiState {
  activeTab: GameProgressTab;
  isAlertVisible: boolean;
  selectedMatchId: string | null;
  isQuickActionsVisible: boolean;
  refreshing: boolean;
}

type GameProgressUiAction =
  | { type: "setActiveTab"; tab: GameProgressTab }
  | { type: "setAlertVisible"; visible: boolean }
  | { type: "openQuickActions"; matchId: string }
  | { type: "closeQuickActions" }
  | { type: "setRefreshing"; refreshing: boolean };

interface ToastQueueState {
  queue: QueuedToastData[];
  isToastVisible: boolean;
}

type ToastQueueAction =
  | { type: "enqueue"; toast: QueuedToastData }
  | { type: "showNext" }
  | { type: "hide" };

interface GoalScoreUpdateResult {
  updatedMatch: Match;
  goalScored: boolean;
  scoringTeamTotal?: number;
  otherTeamScore?: number;
}

const initialGameProgressUiState: GameProgressUiState = {
  activeTab: "matches",
  isAlertVisible: false,
  selectedMatchId: null,
  isQuickActionsVisible: false,
  refreshing: false,
};

const initialToastQueueState: ToastQueueState = {
  queue: [],
  isToastVisible: false,
};

const gameProgressUiReducer = (
  state: GameProgressUiState,
  action: GameProgressUiAction,
): GameProgressUiState => {
  switch (action.type) {
    case "setActiveTab":
      return { ...state, activeTab: action.tab };
    case "setAlertVisible":
      return { ...state, isAlertVisible: action.visible };
    case "openQuickActions":
      return {
        ...state,
        selectedMatchId: action.matchId,
        isQuickActionsVisible: true,
      };
    case "closeQuickActions":
      return {
        ...state,
        selectedMatchId: null,
        isQuickActionsVisible: false,
      };
    case "setRefreshing":
      return { ...state, refreshing: action.refreshing };
    default:
      return state;
  }
};

const toastQueueReducer = (
  state: ToastQueueState,
  action: ToastQueueAction,
): ToastQueueState => {
  switch (action.type) {
    case "enqueue":
      return {
        ...state,
        queue: [...state.queue, action.toast],
      };
    case "showNext":
      return {
        queue: state.queue.slice(1),
        isToastVisible: true,
      };
    case "hide":
      return {
        ...state,
        isToastVisible: false,
      };
    default:
      return state;
  }
};

const migrateLegacyMatch = (match: Match): Match => {
  if (
    match.goals !== undefined &&
    (match.homeGoals === undefined || match.awayGoals === undefined)
  ) {
    return {
      ...match,
      homeGoals: Math.floor(match.goals / 2),
      awayGoals: Math.ceil(match.goals / 2),
    };
  }

  return {
    ...match,
    homeGoals: match.homeGoals || 0,
    awayGoals: match.awayGoals || 0,
  };
};

const calculateToastScoreDisplay = (
  match: Match,
  team: "home" | "away",
  isLiveUpdate: boolean,
  newTotal?: number,
  otherTeamScore?: number,
) => {
  if (
    isLiveUpdate &&
    typeof newTotal === "number" &&
    typeof otherTeamScore === "number"
  ) {
    return team === "home"
      ? { homeScore: newTotal, awayScore: otherTeamScore }
      : { homeScore: otherTeamScore, awayScore: newTotal };
  }

  return {
    homeScore: match.homeGoals || 0,
    awayScore: match.awayGoals || 0,
  };
};

const formatGoalToastMessage = (playersToDrink: string[]) => {
  if (playersToDrink.length === 0) {
    return "";
  }

  if (playersToDrink.length <= 3) {
    return `${playersToDrink.join(", ")} should drink!`;
  }

  return `${playersToDrink.slice(0, 2).join(", ")} and ${
    playersToDrink.length - 2
  } others should drink!`;
};

const applyHomeGoalUpdate = (
  match: Match,
  newTotal?: number,
): GoalScoreUpdateResult => {
  const currentHomeGoals = match.homeGoals || 0;
  const updatedMatch = { ...match };

  if (typeof newTotal === "number") {
    if (newTotal > currentHomeGoals) {
      updatedMatch.homeGoals = newTotal;

      return {
        updatedMatch,
        goalScored: true,
        scoringTeamTotal: newTotal,
        otherTeamScore: match.awayGoals || 0,
      };
    }

    if (newTotal !== currentHomeGoals) {
      updatedMatch.homeGoals = newTotal;
    }

    return { updatedMatch, goalScored: false };
  }

  updatedMatch.homeGoals = currentHomeGoals + 1;

  return {
    updatedMatch,
    goalScored: true,
  };
};

const applyAwayGoalUpdate = (
  match: Match,
  newTotal?: number,
): GoalScoreUpdateResult => {
  const currentAwayGoals = match.awayGoals || 0;
  const updatedMatch = { ...match };

  if (typeof newTotal === "number") {
    if (newTotal > currentAwayGoals) {
      updatedMatch.awayGoals = newTotal;

      return {
        updatedMatch,
        goalScored: true,
        scoringTeamTotal: newTotal,
        otherTeamScore: match.homeGoals || 0,
      };
    }

    if (newTotal !== currentAwayGoals) {
      updatedMatch.awayGoals = newTotal;
    }

    return { updatedMatch, goalScored: false };
  }

  updatedMatch.awayGoals = currentAwayGoals + 1;

  return {
    updatedMatch,
    goalScored: true,
  };
};

const updateMatchForGoal = (
  match: Match,
  team: "home" | "away",
  newTotal?: number,
) => {
  const isLiveUpdate = typeof newTotal === "number";
  const updateResult =
    team === "home"
      ? applyHomeGoalUpdate(match, newTotal)
      : applyAwayGoalUpdate(match, newTotal);

  return {
    updatedMatch: updateResult.updatedMatch,
    goalInfo: updateResult.goalScored
      ? {
          match: updateResult.updatedMatch,
          matchId: match.id,
          team,
          isLiveUpdate,
          newTotal: updateResult.scoringTeamTotal,
          otherTeamScore: updateResult.otherTeamScore,
          timestamp: Date.now(),
        }
      : null,
  };
};

const useGameProgressController = () => {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createGameProgressStyles(colors), [colors]);

  usePersistedTeamLogos();

  const [uiState, dispatchUi] = useReducer(
    gameProgressUiReducer,
    initialGameProgressUiState,
  );
  const [toastState, dispatchToast] = useReducer(
    toastQueueReducer,
    initialToastQueueState,
  );
  const {
    activeTab,
    isAlertVisible,
    selectedMatchId,
    isQuickActionsVisible,
    refreshing,
  } = uiState;
  const { queue: toastQueue, isToastVisible: isToastCurrentlyVisible } =
    toastState;
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

  const enqueueGoalToast = useCallback(
    ({
      match,
      matchId,
      team,
      isLiveUpdate,
      newTotal,
      otherTeamScore,
    }: LastGoalInfo) => {
      const { homeScore, awayScore } = calculateToastScoreDisplay(
        match,
        team,
        isLiveUpdate,
        newTotal,
        otherTeamScore,
      );
      const scoreTitle = `${match.homeTeam} ${homeScore}-${awayScore} ${match.awayTeam}`;
      const playersToDrink = getPlayersWhoDrink(matchId);
      const message = formatGoalToastMessage(playersToDrink);

      if (!message) {
        return;
      }

      dispatchToast({
        type: "enqueue",
        toast: {
          type: "success",
          text1: scoreTitle,
          text2: message,
          props: {
            scoringTeam: team,
          },
          position: "bottom",
          visibilityTime: 5000,
        },
      });
    },
    [getPlayersWhoDrink],
  );

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

  useEffect(() => {
    if (isToastCurrentlyVisible || toastQueue.length === 0) {
      return;
    }

    const toastToShow = toastQueue[0];
    dispatchToast({ type: "showNext" });

    Toast.show({
      ...toastToShow,
      onHide: () => {
        dispatchToast({ type: "hide" });
      },
    });
  }, [toastQueue, isToastCurrentlyVisible]);

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
