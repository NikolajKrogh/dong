import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "../store/store";
import createStyles from "./style/indexStyles";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import AppIcon from "../components/AppIcon";
import OnboardingScreen from "../components/OnboardingScreen";
import { useColors } from "./style/theme";
import { PlatformAnimation } from "../platform";
import { ShellScreen, ShellCard, ShellActionButton } from "../components/ui";

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

interface TopDrinkerInfo {
  name: string;
  drinks: number;
}

interface HomeSplashProps {
  styles: ReturnType<typeof createStyles>;
  onComplete: () => void;
}

interface CurrentGameCardProps {
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof createStyles>;
  matchesCount: number;
  playersCount: number;
  onContinue: () => void;
  onCancel: () => void;
}

interface HistoryStatsCardProps {
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof createStyles>;
  historyLength: number;
  topDrinkerInfo: TopDrinkerInfo | null;
  totalDrinks: number;
  onPress: () => void;
}

const getTotalDrinks = (gameHistory: GameSession[]) => {
  return gameHistory.reduce(
    (sum, game) =>
      sum +
      game.players.reduce(
        (gameSum: number, player: Player) =>
          gameSum + (player.drinksTaken || 0),
        0,
      ),
    0,
  );
};

const getTopDrinker = (gameHistory: GameSession[]): TopDrinkerInfo | null => {
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

const HomeSplash: React.FC<HomeSplashProps> = ({ styles, onComplete }) => {
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  useEffect(() => {
    opacity.value = withDelay(
      3000,
      withTiming(
        0,
        {
          duration: 1000,
          easing: Easing.out(Easing.quad),
        },
        (finished) => {
          if (finished) {
            runOnJS(onComplete)();
          }
        },
      ),
    );
  }, [onComplete, opacity]);

  return (
    <Animated.View style={[styles.splashContainer, animatedStyle]}>
      <PlatformAnimation
        kind="splash"
        source={require("../assets/lottie/dong_logo_animation.json")}
        autoPlay
        loop={false}
        style={styles.splashAnimation}
        fallback={
          <Image
            source={require("../assets/icons/logo_png/dong_logo.png")}
            style={styles.splashAnimation}
          />
        }
      />
    </Animated.View>
  );
};

const CurrentGameCard: React.FC<CurrentGameCardProps> = ({
  colors,
  styles,
  matchesCount,
  playersCount,
  onContinue,
  onCancel,
}) => {
  return (
    <ShellCard elevated style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 16 }}>
      <Text style={styles.sessionTitle}>Current Game in Progress</Text>
      <View style={styles.sessionInfoRow}>
        <View style={styles.infoItem}>
          <AppIcon name="people" size={22} color={colors.primary} />
          <Text style={styles.infoText}>{playersCount} Players</Text>
        </View>
        <View style={styles.infoItem}>
          <AppIcon name="football" size={22} color={colors.primary} />
          <Text style={styles.infoText}>{matchesCount} Matches</Text>
        </View>
      </View>

      <ShellActionButton
        variant="success"
        label="Continue Game"
        icon={<AppIcon name="play" size={22} color={colors.white} />}
        onPress={onContinue}
      />

      <ShellActionButton
        variant="danger"
        label="Cancel Game"
        icon={<AppIcon name="close-circle-outline" size={22} color={colors.white} />}
        onPress={onCancel}
        style={{ marginTop: 12 }}
      />
    </ShellCard>
  );
};

