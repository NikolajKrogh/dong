import React, { useMemo } from "react";
import { Image, Platform, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "../../../components/ui/AppIcon";
import { useColors } from "../../../styles/theme";
import { formatMatchScore, getMatchPresentation } from "../../football-matches/matchPresentation";
import { useTeamLogo } from "../../football-matches/useTeamLogo";
import { createGameProgressStyles } from "../gameProgressStyles";
import { MatchItemProps } from "./types";

const MatchGridItem: React.FC<MatchItemProps> = ({
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
      <Text style={styles.minutesPlayedText}>{displayStatus}</Text>
    ) : (
      <Text style={styles.vsText}>-</Text>
    );

  /**
   * Build compact player badge list.
   * @description Memoized renderer that converts assigned players into a horizontal list of first‑name badges.
   * Shows: muted 0 when empty; as many badges as fit within a simple character budget; a +N overflow badge when
   * some players are hidden. Optimised for very small footprint in the grid card.
   * @returns {React.ReactNode} Badge container element.
   */
  const playerDisplayText = useMemo(() => {
    if (!assignedPlayers || assignedPlayers.length === 0) {
      return <Text style={styles.emptyPlayerCount}>0</Text>;
    }
    // Show as many as reasonably fit with truncation

    // Calculate how many badges we can show based on character count
    const firstNames = assignedPlayers.map((p) => p.name.split(" ")[0]);
    const MAX_CHARS = 6;

    let charCount = 0;
    let namesCount = 0;

    for (const name of firstNames) {
      // Approximate space needed for each badge
      if (charCount + name.length <= MAX_CHARS) {
        charCount += name.length;
        namesCount++;
      } else {
        break;
      }
    }

    // Show visible badges + count badge if needed
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
      style={styles.gridItem}
      onPress={() => openQuickActions(match.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={Platform.OS === "web" ? undefined : `Open quick actions for ${match.homeTeam} versus ${match.awayTeam}`}
    >
      {/* Common indicator */}
      {match.id === commonMatchId && <View style={styles.commonIndicator} />}

      <View style={styles.teamsContainer}>
        {/* Team logos with scores positioned horizontally */}
        <View style={styles.logosRow}>
          {/* Home team: Logo on LEFT */}
          <View style={styles.teamLogoContainer}>
            <Image
              accessibilityLabel={match.homeTeam}
              source={homeTeamLogo}
              style={styles.teamLogo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.scoresContainer}>
            <Text style={styles.gridScoreText}>{formatMatchScore(homeScore)}</Text>

            {statusDisplay}

            <Text style={styles.gridScoreText}>{formatMatchScore(awayScore)}</Text>
          </View>

          {/* Away team: Logo on RIGHT */}
          <View style={styles.teamLogoContainer}>
            <Image
              accessibilityLabel={match.awayTeam}
              source={awayTeamLogo}
              style={styles.teamLogo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Stats row remains the same */}
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

export default React.memo(MatchGridItem);
