/**
 * Create Room Component
 * 
 * UI for creating a new game      // Callback
      onRoomCreated(room);

      Alert.alert(
        'Room Created! 🎉',
        `Room code: ${room.code}\n\n✅ Room is syncing with the network...\n\n💡 Tip: Wait 2-3 seconds before sharing the code to ensure it's propagated to all peers.`
      );
    } catch (error) {
      console.error('Failed to create room:', error); generating a shareable room code
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
import { createRoom } from "../../utils/roomManager";
import { useGameStore } from "../../store/store";
import { GameRoom } from "../../types/room";

interface CreateRoomProps {
  onRoomCreated: (room: GameRoom) => void;
  onCancel?: () => void;
}

export const CreateRoomComponent: React.FC<CreateRoomProps> = ({
  onRoomCreated,
  onCancel,
}) => {
  const [hostName, setHostName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("10");
  const [loading, setLoading] = useState(false);

  const { setCurrentPlayerId, setCurrentRoom, setRoomConnectionStatus } =
    useGameStore();

  const handleCreateRoom = async () => {
    if (!hostName.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    const maxPlayersNum = parseInt(maxPlayers, 10);
    if (isNaN(maxPlayersNum) || maxPlayersNum < 2 || maxPlayersNum > 20) {
      Alert.alert("Error", "Max players must be between 2 and 20");
      return;
    }

    setLoading(true);
    setRoomConnectionStatus("connecting");

    try {
      // Generate unique player ID
      const playerId = `player_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create room
      const room = await createRoom(playerId, hostName.trim(), maxPlayersNum);

      // Update store
      setCurrentPlayerId(playerId);
      setCurrentRoom(room);
      setRoomConnectionStatus("connected");

      // Callback
      onRoomCreated(room);

      Alert.alert(
        "Room Created!",
        `Room Code: ${room.code}\nShare this code with friends to join.`
      );
    } catch (error) {
      console.error("Failed to create room:", error);
      setRoomConnectionStatus("error");
      Alert.alert("Error", "Failed to create room. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Game Room</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Your Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          value={hostName}
          onChangeText={setHostName}
          maxLength={20}
          editable={!loading}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Max Players</Text>
        <TextInput
          style={styles.input}
          placeholder="10"
          value={maxPlayers}
          onChangeText={setMaxPlayers}
          keyboardType="number-pad"
          maxLength={2}
          editable={!loading}
        />
      </View>

      {loading && (
        <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.createButton]}
          onPress={handleCreateRoom}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Creating..." : "Create Room"}
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
  createButton: {
    backgroundColor: "#2196F3",
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

export default CreateRoomComponent;
