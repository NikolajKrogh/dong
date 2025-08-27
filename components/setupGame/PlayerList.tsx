import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Animated,
} from "react-native";
import { Player } from "../../store/store";
import createSetupGameStyles from "../../app/style/setupGameStyles";
import { useColors } from "../../app/style/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePlayerSuggestions } from "../../hooks/usePlayerSuggestions";
import PlayerSuggestionDropdown from "./PlayerSuggestionDropdown";

/**
 * Props for the PlayerList component.
 */
interface PlayerListProps {
  /** The current list of players in the game. */
  players: Player[];
  /** The current value of the new player input field. */
  newPlayerName: string;
  /** Callback to update the new player name. */
  setNewPlayerName: (name: string) => void;
  /** Callback to add the player from the input field. */
  handleAddPlayer: () => void;
  /** Optional direct method to add a player by name, bypassing the input field state. */
  handleAddPlayerByName?: (name: string) => void;
  /** Callback to remove a player by their ID. */
  handleRemovePlayer: (playerId: string) => void;
}

/**
 * A component that manages the list of players for a game.
 * It handles adding, removing, and displaying players, and includes a smart
 * suggestion dropdown for quickly adding players from previous games.
 *
 * @param {PlayerListProps} props The props for the component.
 * @returns {React.ReactElement} The rendered player list component.
 */
const PlayerList: React.FC<PlayerListProps> = ({
  players,
  newPlayerName,
  setNewPlayerName,
  handleAddPlayer,
  handleAddPlayerByName,
  handleRemovePlayer,
}) => {
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const inputRef = useRef<TextInput>(null);
  const fadeAnims = useRef<{ [key: string]: Animated.Value }>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get player suggestions based on the current input value.
  const { playerSuggestions, hasHistory } = usePlayerSuggestions(newPlayerName);

  // Filter out suggestions for players who are already in the current game.
  const availableSuggestions = playerSuggestions.filter(
    (suggestion) => !players.some((player) => player.name === suggestion.name)
  );

  useEffect(() => {
    players.forEach((player) => {
      if (!fadeAnims.current[player.id]) {
        fadeAnims.current[player.id] = new Animated.Value(1);
      }
    });
  }, [players]);

  /**
   * Handles the input field gaining focus.
   * It shows the suggestion dropdown if there is a history of players.
   */
  const handleInputFocus = () => {
    setIsInputFocused(true);
    if (hasHistory) {
      setShowSuggestions(true);
    }
  };

  /**
   * Handles the input field losing focus.
   * It hides the suggestion dropdown after a short delay to allow for taps.
   */
  const handleInputBlur = () => {
    setIsInputFocused(false);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    hideTimeoutRef.current = setTimeout(() => {
      setShowSuggestions(false);
    }, 1000);
  };

  /**
   * Handles changes to the text in the player input field.
   * @param {string} text The new text in the input field.
   */
  const handleTextChange = (text: string) => {
    // Clear any pending hide timeout when typing
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    setNewPlayerName(text);
    // Show suggestions only if the input is focused, has history, and contains text.
    if (hasHistory && isInputFocused && text.length > 0) {
      setShowSuggestions(true);
    } else if (text.length === 0) {
      setShowSuggestions(false);
    }
  };

  /**
   * Handles the selection of a player from the suggestion dropdown.
   * @param {string} playerName The name of the player selected.
   */
  const handleSelectSuggestion = (playerName: string) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    setShowSuggestions(false);

    if (handleAddPlayerByName) {
      handleAddPlayerByName(playerName);
      // Clear the input field immediately
      setNewPlayerName("");
      setTimeout(() => {
        setIsInputFocused(true);
        inputRef.current?.focus();
      }, 100);
    }
  };

  /**
   * Adds the player from the input field and refocuses the input.
   */
  const addPlayerAndFocus = () => {
    if (newPlayerName.trim()) {
      handleAddPlayer();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  /**
   * Handles the removal of a player with a fade-out animation.
   * @param {string} playerId The ID of the player to remove.
   */
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

  /**
   * Removes all players with a parallel fade-out animation.
   */
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

  /**
   * Gets a unique gradient for a player item based on its index.
   * @param {number} index The index of the player in the list.
   * @returns {readonly [string, string, ...string[]]} An array of color strings for the gradient.
   */
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
        <View style={[styles.playerInputContainer, { zIndex: 1000 }]}>
          <Ionicons
            name="person-outline"
            size={20}
            color={colors.textSecondary}
            style={styles.playerInputIcon}
          />
          <TextInput
            ref={inputRef}
            style={styles.playerTextInput}
            placeholder="Enter player name"
            placeholderTextColor={colors.textPlaceholder}
            value={newPlayerName}
            onChangeText={handleTextChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            returnKeyType="done"
            onSubmitEditing={addPlayerAndFocus}
          />

          {/* Player Suggestion Dropdown */}
          <PlayerSuggestionDropdown
            suggestions={availableSuggestions}
            visible={showSuggestions && availableSuggestions.length > 0}
            onSelectPlayer={handleSelectSuggestion}
            searchQuery={newPlayerName}
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
          <Ionicons name="add-circle-outline" size={28} color={colors.white} />
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
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </Animated.View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.playerEmptyListContainer}>
            <Ionicons
              name="people-outline"
              size={48}
              color={colors.neutralGray}
            />
            <Text style={styles.emptyListTitleText}>No players added yet!</Text>
            <Text style={styles.emptyListSubtitleText}>
              Add players by typing their name in the input above.
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
            color={colors.white}
            style={{ marginRight: 5 }}
          />
          <Text style={styles.playerClearAllButtonText}>Clear All Players</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default PlayerList;
