import React, { useState, useEffect, useCallback } from "react";
import { useLiveScores } from "../hooks/useLiveScores";
import {
  View,
  SafeAreaView,
  Text,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "./store";
import { Audio } from "expo-av";
import styles from "./style/gameProgressStyles";
import { Ionicons } from "@expo/vector-icons";

// Import components
import TabNavigation from "../components/gameProgress/TabNavigation";
import MatchesGrid from "../components/gameProgress/MatchesGrid";
import PlayersList from "../components/gameProgress/PlayersList";
import MatchQuickActionsModal from "../components/gameProgress/MatchQuickActionsModal";
import EndGameModal from "../components/gameProgress/EndGameModal";
import FooterButtons from "../components/gameProgress/FooterButtons";

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
   * Function to play the dong.mp3 sound with debounce.
   */
  const playDongSound = async () => {
    if (!soundEnabled || isSoundPlaying) return; // Respect user preference
    setIsSoundPlaying(true); // Set the state to indicate sound is playing
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/sounds/dong.mp3")
      );
      await sound.playAsync();
      setTimeout(() => {
        setIsSoundPlaying(false); // Allow sound to play again after 3 seconds
      }, 3000);
    } catch (error) {
      console.error("Error playing sound:", error);
      setIsSoundPlaying(false); // Reset state in case of an error
    }
  };

  /**
   * Handles the action to end the game, making the alert modal visible.
   */
  const handleEndGame = () => {
    setIsAlertVisible(true);
  };

  /**
   * Confirms the action to end the game, saves the game to history, resets the state, and navigates to the home screen.
   */
  const confirmEndGame = () => {
    setIsAlertVisible(false);
    saveGameToHistory();
    resetState();
    router.replace("/");
  };

  /**
   * Cancels the action to end the game, hiding the alert modal.
   */
  const cancelEndGame = () => {
    setIsAlertVisible(false);
  };

  /**
   * Navigates back to the setup game screen without resetting game state
   */
  const handleBackToSetup = () => {
    router.push("/setupGame");
  };

  /**
   * Handles updating the goal count for a specific match.
   * @param matchId - The ID of the match to update the goal count for.
   * @param newTotal - The new total number of goals for this match.
   */
  const handleGoalIncrement = (matchId: string, newTotal: number) => {
    setMatches((prevMatches) =>
      prevMatches.map((match) => {
        if (match.id === matchId) {
          // Only play sound if the goal count actually increased
          if (newTotal > match.goals) {
            playDongSound(); // Play sound when goal is incremented
          }
          return { ...match, goals: newTotal }; // Set to the exact new total
        }
        return match;
      })
    );
  };

  // For manual +1 adjustments
  const handleManualGoalIncrement = (matchId: string) => {
    setMatches((prevMatches) =>
      prevMatches.map((match) =>
        match.id === matchId ? { ...match, goals: match.goals + 1 } : match
      )
    );
    playDongSound();
  };

  /**
   * Handles decrementing the goal count for a specific match, ensuring it does not go below 0.
   * @param matchId - The ID of the match to decrement the goal count for.
   */
  const handleGoalDecrement = (matchId: string) => {
    setMatches((prevMatches) =>
      prevMatches.map((match) =>
        match.id === matchId && match.goals > 0
          ? { ...match, goals: match.goals - 1 }
          : match
      )
    );
  };

  /**
   * Handles incrementing the drink count for a specific player.
   * @param playerId - The ID of the player to increment the drink count for.
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
   * Handles decrementing the drink count for a specific player, ensuring it does not go below 0.
   * @param playerId - The ID of the player to decrement the drink count for.
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
   * Opens the quick action panel for a match
   * @param matchId - The ID of the match to open quick actions for
   */
  const openQuickActions = (matchId: string) => {
    setSelectedMatchId(matchId);
    setIsQuickActionsVisible(true);
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

  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCurrentScores();
      // No need to set lastUpdated - fetchCurrentScores already does this
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
        handleGoalIncrement={handleManualGoalIncrement}
        handleGoalDecrement={handleGoalDecrement}
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
