import React from 'react';
import { View, Text, Image } from 'react-native';
import { Match } from './historyTypes';
import { styles } from './historyStyles';
import { getTeamLogoWithFallback } from '../../utils/teamLogos';

interface MatchCardProps {
  match: Match;
  isCommon?: boolean;
  style?: object;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, isCommon, style }) => {
  return (
    <View style={[styles.matchRow, style]}> {/* Use base style */}
      <View style={styles.matchTeams}>
        <View style={styles.matchTeamBlock}>
          <Image
            source={getTeamLogoWithFallback(match.homeTeam)}
            style={styles.matchTeamLogo}
            resizeMode="contain"
          />
          <Text style={styles.matchTeamName} numberOfLines={1}>{match.homeTeam}</Text>
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
          <Text style={styles.matchTeamName} numberOfLines={1}>{match.awayTeam}</Text>
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