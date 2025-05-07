import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Animated,
} from "react-native";
import { Player } from "../../store/store";
import styles from "../../app/style/setupGameStyles";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

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
  const fadeAnims = useRef<{ [key: string]: Animated.Value }>({});

  useEffect(() => {
    players.forEach((player) => {
      if (!fadeAnims.current[player.id]) {
        fadeAnims.current[player.id] = new Animated.Value(1);
      }
    });
  }, [players]);

  const addPlayerAndFocus = () => {
    if (newPlayerName.trim()) {
      handleAddPlayer();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleRemoveWithAnimation = (playerId: string) => {
    const anim = fadeAnims.current[playerId];
    if (!anim) return;

    Animated.timing(anim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      handleRemovePlayer(playerId);
      delete fadeAnims.current[playerId];
    });
  };

  const handleRemoveAllPlayers = () => {
    const animations = Object.values(fadeAnims.current).map((anim) =>
      Animated.timing(anim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    );

    Animated.parallel(animations).start(() => {
      [...players].forEach((player) => {
        handleRemovePlayer(player.id);
      });
      fadeAnims.current = {};
    });
  };

  const getPlayerGradient = (
    index: number
  ): readonly [string, string, ...string[]] => {
    const gradients: readonly (readonly [string, string, ...string[]])[] = [
      ["#FF416C", "#FF4B2B"] as const,
      ["#4776E6", "#8E54E9"] as const,
      ["#11998e", "#38ef7d"] as const,
      ["#FDC830", "#F37335"] as const,
      ["#667eea", "#764ba2"] as const,
      ["#1A2980", "#26D0CE"] as const,
      ["#FF0099", "#493240"] as const,
      ["#8A2387", "#E94057", "#F27121"] as const,
      ["#00c6ff", "#0072ff"] as const,
      ["#f857a6", "#ff5858"] as const,
      ["#4facfe", "#00f2fe"] as const,
      ["#43e97b", "#38f9d7"] as const,
      ["#fa709a", "#fee140"] as const,
      ["#7F00FF", "#E100FF"] as const,
      ["#3E5151", "#DECBA4"] as const,
      ["#12c2e9", "#c471ed", "#f64f59"] as const,
      ["#b721ff", "#21d4fd"] as const,
    ];
    return gradients[index % gradients.length];
  };

  return (
    <View style={styles.tabContent}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 15,
        }}
      >
        <Text style={styles.sectionTitle}>Players</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.playerCount}>
            {players.length} {players.length === 1 ? "player" : "players"}
          </Text>
        </View>
      </View>

      <View style={styles.inputRow}>
        <View style={styles.playerInputContainer}>
          <Ionicons
            name="person-outline"
            size={20}
            color="#555"
            style={styles.playerInputIcon}
          />
          <TextInput
            ref={inputRef}
            style={styles.playerTextInput}
            placeholder="Enter player name"
            placeholderTextColor="#aaa"
            value={newPlayerName}
            onChangeText={setNewPlayerName}
            returnKeyType="done"
            onSubmitEditing={addPlayerAndFocus}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.playerAddButton,
            !newPlayerName.trim() && styles.playerAddButtonDisabled,
          ]}
          onPress={addPlayerAndFocus}
          disabled={!newPlayerName.trim()}
        >
          <Ionicons name="add-circle-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={players}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const fadeAnim = fadeAnims.current[item.id] || new Animated.Value(1);
          fadeAnims.current[item.id] = fadeAnim;

          return (
            <Animated.View
              style={[
                styles.playerItemContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: fadeAnim }],
                },
                index % 2 === 0 ? styles.playerItemEven : styles.playerItemOdd,
              ]}
            >
              <LinearGradient
                colors={getPlayerGradient(index)}
                style={styles.playerAvatar}
              >
                <Text style={styles.playerAvatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
              <Text style={styles.playerNameText}>{item.name}</Text>
              <TouchableOpacity
                style={styles.playerRemoveButton}
                onPress={() => handleRemoveWithAnimation(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={20} color="#E94E77" />
              </TouchableOpacity>
            </Animated.View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.playerEmptyListContainer}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyListText}>
              No players added yet. Add some to get started!
            </Text>
          </View>
        )}
        scrollEnabled={false}
        contentContainerStyle={styles.playersListContent}
      />

      {players.length > 0 && (
        <TouchableOpacity
          style={styles.playerClearAllButton}
          onPress={handleRemoveAllPlayers}
        >
          <Ionicons
            name="trash-outline"
            size={16}
            color="#fff"
            style={{ marginRight: 5 }}
          />
          <Text style={styles.playerClearAllButtonText}>Clear All Players</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default PlayerList;
