/**
 * @file gameProgress.tsx
 * @description Main in-game screen: manages live score polling, goal handling (sound + toast queue), player drink tracking, quick actions, and end game workflow. Integrates theming and persistence via the global store.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useLiveScores } from "../hooks/useLiveScores";
import {
  View,
  SafeAreaView,
  RefreshControl,
  AppState,
  AppStateStatus,
} from "react-native";
import { useRouter } from "expo-router";
import { useGameStore, Match } from "../store/store";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { createGameProgressStyles } from "./style/gameProgressStyles";
import { useColors } from "./style/theme";
import Toast from "react-native-toast-message";
import { useMemo } from "react";

// Import components
import TabNavigation from "../components/gameProgress/TabNavigation";
import MatchesGrid from "../components/gameProgress/MatchesGrid/";
import PlayersList from "../components/gameProgress/PlayersList";
import MatchQuickActionsModal from "../components/gameProgress/MatchQuickActionsModal";
import EndGameModal from "../components/gameProgress/EndGameModal";
import FooterButtons from "../components/gameProgress/FooterButtons";

// Define interface for goal information
interface LastGoalInfo {
  matchId: string;
  team: "home" | "away";
  isLiveUpdate: boolean;
  newTotal?: number; // The new score total for the scoring team (live updates)
  otherTeamScore?: number; // The score of the other team at the time of the goal (live updates)
  timestamp: number; // To differentiate consecutive identical goals
}

// Define interface for queued toast data
interface QueuedToastData {
  type: string;
  text1: string;
  text2?: string;
  props?: any;
  position?: "top" | "bottom";
  visibilityTime?: number;
}

/**
 * Main gameplay screen: live score polling, goal handling (sound + toast queue),
 * player drink tracking, quick actions, and end-game workflow.
 * @component
 * @description Renders two tabs (matches / players), coordinates live polling + toast queue,
 * plays goal sounds, and exposes modals for quick match adjustments and ending the game.
 * Integrates global store + theming.
 */
