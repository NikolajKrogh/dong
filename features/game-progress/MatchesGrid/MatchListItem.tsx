import React, { useMemo } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "../../../components/ui/AppIcon";
import { useColors } from "../../../styles/theme";
import { formatMatchScore, getMatchPresentation } from "../../football-matches/matchPresentation";
import { useTeamLogo } from "../../football-matches/useTeamLogo";
import { createGameProgressStyles } from "../gameProgressStyles";
import { MatchItemProps } from "./types";

/**
 * MatchListItem component.
 * @description Renders a single match in list form: team logos, live/finished status (minutes, FT, HT),
 * current scores, and assigned players (condensed into badges).
 * Highlights the common match and triggers quick action modal on press.
 * @param props Component props.
 */
const MatchListItem: React.FC<MatchItemProps> = ({
  match,
  commonMatchId,
  assignedPlayers,
  liveMatch,
  openQuickActions,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createGameProgressStyles(colors), [colors]);

  // Get team logos with async fallback support
  const homeTeamLogo = useTeamLogo(match.homeTeam);
  const awayTeamLogo = useTeamLogo(match.awayTeam);

  const { homeScore, awayScore, displayStatus, showStatus } = getMatchPresentation(match, liveMatch);
  const statusDisplay =
    showStatus ? (
      <Text style={[styles.minutesPlayedText, styles.matchList_StatusText]}>
        {displayStatus}
      </Text>
    ) : (
      <Text style={[styles.vsText, styles.matchList_VSFallbackText]}>-</Text>
    );

  /**
   * Builds badge list for assigned players with +N overflow indicator.
   * @returns React node containing player badges.
   */
  const playerDisplayText = useMemo(() => {
    if (!assignedPlayers || assignedPlayers.length === 0) {
      return <Text style={styles.emptyPlayerCount}>0</Text>;
    }
    const firstNames = assignedPlayers.map((p) => p.name.split(" ")[0]);
    const MAX_CHARS = 20;
    let charCount = 0;
    let namesCount = 0;
    for (const name of firstNames) {
      if (charCount + name.length <= MAX_CHARS) {
        charCount += name.length;
        namesCount++;
      } else {
        break;
      }
    }
    const visiblePlayers = assignedPlayers.slice(0, namesCount);
    const remaining = assignedPlayers.length - namesCount;
    return (
      <View style={styles.playerBadgeContainer}>
        {visiblePlayers.map((player) => (
          <View key={player.id} style={styles.playerBadge}>
            <Text style={styles.playerBadgeText}>
              {player.name.split(" ")[0]}
            </Text>
          </View>
        ))}
        {remaining > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>+{remaining}</Text>
          </View>
        )}
      </View>
    );
  }, [assignedPlayers, styles]);

  return (
    <TouchableOpacity
      testID={`GameProgressMatchCard-${match.id}`}
      style={[styles.gridItem, styles.matchListItemCard]}
      onPress={() => openQuickActions(match.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Open quick actions for ${match.homeTeam} versus ${match.awayTeam}`}
    >
      {/* Common indicator */}
      {match.id === commonMatchId && (
        <View style={styles.commonMatchIndicator}>
          <Text style={styles.commonMatchIndicator_Text}>Common</Text>
        </View>
      )}

      <View style={styles.teamsContainer}>
        {/* Team logos with scores positioned horizontally */}
        <View style={styles.logosRow}>
          {/* Home team: Logo on LEFT */}
          <View style={styles.matchList_HomeLogoWrapper}>
            <Image source={homeTeamLogo} style={styles.matchList_LogoImage} />
          </View>

          <View
            style={[styles.scoresContainer, styles.matchList_ScoresWrapper]}
          >
            <Text style={[styles.gridScoreText, styles.matchList_ScoreText]}>
              {formatMatchScore(homeScore)}
            </Text>
            {statusDisplay}
            <Text style={[styles.gridScoreText, styles.matchList_ScoreText]}>
              {formatMatchScore(awayScore)}
            </Text>
          </View>

          {/* Away team: Logo on RIGHT */}
          <View style={styles.matchList_AwayLogoWrapper}>
            <Image source={awayTeamLogo} style={styles.matchList_LogoImage} />
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <AppIcon name="people-outline" size={13} color={colors.textMuted} />
            <Text style={styles.statValue}>{playerDisplayText}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(MatchListItem);
