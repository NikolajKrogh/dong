import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions, StyleSheet, SafeAreaView, Animated } from "react-native";
import { Match, Player } from "../../app/store";
import { Ionicons } from "@expo/vector-icons";
import Styles from "../../app/style/gameProgressStyles";

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

  // Animation values
  const decrementAnim = useRef(new Animated.Value(1)).current;
  const incrementAnim = useRef(new Animated.Value(1)).current;
  const closeButtonAnim = useRef(new Animated.Value(1)).current;
  const goalValueAnim = useRef(new Animated.Value(1)).current;
  const modalContentAnim = useRef(new Animated.Value(0)).current;
  
  // Previous goal value reference
  const prevGoalsRef = useRef(match.goals);

  // Button press animation
  const animateButtonPress = (buttonAnim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(buttonAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Modal entry animation
  useEffect(() => {
    if (isVisible) {
      Animated.timing(modalContentAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  // Goal value change animation
  useEffect(() => {
    if (prevGoalsRef.current !== match.goals) {
      Animated.sequence([
        Animated.timing(goalValueAnim, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(goalValueAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      
      prevGoalsRef.current = match.goals;
    }
  }, [match.goals]);

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
            <Animated.View 
              style={[
                modalStyles.modalContainer,
                { 
                  opacity: modalContentAnim,
                  transform: [
                    { scale: modalContentAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1]
                      })
                    }
                  ]
                }
              ]}
            >
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
                    <Animated.View style={{
                      transform: [{ scale: decrementAnim }]
                    }}>
                      <TouchableOpacity
                        style={[modalStyles.actionButton, modalStyles.decrementButton]}
                        onPress={() => {
                          handleGoalDecrement(match.id);
                          animateButtonPress(decrementAnim);
                        }}
                      >
                        <Ionicons name="remove" size={24} color="white" />
                      </TouchableOpacity>
                    </Animated.View>

                    <Animated.View 
                      style={[
                        modalStyles.goalCounter,
                        { transform: [{ scale: goalValueAnim }] }
                      ]}
                    >
                      <Text style={modalStyles.goalValue}>{match.goals}</Text>
                      <Text style={modalStyles.goalLabel}>GOALS</Text>
                    </Animated.View>

                    <Animated.View style={{
                      transform: [{ scale: incrementAnim }]
                    }}>
                      <TouchableOpacity
                        style={[modalStyles.actionButton, modalStyles.incrementButton]}
                        onPress={() => {
                          handleGoalIncrement(match.id);
                          animateButtonPress(incrementAnim);
                        }}
                      >
                        <Ionicons name="add" size={24} color="white" />
                      </TouchableOpacity>
                    </Animated.View>
                  </View>

                  <View style={modalStyles.sectionHeader}>
                    <Ionicons name="people" size={16} color="#555" />
                    <Text style={modalStyles.sectionTitle}>This will affect:</Text>
                  </View>
                  
                  {affectedPlayers.length > 0 ? (
                    <View style={modalStyles.playerListContainer}>
                      {affectedPlayers.map((player, index) => (
                        <Animated.View 
                          key={player.id} 
                          style={[
                            modalStyles.playerCard,
                            { 
                              opacity: modalContentAnim,
                              transform: [{ 
                                translateY: modalContentAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [20, 0]
                                })
                              }]
                            }
                          ]}
                        >
                          <Text style={modalStyles.playerName}>{player.name}</Text>
                        </Animated.View>
                      ))}
                    </View>
                  ) : (
                    <View style={modalStyles.emptyStateContainer}>
                      <Ionicons name="person-outline" size={24} color="#aaa" />
                      <Text style={modalStyles.noPlayersText}>No players affected</Text>
                    </View>
                  )}

                  <Animated.View style={{
                    transform: [{ scale: closeButtonAnim }]
                  }}>
                    <TouchableOpacity
                      style={modalStyles.closeButton}
                      onPress={() => {
                        animateButtonPress(closeButtonAnim);
                        // Short delay before closing modal to show the animation
                        setTimeout(onClose, 150);
                      }}
                    >
                      <Text style={modalStyles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </ScrollView>
              </TouchableOpacity>
            </Animated.View>
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
    backgroundColor: '#0275d8',
  },
  incrementButton: {
    backgroundColor: '#0275d8',
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