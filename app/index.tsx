import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppIcon from "../components/AppIcon";
import { CancelGameModal } from "../components/home/CancelGameModal";
import { CurrentGameCard } from "../components/home/CurrentGameCard";
import { HistoryStatsCard } from "../components/home/HistoryStatsCard";
import { HomeSplash } from "../components/home/HomeSplash";
import { JoinRoomModal } from "../components/home/JoinRoomModal";
import { GuestJoinModal } from "../components/guestJoin/GuestJoinModal";
import OnboardingScreen from "../components/OnboardingScreen";
import { ShellActionButton, ShellScreen } from "../components/ui";
import { useHomeRoomActions } from "../hooks/useHomeRoomActions";
import { useGameStore } from "../store/store";
import { getTopDrinker, getTotalDrinks } from "../utils/homeStats";
import createStyles from "./style/indexStyles";
import { isWideLayout } from "./style/responsive";
import { useColors } from "./style/theme";

// Create a global variable to track if splash has already been shown
// This will be reset when app is closed and reopened
let hasSplashBeenShown = false;

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
  const {
    account,
    activeRoom,
    isCreatingRoom,
    createRoomError,
    createRoom,
    isJoiningRoom,
    joinRoomError,
    conflictRoom,
    clearConflict,
    exit,
    isJoinModalVisible,
    setIsJoinModalVisible,
    registeredJoinCode,
    setRegisteredJoinCode,
    guestRoomSession,
    guestRoomError,
    isGuestJoinSubmitting,
    submitGuestJoin,
    isGuestJoinModalVisible,
    guestJoinCode,
    setGuestJoinCode,
    guestName,
    setGuestName,
    guestJoinActionLabel,
    handleReturnToRoom,
    handleSubmitRegisteredJoin,
    handleLeaveCurrentAndSwitch,
    handleChooseSuccessorOnHome,
    handleConfirmCloseOnHome,
    handleOpenGuestJoin,
    handleCloseGuestJoin,
    handleLeaveGuestJoin,
  } = useHomeRoomActions();
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

          <CancelGameModal
            visible={isConfirmModalVisible}
            styles={styles}
            onRequestClose={() => setIsConfirmModalVisible(false)}
            onConfirm={handleCancelGame}
          />

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

          <JoinRoomModal
            visible={isJoinModalVisible}
            styles={styles}
            colors={colors}
            conflictRoom={conflictRoom}
            exit={exit}
            registeredJoinCode={registeredJoinCode}
            setRegisteredJoinCode={setRegisteredJoinCode}
            joinRoomError={joinRoomError}
            isJoiningRoom={isJoiningRoom}
            onRequestClose={() => {
              setIsJoinModalVisible(false);
              clearConflict();
              exit.cancel();
            }}
            onCancelJoinForm={() => setIsJoinModalVisible(false)}
            onSubmitJoin={() => {
              void handleSubmitRegisteredJoin();
            }}
            onStay={() => {
              clearConflict();
              setIsJoinModalVisible(false);
            }}
            onLeaveCurrentAndSwitch={() => {
              void handleLeaveCurrentAndSwitch();
            }}
            onChooseSuccessor={(participantId) => {
              void handleChooseSuccessorOnHome(participantId);
            }}
            onConfirmClose={() => {
              void handleConfirmCloseOnHome();
            }}
          />
        </SafeAreaView>
      </ShellScreen>
    </>
  );
};

export default HomeScreen;
