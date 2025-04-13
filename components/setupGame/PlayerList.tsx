import React, { useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import { Player } from "../../store/store";
import styles from "../../app/style/setupGameStyles";
import { Ionicons } from "@expo/vector-icons";

interface PlayerListProps {
  players: Player[];
  newPlayerName: string;
  setNewPlayerName: (name: string) => void;
  handleAddPlayer: () => void;
  handleRemovePlayer: (playerId: string) => void;
}

const PlayerList: React.FC<PlayerListProps> = ({
  players,
  newPlayerName,
  setNewPlayerName,
  handleAddPlayer,
  handleRemovePlayer,
}) => {
  const inputRef = useRef<TextInput>(null);

  const addPlayerAndFocus = () => {
    if (newPlayerName.trim()) {
      handleAddPlayer();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Players</Text>

      <View style={styles.inputRow}>
        {/* Input with icon inside */}
        <View style={localStyles.inputContainer}>
          <Ionicons
            name="person-outline"
            size={18}
            color="#777"
            style={localStyles.inputIcon}
          />
          <TextInput
            ref={inputRef}
            style={localStyles.textInput}
            placeholder="Enter player name"
            placeholderTextColor="#999"
            value={newPlayerName}
            onChangeText={setNewPlayerName}
            returnKeyType="done"
            onSubmitEditing={addPlayerAndFocus}
          />
        </View>

        {/* Improved add button */}
        <TouchableOpacity
          style={[
            localStyles.addButton,
            !newPlayerName.trim() && localStyles.addButtonDisabled,
          ]}
          onPress={addPlayerAndFocus}
          disabled={!newPlayerName.trim()}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={players}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.matchItemWrapper}>
            <View style={styles.assignmentItem}>
              <View style={styles.assignmentItemContent}>
                <Text style={styles.matchText}>{item.name}</Text>
              </View>

              {/* Delete button appears as a subtle icon in the corner */}
              <TouchableOpacity
                style={styles.subtleDeleteButton}
                onPress={() => handleRemovePlayer(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={16} color="#999" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <Text style={styles.emptyListText}>No players added yet</Text>
        )}
        scrollEnabled={false}
        contentContainerStyle={styles.playersListContent}
      />
    </View>
  );
};

const localStyles = StyleSheet.create({
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    backgroundColor: "#f5f7fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    color: "#333",
  },
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: "#0275d8",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  addButtonDisabled: {
    backgroundColor: "#b0c1d9",
  },
});

export default PlayerList;
