import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppIcon from "../../components/AppIcon";
import { HistoryStatsCard } from "./HistoryStatsCard";
import { HomeGameActions } from "./HomeGameActions";
import { HomeSplash } from "./HomeSplash";
import { JoinRoomModal } from "./JoinRoomModal";
import { GuestJoinModal } from "../../components/guestJoin/GuestJoinModal";
import OnboardingScreen from "../../components/OnboardingScreen";
import { ShellActionButton, ShellScreen } from "../../components/ui";
import { ScreenReaderHeading } from "../../components/ui/ScreenReaderHeading";
import { useHomeRoomActions } from "./useHomeRoomActions";
import { useHistory } from "../history";
import { getTopDrinker, getTotalDrinks } from "./homeStats";
import createStyles from "./homeStyles";
import { isWideLayout } from "../../styles/responsive";
import { useColors } from "../../styles/theme";
import { isWebPlatform } from "../../platform/environment";

// Create a global variable to track if splash has already been shown
// This will be reset when app is closed and reopened
let hasSplashBeenShown = false;

/**
 * HomeScreen component.
 * @description Main landing screen: shows logo, game-in-progress actions,
 * aggregate stats, onboarding on first native launch,
 * and splash animation (once per session).
 * @returns {React.ReactElement} Home screen UI.
 */
const HomeScreen = () => {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const wideLayout = isWideLayout(width);
  const { history, refresh: refreshHistory } = useHistory();
  const roomActions = useHomeRoomActions();
  const refreshActiveRoom = roomActions.refreshActiveRoom;
  useFocusEffect(useCallback(() => {
    void refreshHistory();
    void refreshActiveRoom();
  }, [refreshHistory, refreshActiveRoom]));
  const [isSplashVisible, setIsSplashVisible] = useState(() => {
    const shouldShow = !hasSplashBeenShown;
    if (shouldShow) {
      hasSplashBeenShown = true;
    }
    return shouldShow;
  });
  const [isFirstLaunch, setIsFirstLaunch] = useState(false); // Tutorial state

  useEffect(() => {
    if (isWebPlatform) return;

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

  const topDrinkerInfo = useMemo(() => getTopDrinker(history), [history]);
  const totalDrinks = useMemo(() => getTotalDrinks(history), [history]);

  if (isSplashVisible) {
    return <HomeSplash styles={styles} onComplete={handleCloseSplash} />;
  }

  if (isFirstLaunch) {
    return <OnboardingScreen onFinish={handleFinishOnboarding} />;
  }

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
                source={require("../../assets/icons/logo_png/dong_logo.png")}
                style={styles.logo}
                resizeMode="contain"
                accessible={false}
              />
              <ScreenReaderHeading>Home</ScreenReaderHeading>
            </View>

            <HomeGameActions actions={roomActions} colors={colors} styles={styles} wideLayout={wideLayout} />

            <HistoryStatsCard
              colors={colors}
              styles={styles}
              historyLength={history.length}
              topDrinkerInfo={topDrinkerInfo}
              totalDrinks={totalDrinks}
            />

            <ShellActionButton
              variant="surface"
              size="small"
              testID="open-preferences-button"
              accessibilityLabel="Settings"
              widthMode="fit"
              icon={
                <AppIcon
                  name="person-circle-outline"
                  size={28}
                  color={colors.white}
                />
              }
              href="/userPreferences"
              style={styles.userPreferencesButton}
            />
          </ScrollView>

          <HomeRoomModals actions={roomActions} colors={colors} styles={styles} />
        </SafeAreaView>
      </ShellScreen>
    </>
  );
};

function HomeRoomModals({ actions, colors, styles }: {
  actions: ReturnType<typeof useHomeRoomActions>;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof createStyles>;
}) {
  const {
    guestRoomError,
    guestName,
    isGuestJoinSubmitting,
    guestJoinCode,
    handleCloseGuestJoin,
    setGuestName,
    setGuestJoinCode,
    handleLeaveGuestJoin,
    setGuestPicks,
    isGuestPickBusy,
    submitGuestJoin,
    guestRoomSession,
    guestRoomStatus,
    isGuestJoinModalVisible,
    isJoinModalVisible,
    conflictRoom,
    roomToLeave,
    cancelRoomExit,
    exit,
    registeredJoinCode,
    setRegisteredJoinCode,
    joinRoomError,
    isJoiningRoom,
    setIsJoinModalVisible,
    clearConflict,
    handleSubmitRegisteredJoin,
    handleLeaveCurrentAndSwitch,
    handleChooseSuccessorOnHome,
    handleConfirmCloseOnHome,
  } = actions;
  return (
    <>
    <GuestJoinModal
      error={guestRoomError}
      guestName={guestName}
      isSubmitting={isGuestJoinSubmitting}
      joinCode={guestJoinCode}
      onClose={handleCloseGuestJoin}
      onGuestNameChange={setGuestName}
      onJoinCodeChange={setGuestJoinCode}
      onLeaveRoom={handleLeaveGuestJoin}
      onSetPicks={setGuestPicks}
      isPickBusy={isGuestPickBusy}
      onSubmit={() => {
        void submitGuestJoin(guestJoinCode, guestName);
      }}
      session={guestRoomSession}
      status={guestRoomStatus}
      visible={isGuestJoinModalVisible}
    />

    <JoinRoomModal
      visible={isJoinModalVisible || roomToLeave !== null}
      leaveOnly={roomToLeave !== null}
      styles={styles}
      colors={colors}
      conflictRoom={roomToLeave ?? conflictRoom}
      exit={exit}
      registeredJoinCode={registeredJoinCode}
      setRegisteredJoinCode={setRegisteredJoinCode}
      joinRoomError={joinRoomError}
      isJoiningRoom={isJoiningRoom}
      onRequestClose={() => {
        if (exit.isExiting) return;
        cancelRoomExit();
        setIsJoinModalVisible(false);
        clearConflict();
      }}
      onCancelJoinForm={() => setIsJoinModalVisible(false)}
      onSubmitJoin={() => {
        void handleSubmitRegisteredJoin();
      }}
      onStay={() => {
        cancelRoomExit();
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
    </>
  );
}

export default HomeScreen;
