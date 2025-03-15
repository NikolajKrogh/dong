import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Modal,
  
} from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "./store";
import { Ionicons } from "@expo/vector-icons";
import styles from "./style/gameProgressStyles";

interface Player {
  id: string;
  name: string;
  drinksTaken?: number;
}

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  goals: number;
}

const GameProgressScreen = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("matches"); // 'matches' or 'players'
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [isQuickActionsVisible, setIsQuickActionsVisible] = useState(false);

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
   * Calculates the total number of drinks required for a player based on the common match and assigned matches.
   * @param playerId - The ID of the player to calculate the drinks for.
   * @returns The total number of drinks required for the player.
   */
  const calculateDrinksRequired = (playerId: string) => {
    let total = 0;

    const commonMatch = matches.find((m) => m.id === commonMatchId);
    if (commonMatch) {
      total += commonMatch.goals * 1;
    }

    const assignedMatchIds = playerAssignments[playerId] || [];
    assignedMatchIds.forEach((matchId) => {
      const match = matches.find((m) => m.id === matchId);
      if (match) {
        total += match.goals * 0.5;
      }
    });

    return total;
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

  /**
   * Navigates to the history screen
   */
  const handleGoToHistory = () => {
    router.push("/history");
  };

  /**
   * Renders the compact match grid view with assigned player names on the right
   */
  const renderMatchesGrid = () => {
    // Calculate number of columns based on screen width
    const screenWidth = Dimensions.get("window").width;
    const numColumns = screenWidth > 600 ? 3 : 1; // Use single column on mobile

    return (
      <FlatList
        key={`matches-grid-${numColumns}`} // Add this key that changes with column count
        data={matches}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        renderItem={({ item }) => {
          // Get all players assigned to this match
          const assignedPlayers = players.filter(
            (player) =>
              item.id === commonMatchId || // Either it's the common match (all players)
              (playerAssignments[player.id] &&
                playerAssignments[player.id].includes(item.id)) // Or specifically assigned
          );

          return (
            <TouchableOpacity
              style={[
                styles.matchGridItem,
                item.id === commonMatchId && styles.commonMatchGridItem,
              ]}
              onPress={() => openQuickActions(item.id)}
            >
              <View style={styles.matchCardContent}>
                {/* Left side: Match details */}
                <View style={styles.matchDetailsSection}>
                  <Text style={styles.matchTeams}>
                    {item.homeTeam} vs {item.awayTeam}
                  </Text>

                  <View style={styles.goalBadge}>
                    <Text style={styles.goalBadgeText}>{item.goals}</Text>
                  </View>
                </View>

                {/* Right side: Player names */}
                <View style={styles.playerNamesSection}>
                  {assignedPlayers.length > 0 ? (
                    assignedPlayers.length <= 3 ? (
                      // Show all players if 3 or fewer
                      assignedPlayers.map((player) => (
                        <Text key={player.id} style={styles.assignedPlayerName}>
                          {player.name}
                        </Text>
                      ))
                    ) : (
                      // Show first 2 and a count if more than 3
                      <>
                        {assignedPlayers.slice(0, 2).map((player) => (
                          <Text
                            key={player.id}
                            style={styles.assignedPlayerName}
                          >
                            {player.name}
                          </Text>
                        ))}
                        <Text style={styles.assignedPlayerName}>
                          +{assignedPlayers.length - 2} more
                        </Text>
                      </>
                    )
                  ) : (
                    <Text style={styles.noPlayersText}>
                      No players assigned
                    </Text>
                  )}
                </View>
              </View>

              {/* Common badge */}
              {item.id === commonMatchId && (
                <View style={styles.commonBadge}>
                  <Text style={styles.commonBadgeText}>Common</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.matchesGridContainer}
      />
    );
  };

  /**
   * Renders the player list with drink stats in a more compact form
   */
  const renderPlayersList = () => {
    return (
      <FlatList
        data={players}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={true}
        renderItem={({ item }) => {
          const required = calculateDrinksRequired(item.id);
          const consumed = item.drinksTaken || 0;
          const owed = Math.max(0, required - consumed);
          
          return (
            <View style={styles.playerCard}>
              {/* Header row with name and quick stats */}
              <View style={styles.playerCardHeader}>
                <Text style={styles.playerName}>{item.name}</Text>
                <View style={[
                  styles.quickStatBadge,
                  owed === 0 ? styles.owedZeroBadge : styles.owedPositiveBadge
                ]}>
                  <Text style={[
                    styles.quickStatText,
                    owed === 0 ? styles.owedZeroText : styles.owedPositiveText
                  ]}>
                    {owed > 0 ? `${owed.toFixed(1)} owed` : "✓ Done"}
                  </Text>
                </View>
              </View>
              
              {/* Compact stats row with evenly distributed space */}
              <View style={styles.compactDrinkStats}>
                {/* Required */}
                <View style={styles.compactStatItem}>
                  <Text style={styles.compactStatLabel}>Required</Text>
                  <Text style={styles.compactStatValue}>{required.toFixed(1)}</Text>
                </View>
                
                {/* Consumed with controls */}
                <View style={styles.compactStatWithControls}>
                  <Text style={styles.compactStatLabel}>Consumed</Text>
                  <View style={styles.compactControls}>
                    <TouchableOpacity
                      style={[styles.tinyButton, { backgroundColor: "#dc3545" }]}
                      onPress={() => handleDrinkDecrement(item.id)}
                    >
                      <Text style={styles.tinyButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.compactStatValue}>{consumed.toFixed(1)}</Text>
                    <TouchableOpacity
                      style={[styles.tinyButton, { backgroundColor: "#28a745" }]}
                      onPress={() => handleDrinkIncrement(item.id)}
                    >
                      <Text style={styles.tinyButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.playersListContent}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "matches" && styles.activeTab]}
          onPress={() => setActiveTab("matches")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "matches" && styles.activeTabText,
            ]}
          >
            Matches
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "players" && styles.activeTab]}
          onPress={() => setActiveTab("players")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "players" && styles.activeTabText,
            ]}
          >
            Players
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content based on selected tab */}
      {activeTab === "matches" ? (
        <View style={styles.contentContainer}>
          {renderMatchesGrid()}

          <View style={styles.endButtonContainer}>
            <TouchableOpacity
              style={styles.setupButton}
              onPress={handleBackToSetup}
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>Setup</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.endButton} onPress={handleEndGame}>
              <Ionicons name="flag-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>End Game</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          {renderPlayersList()}

          <View style={styles.endButtonContainer}>
            <TouchableOpacity
              style={styles.setupButton}
              onPress={handleBackToSetup}
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>Setup</Text>
            </TouchableOpacity>


            <TouchableOpacity style={styles.endButton} onPress={handleEndGame}>
              <Ionicons name="flag-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>End Game</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Match Quick Actions Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isQuickActionsVisible}
        onRequestClose={() => setIsQuickActionsVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            {selectedMatchId &&
              (() => {
                const match = matches.find((m) => m.id === selectedMatchId);
                return match ? (
                  <View style={styles.quickActionsContainer}>
                    <Text style={styles.modalTitle}>
                      {match.homeTeam} vs {match.awayTeam}
                    </Text>

                    {match.id === commonMatchId && (
                      <Text style={styles.commonMatchLabel}>Common Match</Text>
                    )}

                    <View style={styles.goalQuickActions}>
                      <TouchableOpacity
                        style={[
                          styles.quickActionButton,
                          styles.decrementButton,
                        ]}
                        onPress={() => {
                          handleGoalDecrement(match.id);
                        }}
                      >
                        <Text style={styles.quickActionButtonText}>-</Text>
                      </TouchableOpacity>

                      <View style={styles.goalCounterLarge}>
                        <Text style={styles.goalValueLarge}>{match.goals}</Text>
                        <Text style={styles.goalLabelLarge}>GOALS</Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.quickActionButton,
                          styles.incrementButton,
                        ]}
                        onPress={() => {
                          handleGoalIncrement(match.id);
                        }}
                      >
                        <Text style={styles.quickActionButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.impactLabel}>This will affect:</Text>
                    <FlatList
                      data={players.filter(
                        (p) =>
                          match.id === commonMatchId ||
                          (playerAssignments[p.id] &&
                            playerAssignments[p.id].includes(match.id))
                      )}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <Text style={styles.affectedPlayerText}>
                          • {item.name}
                        </Text>
                      )}
                      style={styles.affectedPlayersList}
                    />

                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => setIsQuickActionsVisible(false)}
                    >
                      <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                ) : null;
              })()}
          </View>
        </View>
      </Modal>

      {/* End Game Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isAlertVisible}
        onRequestClose={() => {
          setIsAlertVisible(false);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>End Game</Text>
            <Text style={styles.modalText}>
              Are you sure you want to end the current game? This will save the
              results to history.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel]}
                onPress={cancelEndGame}
              >
                <Text style={styles.textStyle}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonConfirm]}
                onPress={confirmEndGame}
              >
                <Text style={styles.textStyle}>End Game</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default GameProgressScreen;