const GameProgressScreen = () => {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createGameProgressStyles(colors), [colors]);
  const [activeTab, setActiveTab] = React.useState("matches"); // 'matches' or 'players'
  const [isAlertVisible, setIsAlertVisible] = React.useState(false);
  const [selectedMatchId, setSelectedMatchId] = React.useState<string | null>(
    null
  );
  const [isQuickActionsVisible, setIsQuickActionsVisible] =
    React.useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);
  // State to track the last goal scored, triggering sound/toast effect
  const [lastGoalInfo, setLastGoalInfo] = useState<LastGoalInfo | null>(null);

  // Toast queue state
  const [toastQueue, setToastQueue] = useState<QueuedToastData[]>([]);
  const [isToastCurrentlyVisible, setIsToastCurrentlyVisible] = useState(false);

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

  // State to track if the sound is currently playing
  const [isSoundPlaying, setIsSoundPlaying] = React.useState(false);

  /**
   * Plays goal sound if enabled, app active, and no other playback in progress.
   * @async
   * @description Sets audio mode, loads, plays, then unloads the sound; guards against overlap via isSoundPlaying flag.
   */
  const playDongSound = useCallback(async () => {
    if (!soundEnabled || isSoundPlaying || appState !== "active") return;

    setIsSoundPlaying(true);

    try {
      // Set audio mode to request proper audio focus
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      });

      const { sound } = await Audio.Sound.createAsync(
        require("../assets/sounds/dong.mp3")
      );

      setSoundObject(sound);

      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (
          status.isLoaded &&
          !status.isPlaying &&
          status.positionMillis > 0 &&
          status.durationMillis !== undefined &&
          status.positionMillis === status.durationMillis
        ) {
          sound.unloadAsync();
          setIsSoundPlaying(false);
        }
      });
    } catch (error) {
      console.error("Error playing sound:", error);
      setIsSoundPlaying(false); // Reset on error
    }
  }, [soundEnabled, isSoundPlaying, appState]);

  /**
   * Stop & unload currently playing goal sound (if any).
   * @async
   */
  const stopSound = async () => {
    if (soundObject) {
      try {
        const status = await soundObject.getStatusAsync();
        if (status.isLoaded) {
          await soundObject.stopAsync();
          await soundObject.unloadAsync();
        }
        setSoundObject(null);
      } catch (error) {
        console.error("Error stopping sound:", error);
      }
      setIsSoundPlaying(false);
    }
  };

  // Listen for app state changes
  useEffect(() => {
    /**
     * Handle app state changes; stops audio when moving to background.
     * @param {AppStateStatus} nextAppState New application state string.
     */
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState !== "active" && appState === "active") {
        // App moving to background
        stopSound();
      }
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription.remove();
      stopSound();
    };
  }, [appState]);

  /** Show end-game confirmation modal. */
  const handleEndGame = () => {
    setIsAlertVisible(true);
  };

  /** Persist game to history, reset state, navigate home (confirmation accepted). */
  const confirmEndGame = () => {
    setIsAlertVisible(false);
    saveGameToHistory();
    resetState();
    router.replace("/");
  };

  /** Dismiss end-game confirmation modal (no state changes). */
  const cancelEndGame = () => {
    setIsAlertVisible(false);
  };

  /** Navigate to setup screen without ending current game. */
  const handleBackToSetup = () => {
    router.push("/setupGame");
  };

  /**
   * Increment (manual) or set (live) a team's goal count; queues goal meta for sound/toast.
   * @param {string} matchId Match identifier.
   * @param {('home'|'away')} team Scoring team.
   * @param {number} [newTotal] New total (live updates only; if provided indicates a live update context).
   */
  const handleGoalIncrement = (
    matchId: string,
    team: "home" | "away",
    newTotal?: number
  ) => {
    let goalScoredInfo: LastGoalInfo | null = null; // Temp storage for goal info

    setMatches((prevMatches) =>
      prevMatches.map((match) => {
        if (match.id === matchId) {
          let updatedMatch = { ...match }; // Work with a mutable copy
          let goalActuallyScored = false;
          const isLive = typeof newTotal === "number";
          let liveUpdateNewTotal: number | undefined = undefined;
          let liveUpdateOtherScore: number | undefined = undefined;

          if (isLive) {
            // Live update
            if (team === "home") {
              if (newTotal > (match.homeGoals || 0)) {
                goalActuallyScored = true;
                updatedMatch.homeGoals = newTotal;
                liveUpdateNewTotal = newTotal;
                liveUpdateOtherScore = match.awayGoals || 0;
              } else if (newTotal !== match.homeGoals) {
                // Update state even if score didn't increase (e.g., correction)
                updatedMatch.homeGoals = newTotal;
              }
            } else {
              // Away team
              if (newTotal > (match.awayGoals || 0)) {
                goalActuallyScored = true;
                updatedMatch.awayGoals = newTotal;
                liveUpdateNewTotal = newTotal;
                liveUpdateOtherScore = match.homeGoals || 0;
              } else if (newTotal !== match.awayGoals) {
                updatedMatch.awayGoals = newTotal;
              }
            }
          } else {
            // Manual increment
            if (team === "home") {
              updatedMatch.homeGoals = (match.homeGoals || 0) + 1;
              goalActuallyScored = true;
            } else {
              // Away team
              updatedMatch.awayGoals = (match.awayGoals || 0) + 1;
              goalActuallyScored = true;
            }
          }

          // If a goal was scored, prepare the info to trigger the effect
          if (goalActuallyScored) {
            goalScoredInfo = {
              matchId,
              team,
              isLiveUpdate: isLive,
              newTotal: liveUpdateNewTotal, // Store calculated values for live updates
              otherTeamScore: liveUpdateOtherScore,
              timestamp: Date.now(), // Add timestamp
            };
          }
          return updatedMatch; // Return the potentially updated match
        }
        return match; // Return unchanged match
      })
    );

    // After setMatches is called, update the state that triggers the effect
    if (goalScoredInfo) {
      setLastGoalInfo(goalScoredInfo);
    }
  };

  /**
   * Decrement a team's goal count (floored at 0).
   * @param {string} matchId Match identifier.
   * @param {('home'|'away')} team Team whose score should be decremented.
   */
  const handleGoalDecrement = (matchId: string, team: "home" | "away") => {
    setMatches((prevMatches) =>
      prevMatches.map((match) => {
        if (match.id === matchId) {
          if (team === "home" && (match.homeGoals || 0) > 0) {
            return { ...match, homeGoals: (match.homeGoals || 0) - 1 };
          } else if (team === "away" && (match.awayGoals || 0) > 0) {
            return { ...match, awayGoals: (match.awayGoals || 0) - 1 };
          }
        }
        return match;
      })
    );
  };

  /**
   * Increment a player's drinksTaken by 0.5.
   * @param {string} playerId Player identifier.
   */
  const handleDrinkIncrement = (playerId: string) => {
    setPlayers((prevPlayers) =>
      prevPlayers.map((player) => {
        return player.id === playerId
          ? {
              ...player,
              drinksTaken: (player.drinksTaken || 0) + 0.5,
            }
          : player;
      })
    );
  };

  /**
   * Decrement a player's drinksTaken by 0.5 (not below zero).
   * @param {string} playerId Player identifier.
   */
  const handleDrinkDecrement = (playerId: string) => {
    setPlayers((prevPlayers) =>
      prevPlayers.map((player) => {
        return player.id === playerId && (player.drinksTaken ?? 0) > 0
          ? {
              ...player,
              drinksTaken: (player.drinksTaken ?? 0) - 0.5,
            }
          : player;
      })
    );
  };

  /**
   * Open quick actions modal for a given match.
   * @param {string} matchId Match identifier to inspect/modify.
   */
  const openQuickActions = (matchId: string) => {
    setSelectedMatchId(matchId);
    setIsQuickActionsVisible(true);
  };

  /**
   * Migrate legacy single 'goals' field into homeGoals/awayGoals, initializing zeros.
   * (No params; operates on matches store state.)
   */
  const migrateMatchData = () => {
    setMatches((prevMatches) =>
      prevMatches.map((match) => {
        // If it's an old match with just the goals property
        if (
          match.goals !== undefined &&
          (match.homeGoals === undefined || match.awayGoals === undefined)
        ) {
          return {
            ...match,
            homeGoals: Math.floor(match.goals / 2), // Split existing goals between home and away
            awayGoals: Math.ceil(match.goals / 2),
          };
        }
        // Make sure homeGoals and awayGoals are initialized
        return {
          ...match,
          homeGoals: match.homeGoals || 0,
          awayGoals: match.awayGoals || 0,
        };
      })
    );
  };

  /**
   * Return list of player names who drink for a goal in the specified match.
   * @param {string} matchId Match identifier.
   * @returns {string[]} Player names to notify for the goal.
   */
  const getPlayersWhoDrink = (matchId: string): string[] => {
    // If it's the common match, all players drink
    if (matchId === commonMatchId) {
      return players.map((p) => p.name);
    }

    // Otherwise, only players assigned to this match drink
    return players
      .filter(
        (player) =>
          playerAssignments[player.id] &&
          playerAssignments[player.id].includes(matchId)
      )
      .map((p) => p.name);
  };

  /**
   * Compute display scores for goal toast (handles manual vs live updates).
   * @param {Match} match Current match object (post-update for manual increments).
   * @param {('home'|'away')} team Scoring team.
   * @param {boolean} isLiveUpdate Whether this update came from live polling.
   * @param {number} [newTotal] New total for scoring team (live updates only).
   * @param {number} [otherTeamScore] Other team's score at time of live goal.
   * @returns {{ homeScore: number; awayScore: number }} Computed home/away scores for toast title.
   */
  const calculateToastScoreDisplay = (
    match: Match,
    team: "home" | "away",
    isLiveUpdate: boolean,
    newTotal?: number,
    otherTeamScore?: number
  ): { homeScore: number; awayScore: number } => {
    let homeScore, awayScore;

    if (
      isLiveUpdate &&
      typeof newTotal === "number" &&
      typeof otherTeamScore === "number"
    ) {
      // For live updates, use the provided scores directly
      if (team === "home") {
        homeScore = newTotal;
        awayScore = otherTeamScore;
      } else {
        homeScore = otherTeamScore;
        awayScore = newTotal;
      }
    } else {
      // Manual updates: Use the current scores from the match object passed in.
      // This match object comes from the *updated* `matches` state in the effect.
      homeScore = match.homeGoals || 0;
      awayScore = match.awayGoals || 0;
    }
    return { homeScore, awayScore };
  };

  /**
   * Format goal toast drinking message (names if <=3 else summarized).
   * @param {string[]} playersToDrink Array of player names.
   * @returns {string} Formatted drinking message.
   */
  const formatGoalToastMessage = useCallback(
    (playersToDrink: string[]): string => {
      if (playersToDrink.length === 0) return "";
      if (playersToDrink.length <= 3) {
        return `${playersToDrink.join(", ")} should drink!`;
      } else {
        return `${playersToDrink.slice(0, 2).join(", ")} and ${
          playersToDrink.length - 2
        } others should drink!`;
      }
    },
    []
  );

  /**
   * Queue a goal toast (score + drink message) respecting common-match notification prefs.
   * @param {string} matchId Match identifier.
   * @param {('home'|'away')} team Scoring team.
   * @param {boolean} [isLiveUpdate=false] Whether triggered by live polling.
   * @param {number} [newTotal] New total for scoring team (live update context).
   * @param {number} [otherTeamScore] Opponent score at time of live goal.
   */
  const enqueueGoalToast = useCallback(
    (
      matchId: string,
      team: "home" | "away",
      isLiveUpdate = false,
      newTotal?: number,
      otherTeamScore?: number
    ) => {
      // Skip notifications for common match if disabled in preferences
      if (matchId === commonMatchId && !commonMatchNotificationsEnabled) {
        return;
      }

      // Find the match based on the *current* matches state
      const match = matches.find((m) => m.id === matchId);
      if (!match) {
        console.warn(
          "Toast: Match not found in current state for enqueue:",
          matchId
        );
        return;
      }

      const { homeScore, awayScore } = calculateToastScoreDisplay(
        match, // Pass the current match state
        team,
        isLiveUpdate,
        newTotal,
        otherTeamScore
      );
      const scoreTitle = `${match.homeTeam} ${homeScore}-${awayScore} ${match.awayTeam}`;

      const playersToDrink = getPlayersWhoDrink(matchId);
      const message = formatGoalToastMessage(playersToDrink);

      if (!message) return; // Don't show toast if no one needs to drink

      const toastData: QueuedToastData = {
        type: "success",
        text1: scoreTitle,
        text2: message,
        props: {
          scoringTeam: team,
        },
        position: "bottom",
        visibilityTime: 5000,
      };

      setToastQueue((prevQueue) => [...prevQueue, toastData]);
    },
    [
      matches,
      commonMatchId,
      commonMatchNotificationsEnabled,
      getPlayersWhoDrink,
      calculateToastScoreDisplay,
      formatGoalToastMessage,
      players,
      playerAssignments /* Added players & assignments as getPlayersWhoDrink depends on them */,
    ]
  );

  // Effect to process the toast queue
  useEffect(() => {
    if (!isToastCurrentlyVisible && toastQueue.length > 0) {
      const toastToShow = toastQueue[0];

      setToastQueue((prevQueue) => prevQueue.slice(1)); // Dequeue
      setIsToastCurrentlyVisible(true);

      Toast.show({
        ...toastToShow,
        onHide: () => {
          setIsToastCurrentlyVisible(false);
        },
      });
    }
  }, [toastQueue, isToastCurrentlyVisible]);

  // Call the useLiveScores hook
  const {
    liveMatches,
    isPolling,
    lastUpdated,
    startPolling,
    stopPolling,
    fetchCurrentScores,
  } = useLiveScores(
    matches,
    handleGoalIncrement, // Pass the updated handler
    60000 // Poll every minute
  );

  // Start polling as soon as the component mounts
  useEffect(() => {
    // Use local references to the functions to avoid dependency issues
    const start = () => {
      if (matches.length > 0) {
        startPolling();
      }
    };

    const stop = () => {
      if (isPolling) {
        stopPolling();
      }
    };

    start();

    // Clean up when component unmounts
    return () => {
      stop();
    };
  }, []);

  // Call migration function when component mounts
  useEffect(() => {
    migrateMatchData();
  }, []);

  // Effect to play sound and show toast *after* state update
  useEffect(() => {
    if (lastGoalInfo) {
      const { matchId, team, isLiveUpdate, newTotal, otherTeamScore } =
        lastGoalInfo;

      // Skip notifications AND SOUND for common match if disabled in preferences
      if (matchId === commonMatchId && !commonMatchNotificationsEnabled) {
        setLastGoalInfo(null); // Reset to prevent re-trigger
        return;
      }

      playDongSound();
      // Enqueue toast instead of showing directly
      enqueueGoalToast(matchId, team, isLiveUpdate, newTotal, otherTeamScore);

      // Reset lastGoalInfo so this effect only runs once per goal
      setLastGoalInfo(null);
    }
  }, [
    lastGoalInfo,
    commonMatchId,
    commonMatchNotificationsEnabled,
    playDongSound,
    enqueueGoalToast,
  ]);

  /**
   * Pull-to-refresh handler: fetch current scores, manage refreshing state.
   * @async
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCurrentScores();
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchCurrentScores]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Tab Navigation with swipeable content */}
        <TabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          matchesCount={matches.length}
          playersCount={players.length}
        >
          {/* First tab - Matches */}
          <View style={styles.tabContent}>
            {/* Pass liveMatches to your MatchesGrid */}
            <MatchesGrid
              matches={matches}
              players={players}
              commonMatchId={commonMatchId ?? ""}
              playerAssignments={playerAssignments}
              openQuickActions={openQuickActions}
              liveMatches={liveMatches}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
              onRefresh={onRefresh} // Make sure this is passed
              refreshing={refreshing} // This too
              lastUpdated={lastUpdated} // And this
              isPolling={isPolling}
            />
          </View>

          {/* Second tab - Players */}
          <View style={styles.tabContent}>
            <PlayersList
              players={players}
              matches={matches}
              commonMatchId={commonMatchId ?? ""}
              playerAssignments={playerAssignments}
              handleDrinkIncrement={handleDrinkIncrement}
              handleDrinkDecrement={handleDrinkDecrement}
            />
          </View>
        </TabNavigation>

        {/* Footer buttons */}
        <View style={styles.footerContainer}>
          <FooterButtons
            onBackToSetup={handleBackToSetup}
            onEndGame={handleEndGame}
          />
        </View>
      </View>

      {/* Modals */}
      <MatchQuickActionsModal
        isVisible={isQuickActionsVisible}
        onClose={() => setIsQuickActionsVisible(false)}
        selectedMatchId={selectedMatchId}
        matches={matches}
        players={players}
        commonMatchId={commonMatchId ?? ""}
        playerAssignments={playerAssignments}
        handleGoalIncrement={handleGoalIncrement}
        handleGoalDecrement={handleGoalDecrement}
        liveMatches={liveMatches}
      />

      <EndGameModal
        isVisible={isAlertVisible}
        onCancel={cancelEndGame}
        onConfirm={confirmEndGame}
      />

      {/* Toast mounted at app root */}
    </SafeAreaView>
  );
};

export default GameProgressScreen;
