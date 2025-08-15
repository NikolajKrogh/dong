import React from "react";
import { View, Text, TouchableOpacity, FlatList, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PlayerSuggestion } from "../../hooks/usePlayerSuggestions";
import { colors } from "../../app/style/palette";
import styles from "../../app/style/setupGameStyles";

/**
 * Props for the PlayerSuggestionDropdown component.
 */
interface PlayerSuggestionDropdownProps {
  /** The list of player suggestions to display. */
  suggestions: PlayerSuggestion[];
  /** Whether the dropdown is currently visible. */
  visible: boolean;
  /** Callback function when a player is selected from the dropdown. */
  onSelectPlayer: (playerName: string) => void;
  /** The current search query to highlight matching text. */
  searchQuery: string;
}

/**
 * Props for the SuggestionItem component.
 */
interface SuggestionItemProps {
  /** The player suggestion data for the item. */
  player: PlayerSuggestion;
  /** Callback function when the item is selected. */
  onSelect: (playerName: string) => void;
  /** The current search query to highlight matching text. */
  searchQuery: string;
}

/**
 * Individual suggestion item component
 */
const SuggestionItem: React.FC<SuggestionItemProps> = ({
  player,
  onSelect,
  searchQuery,
}) => {
  /**
   * Handles the press event on a suggestion item.
   */
  const handlePress = () => {
    onSelect(player.name);
  };

  /**
   * Formats a date string into a relative time string (e.g., "Today", "Yesterday", "2d ago").
   * @param {string} dateString The ISO date string to format.
   * @returns {string} The formatted relative time string.
   */
  const formatLastPlayed = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}m ago`;
  };

  /**
   * Highlights the matching part of a text string based on a search query.
   * @param {string} text The text to highlight.
   * @param {string} highlight The search query to match.
   * @returns {React.ReactElement} A <Text> component with highlighted parts.
   */
  const getHighlightedText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <Text>{text}</Text>;

    const parts = text.split(new RegExp(`(${highlight})`, "gi"));
    return (
      <Text>
        {parts.map((part, index) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <Text key={index} style={styles.highlightedText}>
              {part}
            </Text>
          ) : (
            <Text key={index}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  return (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={handlePress}
      activeOpacity={0.6}
    >
      <View style={styles.suggestionContent}>
        <View style={styles.suggestionInfo}>
          <View style={styles.suggestionHeader}>
            <Text style={styles.suggestionName}>
              {getHighlightedText(player.name, searchQuery)}
            </Text>
            <Text style={styles.suggestionTime}>
              {formatLastPlayed(player.lastPlayed)}
            </Text>
          </View>
          <View style={styles.suggestionStats}>
            <View style={styles.statItem}>
              <Ionicons
                name="game-controller-outline"
                size={12}
                color={colors.textMuted}
              />
              <Text style={styles.statText}>{player.gamesPlayed}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons
                name="beer-outline"
                size={12}
                color={colors.textMuted}
              />
              <Text style={styles.statText}>
                {player.totalDrinks.toFixed(1)}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons
                name="flash-outline"
                size={12}
                color={colors.textMuted}
              />
              <Text style={styles.statText}>
                {player.averageDrinksPerGame.toFixed(1)}/game
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/**
 * A dropdown component that displays player suggestions based on user input.
 * It appears when the user types in the player input field and shows a list of
 * relevant players from past games. The component prioritizes suggestions based on
 * match relevance: exact matches first, then names starting with the search query,
 * followed by names containing the search query elsewhere.
 *
 * The dropdown is designed to be compact, showing only 4 players at a time with
 * a "+X more" indicator when more suggestions are available. It avoids using nested
 * scrollable views to prevent performance issues when used within ScrollView components.
 *
 * @param {PlayerSuggestionDropdownProps} props The props for the component.
 * @returns {React.ReactElement | null} The rendered dropdown or null if not visible.
 */
const PlayerSuggestionDropdown: React.FC<PlayerSuggestionDropdownProps> = ({
  suggestions,
  visible,
  onSelectPlayer,
  searchQuery,
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;

  const sortedSuggestions = React.useMemo(() => {
    if (!searchQuery.trim()) return suggestions;

    return [...suggestions].sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const query = searchQuery.toLowerCase();

      // Exact match gets highest priority
      if (aName === query && bName !== query) return -1;
      if (bName === query && aName !== query) return 1;

      // Starts with gets next priority
      const aStartsWith = aName.startsWith(query);
      const bStartsWith = bName.startsWith(query);

      if (aStartsWith && !bStartsWith) return -1;
      if (bStartsWith && !aStartsWith) return 1;

      // Both either start with query or don't, so no change in order
      return 0;
    });
  }, [suggestions, searchQuery]);

  React.useEffect(() => {
    if (visible && sortedSuggestions.length > 0) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, sortedSuggestions.length]);

  if (!visible || sortedSuggestions.length === 0) return null;

  return (
    <Animated.View
      style={[
        styles.dropdown,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.dropdownHeader}>
        <Ionicons name="time-outline" size={14} color={colors.primary} />
        <Text style={styles.dropdownHeaderText}>Recent Players</Text>
      </View>
      <View style={styles.suggestionsList}>
        {sortedSuggestions.slice(0, 4).map((item) => (
          <SuggestionItem
            key={item.name}
            player={item}
            onSelect={onSelectPlayer}
            searchQuery={searchQuery}
          />
        ))}
        {sortedSuggestions.length > 4 && (
          <View style={styles.moreItemsIndicator}>
            <Text style={styles.moreItemsText}>{`+${
              sortedSuggestions.length - 4
            } more`}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

export default PlayerSuggestionDropdown;
