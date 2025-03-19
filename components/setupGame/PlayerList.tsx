import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Player } from "../../app/store";
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
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Players</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Add new player"
          value={newPlayerName}
          onChangeText={setNewPlayerName}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddPlayer}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={players}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.matchItemWrapper}>
            <TouchableOpacity activeOpacity={0.6} style={styles.assignmentItem}>
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
            </TouchableOpacity>
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

export default PlayerList;
