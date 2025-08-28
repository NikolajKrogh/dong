import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLeagueLogo } from "../../hooks/useLeagueLogo";
import { LeagueEndpoint } from "../../constants/leagues";
import createSetupGameStyles from "../../app/style/setupGameStyles";
import { useColors } from "../../app/style/theme";

/**
 * Props for league filter.
 * @description Supplies available league options, the user's current multi-selection and a toggle handler.
 * @property availableLeagues All leagues fetched/derived that can be chosen.
 * @property selectedLeagues Currently active (chosen) leagues used for filtering matches.
 * @property handleLeagueChange Callback to toggle a league in/out of the selection.
 */
interface LeagueFilterProps {
  availableLeagues: LeagueEndpoint[];
  selectedLeagues: LeagueEndpoint[];
  handleLeagueChange: (league: LeagueEndpoint) => void;
}

/**
 * League badge.
 * @description Small logo representation for collapsed header.
 */
const LeagueBadge = ({ league }: { league: LeagueEndpoint }) => {
  const { logoSource, isLoading } = useLeagueLogo(league.name, league.code);
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);

  return (
    <View key={league.code} style={styles.filterBadge}>
      {isLoading ? (
        <View style={styles.badgeLogoPlaceholder}>
          <Ionicons
            name="hourglass-outline"
            size={14}
            color={colors.textMuted}
          />
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
 * Props for league item.
 */
interface LeagueItemProps {
  league: LeagueEndpoint;
  isSelected: boolean;
  onPress: () => void;
}

/**
 * League grid item.
 * @description Selectable league chip with logo + selection styling.
 * @param {LeagueItemProps} props Item props.
 * @returns {JSX.Element} Element.
 */
const LeagueItem: React.FC<LeagueItemProps> = ({
  league,
  isSelected,
  onPress,
}) => {
  const { logoSource, isLoading } = useLeagueLogo(league.name, league.code);
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);

  return (
    <TouchableOpacity
      key={league.code}
      style={[styles.leagueGridItem, isSelected && styles.selectedLeagueChip]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <View style={styles.chipLogoPlaceholder}>
          <Ionicons
            name="hourglass-outline"
            size={14}
            color={colors.textMuted}
          />
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
 * League filter.
 * @description Collapsible UI to select/deselect leagues with badge preview.
 * @param {LeagueFilterProps} props Component props.
 * @returns {JSX.Element} Filter element.
 */
const LeagueFilter: React.FC<LeagueFilterProps> = ({
  availableLeagues,
  selectedLeagues,
  handleLeagueChange,
}) => {
  const [isLeagueExpanded, setIsLeagueExpanded] = useState(false);
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);

  // Maximum number of badges to show before collapsing (when > 3 are selected)
  const MAX_VISIBLE_BADGES_WHEN_COLLAPSED = 2;

  /** Render selected league badges or summary indicator. */
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
            <Ionicons
              name="football-outline"
              size={20}
              color={colors.primaryFocus}
            />
            <Text style={styles.filterTitle}>Choose Leagues</Text>
          </View>

          <View style={styles.filterBadgesSection}>
            <View style={styles.filterBadgesContainer}>{renderBadges()}</View>
            <View style={styles.indicatorContainer}>
              <Ionicons
                name={isLeagueExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textMuted}
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
