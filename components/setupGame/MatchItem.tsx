import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "../../app/store";
import styles from "../../app/style/setupGameStyles";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";

interface MatchItemProps {
  match: Match;
  selectedCommonMatch: string | null;
  handleSelectCommonMatch: (id: string) => void;
  handleRemoveMatch: (id: string) => void;
}

const MatchItem: React.FC<MatchItemProps> = ({
  match,
  selectedCommonMatch,
  handleSelectCommonMatch,
  handleRemoveMatch,
}) => {
  const homeTeamLogo = getTeamLogoWithFallback(match.homeTeam);
  const awayTeamLogo = getTeamLogoWithFallback(match.awayTeam);
  const isSelected = selectedCommonMatch === match.id;

  return (
    <View style={styles.matchItemWrapper}>
      <TouchableOpacity
        onPress={() => handleSelectCommonMatch(match.id)}
        activeOpacity={0.6}
        style={[
          styles.assignmentItem,
          isSelected && styles.selectedAssignmentItem,
        ]}
      >
        {/* Teams section */}
        <View style={styles.matchTeamsSection}>
          {/* Home team row */}
          <View style={styles.matchTeamRow}>
            {homeTeamLogo && (
              <Image source={homeTeamLogo} style={styles.matchTeamLogo} />
            )}
            <Text
              style={styles.matchTeamName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {match.homeTeam}
            </Text>
          </View>

          {/* Divider with vs text */}
          <View style={styles.matchDivider}>
            <Text style={styles.matchVsText}>vs</Text>
          </View>

          {/* Away team row */}
          <View style={styles.matchTeamRow}>
            {awayTeamLogo && (
              <Image source={awayTeamLogo} style={styles.matchTeamLogo} />
            )}
            <Text
              style={styles.matchTeamName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {match.awayTeam}
            </Text>
          </View>
        </View>

        {/* Actions section */}
        <View style={styles.matchActionsContainer}>
          {/* Selection indicator */}
          <View style={styles.matchSelectionIndicator}>
            <Ionicons
              name={isSelected ? "checkmark-circle" : "radio-button-off"}
              size={22}
              color={isSelected ? "#007bff" : "#bbb"}
            />
          </View>

          {/* Delete button */}
          <TouchableOpacity
            style={styles.matchDeleteButton}
            onPress={() => handleRemoveMatch(match.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default MatchItem;
