import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { GameSession } from './historyTypes';
import { styles } from './historyStyles';

interface GameHistoryItemProps {
  game: GameSession;
  onPress: (game: GameSession) => void;
}

const GameHistoryItem: React.FC<GameHistoryItemProps> = ({ game, onPress }) => {
  const [showPlayers, setShowPlayers] = useState(false);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const toggleShowPlayers = () => {
    setShowPlayers(!showPlayers);
  };
  
  const totalDrinks = game.players.reduce(
    (sum, player) => sum + (player.drinksTaken || 0), 0
  );
  
  const totalGoals = game.matches.reduce(
    (sum, match) => sum + match.goals, 0
  );
  
  return (
    <TouchableOpacity 
      style={styles.gameItem}
      onPress={() => onPress(game)}
    >
      <Text style={styles.gameDate}>{formatDate(game.date)}</Text>
      <View style={styles.gameSummary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{game.players.length}</Text>
          <Text style={styles.summaryLabel}>Players</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{game.matches.length}</Text>
          <Text style={styles.summaryLabel}>Matches</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalGoals}</Text>
          <Text style={styles.summaryLabel}>Goals</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalDrinks.toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>Drinks</Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.expandButton}
        onPress={toggleShowPlayers}
      >
        <Text style={styles.expandButtonText}>
          {showPlayers ? 'Hide Players' : 'Show Players'}
        </Text>
      </TouchableOpacity>
      
      {showPlayers && (
        <View style={styles.playerList}>
          <Text style={styles.playerListTitle}>Player Drinks:</Text>
          {game.players
            .sort((a, b) => (b.drinksTaken || 0) - (a.drinksTaken || 0))
            .map(player => (
              <View key={player.id} style={styles.playerRow}>
                <Text style={styles.playerItemName}>{player.name}</Text>
                <Text style={styles.playerItemDrinks}>{(player.drinksTaken || 0).toFixed(1)}</Text>
              </View>
            ))
          }
        </View>
      )}
    </TouchableOpacity>
  );
};

export default GameHistoryItem;