/**
 * @file gameProgress.tsx
 * @description Main in-game screen shell: renders tabs, footer, and modals using the game progress controller hook.
 */
import React from "react";
import { RefreshControl, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import EndGameModal from "../components/gameProgress/EndGameModal";
import FooterButtons from "../components/gameProgress/FooterButtons";
import MatchesGrid from "../components/gameProgress/MatchesGrid/";
import MatchQuickActionsModal from "../components/gameProgress/MatchQuickActionsModal";
import PlayersList from "../components/gameProgress/PlayersList";
import TabNavigation from "../components/gameProgress/TabNavigation";
import { ShellScreen } from "../components/ui";
import useGameProgressController from "../hooks/useGameProgressController";
import { isWideLayout } from "./style/responsive";

const GameProgressScreen = () => {
  const { width } = useWindowDimensions();
  const wideLayout = isWideLayout(width);
  const {
    colors,
    styles,
    activeTab,
    isAlertVisible,
    selectedMatchId,
    isQuickActionsVisible,
    refreshing,
    players,
    matches,
    commonMatchId,
    playerAssignments,
    liveMatches,
    isPolling,
    lastUpdated,
    setActiveTab,
    openQuickActions,
    closeQuickActions,
    onRefresh,
    handleDrinkIncrement,
    handleDrinkDecrement,
    handleBackToSetup,
    handleEndGame,
    handleGoalIncrement,
    handleGoalDecrement,
    cancelEndGame,
    confirmEndGame,
  } = useGameProgressController();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ShellScreen
        padded={false}
        centerContent={wideLayout}
        contentMaxWidth={wideLayout ? 1280 : undefined}
      >
        <View style={styles.container}>
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            matchesCount={matches.length}
            playersCount={players.length}
          >
            <View style={styles.tabContent}>
              <MatchesGrid
                matches={matches}
                players={players}
                commonMatchId={commonMatchId}
                playerAssignments={playerAssignments}
                openQuickActions={openQuickActions}
                liveMatches={liveMatches}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[colors.primary]}
                    tintColor={colors.primary}
                  />
                }
                onRefresh={onRefresh}
                refreshing={refreshing}
                lastUpdated={lastUpdated}
                isPolling={isPolling}
              />
            </View>

            <View style={styles.tabContent}>
              <PlayersList
                players={players}
                matches={matches}
                commonMatchId={commonMatchId}
                playerAssignments={playerAssignments}
                handleDrinkIncrement={handleDrinkIncrement}
                handleDrinkDecrement={handleDrinkDecrement}
              />
            </View>
          </TabNavigation>

          <View style={styles.footerContainer}>
            <FooterButtons
              onBackToSetup={handleBackToSetup}
              onEndGame={handleEndGame}
            />
          </View>
        </View>
      </ShellScreen>

      <MatchQuickActionsModal
        isVisible={isQuickActionsVisible}
        onClose={closeQuickActions}
        selectedMatchId={selectedMatchId}
        matches={matches}
        players={players}
        commonMatchId={commonMatchId}
        playerAssignments={playerAssignments}
        handleGoalIncrement={handleGoalIncrement}
        handleGoalDecrement={handleGoalDecrement}
        liveMatches={liveMatches}
      />

      <EndGameModal
        isVisible={isAlertVisible}
        onCancel={cancelEndGame}
        onConfirm={confirmEndGame}
      />
    </SafeAreaView>
  );
};

export default GameProgressScreen;
