import React from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions, StyleSheet, SafeAreaView } from "react-native";
import { Match, Player } from "../../app/store";
import { Ionicons } from "@expo/vector-icons";
import  Styles from "../../app/style/gameProgressStyles"; 

interface MatchQuickActionsModalProps {
  isVisible: boolean;
  onClose: () => void;
  selectedMatchId: string | null;
  matches: Match[];
  players: Player[];
  commonMatchId: string;
  playerAssignments: Record<string, string[]>;
  handleGoalIncrement: (matchId: string) => void;
  handleGoalDecrement: (matchId: string) => void;
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const MatchQuickActionsModal: React.FC<MatchQuickActionsModalProps> = ({
  isVisible,
  onClose,
  selectedMatchId,
  matches,
  players,
  commonMatchId,
  playerAssignments,
  handleGoalIncrement,
  handleGoalDecrement,
}) => {
  // Skip rendering if no match is selected
  if (!selectedMatchId || !isVisible) return null;
  
  // Find the selected match
  const match = matches.find((m) => m.id === selectedMatchId);
  if (!match) return null;
  
  // Calculate affected players
  const affectedPlayers = players.filter(
    (p) => match.id === commonMatchId || 
           (playerAssignments[p.id] && 
            playerAssignments[p.id].includes(match.id))
  );

  return (
    <SafeAreaView style={{ flex: 0 }}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isVisible}
        onRequestClose={onClose}
        statusBarTranslucent={true}
      >
        <TouchableOpacity 
          style={modalStyles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={modalStyles.centeredView}>
            <View style={modalStyles.modalContainer}>
              <TouchableOpacity 
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={{ width: '100%' }}
              >
                <ScrollView 
                  contentContainerStyle={modalStyles.scrollContent}
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={modalStyles.title}>
                    {match.homeTeam} vs {match.awayTeam}
                  </Text>

                  

                  <View style={modalStyles.goalActions}>
                    <TouchableOpacity
                      style={[modalStyles.actionButton, modalStyles.decrementButton]}
                      onPress={() => handleGoalDecrement(match.id)}
                    >
                      <Ionicons name="remove" size={24} color="white" />
                    </TouchableOpacity>

                    <View style={modalStyles.goalCounter}>
                      <Text style={modalStyles.goalValue}>{match.goals}</Text>
                      <Text style={modalStyles.goalLabel}>GOALS</Text>
                    </View>

                    <TouchableOpacity
                      style={[modalStyles.actionButton, modalStyles.incrementButton]}
                      onPress={() => handleGoalIncrement(match.id)}
                    >
                      <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                  </View>

                  <View style={modalStyles.sectionHeader}>
                    <Ionicons name="people" size={16} color="#555" />
                    <Text style={modalStyles.sectionTitle}>This will affect:</Text>
                  </View>
                  {affectedPlayers.length > 0 ? (
                    <View style={modalStyles.playerListContainer}>
                      {affectedPlayers.map(player => (
                        <View key={player.id} style={modalStyles.playerCard}>
                          <Text style={modalStyles.playerName}>{player.name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={modalStyles.emptyStateContainer}>
                      <Ionicons name="person-outline" size={24} color="#aaa" />
                      <Text style={modalStyles.noPlayersText}>No players affected</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={modalStyles.closeButton}
                    onPress={onClose}
                  >
                    <Text style={modalStyles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const modalStyles = StyleSheet.create({
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0, 
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.8, // Reduced width
    maxHeight: SCREEN_HEIGHT * 0.6, // Reduced height
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16, // Reduced padding
    alignItems: 'center',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 8,
  },
  scrollContent: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 8,
  },
  title: {
    fontSize: 18, // Reduced font size
    fontWeight: 'bold',
    marginBottom: 12, // Reduced margin
    textAlign: 'center',
  },
  goalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 16, // Reduced margin
    width: '100%',
    paddingHorizontal: 8, // Reduced padding
  },
  goalCounter: {
    alignItems: 'center',
  },
  goalValue: {
    fontSize: 28, // Reduced font size
    fontWeight: 'bold',
  },
  goalLabel: {
    fontSize: 12, // Reduced font size
    color: '#666',
    marginTop: 4,
  },
  actionButton: {
    width: 40, // Reduced width
    height: 40, // Reduced height
    borderRadius: 20, // Reduced border radius
    justifyContent: 'center',
    alignItems: 'center',
  },
  decrementButton: {
    backgroundColor: '#f44336',
  },
  incrementButton: {
    backgroundColor: '#4caf50',
  },
  sectionTitle: {
    fontSize: 14, // Reduced font size
    fontWeight: 'bold',
    marginTop: 6, // Reduced margin
    marginBottom: 8, // Reduced margin
    alignSelf: 'flex-start',
    marginLeft: 6,
    color: '#555',
  },
  playerListContainer: {
    width: '100%',
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    maxHeight: SCREEN_HEIGHT * 0.15,
    paddingVertical: 4,
  },
  noPlayersText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginLeft: 8,
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8, // Reduced padding
    paddingHorizontal: 16, // Reduced padding
    borderRadius: 6, // Reduced border radius
    marginTop: 6, // Reduced margin
  },
  closeButtonText: {
    fontSize: 14, // Reduced font size
    color: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 6,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb',
  },
  playerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  emptyStateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
  },
  playerIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerInitial: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  playerStatusIcon: {
    marginLeft: 8,
  }
});

export default MatchQuickActionsModal;