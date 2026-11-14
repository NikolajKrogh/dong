import React from "react";
import { Text, View } from "react-native";
import { TeamBadge } from "../../football-matches/TeamBadge";
import type { SavedMatchTeam } from "../../../types/footballMatch";
import { createStyles } from "./styles";

interface MatchHeaderProps {
  homeTeam: string;
  awayTeam: string;
  homeTeamDetails?: SavedMatchTeam;
  awayTeamDetails?: SavedMatchTeam;
  isCommonMatch: boolean;
  styles: ReturnType<typeof createStyles>;
}

/** Teams header (logos, names, VS badge) plus the common-match badge. */
export const MatchHeader = ({
  homeTeam,
  awayTeam,
  homeTeamDetails,
  awayTeamDetails,
  isCommonMatch,
  styles,
}: MatchHeaderProps) => {
  return (
    <>
      <View style={styles.matchHeaderSection}>
        {/* Home team */}
        <View style={styles.matchTeamContainer}>
          <TeamBadge teamName={homeTeam} team={homeTeamDetails} resizeMode="contain" style={styles.matchTeamLogo} />
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
          <TeamBadge teamName={awayTeam} team={awayTeamDetails} resizeMode="contain" style={styles.matchTeamLogo} />
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
