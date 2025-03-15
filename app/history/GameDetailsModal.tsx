import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { GameSession } from './historyTypes';
import { styles } from './historyStyles';

interface GameDetailsModalProps {
  game: GameSession | null;
  visible: boolean;
  onClose: () => void;
}

const GameDetailsModal: React.FC<GameDetailsModalProps> = ({ game, visible, onClose }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (!game) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <ScrollView style={styles.modalScrollView}>
            <Text style={styles.modalTitle}>Game Details</Text>
            <Text style={styles.modalDate}>{formatDate(game.date)}</Text>
            
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Players</Text>
              {game.players
                .sort((a, b) => (b.drinksTaken || 0) - (a.drinksTaken || 0)) // Sort by drinks taken
                .map(player => (
                <View key={player.id} style={styles.playerDetail}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <View style={styles.drinkBadge}>
                    <Text style={styles.playerDrinks}>
                      {(player.drinksTaken || 0).toFixed(1)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Matches</Text>
              {game.matches.map(match => (
                <View key={match.id} style={styles.matchDetail}>
                  <View style={styles.matchDetailHeader}>
                    <Text style={styles.matchText}>
                      {match.homeTeam} vs {match.awayTeam}
                    </Text>
                    {match.id === game.commonMatchId && (
                      <View style={styles.commonBadge}>
                        <Text style={styles.commonBadgeText}>Common</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.matchGoals}>
                    Goals: {match.goals}
                  </Text>
                  
                  <View style={styles.assignedPlayersSection}>
                    <Text style={styles.assignedPlayersTitle}>Assigned Players:</Text>
                    <View style={styles.assignedPlayersList}>
                      {game.players
                        .filter(player => 
                          match.id === game.commonMatchId || 
                          (game.playerAssignments[player.id] && 
                           game.playerAssignments[player.id].includes(match.id))
                        )
                        .map(player => (
                          <Text key={player.id} style={styles.assignedPlayerName}>
                            • {player.name}
                          </Text>
                        ))
                      }
                    </View>
                  </View>
                </View>
              ))}
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default GameDetailsModal;