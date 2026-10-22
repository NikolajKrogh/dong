import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLeagueLogo } from "../../hooks/useLeagueLogo";
import { LeagueEndpoint } from "../../constants/leagues";
import createSetupGameStyles from "../../styles/setupGameStyles";
import { useColors } from "../../styles/theme";

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
    <View key={league.code} style={summaryStyles.badge}>
      {isLoading ? (
        <View style={styles.badgeLogoPlaceholder}>
          <Ionicons
            name="hourglass-outline"
            size={14}
            color={colors.textMuted}
          />
        </View>
      ) : logoSource ? (
        <Image source={logoSource} style={summaryStyles.logo} />
      ) : (
        // Fallback to text if logo is not available or still loading
        <Text
          style={styles.filterBadgeText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {league.name.slice(0, 2)}
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


  return (
    <View style={styles.filterCard}>
      <TouchableOpacity
        testID="SetupLeagueToggle"
        accessibilityRole="button"
        accessibilityLabel="Choose leagues"
        accessibilityState={{ expanded: isLeagueExpanded }}
        style={summaryStyles.button}
        onPress={() => setIsLeagueExpanded(!isLeagueExpanded)}
        activeOpacity={0.7}
      >
        <View style={summaryStyles.row}>
          <View style={summaryStyles.icons}>
            {selectedLeagues.slice(0, 3).map(league => <LeagueBadge key={league.code} league={league} />)}
            {selectedLeagues.length > 3 ? <Text style={{ color: colors.textSecondary }}>{`+${selectedLeagues.length - 3}`}</Text> : null}
          </View>
          <Text numberOfLines={1} style={[summaryStyles.label, { color: colors.textPrimary }]}>
            {selectedLeagues.length === 0 ? "Choose leagues" : `${selectedLeagues.length} ${selectedLeagues.length === 1 ? "league" : "leagues"}`}
          </Text>
          <Ionicons name={isLeagueExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
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

const summaryStyles = StyleSheet.create({
  button: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 48 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  icons: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  badge: { width: 24, height: 28, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logo: { width: 24, height: 26, resizeMode: "contain" },
  label: { flex: 1, fontSize: 14, fontWeight: "600" },
});
