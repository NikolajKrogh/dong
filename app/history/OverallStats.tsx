import React from 'react';
import { View, Text } from 'react-native';
import { GameSession } from './historyTypes';
import { styles } from './historyStyles';

interface OverallStatsProps {
  history: GameSession[];
}

const OverallStats: React.FC<OverallStatsProps> = ({ history }) => {
  // Calculate overall statistics
  const totalGames = history.length;
  const totalPlayers = history.reduce((sum, game) => sum + game.players.length, 0);
  const totalMatches = history.reduce((sum, game) => sum + game.matches.length, 0);
  const totalGoals = history.reduce((sum, game) => 
    sum + game.matches.reduce((gameSum, match) => gameSum + match.goals, 0), 0);
  
  const totalDrinks = history.reduce((sum, game) => 
    sum + game.players.reduce((gameSum, player) => gameSum + (player.drinksTaken || 0), 0), 0);
    
  const averageDrinksPerPlayer = totalPlayers > 0 ? 
    (totalDrinks / totalPlayers).toFixed(1) : '0';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Overall Statistics</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalGames}</Text>
          <Text style={styles.statLabel}>Games</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalPlayers}</Text>
          <Text style={styles.statLabel}>Players</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalMatches}</Text>
          <Text style={styles.statLabel}>Matches</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalGoals}</Text>
          <Text style={styles.statLabel}>Goals</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalDrinks.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Total Drinks</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{averageDrinksPerPlayer}</Text>
          <Text style={styles.statLabel}>Avg Drinks/Player</Text>
        </View>
      </View>
    </View>
  );
};

export default OverallStats;