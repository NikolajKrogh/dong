import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "../../store/store";
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

  // Format match start time with better error handling
  const formatMatchTime = () => {
    if (!match.startTime) return null;

    // Try multiple approaches to display the time
    try {
      // 1. First try: Direct parsing as Date object
      const date = new Date(match.startTime);

      // Check if date is valid
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      }

      // 2. Second try: Check if it's just a time string (HH:MM)
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(match.startTime)) {
        return match.startTime;
      }

      // 3. Third try: Check if we can extract time from ESPN format
      const espnMatch = match.startTime.match(/T(\d{2}:\d{2})Z/);
      if (espnMatch && espnMatch[1]) {
        // Convert from UTC to local time
        const [hours, minutes] = espnMatch[1].split(":").map(Number);
        const localDate = new Date();
        localDate.setUTCHours(hours, minutes);

        return localDate.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      }

      // 4. Fallback: Just show the raw string
      return match.startTime;
    } catch (e) {
      console.log("Time formatting error:", e, "for time:", match.startTime);
      // If any error in parsing, just return the raw string
      return match.startTime;
    }
  };

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

          {/* Match start time - new addition */}
          {match.startTime && (
            <View style={styles.matchTimeContainer}>
              <Ionicons name="time-outline" size={14} color="#666" />
              <Text style={styles.matchTimeText}>{formatMatchTime()}</Text>
            </View>
          )}
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
