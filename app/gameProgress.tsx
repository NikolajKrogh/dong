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
import styles from "./style/gameProgressStyles";
import Toast from "react-native-toast-message";

// Import components
import TabNavigation from "../components/gameProgress/TabNavigation";
import MatchesGrid from "../components/gameProgress/MatchesGrid/";
import PlayersList from "../components/gameProgress/PlayersList";
import MatchQuickActionsModal from "../components/gameProgress/MatchQuickActionsModal";
import EndGameModal from "../components/gameProgress/EndGameModal";
import FooterButtons from "../components/gameProgress/FooterButtons";
import { goalToastConfig } from "../components/gameProgress/GoalToast";

// Define interface for goal information
interface LastGoalInfo {
  matchId: string;
  team: "home" | "away";
  isLiveUpdate: boolean;
  newTotal?: number; // The new score total for the scoring team (live updates)
  otherTeamScore?: number; // The score of the other team at the time of the goal (live updates)
  timestamp: number; // To differentiate consecutive identical goals
}

/**
 * @component GameProgressScreen
 * @brief Represents the main screen during active gameplay.
 * Displays matches, player stats, and provides controls for game interaction and management.
 * It handles live score updates, sound effects, and navigation between game setup and history.
 */
const GameProgressScreen = () => {
  const router = useRouter();
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
  } = useGameStore();

  // State to track if the sound is currently playing
  const [isSoundPlaying, setIsSoundPlaying] = React.useState(false);

  /**
   * @brief Plays the 'dong.mp3' sound effect.
   * Plays if sound is enabled, the app is active, and no sound is currently playing.
   * Manages audio focus and unloads the sound upon completion.
   * @async
   */
  const playDongSound = async () => {
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
      setIsSoundPlaying(false);
    }
  };

  /**
   * @brief Stops the currently playing sound effect.
   * Stops the sound, if any, and unloads the audio resource to free up memory.
   * Resets the sound playing state.
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
     * @brief Handles application state changes.
     * Callback function triggered when the application's state changes (e.g., active, background, inactive).
     * Stops sound playback if the app moves away from the active state.
     * @param {AppStateStatus} nextAppState - The new state of the application.
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

  /**
   * @brief Initiates the end game process.
   * Displays a confirmation modal to the user.
   */
  const handleEndGame = () => {
    setIsAlertVisible(true);
  };

  /**
   * @brief Confirms the end game action.
   * Saves the current game state to history, resets the application state for a new game,
   * and navigates the user back to the home screen.
   */
  const confirmEndGame = () => {
    setIsAlertVisible(false);
    saveGameToHistory();
    resetState();
    router.replace("/");
  };

  /**
   * @brief Cancels the end game action.
   * Hides the confirmation modal.
   */
  const cancelEndGame = () => {
    setIsAlertVisible(false);
  };

  /**
   * @brief Navigates back to the game setup screen.
   * Navigates the user to '/setupGame', allowing modification of the game setup
   * without ending the current game progress.
   */
  const handleBackToSetup = () => {
    router.push("/setupGame");
  };

  /**
   * @brief Increments the goal count for a team in a match.
   *
   * Updates the goal count for the specified team in the given match. If a new total
   * is provided (live update), sets the count directly. Otherwise, increments by 1 (manual).
   * Stores goal information to trigger sound/toast effect *after* state update.
   *
   * @param {string} matchId - The ID of the match to update
   * @param {'home' | 'away'} team - Which team scored the goal
   * @param {number} [newTotal] - Optional specific goal count to set (used for live data)
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
   * @brief Decrements the goal count for a team.
   * Decrements the goal count for a specified team in a given match.
   * Ensures the goal count does not go below zero.
   * @param {string} matchId - The ID of the match to update.
   * @param {'home' | 'away'} team - The team ('home' or 'away') whose score is changing.
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
   * @brief Increments the drinks taken by a player.
   * Increments the number of drinks taken by a specific player by 0.5.
   * @param {string} playerId - The ID of the player whose drink count is increasing.
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
   * @brief Decrements the drinks taken by a player.
   * Decrements the number of drinks taken by a specific player by 0.5.
   * Ensures the drink count does not go below zero.
   * @param {string} playerId - The ID of the player whose drink count is decreasing.
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
   * @brief Opens the quick actions modal for a match.
   * Opens the modal allowing rapid goal adjustments for the specified match.
   * @param {string} matchId - The ID of the match for which to show quick actions.
   */
  const openQuickActions = (matchId: string) => {
    setSelectedMatchId(matchId);
    setIsQuickActionsVisible(true);
  };

  /**
   * @brief Migrates older match data formats.
   * Migrates formats using a single 'goals' property to the current format
   * using 'homeGoals' and 'awayGoals'. Ensures goal counts are initialized to 0 if undefined.
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
   * @brief Determines which players should drink when a goal is scored
   * @param {string} matchId - The ID of the match where a goal was scored
   * @return {string[]} Array of player names who should drink
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
   * @brief Calculates the home and away scores to be displayed in the goal toast.
   * For live updates, uses the provided new total and the other team's score.
   * For manual updates, uses the current scores from the match object (which should reflect the increment).
   * @param {Match} match - The match object containing current scores and team names.
   * @param {'home' | 'away'} team - The team that scored the goal.
   * @param {boolean} isLiveUpdate - Flag indicating if the update is from live data.
   * @param {number} [newTotal] - The new total score for the scoring team (passed for live updates).
   * @param {number} [otherTeamScore] - The current score of the non-scoring team (passed for live updates).
   * @returns {{ homeScore: number, awayScore: number }} An object containing the calculated home and away scores for display.
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
   * @brief Formats the message indicating which players should drink.
   * Lists player names directly if 3 or fewer players need to drink.
   * Summarizes if more than 3 players need to drink (e.g., "Player A, Player B and 5 others should drink!").
   * Returns an empty string if no players need to drink.
   * @param {string[]} playersToDrink - An array of names of players who should drink.
   * @returns {string} The formatted message string, or an empty string if the input array is empty.
   */
  const formatGoalToastMessage = (playersToDrink: string[]): string => {
    if (playersToDrink.length === 0) return "";
    if (playersToDrink.length <= 3) {
      return `${playersToDrink.join(", ")} should drink!`;
    } else {
      return `${playersToDrink.slice(0, 2).join(", ")} and ${
        playersToDrink.length - 2
      } others should drink!`;
    }
  };

  /**
   * @brief Shows a toast notification when a goal is scored.
   * Finds the match from the *current* state, calculates the score display,
   * determines which players should drink, formats the message, and displays the toast.
   * @param {string} matchId - The ID of the match where a goal was scored.
   * @param {'home' | 'away'} team - The team that scored the goal.
   * @param {boolean} [isLiveUpdate=false] - Flag indicating if the update is from live data.
   * @param {number} [newTotal] - The new total score for the scoring team (passed for live updates).
   * @param {number} [otherTeamScore] - The current score of the non-scoring team (passed for live updates).
   */
  const showGoalToast = (
    matchId: string,
    team: "home" | "away",
    isLiveUpdate = false,
    newTotal?: number,
    otherTeamScore?: number
  ) => {
    // Find the match based on the *current* matches state
    const match = matches.find((m) => m.id === matchId);
    if (!match) {
      console.warn("Toast: Match not found in current state:", matchId);
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

    Toast.show({
      type: "success",
      text1: scoreTitle,
      text2: message,
      props: {
        scoringTeam: team,
      },
      position: "bottom",
      visibilityTime: 5000,
    });
  };

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
    60000, // Poll every minute
    soundEnabled
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

      // Play sound
      playDongSound();

      // Show toast using the info stored when the goal was processed
      showGoalToast(matchId, team, isLiveUpdate, newTotal, otherTeamScore);

      // Reset lastGoalInfo so this effect only runs once per goal
      setLastGoalInfo(null);
    }
  }, [lastGoalInfo]); // This effect runs only when lastGoalInfo changes

  /**
   * @brief Handles the pull-to-refresh action.
   * Manually triggers fetching of current live scores and updates the refreshing state.
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
                  colors={["#0275d8"]}
                  tintColor="#0275d8"
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

      {/* Add this line to include Toast */}
      <Toast config={goalToastConfig} />
    </SafeAreaView>
  );
};

export default GameProgressScreen;
