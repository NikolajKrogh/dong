/**
 * @file gameProgress.tsx
 * @description Main in-game screen: delegates live score syncing, goal handling, and toast orchestration to the game progress hook while rendering the matches/players tabs and footer actions.
 */
import React, { useMemo } from "react";
import { View, SafeAreaView, RefreshControl, Text } from "react-native";
import { useColors } from "./style/theme";
import { createGameProgressStyles } from "./style/gameProgressStyles";
import TabNavigation from "../components/gameProgress/TabNavigation";
import MatchesGrid from "../components/gameProgress/MatchesGrid/";
import PlayersList from "../components/gameProgress/PlayersList";
import MatchQuickActionsModal from "../components/gameProgress/MatchQuickActionsModal";
import EndGameModal from "../components/gameProgress/EndGameModal";
import FooterButtons from "../components/gameProgress/FooterButtons";
import useGameProgressLogic from "../hooks/useGameProgressLogic";

/**
 * Main gameplay screen: live score polling, goal handling (sound + toast queue),
 * player drink tracking, quick actions, and end-game workflow.
 * @component
 * @description Renders two tabs (matches / players), coordinates live polling + toast queue,
 * plays goal sounds, and exposes modals for quick match adjustments and ending the game.
 * Integrates global store + theming.
 */
const GameProgressScreen = () => {
  const colors = useColors();
  const styles = useMemo(() => createGameProgressStyles(colors), [colors]);

  const {
    activeTab,
    setActiveTab,
    isAlertVisible,
    isQuickActionsVisible,
    selectedMatchId,
    refreshing,
    liveMatches,
    lastUpdated,
    isPolling,
    players,
    matches,
    commonMatchId,
    playerAssignments,
    currentRoom,
    handleBackToSetup,
    handleEndGame,
    confirmEndGame,
    cancelEndGame,
    openQuickActions,
    closeQuickActions,
    handleGoalIncrement,
    handleGoalDecrement,
    handleDrinkIncrement,
    handleDrinkDecrement,
    onRefresh,
  } = useGameProgressLogic();

  const roomCode = currentRoom?.code || null;

  if (currentRoom && matches.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View
          style={[
            styles.container,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 18 }}>
            Loading game data...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TabNavigation
          activeTab={activeTab}
          setActiveTab={(tab) =>
            setActiveTab(tab === "players" ? "players" : "matches")
          }
          matchesCount={matches.length}
          playersCount={players.length}
        >
          <View style={styles.tabContent}>
            <MatchesGrid
              matches={matches}
              players={players}
              commonMatchId={commonMatchId ?? ""}
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
              roomCode={roomCode}
            />
          </View>

          <View style={styles.tabContent}>
            <PlayersList
              players={players}
              matches={matches}
              commonMatchId={commonMatchId ?? ""}
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

      <MatchQuickActionsModal
        isVisible={isQuickActionsVisible}
        onClose={closeQuickActions}
        selectedMatchId={selectedMatchId}
        matches={matches}
        players={players}
        commonMatchId={commonMatchId ?? ""}
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
