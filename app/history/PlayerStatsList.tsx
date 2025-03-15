import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { PlayerStat } from './historyTypes';
import { styles } from './historyStyles';

interface PlayerStatsListProps {
  playerStats: PlayerStat[];
}

const PlayerStatsList: React.FC<PlayerStatsListProps> = ({ playerStats }) => {
  const renderPlayerStatItem = ({ item }: { item: PlayerStat }) => {
    return (
      <View style={styles.playerStatItem}>
        <Text style={styles.playerStatName}>{item.name}</Text>
        <View style={styles.playerStatDetails}>
          <View style={styles.playerStatDetail}>
            <Text style={styles.playerStatValue}>{item.totalDrinks.toFixed(1)}</Text>
            <Text style={styles.playerStatLabel}>Total Drinks</Text>
          </View>
          
          <View style={styles.playerStatDetail}>
            <Text style={styles.playerStatValue}>{item.gamesPlayed}</Text>
            <Text style={styles.playerStatLabel}>Games</Text>
          </View>
          
          <View style={styles.playerStatDetail}>
            <Text style={styles.playerStatValue}>{item.averagePerGame.toFixed(1)}</Text>
            <Text style={styles.playerStatLabel}>Avg/Game</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Player Statistics</Text>
      <Text style={styles.sectionSubtitle}>Lifetime drink totals</Text>
      
      <FlatList
        data={playerStats}
        keyExtractor={item => item.name}
        renderItem={renderPlayerStatItem}
        scrollEnabled={false}
      />
    </View>
  );
};

export default PlayerStatsList;