/**
 * @file MatchCard.tsx
 * @description History screen list item displaying a single match with teams, score, and optional "Common" badge.
 */
import React, { useMemo } from "react";
import { View, Text, Image } from "react-native";
import { Match } from "./historyTypes";
import { createHistoryStyles } from "../../app/style/historyStyles";
import { useColors } from "../../app/style/theme";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";

/**
 * Props for {@link MatchCard}.
 */
interface MatchCardProps {
  /** Full match data including teams and (possibly null) goal counts. */
  match: Match;
  /** Whether this match is part of the user's common game set; shows a badge when true. */
  isCommon?: boolean;
  /** Optional style overrides merged onto the outer container. */
  style?: object;
}

/**
 * MatchCard component
 *
 * Renders a single historical match row with both team logos, names (truncated
 * to a single line), and the score block in the middle. If `isCommon` is set it
 * appends a highlighted badge indicating the match belongs to the common set.
 *
 * Logos are resolved through `getTeamLogoWithFallback` to guard against
 * missing assets. Null / undefined goal values are displayed as 0 to keep a
 * consistent layout.
 */
const MatchCard: React.FC<MatchCardProps> = ({ match, isCommon, style }) => {
  const colors = useColors();
  const styles = useMemo(() => createHistoryStyles(colors), [colors]);
  return (
    <View style={[styles.matchRow, style]}>
      {" "}
      {/* Use base style */}
      <View style={styles.matchTeams}>
        <View style={styles.matchTeamBlock}>
          <Image
            source={getTeamLogoWithFallback(match.homeTeam)}
            style={styles.matchTeamLogo}
            resizeMode="contain"
          />
          <Text style={styles.matchTeamName} numberOfLines={1}>
            {match.homeTeam}
          </Text>
        </View>

        <View style={styles.scoreBlock}>
          <Text style={styles.scoreText}>{match.homeGoals ?? 0}</Text>
          <Text style={styles.vsText}>-</Text>
          <Text style={styles.scoreText}>{match.awayGoals ?? 0}</Text>
        </View>

        <View style={styles.matchTeamBlock}>
          <Image
            source={getTeamLogoWithFallback(match.awayTeam)}
            style={styles.matchTeamLogo}
            resizeMode="contain"
          />
          <Text style={styles.matchTeamName} numberOfLines={1}>
            {match.awayTeam}
          </Text>
        </View>
      </View>
      {isCommon && (
        <View style={styles.commonBadge}>
          <Text style={styles.commonBadgeText}>Common</Text>
        </View>
      )}
    </View>
  );
};

export default MatchCard;
