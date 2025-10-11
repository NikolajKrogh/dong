/**
 * Room Display Component
 *
 * Displays current room information, connected players, and room management controls
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
} from "react-native";
import { useGameStore } from "../../store/store";
import {
  subscribeToRoom,
  leaveRoom,
  lockRoom,
  kickPlayer,
} from "../../utils/roomManager";
import { GameRoom, RoomPlayer } from "../../types/room";

interface RoomDisplayProps {
  onLeaveRoom?: () => void;
}

export const RoomDisplayComponent: React.FC<RoomDisplayProps> = ({
  onLeaveRoom,
}) => {
  const {
    currentRoom,
    currentPlayerId,
    setCurrentRoom,
    setCurrentPlayerId,
    setRoomConnectionStatus,
  } = useGameStore();

  useEffect(() => {
    if (!currentRoom) return;

    // Subscribe to room updates
    const unsubscribe = subscribeToRoom(currentRoom.code, (updatedRoom) => {
      if (updatedRoom) {
        setCurrentRoom(updatedRoom);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentRoom?.code]);

  const handleLeaveRoom = () => {
    if (!currentRoom || !currentPlayerId) return;

    Alert.alert("Leave Room", "Are you sure you want to leave this room?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          leaveRoom(currentRoom.code, currentPlayerId);
          setCurrentRoom(null);
          setCurrentPlayerId(null);
          setRoomConnectionStatus("disconnected");
          onLeaveRoom?.();
        },
      },
    ]);
  };

  const handleShareCode = async () => {
    if (!currentRoom) return;

    try {
      await Share.share({
        message: `Join my DONG game! Room Code: ${currentRoom.code}`,
        title: "Join DONG Game",
      });
    } catch (error) {
      console.error("Error sharing code:", error);
    }
  };

  const handleLockRoom = () => {
    if (!currentRoom || !isHost) return;

    const newLockState = !currentRoom.isLocked;
    lockRoom(currentRoom.code, newLockState);

    Alert.alert(
      newLockState ? "Room Locked" : "Room Unlocked",
      newLockState ? "No new players can join" : "New players can now join"
    );
  };

  const handleKickPlayer = (player: RoomPlayer) => {
    if (!currentRoom || !isHost || player.id === currentPlayerId) return;

    Alert.alert("Kick Player", `Remove ${player.name} from the room?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Kick",
        style: "destructive",
        onPress: () => {
          kickPlayer(currentRoom.code, player.id);
        },
      },
    ]);
  };

  if (!currentRoom || !currentPlayerId) {
    return (
      <View style={styles.container}>
        <Text style={styles.noRoomText}>Not in a room</Text>
      </View>
    );
  }

  const isHost = currentRoom.hostId === currentPlayerId;
  // Filter out invalid players (must have id and name)
  const playersList = (currentRoom.players || []).filter(
    (player) => player && player.id && player.name
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Room Code</Text>
          <Text style={styles.code}>{currentRoom.code}</Text>
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={handleShareCode}>
          <Text style={styles.shareButtonText}>📤 Share</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoText}>
          Host: <Text style={styles.boldText}>{currentRoom.hostName}</Text>
        </Text>
        <Text style={styles.infoText}>
          Players:{" "}
          <Text style={styles.boldText}>
            {playersList.length} / {currentRoom.maxPlayers || 10}
          </Text>
        </Text>
      </View>

      {currentRoom.isLocked && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedText}>🔒 Room is locked</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Players in Room</Text>
        <ScrollView style={styles.playersList}>
          {playersList.map((player) => (
            <View key={player.id} style={styles.playerItem}>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>
                  {player.name}
                  {player.id === currentPlayerId && " (You)"}
                  {player.isHost && " 👑"}
                </Text>
              </View>
              {isHost && player.id !== currentPlayerId && (
                <TouchableOpacity
                  style={styles.kickButton}
                  onPress={() => handleKickPlayer(player)}
                >
                  <Text style={styles.kickButtonText}>Kick</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.buttonContainer}>
        {isHost && (
          <TouchableOpacity style={styles.lockButton} onPress={handleLockRoom}>
            <Text style={styles.buttonText}>
              {currentRoom.isLocked ? "🔓 Unlock Room" : "🔒 Lock Room"}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveRoom}>
          <Text style={styles.leaveButtonText}>Leave Room</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  noRoomText: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    marginTop: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  codeContainer: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  code: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2196F3",
    letterSpacing: 2,
  },
  shareButton: {
    backgroundColor: "#2196F3",
    padding: 12,
    borderRadius: 8,
  },
  shareButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
  },
  boldText: {
    fontWeight: "bold",
    color: "#333",
  },
  lockedBanner: {
    backgroundColor: "#FFF3CD",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  lockedText: {
    fontSize: 14,
    color: "#856404",
    textAlign: "center",
    fontWeight: "600",
  },
  section: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  playersList: {
    maxHeight: 300,
  },
  playerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    color: "#333",
  },
  kickButton: {
    backgroundColor: "#f44336",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  kickButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  buttonContainer: {
    gap: 12,
  },
  lockButton: {
    backgroundColor: "#FF9800",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  leaveButton: {
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  leaveButtonText: {
    color: "#f44336",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default RoomDisplayComponent;
