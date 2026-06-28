import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGameStore } from "../store/store";
import createStyles from "./style/indexStyles";

import AppIcon from "../components/AppIcon";
import { GuestJoinModal } from "../components/guestJoin/GuestJoinModal";
import OnboardingScreen from "../components/OnboardingScreen";
import { ShellActionButton, ShellCard, ShellScreen } from "../components/ui";
import { useAccountAuth } from "../hooks/useAccountAuth";
import { useGuestRoomJoin } from "../hooks/useGuestRoomJoin";
import { useHostRoomCreate } from "../hooks/useHostRoomCreate";
import { useMyActiveRoom } from "../hooks/useMyActiveRoom";
import { useRegisteredRoomJoin } from "../hooks/useRegisteredRoomJoin";
import { useRoomExit } from "../hooks/useRoomExit";
import { PlatformAnimation } from "../platform";
import { isWideLayout } from "./style/responsive";
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
  const hasCompletedRef = useRef(false);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const completeSplash = useCallback(() => {
    if (hasCompletedRef.current) {
      return;
    }

    hasCompletedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const splashFallbackTimer = setTimeout(completeSplash, 4500);

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
            runOnJS(completeSplash)();
          }
        },
      ),
    );

    return () => {
      clearTimeout(splashFallbackTimer);
    };
  }, [completeSplash, opacity]);

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
    <ShellCard
      elevated
      testID="home-current-game-card"
      style={{ marginTop: 16, marginBottom: 16 }}
    >
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
        icon={
          <AppIcon name="close-circle-outline" size={22} color={colors.white} />
        }
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
      testID="home-history-stats-card"
      style={{ marginTop: 16 }}
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
  const { width } = useWindowDimensions();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const wideLayout = isWideLayout(width);
  const { players, matches, history, resetState } = useGameStore();
  const { account } = useAccountAuth();
  const {
    isCreating: isCreatingRoom,
    error: createRoomError,
    createRoom,
  } = useHostRoomCreate();
  const { activeRoom, refresh: refreshActiveRoom } = useMyActiveRoom(
    account !== null,
  );
  const {
    isJoining: isJoiningRoom,
    error: joinRoomError,
    conflictRoom,
    joinRoom: joinRegisteredRoom,
    clearConflict,
  } = useRegisteredRoomJoin();
  const exit = useRoomExit();
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [registeredJoinCode, setRegisteredJoinCode] = useState("");
  const {
    session: guestRoomSession,
    error: guestRoomError,
    isSubmitting: isGuestJoinSubmitting,
    leaveRoom: leaveGuestRoom,
    submitGuestJoin,
  } = useGuestRoomJoin();
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isGuestJoinModalVisible, setIsGuestJoinModalVisible] = useState(false);
  const [isSplashVisible, setIsSplashVisible] = useState(() => {
    const shouldShow = !hasSplashBeenShown;
    if (shouldShow) {
      hasSplashBeenShown = true;
    }
    return shouldShow;
  });
  const [isFirstLaunch, setIsFirstLaunch] = useState(false); // Tutorial state
  const [guestJoinCode, setGuestJoinCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [hasDismissedGuestJoinModal, setHasDismissedGuestJoinModal] =
    useState(false);

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

  const handleReturnToRoom = useCallback(() => {
    if (!activeRoom) {
      return;
    }
    router.push({
      pathname: "/lobby/[sessionId]",
      params: {
        sessionId: activeRoom.sessionId,
        participantId: activeRoom.participantId,
      },
    });
  }, [activeRoom, router]);

  const handleSubmitRegisteredJoin = useCallback(async () => {
    const response = await joinRegisteredRoom(registeredJoinCode);
    if (response) {
      setIsJoinModalVisible(false);
      setRegisteredJoinCode("");
      router.push({
        pathname: "/lobby/[sessionId]",
        params: {
          sessionId: response.sessionId,
          participantId: response.participantId,
        },
      });
    }
    // On already_in_active_room, joinRegisteredRoom returns null and sets
    // conflictRoom — the modal renders the "Leave current room & switch" affordance.
  }, [joinRegisteredRoom, registeredJoinCode, router]);

  const handleLeaveCurrentAndSwitch = useCallback(async () => {
    if (!conflictRoom) {
      return;
    }
    const result = await exit.exitRoom(
      conflictRoom.sessionId,
      conflictRoom.role,
    );
    // If exit needs a host successor choice, the modal stays open; the chooser
    // surfaces via exit.pendingSuccessorChoice (rendered below).
    if (!result) {
      return;
    }
    await refreshActiveRoom();
    clearConflict();
    // Retry the original join with the same code.
    const response = await joinRegisteredRoom(registeredJoinCode);
    if (response) {
      setIsJoinModalVisible(false);
      setRegisteredJoinCode("");
      router.push({
        pathname: "/lobby/[sessionId]",
        params: {
          sessionId: response.sessionId,
          participantId: response.participantId,
        },
      });
    }
  }, [
    clearConflict,
    conflictRoom,
    exit,
    joinRegisteredRoom,
    refreshActiveRoom,
    registeredJoinCode,
    router,
  ]);

  const handleChooseSuccessorOnHome = useCallback(
    async (participantId: string) => {
      if (!conflictRoom) {
        return;
      }
      const result = await exit.confirmSuccessor(
        conflictRoom.sessionId,
        participantId,
      );
      if (!result) {
        return;
      }
      await refreshActiveRoom();
      clearConflict();
      const response = await joinRegisteredRoom(registeredJoinCode);
      if (response) {
        setIsJoinModalVisible(false);
        setRegisteredJoinCode("");
        router.push({
          pathname: "/lobby/[sessionId]",
          params: {
            sessionId: response.sessionId,
            participantId: response.participantId,
          },
        });
      }
    },
    [
      clearConflict,
      conflictRoom,
      exit,
      joinRegisteredRoom,
      refreshActiveRoom,
      registeredJoinCode,
      router,
    ],
  );

  const handleConfirmCloseOnHome = useCallback(async () => {
    if (!conflictRoom) {
      return;
    }
    const result = await exit.confirmClose(conflictRoom.sessionId);
    if (!result) {
      return;
    }
    await refreshActiveRoom();
    clearConflict();
    const response = await joinRegisteredRoom(registeredJoinCode);
    if (response) {
      setIsJoinModalVisible(false);
      setRegisteredJoinCode("");
      router.push({
        pathname: "/lobby/[sessionId]",
        params: {
          sessionId: response.sessionId,
          participantId: response.participantId,
        },
      });
    }
  }, [
    clearConflict,
    conflictRoom,
    exit,
    joinRegisteredRoom,
    refreshActiveRoom,
    registeredJoinCode,
    router,
  ]);

  const handleOpenHistory = useCallback(() => {
    router.push("/history");
  }, [router]);

  const handleOpenPreferences = useCallback(() => {
    router.push("/userPreferences");
  }, [router]);

  const handleOpenGuestJoin = useCallback(() => {
    setHasDismissedGuestJoinModal(false);
    setIsGuestJoinModalVisible(true);
  }, []);

  const handleCloseGuestJoin = useCallback(() => {
    setIsGuestJoinModalVisible(false);
    setHasDismissedGuestJoinModal(Boolean(guestRoomSession));
  }, [guestRoomSession]);

  const handleLeaveGuestJoin = useCallback(async () => {
    await leaveGuestRoom();
    setGuestJoinCode("");
    setGuestName("");
    setHasDismissedGuestJoinModal(false);
    setIsGuestJoinModalVisible(false);
  }, [leaveGuestRoom]);

  const openCancelModal = useCallback(() => {
    setIsConfirmModalVisible(true);
  }, []);

  const topDrinkerInfo = useMemo(() => getTopDrinker(history), [history]);
  const totalDrinks = useMemo(() => getTotalDrinks(history), [history]);
  const guestJoinActionLabel = guestRoomSession
    ? "Return to Guest Room"
    : "Join Room as Guest";

  useEffect(() => {
    if (!guestRoomSession) {
      setHasDismissedGuestJoinModal(false);
      return;
    }

    if (!hasDismissedGuestJoinModal) {
      setIsGuestJoinModalVisible(true);
    }
  }, [guestRoomSession, hasDismissedGuestJoinModal]);

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
      <ShellScreen
        padded={false}
        centerContent={wideLayout}
        contentMaxWidth={wideLayout ? 960 : undefined}
      >
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
                testID="home-start-game-button"
                icon={
                  <AppIcon name="add-circle" size={22} color={colors.white} />
                }
                onPress={handleStartNewGame}
                widthMode={wideLayout ? "wide" : undefined}
                style={{ marginTop: 16 }}
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

            {account !== null && activeRoom !== null && (
              <ShellActionButton
                variant="primary"
                label="Return to room"
                testID="home-return-to-room"
                icon={<AppIcon name="people" size={22} color={colors.white} />}
                onPress={handleReturnToRoom}
                widthMode={wideLayout ? "wide" : undefined}
                style={{ marginTop: 16 }}
              />
            )}

            {account !== null && (
              <>
                <ShellActionButton
                  variant="primary"
                  label={isCreatingRoom ? "Creating Room…" : "Create Room"}
                  testID="home-create-room-button"
                  disabled={isCreatingRoom}
                  icon={
                    isCreatingRoom ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <AppIcon
                        name="people-outline"
                        size={22}
                        color={colors.white}
                      />
                    )
                  }
                  onPress={() => {
                    void createRoom();
                  }}
                  widthMode={wideLayout ? "wide" : undefined}
                  style={{ marginTop: 16 }}
                />

                {createRoomError !== null && (
                  <Text
                    testID="home-create-room-error"
                    style={styles.createRoomError}
                  >
                    {createRoomError}
                  </Text>
                )}

                <ShellActionButton
                  variant="secondary"
                  label="Join Room"
                  testID="home-join-registered-button"
                  icon={
                    <AppIcon
                      name="people-outline"
                      size={22}
                      color={colors.white}
                    />
                  }
                  onPress={() => setIsJoinModalVisible(true)}
                  widthMode={wideLayout ? "wide" : undefined}
                  style={{ marginTop: 16 }}
                />
              </>
            )}

            <ShellActionButton
              variant={guestRoomSession ? "primary" : "secondary"}
              label={guestJoinActionLabel}
              testID="home-join-room-button"
              icon={
                <AppIcon
                  name={guestRoomSession ? "people" : "people-outline"}
                  size={22}
                  color={colors.white}
                />
              }
              onPress={handleOpenGuestJoin}
              widthMode={wideLayout ? "wide" : undefined}
              style={{ marginTop: 16 }}
            />

            <ShellActionButton
              variant="surface"
              size="small"
              testID="open-preferences-button"
              widthMode="fit"
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

          <GuestJoinModal
            error={guestRoomError}
            guestName={guestName}
            isSubmitting={isGuestJoinSubmitting}
            joinCode={guestJoinCode}
            onClose={handleCloseGuestJoin}
            onGuestNameChange={setGuestName}
            onJoinCodeChange={setGuestJoinCode}
            onLeaveRoom={handleLeaveGuestJoin}
            onSubmit={() => {
              void submitGuestJoin(guestJoinCode, guestName);
            }}
            session={guestRoomSession}
            visible={isGuestJoinModalVisible}
          />

          <Modal
            animationType="fade"
            transparent={true}
            visible={isJoinModalVisible}
            onRequestClose={() => {
              setIsJoinModalVisible(false);
              clearConflict();
              exit.cancel();
            }}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                {conflictRoom === null && !exit.pendingSuccessorChoice && !exit.needsCloseConfirm ? (
                  <>
                    <Text style={styles.modalTitle}>Join Room</Text>
                    <Text style={styles.modalText}>
                      Enter the room code to join as a member.
                    </Text>
                    <TextInput
                      testID="home-join-registered-code"
                      value={registeredJoinCode}
                      onChangeText={setRegisteredJoinCode}
                      placeholder="Room code"
                      placeholderTextColor={colors.textPlaceholder}
                      autoCapitalize="characters"
                      style={{
                        width: "100%",
                        borderWidth: 1,
                        borderColor: colors.borderLight,
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 12,
                        color: colors.textPrimary,
                      }}
                    />
                    {joinRoomError !== null && (
                      <Text
                        testID="home-join-registered-error"
                        style={styles.createRoomError}
                      >
                        {joinRoomError}
                      </Text>
                    )}
                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.buttonCancel]}
                        onPress={() => setIsJoinModalVisible(false)}
                      >
                        <Text style={styles.textStyle}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID="home-join-registered-submit"
                        style={[styles.modalButton, styles.buttonConfirm]}
                        disabled={isJoiningRoom}
                        onPress={() => {
                          void handleSubmitRegisteredJoin();
                        }}
                      >
                        <Text style={styles.textStyle}>
                          {isJoiningRoom ? "Joining…" : "Join"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}

                {conflictRoom !== null && !exit.pendingSuccessorChoice && !exit.needsCloseConfirm ? (
                  <>
                    <Text style={styles.modalTitle}>You're in another room</Text>
                    <Text style={styles.modalText}>
                      {conflictRoom.role === "owner"
                        ? "You're hosting a room. Leave it (handover or close) and join this one?"
                        : "Leave your current room and join this one?"}
                    </Text>
                    {exit.error !== null && (
                      <Text style={styles.createRoomError}>{exit.error}</Text>
                    )}
                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.buttonCancel]}
                        onPress={() => {
                          clearConflict();
                          setIsJoinModalVisible(false);
                        }}
                      >
                        <Text style={styles.textStyle}>Stay</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID="home-conflict-leave-and-switch"
                        style={[styles.modalButton, styles.buttonConfirm]}
                        disabled={exit.isExiting}
                        onPress={() => {
                          void handleLeaveCurrentAndSwitch();
                        }}
                      >
                        <Text style={styles.textStyle}>
                          {exit.isExiting ? "Leaving…" : "Leave & Join"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}

                {exit.pendingSuccessorChoice ? (
                  <>
                    <Text style={styles.modalTitle}>Choose a new host</Text>
                    <Text style={styles.modalText}>
                      Pick which signed-in player should take over your current
                      room.
                    </Text>
                    {exit.eligibleSuccessors.map((candidate) => (
                      <TouchableOpacity
                        key={candidate.id}
                        testID={`home-conflict-successor-${candidate.id}`}
                        style={[styles.modalButton, styles.buttonConfirm, { marginTop: 8 }]}
                        onPress={() => {
                          void handleChooseSuccessorOnHome(candidate.id);
                        }}
                      >
                        <Text style={styles.textStyle}>
                          {candidate.displayName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.modalButton, styles.buttonCancel, { marginTop: 12 }]}
                      onPress={exit.cancel}
                    >
                      <Text style={styles.textStyle}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                {exit.needsCloseConfirm ? (
                  <>
                    <Text style={styles.modalTitle}>Everyone left</Text>
                    <Text style={styles.modalText}>
                      There's no one left to take over. Close the room and join
                      the new one?
                    </Text>
                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.buttonCancel]}
                        onPress={exit.cancel}
                      >
                        <Text style={styles.textStyle}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID="home-conflict-close-confirm"
                        style={[styles.modalButton, styles.buttonConfirm]}
                        disabled={exit.isExiting}
                        onPress={() => {
                          void handleConfirmCloseOnHome();
                        }}
                      >
                        <Text style={styles.textStyle}>
                          {exit.isExiting ? "Closing…" : "Close & Join"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </ShellScreen>
    </>
  );
};

export default HomeScreen;
