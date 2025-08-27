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
import createStyles from "./style/indexStyles";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OnboardingScreen from "../components/OnboardingScreen";
import { useColors } from "./style/theme";

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

  return (
    <>
      <StatusBar
        style={colors.background === "#f5f5f5" ? "dark" : "light"}
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
      </SafeAreaView>
    </>
  );
};

export default HomeScreen;
