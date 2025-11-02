import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Animated,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "../store/store";
import { Ionicons } from "@expo/vector-icons";
import createStyles from "./style/indexStyles";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OnboardingScreen from "../components/OnboardingScreen";
import { useColors } from "./style/theme";
import { createRoom, joinRoom } from "../utils/roomManager";
import { GameRoom } from "../types/room";

// Create a global variable to track if splash has already been shown
// This will be reset when app is closed and reopened
let hasSplashBeenShown = false;

interface Player {
  name: string;
  drinksTaken?: number;
}

interface GameSession {
  players: Player[];
}

/**
 * HomeScreen component.
 * @description Main landing screen: shows logo, game-in-progress actions,
 * aggregate stats, onboarding on first launch,
 * and splash animation (once per session).
 * @returns {React.ReactElement} Home screen UI.
 */
const HomeScreen = () => {
  const router = useRouter();
  const colors = useColors();
  const styles = createStyles(colors);
  const {
    players,
    matches,
    history,
    resetState,
    setCurrentRoom,
    setCurrentPlayerId,
    setRoomConnectionStatus,
    playerName: storedPlayerName,
    setPlayerName: setStoredPlayerName,
  } = useGameStore();
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  // Initialize splash visibility based on if it's already been shown in this session
  const [isSplashVisible, setIsSplashVisible] = useState(!hasSplashBeenShown); // Splash screen state
  const [isFirstLaunch, setIsFirstLaunch] = useState(false); // Tutorial state
  const splashAnimation = useRef<LottieView>(null);
  const [fadeAnim] = useState(new Animated.Value(1)); // Initialize fade animation

  // Handle splash animation and timing
  useEffect(() => {
    if (isSplashVisible) {
      // Mark that we've shown the splash for this session
      hasSplashBeenShown = true;

      const timeout = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }).start(() => setIsSplashVisible(false));
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [isSplashVisible]);

  useEffect(() => {
    const checkFirstLaunch = async () => {
      const hasLaunched = await AsyncStorage.getItem("hasLaunched");
      if (!hasLaunched) {
        await AsyncStorage.setItem("hasLaunched", "true");
        setIsFirstLaunch(true);
      }
    };
    checkFirstLaunch();
  }, []);

  // Pre-populate player name from store when modals open
  useEffect(() => {
    const loadSavedName = async () => {
      if (isCreateModalVisible || isJoinModalVisible) {
        if (storedPlayerName) {
          setPlayerName(storedPlayerName);
        }
      }
    };
    loadSavedName();
  }, [isCreateModalVisible, isJoinModalVisible, storedPlayerName]);

  if (isSplashVisible) {
    return (
      <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
        <LottieView
          ref={splashAnimation}
          source={require("../assets/lottie/dong_logo_animation.json")}
          autoPlay
          loop={false}
          style={styles.splashAnimation}
        />
      </Animated.View>
    );
  }

  if (isFirstLaunch) {
    return <OnboardingScreen onFinish={() => setIsFirstLaunch(false)} />;
  }

  const hasGameInProgress = players.length > 0 && matches.length > 0;

  /**
   * Cancel current game.
   * @description Resets global game state and dismisses confirmation modal.
   */
  const handleCancelGame = () => {
    resetState();
    setIsConfirmModalVisible(false);
  };

  /**
   * Get total drinks across history.
   * @description Sums drinksTaken for every player in every session.
   * @param {GameSession[]} gameHistory Game history array.
   * @returns {number} Total drink count.
   */
  const getTotalDrinks = (gameHistory: GameSession[]) => {
    return gameHistory.reduce(
      (sum, game) =>
        sum +
        game.players.reduce(
          (gameSum: number, player: Player) =>
            gameSum + (player.drinksTaken || 0),
          0
        ),
      0
    );
  };

  /**
   * Get top drinker across history.
   * @description Aggregates per-player drink totals and returns highest.
   * @param {GameSession[]} gameHistory Game history array.
   * @returns {{name:string,drinks:number}|null} Top drinker info or null.
   */
  const getTopDrinker = (gameHistory: GameSession[]) => {
    const playerDrinks = new Map<string, number>();

    gameHistory.forEach((game) => {
      game.players.forEach((player) => {
        const current = playerDrinks.get(player.name) || 0;
        playerDrinks.set(player.name, current + (player.drinksTaken || 0));
      });
    });

    let topPlayer = "";
    let maxDrinks = 0;

    playerDrinks.forEach((drinks, name) => {
      if (drinks > maxDrinks) {
        maxDrinks = drinks;
        topPlayer = name;
      }
    });
    return topPlayer ? { name: topPlayer, drinks: maxDrinks } : null;
  };

  const topDrinkerInfo = getTopDrinker(history);

  /**
   * Handle create game button press
   * If name is already set in preferences, create room directly
   * Otherwise, show modal to get name
   */
  const handleCreateGameButtonPress = () => {
    if (storedPlayerName) {
      // Name already set, create room directly
      handleCreateGameWithName(storedPlayerName);
    } else {
      // No name set, show modal
      setIsCreateModalVisible(true);
    }
  };

  /**
   * Handle creating a new game room with a given name
   */
  const handleCreateGameWithName = async (hostName: string) => {
    setIsCreatingRoom(true);
    setRoomConnectionStatus("connecting");

    try {
      // Generate unique player ID
      const playerId = `player_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create room
      const room = await createRoom(playerId, hostName, 10);

      // Update store
      setCurrentPlayerId(playerId);
      setCurrentRoom(room);
      setRoomConnectionStatus("connected");

      // Save player name to store
      setStoredPlayerName(hostName);

      // Close modal if open and navigate
      if (isCreateModalVisible) {
        setIsCreateModalVisible(false);
        setPlayerName("");
      }
      router.push("/setupGame");
    } catch (error) {
      console.error("Failed to create room:", error);
      setRoomConnectionStatus("error");
      Alert.alert("Error", "Failed to create room. Please try again.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  /**
   * Handle creating a new game room from modal
   */
  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      Alert.alert("Name Required", "Please enter your name");
      return;
    }

    await handleCreateGameWithName(playerName.trim());
  };

  /**
   * Handle joining an existing game room
   */
  const handleJoinGame = async () => {
    if (!playerName.trim()) {
      Alert.alert("Name Required", "Please enter your name");
      return;
    }

    if (!roomCode.trim()) {
      Alert.alert("Room Code Required", "Please enter a room code");
      return;
    }

    if (roomCode.trim().length !== 6) {
      Alert.alert("Invalid Code", "Room code must be 6 characters");
      return;
    }

    setIsCreatingRoom(true);
    setRoomConnectionStatus("connecting");

    try {
      // Generate unique player ID
      const playerId = `player_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Join room
      const room = await joinRoom(
        roomCode.trim().toUpperCase(),
        playerId,
        playerName.trim()
      );

      if (!room) {
        setRoomConnectionStatus("error");
        Alert.alert(
          "Room Not Found",
          "Could not find a room with that code. Please check and try again."
        );
        setIsCreatingRoom(false);
        return;
      }

      // Update store
      setCurrentPlayerId(playerId);
      setCurrentRoom(room);
      setRoomConnectionStatus("connected");

      // Save player name to store for future use
      setStoredPlayerName(playerName.trim());

      // Close modal and navigate
      setIsJoinModalVisible(false);
      setPlayerName("");
      setRoomCode("");
      router.push("/setupGame");
    } catch (error) {
      console.error("Failed to join room:", error);
      setRoomConnectionStatus("error");
      Alert.alert("Error", "Failed to join room. Please try again.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  return (
    <>
      <StatusBar
        style={colors.background === colors.background ? "dark" : "light"}
        backgroundColor={styles.safeArea.backgroundColor as string}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Image
              source={require("../assets/icons/logo_png/dong_logo.png")}
              style={styles.logo}
            />
          </View>

          {hasGameInProgress ? (
            <View style={styles.sessionContainer}>
              <Text style={styles.sessionTitle}>Current Game in Progress</Text>
              <View style={styles.sessionInfoRow}>
                <View style={styles.infoItem}>
                  <Ionicons name="people" size={22} color={colors.primary} />
                  <Text style={styles.infoText}>{players.length} Players</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="football" size={22} color={colors.primary} />
                  <Text style={styles.infoText}>{matches.length} Matches</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => router.push("/gameProgress")}
              >
                <Ionicons name="play" size={22} color={colors.white} />
                <Text style={styles.buttonText}>Continue Game</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsConfirmModalVisible(true)}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={22}
                  color={colors.white}
                />
                <Text style={styles.buttonText}>Cancel Game</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.createGameButton}
                onPress={handleCreateGameButtonPress}
                disabled={isCreatingRoom}
              >
                {isCreatingRoom ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons
                      name="add-circle"
                      size={22}
                      color={colors.white}
                    />
                    <Text style={styles.buttonText}>Create New Game</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.joinGameButton}
                onPress={() => setIsJoinModalVisible(true)}
                disabled={isCreatingRoom}
              >
                <Ionicons name="enter-outline" size={22} color={colors.white} />
                <Text style={styles.buttonText}>Join Game</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Stats Container */}
          {history.length > 0 && (
            <TouchableOpacity
              style={styles.statsContainer}
              onPress={() => router.push("/history")}
              activeOpacity={0.9}
            >
              <View style={styles.statsHeader}>
                <View style={styles.titleWithIcon}>
                  <Text style={styles.statsTitle}>Game Stats</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.primary}
                    style={styles.titleChevron}
                  />
                </View>
              </View>

              <View style={styles.statsContent}>
                {/* Games Played */}
                <View style={styles.statItem}>
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name="calendar"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.statTextContainer}>
                    <Text style={styles.statLabel}>Games Played</Text>
                    <Text style={styles.statValue}>{history.length}</Text>
                  </View>
                </View>

                {/* Top Drinker */}
                {topDrinkerInfo && (
                  <View style={styles.statItem}>
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name="trophy"
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.statTextContainer}>
                      <Text style={styles.statLabel}>Top Drinker</Text>
                      <Text style={styles.statValue}>{`${
                        topDrinkerInfo.name
                      } (${topDrinkerInfo.drinks.toFixed(1)})`}</Text>
                    </View>
                  </View>
                )}

                {/* Total Drinks */}
                <View style={styles.statItem}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="beer" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.statTextContainer}>
                    <Text style={styles.statLabel}>Total Drinks</Text>
                    <Text style={styles.statValue}>
                      {getTotalDrinks(history).toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.userPreferencesButton}
            onPress={() => router.push("/userPreferences")}
          >
            <Ionicons
              name="person-circle-outline"
              size={28}
              color={colors.white}
            />
          </TouchableOpacity>
        </ScrollView>

        <Modal
          animationType="fade"
          transparent={true}
          visible={isConfirmModalVisible}
          onRequestClose={() => setIsConfirmModalVisible(false)}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>Cancel Game</Text>
              <Text style={styles.modalText}>
                Are you sure you want to cancel the current game? This action
                cannot be undone.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.buttonCancel]}
                  onPress={() => setIsConfirmModalVisible(false)}
                >
                  <Text style={styles.textStyle}>No, Keep Game</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.buttonConfirm]}
                  onPress={handleCancelGame}
                >
                  <Text style={styles.textStyle}>Yes, Cancel Game</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Join Room Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={isJoinModalVisible}
          onRequestClose={() => {
            if (!isCreatingRoom) {
              setIsJoinModalVisible(false);
              setPlayerName("");
              setRoomCode("");
            }
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.roomModalContainer}>
              <Text style={styles.roomModalTitle}>Join Game</Text>
              <Text style={styles.roomModalSubtitle}>
                Enter the room code to join your friends
              </Text>

              <Text style={styles.roomInputLabel}>Your Name</Text>
              <TextInput
                style={styles.roomInput}
                placeholder="Enter your name"
                placeholderTextColor={colors.textPlaceholder}
                value={playerName}
                onChangeText={setPlayerName}
                editable={!isCreatingRoom}
                autoCapitalize="words"
              />

              <Text style={styles.roomInputLabel}>Room Code</Text>
              <TextInput
                style={styles.roomCodeInput}
                placeholder="ABC123"
                placeholderTextColor={colors.textPlaceholder}
                value={roomCode}
                onChangeText={(text) => setRoomCode(text.toUpperCase())}
                editable={!isCreatingRoom}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {isCreatingRoom ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Joining room...</Text>
                </View>
              ) : (
                <View style={styles.roomModalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.roomModalButton,
                      styles.roomModalButtonSecondary,
                    ]}
                    onPress={() => {
                      setIsJoinModalVisible(false);
                      setPlayerName("");
                      setRoomCode("");
                    }}
                  >
                    <Text style={styles.textStyle}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.roomModalButton,
                      styles.roomModalButtonSuccess,
                    ]}
                    onPress={handleJoinGame}
                  >
                    <Ionicons
                      name="enter-outline"
                      size={20}
                      color={colors.white}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.textStyle}>Join</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Create Room Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={isCreateModalVisible}
          onRequestClose={() => {
            if (!isCreatingRoom) {
              setIsCreateModalVisible(false);
              setPlayerName("");
            }
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.roomModalContainer}>
              <Text style={styles.roomModalTitle}>Create New Game</Text>
              <Text style={styles.roomModalSubtitle}>
                Enter your name to start a new game
              </Text>

              <Text style={styles.roomInputLabel}>Your Name</Text>
              <TextInput
                style={styles.roomInput}
                placeholder="Enter your name"
                placeholderTextColor={colors.textPlaceholder}
                value={playerName}
                onChangeText={setPlayerName}
                editable={!isCreatingRoom}
                autoCapitalize="words"
                autoFocus={true}
              />

              {isCreatingRoom ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Creating room...</Text>
                </View>
              ) : (
                <View style={styles.roomModalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.roomModalButton,
                      styles.roomModalButtonSecondary,
                    ]}
                    onPress={() => {
                      setIsCreateModalVisible(false);
                      setPlayerName("");
                    }}
                  >
                    <Text style={styles.textStyle}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.roomModalButton,
                      styles.roomModalButtonPrimary,
                    ]}
                    onPress={handleCreateGame}
                  >
                    <Ionicons
                      name="add-circle"
                      size={20}
                      color={colors.white}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.textStyle}>Create</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
};

export default HomeScreen;