const HistoryStatsCard: React.FC<HistoryStatsCardProps> = ({
  colors,
  styles,
  historyLength,
  topDrinkerInfo,
  totalDrinks,
  onPress,
}) => {
  return (
    <ShellCard
      elevated
      onPress={onPress}
      style={{ marginHorizontal: 16, marginTop: 16 }}
    >
      <View style={styles.statsHeader}>
        <View style={styles.titleWithIcon}>
          <Text style={styles.statsTitle}>Game Stats</Text>
          <AppIcon
            name="chevron-forward"
            size={18}
            color={colors.primary}
            style={styles.titleChevron}
          />
        </View>
      </View>

      <View style={styles.statsContent}>
        <View style={styles.statItem}>
          <View style={styles.iconContainer}>
            <AppIcon name="calendar" size={20} color={colors.primary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statLabel}>Games Played</Text>
            <Text style={styles.statValue}>{historyLength}</Text>
          </View>
        </View>

        {topDrinkerInfo && (
          <View style={styles.statItem}>
            <View style={styles.iconContainer}>
              <AppIcon name="trophy" size={20} color={colors.primary} />
            </View>
            <View style={styles.statTextContainer}>
              <Text style={styles.statLabel}>Top Drinker</Text>
              <Text
                style={styles.statValue}
              >{`${topDrinkerInfo.name} (${topDrinkerInfo.drinks.toFixed(1)})`}</Text>
            </View>
          </View>
        )}

        <View style={styles.statItem}>
          <View style={styles.iconContainer}>
            <AppIcon name="beer" size={20} color={colors.primary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statLabel}>Total Drinks</Text>
            <Text style={styles.statValue}>{totalDrinks.toFixed(1)}</Text>
          </View>
        </View>
      </View>
    </ShellCard>
  );
};

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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { players, matches, history, resetState } = useGameStore();
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isSplashVisible, setIsSplashVisible] = useState(() => {
    const shouldShow = !hasSplashBeenShown;
    if (shouldShow) {
      hasSplashBeenShown = true;
    }
    return shouldShow;
  });
  const [isFirstLaunch, setIsFirstLaunch] = useState(false); // Tutorial state

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

  const handleCloseSplash = useCallback(() => {
    setIsSplashVisible(false);
  }, []);

  const handleFinishOnboarding = useCallback(() => {
    setIsFirstLaunch(false);
  }, []);

  const handleContinueGame = useCallback(() => {
    router.push("/gameProgress");
  }, [router]);

  const handleStartNewGame = useCallback(() => {
    router.push("/setupGame");
  }, [router]);

  const handleOpenHistory = useCallback(() => {
    router.push("/history");
  }, [router]);

  const handleOpenPreferences = useCallback(() => {
    router.push("/userPreferences");
  }, [router]);

  const openCancelModal = useCallback(() => {
    setIsConfirmModalVisible(true);
  }, []);

  const topDrinkerInfo = useMemo(() => getTopDrinker(history), [history]);
  const totalDrinks = useMemo(() => getTotalDrinks(history), [history]);

  if (isSplashVisible) {
    return <HomeSplash styles={styles} onComplete={handleCloseSplash} />;
  }

  if (isFirstLaunch) {
    return <OnboardingScreen onFinish={handleFinishOnboarding} />;
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

  return (
    <>
      <StatusBar
        style={colors.background === "#f5f5f5" ? "dark" : "light"}
        backgroundColor={styles.safeArea.backgroundColor}
      />
      <ShellScreen padded={false}>
        <SafeAreaView style={{ flex: 1 }}>
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
              <CurrentGameCard
                colors={colors}
                styles={styles}
                matchesCount={matches.length}
                playersCount={players.length}
                onContinue={handleContinueGame}
                onCancel={openCancelModal}
              />
            ) : (
              <ShellActionButton
                variant="success"
                label="Start New Game"
                icon={<AppIcon name="add-circle" size={22} color={colors.white} />}
                onPress={handleStartNewGame}
                style={{ marginHorizontal: 16, marginTop: 16 }}
              />
            )}

            {history.length > 0 && (
              <HistoryStatsCard
                colors={colors}
                styles={styles}
                historyLength={history.length}
                topDrinkerInfo={topDrinkerInfo}
                totalDrinks={totalDrinks}
                onPress={handleOpenHistory}
              />
            )}

            <ShellActionButton
              variant="surface"
              size="small"
              icon={
                <AppIcon
                  name="person-circle-outline"
                  size={28}
                  color={colors.white}
                />
              }
              onPress={handleOpenPreferences}
              style={styles.userPreferencesButton}
            />
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
      </ShellScreen>
    </>
  );
};

export default HomeScreen;
