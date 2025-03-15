import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore } from '../store';
import { styles } from './historyStyles';
import { GameSession, PlayerStat } from './historyTypes';
import GameHistoryItem from './GameHistoryItem';
import GameDetailsModal from './GameDetailsModal';
import PlayerStatsList from './PlayerStatsList';
import OverallStats from './OverallStats';

const HistoryScreen = () => {
  const router = useRouter();
  const { history } = useGameStore();
  const [selectedGame, setSelectedGame] = useState<GameSession | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  
  // Calculate player lifetime statistics
  useEffect(() => {
    if (history.length > 0) {
      const playerMap = new Map<string, PlayerStat>();
      
      // Collect all player data across all games
      history.forEach(game => {
        game.players.forEach(player => {
          const name = player.name;
          const drinks = player.drinksTaken || 0;
          
          if (playerMap.has(name)) {
            const existing = playerMap.get(name)!;
            playerMap.set(name, {
              name,
              totalDrinks: existing.totalDrinks + drinks,
              gamesPlayed: existing.gamesPlayed + 1,
              averagePerGame: 0 // Will calculate at the end
            });
          } else {
            playerMap.set(name, {
              name,
              totalDrinks: drinks,
              gamesPlayed: 1,
              averagePerGame: 0
            });
          }
        });
      });
      
      // Calculate averages and convert to array
      const statsArray = Array.from(playerMap.values()).map(stat => ({
        ...stat,
        averagePerGame: stat.totalDrinks / stat.gamesPlayed
      }));
      
      // Sort by total drinks (descending)
      statsArray.sort((a, b) => b.totalDrinks - a.totalDrinks);
      
      setPlayerStats(statsArray);
    }
  }, [history]);
  
  const viewGameDetails = (game: GameSession) => {
    setSelectedGame(game);
    setIsDetailVisible(true);
  };
  
  const closeDetails = () => {
    setIsDetailVisible(false);
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Game History</Text>
        
        {history.length === 0 ? (
          <Text style={styles.emptyText}>No games played yet.</Text>
        ) : (
          <FlatList
            data={history}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <GameHistoryItem game={item} onPress={viewGameDetails} />
            )}
            scrollEnabled={false}
          />
        )}
      </View>
      
      {playerStats.length > 0 && (
        <PlayerStatsList playerStats={playerStats} />
      )}
      
      {history.length > 0 && (
        <OverallStats history={history} />
      )}
      
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>Back to Home</Text>
      </TouchableOpacity>
      
      <GameDetailsModal
        game={selectedGame}
        visible={isDetailVisible}
        onClose={closeDetails}
      />
    </ScrollView>
  );
};

export default HistoryScreen;