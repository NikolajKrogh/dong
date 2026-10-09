import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  type ListRenderItemInfo,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  type ViewStyle,
  View,
} from "react-native";
import { isWideLayout as isWideViewport } from "../../styles/responsive";
import createSetupGameStyles from "../../styles/setupGameStyles";
import { useColors } from "../../styles/theme";
import {
  type PlayerSuggestion,
  usePlayerSuggestions,
} from "../../hooks/usePlayerSuggestions";
import { Player } from "../../store/store";
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

interface PlayerListEmptyStateProps {
  styles: ReturnType<typeof createSetupGameStyles>;
  iconColor: string;
}

interface PlayerInputSectionProps {
  playerCount: number;
  newPlayerName: string;
  isInputFocused: boolean;
  showSuggestions: boolean;
  availableSuggestions: PlayerSuggestion[];
  inputRef: React.RefObject<TextInput | null>;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof createSetupGameStyles>;
  onTextChange: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onAdd: () => void;
  onSelectSuggestion: (playerName: string) => void;
}

interface PlayerListItemProps {
  player: Player;
  index: number;
  isWideLayout: boolean;
  fadeAnim: Animated.Value;
  styles: ReturnType<typeof createSetupGameStyles>;
  errorColor: string;
  onRemove: (playerId: string) => void;
}

const playerKeyExtractor = (player: Player) => player.id;

const playerHeaderRowStyle: ViewStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
  marginBottom: 15,
};

const playerGradients: readonly (readonly [string, string, ...string[]])[] = [
  ["#FF416C", "#FF4B2B"],
  ["#4776E6", "#8E54E9"],
  ["#11998e", "#38ef7d"],
  ["#FDC830", "#F37335"],
  ["#667eea", "#764ba2"],
  ["#1A2980", "#26D0CE"],
  ["#FF0099", "#493240"],
  ["#8A2387", "#E94057", "#F27121"],
  ["#00c6ff", "#0072ff"],
  ["#f857a6", "#ff5858"],
  ["#4facfe", "#00f2fe"],
  ["#43e97b", "#38f9d7"],
  ["#fa709a", "#fee140"],
  ["#7F00FF", "#E100FF"],
  ["#3E5151", "#DECBA4"],
  ["#12c2e9", "#c471ed", "#f64f59"],
  ["#b721ff", "#21d4fd"],
];

const getPlayerGradient = (index: number) =>
  playerGradients[index % playerGradients.length];
const playerRemoveHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

const PlayerInputSection = ({
  playerCount,
  newPlayerName,
  isInputFocused,
  showSuggestions,
  availableSuggestions,
  inputRef,
  colors,
  styles,
  onTextChange,
  onFocus,
  onBlur,
  onAdd,
  onSelectSuggestion,
}: PlayerInputSectionProps) => (
  <>
    <View style={playerHeaderRowStyle}>
      <Text style={styles.sectionTitle}>Players</Text>
      <Text style={styles.playerCount}>
        {playerCount} {playerCount === 1 ? "player" : "players"}
      </Text>
    </View>

    <View style={[styles.inputRow, styles.playerInputRow]}>
      <View testID="PlayerInputStack" style={styles.playerInputStack}>
        <View
          style={[
            styles.playerInputContainer,
            isInputFocused && styles.playerInputContainerFocused,
          ]}
        >
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
            onChangeText={onTextChange}
            onFocus={onFocus}
            onBlur={onBlur}
            returnKeyType="done"
            onSubmitEditing={onAdd}
          />
        </View>

        <PlayerSuggestionDropdown
          suggestions={availableSuggestions}
          visible={showSuggestions}
          onSelectPlayer={onSelectSuggestion}
          searchQuery={newPlayerName}
        />
      </View>

      <TouchableOpacity
        accessibilityLabel="Add Player"
        testID="SetupAddPlayerButton"
        style={[
          styles.playerAddButton,
          !newPlayerName.trim() && styles.playerAddButtonDisabled,
        ]}
        onPress={onAdd}
        disabled={!newPlayerName.trim()}
      >
        <Ionicons name="add-circle-outline" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  </>
);

