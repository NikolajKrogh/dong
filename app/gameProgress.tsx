import React, { useState, useEffect, useCallback } from "react";
import { useLiveScores } from "../hooks/useLiveScores";
import {
  View,
  SafeAreaView,
  Text,
  RefreshControl,
  StyleSheet,
  AppState,
  AppStateStatus,
} from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "../store/store";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import styles from "./style/gameProgressStyles";
import { Ionicons } from "@expo/vector-icons";

// Import components
import TabNavigation from "../components/gameProgress/TabNavigation";
import MatchesGrid from "../components/gameProgress/MatchesGrid/";
import PlayersList from "../components/gameProgress/PlayersList";
import MatchQuickActionsModal from "../components/gameProgress/MatchQuickActionsModal";
import EndGameModal from "../components/gameProgress/EndGameModal";
import FooterButtons from "../components/gameProgress/FooterButtons";

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
   * @brief Increments the goal count for a team.
   * Increments the goal count for a specified team in a given match.
   * Can optionally set the goal count to a specific value (used for live updates).
   * Plays a sound effect if a goal was actually added (not just synced).
   * @param {string} matchId - The ID of the match to update.
   * @param {'home' | 'away'} team - The team ('home' or 'away') whose score is changing.
   * @param {number} [newTotal] - Optional. If provided, sets the goal count directly to this value.
   */
  const handleGoalIncrement = (
    matchId: string,
    team: "home" | "away",
    newTotal?: number
  ) => {
    setMatches((prevMatches) =>
      prevMatches.map((match) => {
        if (match.id === matchId) {
          // Handle the case where we're updating with a specific value from live data
          if (typeof newTotal === "number") {
            if (team === "home") {
              // Only play sound if the goal count actually increased
              if (newTotal > (match.homeGoals || 0)) {
                playDongSound();
              }
              return { ...match, homeGoals: newTotal };
            } else {
              if (newTotal > (match.awayGoals || 0)) {
                playDongSound();
              }
              return { ...match, awayGoals: newTotal };
            }
          }
          // Otherwise just increment by 1
          else {
            if (team === "home") {
              return { ...match, homeGoals: (match.homeGoals || 0) + 1 };
            } else {
              return { ...match, awayGoals: (match.awayGoals || 0) + 1 };
            }
          }
        }
        return match;
      })
    );
    if (typeof newTotal === "undefined") {
      playDongSound();
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
    handleGoalIncrement,
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
    </SafeAreaView>
  );
};

export default GameProgressScreen;
