import React from "react";
import { View, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "./store";
import { Audio } from "expo-av"; // Import Audio from expo-av 
import styles from "./style/gameProgressStyles";

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

  const {
    players,
    matches,
    commonMatchId,
    playerAssignments,
    setPlayers,
    setMatches,
    saveGameToHistory,
    resetState,
  } = useGameStore();

  // State to track if the sound is currently playing
  const [isSoundPlaying, setIsSoundPlaying] = React.useState(false);

  /**
   * Function to play the dong.mp3 sound with debounce.
   */
  const playDongSound = async () => {
    if (isSoundPlaying) return; // Prevent playing if already playing

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
   * Handles incrementing the goal count for a specific match.
   * @param matchId - The ID of the match to increment the goal count for.
   */
  const handleGoalIncrement = (matchId: string) => {
    setMatches((prevMatches) =>
      prevMatches.map((match) =>
        match.id === matchId ? { ...match, goals: match.goals + 1 } : match
      )
    );
    playDongSound(); // Play sound when goal is incremented
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
            <MatchesGrid
              matches={matches}
              players={players}
              commonMatchId={commonMatchId ?? ""}
              playerAssignments={playerAssignments}
              openQuickActions={openQuickActions}
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
