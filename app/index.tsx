import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "../store/store";
import { Ionicons } from "@expo/vector-icons";
import styles from "./style/indexStyles";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OnboardingScreen from "../components/OnboardingScreen";
import { colors } from "./style/palette"; 

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
 * @brief The main home screen component for the Dong application.
 * - Displays the app logo and provides navigation options.
 * - Shows current game status (if a game is in progress) with options to continue or cancel.
 * - Presents a button to start a new game if no game is active.
 * - Displays overall game statistics (games played, top drinker, total drinks) if history exists.
 * - Includes a button to navigate to user preferences.
 * - Plays an introductory video animation once per app session on initial load.
 * - Handles the logic for canceling a game via a confirmation modal.
 * @params None
 * @return {React.ReactElement} The rendered home screen UI.
 */
const HomeScreen = () => {
  const router = useRouter();
  const { players, matches, history, resetState } = useGameStore();
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
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
   * @brief Handles the action of canceling the current game.
   * - Resets the game state using the store's resetState function.
   * - Hides the confirmation modal.
   * @params None
   * @return None
   */
  const handleCancelGame = () => {
    resetState();
    setIsConfirmModalVisible(false);
  };

  /**
   * @brief Calculates the total number of drinks consumed across all games in the history.
   * @param {GameSession[]} gameHistory - An array of past game sessions.
   * @return {number} The total sum of drinks taken across all players and games.
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
   * @brief Determines the player who has consumed the most drinks across all games in the history.
   * @param {GameSession[]} gameHistory - An array of past game sessions.
   * @return {{ name: string, drinks: number } | null} An object containing the name and drink count of the top drinker, or null if history is empty or no drinks were recorded.
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

  return (
    <>
      <StatusBar
        style="dark"
        backgroundColor={styles.safeArea.backgroundColor}
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
                <Ionicons name="close-circle-outline" size={22} color={colors.white} />
                <Text style={styles.buttonText}>Cancel Game</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => router.push("/setupGame")}
            >
              <Ionicons name="add-circle" size={22} color={colors.white} />
              <Text style={styles.buttonText}>Start New Game</Text>
            </TouchableOpacity>
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
                    <Ionicons name="calendar" size={20} color={colors.primary} />
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
                      <Ionicons name="trophy" size={20} color={colors.primary} /> 
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
            <Ionicons name="person-circle-outline" size={28} color={colors.white} />
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
      </SafeAreaView>
    </>
  );
};

export default HomeScreen;