const PlayerListItem = React.memo(function PlayerListItem({
  player,
  index,
  isWideLayout,
  fadeAnim,
  styles,
  errorColor,
  onRemove,
}: PlayerListItemProps) {
  const animatedStyle = React.useMemo(
    () => ({ opacity: fadeAnim, transform: [{ scale: fadeAnim }] }),
    [fadeAnim],
  );
  const handleRemove = React.useCallback(
    () => onRemove(player.id),
    [onRemove, player.id],
  );

  return (
    <Animated.View
      style={[
        styles.playerItemContainer,
        isWideLayout && styles.playerItemWide,
        animatedStyle,
        index % 2 === 0 ? styles.playerItemEven : styles.playerItemOdd,
      ]}
    >
      <LinearGradient colors={getPlayerGradient(index)} style={styles.playerAvatar}>
        <Text style={styles.playerAvatarText}>
          {player.name.charAt(0).toUpperCase()}
        </Text>
      </LinearGradient>
      <Text style={styles.playerNameText}>{player.name}</Text>
      <TouchableOpacity
        style={styles.playerRemoveButton}
        onPress={handleRemove}
        hitSlop={playerRemoveHitSlop}
      >
        <Ionicons name="trash-outline" size={20} color={errorColor} />
      </TouchableOpacity>
    </Animated.View>
  );
});

const PlayerListEmptyState = ({
  styles,
  iconColor,
}: PlayerListEmptyStateProps) => {
  return (
    <View testID="PlayerListEmptyState" style={styles.playerEmptyListContainer}>
      <Ionicons name="people-outline" size={48} color={iconColor} />
      <Text style={styles.emptyListTitleText}>No players added yet!</Text>
      <Text style={styles.emptyListSubtitleText}>
        Add players by typing their name in the input above.
      </Text>
    </View>
  );
};

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
  const { width } = useWindowDimensions();
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const isWideLayout = isWideViewport(width);
  const inputRef = useRef<TextInput>(null);
  const fadeAnims = useRef<{ [key: string]: Animated.Value }>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get player suggestions based on the current input value.
  const { playerSuggestions, hasHistory } = usePlayerSuggestions(newPlayerName);

  // Filter out suggestions for players who are already in the current game.
  const availableSuggestions = playerSuggestions.filter(
    (suggestion) => !players.some((player) => player.name === suggestion.name),
  );
  const showPlayerSuggestions =
    showSuggestions && availableSuggestions.length > 0;

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
    if (hasHistory && newPlayerName.trim().length > 0) {
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
  const handleRemoveWithAnimation = React.useCallback((playerId: string) => {
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
  }, [handleRemovePlayer]);

  /**
   * Removes all players with a parallel fade-out animation.
   */
  const handleRemoveAllPlayers = () => {
    const animations = Object.values(fadeAnims.current).map((anim) =>
      Animated.timing(anim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
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
  const getOrCreateFadeAnim = React.useCallback((playerId: string) => {
    const existing = fadeAnims.current[playerId];
    if (existing) return existing;

    const animation = new Animated.Value(1);
    fadeAnims.current[playerId] = animation;
    return animation;
  }, []);

  const renderPlayerItem = React.useCallback(
    ({ item, index }: ListRenderItemInfo<Player>) => (
      <PlayerListItem
        player={item}
        index={index}
        isWideLayout={isWideLayout}
        fadeAnim={getOrCreateFadeAnim(item.id)}
        styles={styles}
        errorColor={colors.error}
        onRemove={handleRemoveWithAnimation}
      />
    ),
    [colors.error, getOrCreateFadeAnim, handleRemoveWithAnimation, isWideLayout, styles],
  );

  return (
    <View style={styles.tabContent}>
      <PlayerInputSection
        playerCount={players.length}
        newPlayerName={newPlayerName}
        isInputFocused={isInputFocused}
        showSuggestions={showPlayerSuggestions}
        availableSuggestions={availableSuggestions}
        inputRef={inputRef}
        colors={colors}
        styles={styles}
        onTextChange={handleTextChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onAdd={addPlayerAndFocus}
        onSelectSuggestion={handleSelectSuggestion}
      />

      <FlatList
        key={isWideLayout ? "players-wide" : "players-compact"}
        data={players}
        keyExtractor={playerKeyExtractor}
        numColumns={isWideLayout ? 2 : 1}
        renderItem={renderPlayerItem}
        ListEmptyComponent={
          <PlayerListEmptyState
            styles={styles}
            iconColor={colors.neutralGray}
          />
        }
        scrollEnabled={false}
        contentContainerStyle={styles.playersListContent}
        columnWrapperStyle={
          isWideLayout ? styles.playersListWideRow : undefined
        }
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
