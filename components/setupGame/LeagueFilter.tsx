import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../app/style/setupGameStyles";
import { useLeagueLogo } from "../../hooks/useLeagueLogo";
import { LeagueEndpoint } from "../../constants/leagues";

/**
 * @interface LeagueFilterProps
 * @brief Props for the LeagueFilter component.
 * @property availableLeagues - An array of all `LeagueEndpoint` objects that can be selected.
 * @property selectedLeagues - An array of `LeagueEndpoint` objects that are currently selected.
 * @property handleLeagueChange - A function to be called when a league's selection status is toggled.
 */
interface LeagueFilterProps {
  availableLeagues: LeagueEndpoint[];
  selectedLeagues: LeagueEndpoint[];
  handleLeagueChange: (league: LeagueEndpoint) => void;
}

/**
 * @brief A helper component to display a league badge, typically showing its logo.
 * Used in the collapsed header of the LeagueFilter to show selected leagues.
 * @param {object} props - The component's props.
 * @param {LeagueEndpoint} props.league - The league data to display in the badge.
 * @returns {JSX.Element} A React element representing the league badge.
 */
const LeagueBadge = ({ league }: { league: LeagueEndpoint }) => {
  const { logoSource, isLoading } = useLeagueLogo(league.name, league.code);

  return (
    <View key={league.code} style={styles.filterBadge}>
      {isLoading ? (
        <View style={styles.badgeLogoPlaceholder}>
          <Ionicons name="hourglass-outline" size={14} color="#777" />
        </View>
      ) : logoSource ? (
        <Image source={logoSource} style={styles.badgeLogo} />
      ) : (
        // Fallback to text if logo is not available or still loading
        <Text
          style={styles.filterBadgeText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {league.name}
        </Text>
      )}
    </View>
  );
};

/**
 * @interface LeagueItemProps
 * @brief Props for the LeagueItem component.
 * @property league - The `LeagueEndpoint` object for this item.
 * @property isSelected - Boolean indicating if this league item is currently selected.
 * @property onPress - Function to call when the league item is pressed.
 */
interface LeagueItemProps {
  league: LeagueEndpoint;
  isSelected: boolean;
  onPress: () => void;
}

/**
 * @brief A helper component representing a selectable league item in the expanded grid.
 * Displays the league's logo and name, and indicates if it's selected.
 * @param {LeagueItemProps} props - The component's props.
 * @returns {JSX.Element} A React element representing a selectable league item.
 */
const LeagueItem: React.FC<LeagueItemProps> = ({
  league,
  isSelected,
  onPress,
}) => {
  const { logoSource, isLoading } = useLeagueLogo(league.name, league.code);

  return (
    <TouchableOpacity
      key={league.code}
      style={[styles.leagueGridItem, isSelected && styles.selectedLeagueChip]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <View style={styles.chipLogoPlaceholder}>
          <Ionicons name="hourglass-outline" size={14} color="#777" />
        </View>
      ) : logoSource ? (
        <View style={styles.chipContainer}>
          <Image source={logoSource} style={styles.chipLogo} />
          <Text
            style={[
              styles.leagueChipText,
              isSelected && styles.selectedLeagueChipText,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {league.name}
          </Text>
        </View>
      ) : (
        <Text
          style={[
            styles.leagueChipText,
            isSelected && styles.selectedLeagueChipText,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {league.name}
        </Text>
      )}
    </TouchableOpacity>
  );
};

/**
 * @brief A component that allows users to filter by leagues.
 * It displays selected leagues in a collapsed view and provides an expandable grid
 * to select/deselect leagues from a list of available leagues.
 * @param {LeagueFilterProps} props - The component's props.
 * @returns {JSX.Element} A React element representing the league filter UI.
 */
const LeagueFilter: React.FC<LeagueFilterProps> = ({
  availableLeagues,
  selectedLeagues,
  handleLeagueChange,
}) => {
  const [isLeagueExpanded, setIsLeagueExpanded] = useState(false);

  // Maximum number of badges to show before collapsing (when > 3 are selected)
  const MAX_VISIBLE_BADGES_WHEN_COLLAPSED = 2;

  /**
   * @brief Renders the league badges for the collapsed header view.
   * Shows individual league badges or a summary count if many are selected.
   * @returns {JSX.Element | JSX.Element[]} A React element or an array of elements representing the badges.
   */
  const renderBadges = () => {
    const numSelected = selectedLeagues.length;

    if (numSelected === 0) {
      return <Text style={styles.noFiltersText}>No leagues selected</Text>;
    }

    // If 1 to 3 leagues are selected, show them all
    if (numSelected <= 3) {
      return selectedLeagues.map((league) => (
        <LeagueBadge key={league.code} league={league} />
      ));
    }

    // If more than 3 leagues are selected, show a summary
    return (
      <>
        {selectedLeagues
          .slice(0, MAX_VISIBLE_BADGES_WHEN_COLLAPSED)
          .map((league) => (
            <LeagueBadge key={league.code} league={league} />
          ))}
        <View style={[styles.filterBadge, styles.countBadge]}>
          <Text style={styles.countBadgeText}>
            +{numSelected - MAX_VISIBLE_BADGES_WHEN_COLLAPSED}
          </Text>
        </View>
      </>
    );
  };

  return (
    <View style={styles.filterCard}>
      <TouchableOpacity
        style={styles.filterCardHeader}
        onPress={() => setIsLeagueExpanded(!isLeagueExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.filterCardContent}>
          <View style={styles.filterTitleContainer}>
            <Ionicons name="football-outline" size={20} color="#1976d2" />
            <Text style={styles.filterTitle}>Choose Leagues</Text>
          </View>

          <View style={styles.filterBadgesSection}>
            <View style={styles.filterBadgesContainer}>{renderBadges()}</View>
            <View style={styles.indicatorContainer}>
              <Ionicons
                name={isLeagueExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color="#777"
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {isLeagueExpanded && (
        <View style={styles.expandedContent}>
          <View style={styles.leagueGrid}>
            {availableLeagues.map((league) => (
              <LeagueItem
                key={league.code}
                league={league}
                isSelected={selectedLeagues.some((l) => l.code === league.code)}
                onPress={() => handleLeagueChange(league)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

export default LeagueFilter;
