/**
 * Game State Sync Test Screen
 *
 * Test screen for demonstrating real-time game state synchronization
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useGameStore } from "../store/store";
import { useGameStateSync } from "../hooks/useGameStateSync";
import { Player, Match } from "../store/store";

type ViewMode = "menu" | "host" | "player" | "game";

export default function GameStateSyncTest() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("menu");
  const [playerName, setPlayerName] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const currentRoom = useGameStore((state) => state.currentRoom);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const players = useGameStore((state) => state.players);
  const matches = useGameStore((state) => state.matches);
  const commonMatchId = useGameStore((state) => state.commonMatchId);

  const {
    syncStatus,
    isSyncing,
    initializeGame,
    pullFromGun,
    addPlayer,
    removePlayer,
    addMatch,
    removeMatch,
    updateMatchScore,
    setCommonMatch,
    recordDrink,
    startGame,
    finishGame,
  } = useGameStateSync();

  const isHost = currentRoom?.hostId === currentPlayerId;

  // Auto-load game state when room is available
  useEffect(() => {
    if (currentRoom && viewMode === "menu") {
      setViewMode(isHost ? "host" : "player");
      if (isHost) {
        // Host initializes game state
        initializeGame();
      } else {
        // Player pulls existing state
        pullFromGun();
      }
    }
  }, [currentRoom, isHost, viewMode]);

  // Update last sync time when data changes
  useEffect(() => {
    setLastUpdate(new Date());
    console.log("🎮 [GameStateSyncTest] State updated:", {
      players: players.length,
      matches: matches.length,
      syncStatus,
    });
  }, [players, matches, syncStatus]);

  // Manual refresh function
  const handleRefresh = async () => {
    console.log("🔄 Manual refresh triggered");
    await pullFromGun();
  };

  const handleAddPlayer = async () => {
    if (!playerName.trim()) return;

    const player: Player = {
      id: `player-${Date.now()}`,
      name: playerName.trim(),
      drinksTaken: 0,
    };

    await addPlayer(player);
    setPlayerName("");
  };

  const handleRemovePlayer = async (playerId: string) => {
    await removePlayer(playerId);
  };

  const handleAddMatch = async () => {
    if (!homeTeam.trim() || !awayTeam.trim()) return;

    const match: Match = {
      id: `match-${Date.now()}`,
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      homeGoals: 0,
      awayGoals: 0,
    };

    await addMatch(match);
    setHomeTeam("");
    setAwayTeam("");
  };

  const handleRemoveMatch = async (matchId: string) => {
    await removeMatch(matchId);
  };

  const handleGoalScored = async (match: Match, team: "home" | "away") => {
    const newHomeGoals =
      team === "home" ? match.homeGoals + 1 : match.homeGoals;
    const newAwayGoals =
      team === "away" ? match.awayGoals + 1 : match.awayGoals;
    await updateMatchScore(match.id, newHomeGoals, newAwayGoals);
  };

  const handleSetCommonMatch = async (matchId: string) => {
    await setCommonMatch(commonMatchId === matchId ? null : matchId);
  };

  const handleRecordDrink = async (playerId: string) => {
    await recordDrink(playerId);
  };

  const getSyncStatusColor = () => {
    switch (syncStatus) {
      case "synced":
        return "#4CAF50";
      case "syncing":
        return "#FFC107";
      case "error":
        return "#F44336";
      default:
        return "#9E9E9E";
    }
  };

  const getSyncStatusText = () => {
    switch (syncStatus) {
      case "synced":
        return "✅ Synced";
      case "syncing":
        return "🔄 Syncing...";
      case "error":
        return "❌ Error";
      default:
        return "⚪ Disconnected";
    }
  };

  if (!currentRoom) {
    return (
      <View style={styles.container}>
        <View style={styles.backButtonContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
            <Text style={styles.backButtonText}>← Back to Home</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>Game State Sync Test</Text>
          <Text style={styles.subtitle}>⚠️ No room active</Text>
        </View>
        <Text style={styles.helpText}>
          Go to "🧪 Test Rooms" first to create or join a room
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed Back Button Header */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
          <Text style={styles.backButtonText}>← Back to Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>🎮 Game State Sync</Text>
              <View style={styles.roomInfo}>
                <Text style={styles.roomCode}>Room: {currentRoom.code}</Text>
                <Text style={styles.roleTag}>
                  {isHost ? "👑 Host" : "👤 Player"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={isSyncing}
            >
              <Ionicons
                name="refresh"
                size={24}
                color={isSyncing ? "#666" : "#4CAF50"}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getSyncStatusColor() },
              ]}
            >
              <Text style={styles.statusText}>{getSyncStatusText()}</Text>
            </View>
            <Text style={styles.lastUpdateText}>
              Updated: {lastUpdate.toLocaleTimeString()}
            </Text>
          </View>
        </View>

        {/* Players Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Players ({players.length})</Text>

          {isHost && (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Player name"
                value={playerName}
                onChangeText={setPlayerName}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={[styles.button, styles.addButton]}
                onPress={handleAddPlayer}
                disabled={isSyncing || !playerName.trim()}
              >
                <Text style={styles.buttonText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          {players.map((player) => (
            <View key={player.id} style={styles.playerCard}>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.drinkCount}>
                  🍺 {player.drinksTaken || 0}
                </Text>
              </View>
              <View style={styles.playerActions}>
                <TouchableOpacity
                  style={[styles.iconButton, styles.drinkButton]}
                  onPress={() => handleRecordDrink(player.id)}
                  disabled={isSyncing}
                >
                  <Text style={styles.iconButtonText}>+🍺</Text>
                </TouchableOpacity>
                {isHost && (
                  <TouchableOpacity
                    style={[styles.iconButton, styles.removeButton]}
                    onPress={() => handleRemovePlayer(player.id)}
                    disabled={isSyncing}
                  >
                    <Text style={styles.iconButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Matches Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚽ Matches ({matches.length})</Text>

          {isHost && (
            <View style={styles.matchInputs}>
              <TextInput
                style={[styles.input, styles.teamInput]}
                placeholder="Home team"
                value={homeTeam}
                onChangeText={setHomeTeam}
                placeholderTextColor="#999"
              />
              <Text style={styles.vs}>vs</Text>
              <TextInput
                style={[styles.input, styles.teamInput]}
                placeholder="Away team"
                value={awayTeam}
                onChangeText={setAwayTeam}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={[styles.button, styles.addButton]}
                onPress={handleAddMatch}
                disabled={isSyncing || !homeTeam.trim() || !awayTeam.trim()}
              >
                <Text style={styles.buttonText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          {matches.map((match) => (
            <View key={match.id} style={styles.matchCard}>
              <TouchableOpacity
                style={styles.matchHeader}
                onPress={() => handleSetCommonMatch(match.id)}
                disabled={isSyncing}
              >
                {commonMatchId === match.id && (
                  <Text style={styles.commonBadge}>⭐ COMMON</Text>
                )}
              </TouchableOpacity>

              <View style={styles.matchContent}>
                <View key={`${match.id}-home`} style={styles.teamSection}>
                  <Text style={styles.teamName}>{match.homeTeam}</Text>
                  <View style={styles.scoreSection}>
                    <Text style={styles.score}>{match.homeGoals}</Text>
                    {isHost && (
                      <TouchableOpacity
                        style={styles.goalButton}
                        onPress={() => handleGoalScored(match, "home")}
                        disabled={isSyncing}
                      >
                        <Text style={styles.goalButtonText}>⚽</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <Text style={styles.matchVs}>-</Text>

                <View key={`${match.id}-away`} style={styles.teamSection}>
                  <Text style={styles.teamName}>{match.awayTeam}</Text>
                  <View style={styles.scoreSection}>
                    <Text style={styles.score}>{match.awayGoals}</Text>
                    {isHost && (
                      <TouchableOpacity
                        style={styles.goalButton}
                        onPress={() => handleGoalScored(match, "away")}
                        disabled={isSyncing}
                      >
                        <Text style={styles.goalButtonText}>⚽</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {isHost && (
                <TouchableOpacity
                  style={[styles.button, styles.removeMatchButton]}
                  onPress={() => handleRemoveMatch(match.id)}
                  disabled={isSyncing}
                >
                  <Text style={styles.buttonText}>Remove Match</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Host Controls */}
        {isHost && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎮 Host Controls</Text>
            <View style={styles.hostControls}>
              <TouchableOpacity
                style={[styles.button, styles.controlButton]}
                onPress={startGame}
                disabled={isSyncing}
              >
                <Text style={styles.buttonText}>Start Game</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.controlButton]}
                onPress={finishGame}
                disabled={isSyncing}
              >
                <Text style={styles.buttonText}>Finish Game</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.controlButton, styles.syncButton]}
                onPress={pullFromGun}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>🔄 Refresh</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Help Text */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>💡 Test Instructions:</Text>
          <Text style={styles.helpText}>
            1. Open this screen on 2+ devices in the same room{"\n"}
            2. Host adds players and matches{"\n"}
            3. All devices see updates in real-time{"\n"}
            4. Anyone can record drinks{"\n"}
            5. Host can score goals and manage matches{"\n"}
            6. Tap matches to set as common match
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  scrollContainer: {
    flex: 1,
  },
  backButtonContainer: {
    backgroundColor: "#2196F3",
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#1976D2",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButtonText: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  lastUpdateText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#999",
  },
  roomInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 10,
  },
  roomCode: {
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "bold",
  },
  roleTag: {
    fontSize: 14,
    color: "#FFC107",
  },
  statusBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 15,
  },
  inputRow: {
    flexDirection: "row",
    marginBottom: 15,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#2a2a2a",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    backgroundColor: "#4CAF50",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  playerCard: {
    backgroundColor: "#2a2a2a",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  drinkCount: {
    color: "#FFC107",
    fontSize: 14,
  },
  playerActions: {
    flexDirection: "row",
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  drinkButton: {
    backgroundColor: "#FFC107",
  },
  removeButton: {
    backgroundColor: "#F44336",
  },
  iconButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  matchInputs: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    gap: 10,
  },
  teamInput: {
    flex: 1,
  },
  vs: {
    color: "#999",
    fontSize: 16,
    fontWeight: "bold",
  },
  matchCard: {
    backgroundColor: "#2a2a2a",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  matchHeader: {
    marginBottom: 10,
  },
  commonBadge: {
    color: "#FFC107",
    fontSize: 12,
    fontWeight: "bold",
  },
  matchContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamSection: {
    flex: 1,
    alignItems: "center",
  },
  teamName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  scoreSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  score: {
    color: "#4CAF50",
    fontSize: 24,
    fontWeight: "bold",
  },
  matchVs: {
    color: "#666",
    fontSize: 20,
    fontWeight: "bold",
    marginHorizontal: 10,
  },
  goalButton: {
    backgroundColor: "#2196F3",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  goalButtonText: {
    fontSize: 20,
  },
  removeMatchButton: {
    backgroundColor: "#F44336",
    marginTop: 10,
  },
  hostControls: {
    gap: 10,
  },
  controlButton: {
    backgroundColor: "#2196F3",
  },
  syncButton: {
    backgroundColor: "#9C27B0",
  },
  helpSection: {
    padding: 20,
    backgroundColor: "#2a2a2a",
    margin: 20,
    borderRadius: 8,
  },
  helpTitle: {
    color: "#FFC107",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  helpText: {
    color: "#999",
    fontSize: 14,
    lineHeight: 20,
  },
});
