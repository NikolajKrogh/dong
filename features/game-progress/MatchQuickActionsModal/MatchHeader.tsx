import React from "react";
import { Image, ImageSourcePropType, Text, View } from "react-native";
import { createStyles } from "./styles";

interface MatchHeaderProps {
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: ImageSourcePropType;
  awayTeamLogo: ImageSourcePropType;
  isCommonMatch: boolean;
  styles: ReturnType<typeof createStyles>;
}

/** Teams header (logos, names, VS badge) plus the common-match badge. */
export const MatchHeader = ({
  homeTeam,
  awayTeam,
  homeTeamLogo,
  awayTeamLogo,
  isCommonMatch,
  styles,
}: MatchHeaderProps) => {
  return (
    <>
      <View style={styles.matchHeaderSection}>
        {/* Home team */}
        <View style={styles.matchTeamContainer}>
          <Image source={homeTeamLogo} style={styles.matchTeamLogo} />
          <Text style={styles.matchTeamName} numberOfLines={2}>
            {homeTeam}
          </Text>
        </View>

        {/* VS badge */}
        <View style={styles.matchVsBadge}>
          <Text style={styles.matchVsText}>VS</Text>
        </View>

        {/* Away team */}
        <View style={styles.matchTeamContainer}>
          <Image source={awayTeamLogo} style={styles.matchTeamLogo} />
          <Text style={styles.matchTeamName} numberOfLines={2}>
            {awayTeam}
          </Text>
        </View>
      </View>

      {/* Common match badge if applicable */}
      {isCommonMatch && (
        <View style={styles.commonMatchBadge}>
          <Text style={styles.commonMatchText}>Common Match</Text>
        </View>
      )}
    </>
  );
};
