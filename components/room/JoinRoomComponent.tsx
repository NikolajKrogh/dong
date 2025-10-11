/**
 * Join Room Component
 *
 * UI for joining an existing game room using a room code
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { joinRoom } from "../../utils/roomManager";
import { useGameStore } from "../../store/store";
import { GameRoom } from "../../types/room";

interface JoinRoomProps {
  onRoomJoined: (room: GameRoom) => void;
  onCancel?: () => void;
}

export const JoinRoomComponent: React.FC<JoinRoomProps> = ({
  onRoomJoined,
  onCancel,
}) => {
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const { setCurrentPlayerId, setCurrentRoom, setRoomConnectionStatus } =
    useGameStore();

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    if (!roomCode.trim()) {
      Alert.alert("Error", "Please enter a room code");
      return;
    }

    if (roomCode.trim().length !== 6) {
      Alert.alert("Error", "Room code must be 6 characters");
      return;
    }

    setLoading(true);
    setRoomConnectionStatus("connecting");

    try {
      // Generate unique player ID
      const playerId = `player_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Join room
      const room = await joinRoom(
        roomCode.trim().toUpperCase(),
        playerId,
        playerName.trim()
      );

      if (!room) {
        setRoomConnectionStatus("error");
        Alert.alert(
          "Unable to Join",
          `Room "${roomCode.trim().toUpperCase()}" not found.\n\n` +
            "💡 Tips:\n" +
            "• Check if the code is correct\n" +
            "• Ask the host to wait 2-3 seconds after creating the room\n" +
            "• Make sure you're both connected to the internet\n" +
            "• Try again in a few seconds"
        );
        return;
      }

      // Update store
      setCurrentPlayerId(playerId);
      setCurrentRoom(room);
      setRoomConnectionStatus("connected");

      // Callback
      onRoomJoined(room);

      Alert.alert("Success", `Joined room: ${room.code}`);
    } catch (error) {
      console.error("Failed to join room:", error);
      setRoomConnectionStatus("error");
      Alert.alert("Error", "Failed to join room. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join Game Room</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Your Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          value={playerName}
          onChangeText={setPlayerName}
          maxLength={20}
          editable={!loading}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Room Code</Text>
        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="ABC123"
          value={roomCode}
          onChangeText={(text) => setRoomCode(text.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
          editable={!loading}
        />
        <Text style={styles.hint}>Enter the 6-character code</Text>
      </View>

      {loading && (
        <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.joinButton]}
          onPress={handleJoinRoom}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Joining..." : "Join Room"}
          </Text>
        </TouchableOpacity>

        {onCancel && (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={[styles.buttonText, styles.cancelButtonText]}>
              Cancel
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  codeInput: {
    fontSize: 20,
    fontWeight: "bold",
    letterSpacing: 2,
    textAlign: "center",
  },
  hint: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  loader: {
    marginVertical: 20,
  },
  buttonContainer: {
    marginTop: 12,
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  joinButton: {
    backgroundColor: "#4CAF50",
  },
  cancelButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButtonText: {
    color: "#666",
  },
});

export default JoinRoomComponent;
