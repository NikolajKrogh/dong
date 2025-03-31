import React, { useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  StyleSheet,
  SafeAreaView,
  Animated,
  Image,
} from "react-native";
import { Match, Player } from "../../app/store";
import { Ionicons } from "@expo/vector-icons";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";

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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  // Animation values - declare all hooks unconditionally
  const decrementAnim = useRef(new Animated.Value(1)).current;
  const incrementAnim = useRef(new Animated.Value(1)).current;
  const closeButtonAnim = useRef(new Animated.Value(1)).current;
  const goalValueAnim = useRef(new Animated.Value(1)).current;
  const modalContentAnim = useRef(new Animated.Value(0)).current;

  // Find the selected match using useMemo to prevent unnecessary calculations
  const match = useMemo(() => {
    return selectedMatchId
      ? matches.find((m) => m.id === selectedMatchId)
      : null;
  }, [selectedMatchId, matches]);

  // Previous goal value reference
  const prevGoalsRef = useRef(match?.goals ?? 0);

  // Calculate affected players with useMemo
  const affectedPlayers = useMemo(() => {
    if (!match) return [];
    return players.filter(
      (p) =>
        match.id === commonMatchId ||
        (playerAssignments[p.id] && playerAssignments[p.id].includes(match.id))
    );
  }, [match, players, commonMatchId, playerAssignments]);

  // Check if this is a common match
  const isCommonMatch = match ? match.id === commonMatchId : false;

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
    if (isVisible && match) {
      Animated.timing(modalContentAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    // Reset animation when closing
    return () => {
      if (!isVisible) {
        modalContentAnim.setValue(0);
      }
    };
  }, [isVisible, match, modalContentAnim]);

  // Goal value change animation
  useEffect(() => {
    if (match && prevGoalsRef.current !== match.goals) {
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
  }, [match?.goals, goalValueAnim]);

  // Player columns 3-columns
  const playerColumns = useMemo(() => {
    const result: Player[][] = [[], [], []];

    affectedPlayers.forEach((player, index) => {
      const columnIndex = index % 3;
      result[columnIndex].push(player);
    });

    return result;
  }, [affectedPlayers]);

  // If no match or modal is not visible, don't render anything
  if (!match || !isVisible) return null;

  return (
    <SafeAreaView style={{ flex: 0 }}>
      <Modal
        animationType="none"
        transparent={true}
        visible={isVisible}
        onRequestClose={onClose}
        statusBarTranslucent={true}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={styles.centeredView}>
            <Animated.View
              style={[
                styles.modalContainer,
                {
                  opacity: modalContentAnim,
                  transform: [
                    {
                      scale: modalContentAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={styles.modalInnerContainer}
              >
                <ScrollView
                  contentContainerStyle={styles.scrollContent}
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Teams Header */}
                  <View style={styles.matchHeaderSection}>
                    {/* Home team */}
                    <View style={styles.matchTeamContainer}>
                      <Image
                        source={getTeamLogoWithFallback(match.homeTeam)}
                        style={styles.matchTeamLogo}
                      />
                      <Text style={styles.matchTeamName} numberOfLines={1}>
                        {match.homeTeam}
                      </Text>
                    </View>

                    {/* VS badge */}
                    <View style={styles.matchVsBadge}>
                      <Text style={styles.matchVsText}>VS</Text>
                    </View>

                    {/* Away team */}
                    <View style={styles.matchTeamContainer}>
                      <Image
                        source={getTeamLogoWithFallback(match.awayTeam)}
                        style={styles.matchTeamLogo}
                      />
                      <Text style={styles.matchTeamName} numberOfLines={1}>
                        {match.awayTeam}
                      </Text>
                    </View>
                  </View>

                  {/* Common match badge if applicable */}
                  {isCommonMatch && (
                    <View style={styles.commonMatchBadge}>
                      <Text style={styles.commonMatchText}>Common Match</Text>
                    </View>
                  )}

                  <View style={styles.divider} />

                  <View style={styles.goalActions}>
                    <Animated.View
                      style={{
                        transform: [{ scale: decrementAnim }],
                      }}
                    >
                      <TouchableOpacity
                        style={[styles.actionButton, styles.blueButton]}
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
                        styles.goalCounter,
                        { transform: [{ scale: goalValueAnim }] },
                      ]}
                    >
                      <Text style={styles.goalValue}>{match.goals}</Text>
                      <Text style={styles.goalLabel}>GOALS</Text>
                    </Animated.View>

                    <Animated.View
                      style={{
                        transform: [{ scale: incrementAnim }],
                      }}
                    >
                      <TouchableOpacity
                        style={[styles.actionButton, styles.blueButton]}
                        onPress={() => {
                          handleGoalIncrement(match.id);
                          animateButtonPress(incrementAnim);
                        }}
                      >
                        <Ionicons name="add" size={24} color="white" />
                      </TouchableOpacity>
                    </Animated.View>
                  </View>

                  <View style={styles.divider} />

                  {affectedPlayers.length > 0 && (
                    <View style={styles.sectionHeader}>
                      <Ionicons name="people" size={16} color="#555" />
                      <Text style={styles.sectionTitle}>
                        Players ({affectedPlayers.length})
                      </Text>
                    </View>
                  )}

                  {affectedPlayers.length > 0 ? (
                    <View style={styles.compactContainer}>
                      {playerColumns.map(
                        (column, columnIndex) =>
                          column.length > 0 && (
                            <View
                              key={`column-${columnIndex}`}
                              style={styles.playerColumn}
                            >
                              {column.map((player) => (
                                <Animated.View
                                  key={player.id}
                                  style={[
                                    styles.compactPlayerCard,
                                    {
                                      opacity: modalContentAnim,
                                      transform: [
                                        {
                                          translateY:
                                            modalContentAnim.interpolate({
                                              inputRange: [0, 1],
                                              outputRange: [5, 0],
                                            }),
                                        },
                                      ],
                                    },
                                  ]}
                                >
                                  <Text style={styles.compactPlayerName}>
                                    {player.name}
                                  </Text>
                                </Animated.View>
                              ))}
                            </View>
                          )
                      )}
                    </View>
                  ) : (
                    <View style={styles.emptyStateContainer}>
                      <Ionicons name="person-outline" size={24} color="#aaa" />
                      <Text style={styles.noPlayersText}>
                        No players affected
                      </Text>
                    </View>
                  )}

                  <Animated.View
                    style={{
                      transform: [{ scale: closeButtonAnim }],
                      width: "100%",
                    }}
                  >
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => {
                        animateButtonPress(closeButtonAnim);
                        setTimeout(onClose, 100);
                      }}
                    >
                      <Text style={styles.closeButtonText}>Close</Text>
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

const styles = StyleSheet.create({
  overlayTouchable: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 1000,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 1001,
  },
  modalInnerContainer: {
    width: "100%",
  },
  scrollContent: {
    padding: 16,
    alignItems: "center",
  },
  // Match header styling to match MatchesGrid
  matchHeaderSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingBottom: 12,
  },
  matchTeamContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  matchTeamLogo: {
    width: 50,
    height: 50,
    resizeMode: "contain",
    marginBottom: 8,
  },
  matchTeamName: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    color: "#333",
    maxWidth: 120,
  },
  matchVsBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },
  matchVsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },
  // Common match badge
  commonMatchBadge: {
    backgroundColor: "#4caf50",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  commonMatchText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#eeeeee",
    width: "100%",
    marginVertical: 12,
  },
  // Goal actions
  goalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "80%",
    paddingVertical: 8,
  },
  goalCounter: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  goalValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#0275d8",
  },
  goalLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
    letterSpacing: 1,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  blueButton: {
    backgroundColor: "#0275d8", // Blue for both buttons
  },
  // Players section
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
    marginLeft: 8,
  },
  playerListContainer: {
    width: "100%",
    marginBottom: 12,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f9f9f9",
  },
  // Player section - super compact layout
  compactContainer: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 12,
    justifyContent: "flex-start",
  },
  playerColumn: {
    flex: 1,
    marginHorizontal: 2,
  },
  compactPlayerCard: {
    backgroundColor: "#f6f6f6",
    borderRadius: 6,
    paddingVertical: 4, // Even more compact
    paddingHorizontal: 6,
    marginBottom: 4,
    marginHorizontal: 2,
  },
  compactPlayerName: {
    fontSize: 12, // Smaller font for compactness
    fontWeight: "500",
    color: "#333",
    textAlign: "center",
  },
  emptyStateContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginBottom: 12,
  },
  noPlayersText: {
    fontSize: 14,
    color: "#888",
    fontStyle: "italic",
    marginLeft: 8,
  },
  // Close button
  closeButton: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
});

export default MatchQuickActionsModal;
