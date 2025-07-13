import React from "react";
import { View, Text, TouchableOpacity, Image, ImageStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Match } from "../../store/store";
import styles from "../../app/style/setupGameStyles";
import { colors } from "../../app/style/palette";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";

interface MatchItemProps {
  match: Match;
  handleRemoveMatch: (id: string) => void;
}

const MatchItem: React.FC<MatchItemProps> = ({ match, handleRemoveMatch }) => {
  const homeTeamLogo = getTeamLogoWithFallback(match.homeTeam);
  const awayTeamLogo = getTeamLogoWithFallback(match.awayTeam);

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
      <View style={styles.matchCard}>
        <LinearGradient
          colors={[colors.primaryLighter, colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.matchCardGradient}
        >
          {/* Teams container */}
          <View style={styles.matchTeamsContainer}>
            {/* Home team column */}
            <View style={styles.matchTeamColumn}>
              <View style={styles.logoContainer}>
                {homeTeamLogo ? (
                  <Image source={homeTeamLogo} style={styles.teamLogo} />
                ) : (
                  <View style={styles.teamLogoPlaceholder}>
                    <Text style={styles.teamLogoPlaceholderText}>
                      {match.homeTeam.charAt(0)}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={styles.teamName}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {match.homeTeam}
              </Text>
            </View>

            {/* VS column */}
            <View style={styles.vsDivider}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            {/* Away team column */}
            <View style={styles.matchTeamColumn}>
              <View style={styles.logoContainer}>
                {awayTeamLogo ? (
                  <Image source={awayTeamLogo} style={styles.teamLogo} />
                ) : (
                  <View style={styles.teamLogoPlaceholder}>
                    <Text style={styles.teamLogoPlaceholderText}>
                      {match.awayTeam.charAt(0)}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={styles.teamName}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {match.awayTeam}
              </Text>
            </View>
          </View>

          {/* Match time section at the bottom */}
          {match.startTime && (
            <View style={styles.matchTimeHeader}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.matchTimeText}>{formatMatchTime()}</Text>
            </View>
          )}

          {/* Remove button */}
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveMatch(match.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color={colors.danger} />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );
};

export default MatchItem;
