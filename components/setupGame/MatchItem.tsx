import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { isWideLayout as isWideViewport } from "../../app/style/responsive";
import createSetupGameStyles from "../../app/style/setupGameStyles";
import { useColors } from "../../app/style/theme";
import { Match } from "../../store/store";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";
import AppIcon from "../AppIcon";

interface MatchItemProps {
  match: Match;
  handleRemoveMatch: (id: string) => void;
}

const MatchItem: React.FC<MatchItemProps> = ({ match, handleRemoveMatch }) => {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const isWideLayout = isWideViewport(width);
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
      if (!Number.isNaN(date.getTime())) {
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
      const espnMatch = /T(\d{2}:\d{2})Z/.exec(match.startTime);
      if (espnMatch?.[1]) {
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
    <View
      testID="SetupMatchItemWrapper"
      style={[
        styles.matchItemWrapper,
        isWideLayout && styles.matchItemWrapperWide,
      ]}
    >
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
              <AppIcon name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.matchTimeText}>{formatMatchTime()}</Text>
            </View>
          )}

          {/* Remove button */}
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveMatch(match.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <AppIcon name="close-circle" size={20} color={colors.danger} />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );
};

export default MatchItem;
