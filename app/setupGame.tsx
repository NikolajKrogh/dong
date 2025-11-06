import React from "react";
import { SafeAreaView } from "react-native";
import createSetupGameStyles from "./style/setupGameStyles";
import { useColors } from "./style/theme";
import {
  SetupGamePlayerList,
  MatchList,
  AssignmentSection,
  SetupWizard,
  CommonMatchSelector,
} from "../components";
import useSetupGameLogic from "../hooks/useSetupGameLogic";

/**
 * Multi-step setup flow screen responsible for wiring the presentation layer to the extracted setup-game hook.
 * @returns {JSX.Element} Safe-area wrapped setup wizard screen.
 */
const SetupGameScreen = () => {
  const {
    currentRoom,
    currentPlayerId,
    players,
    matches,
    commonMatchId,
    playerAssignments,
    matchesPerPlayer,
    setMatchesPerPlayer,
    setGlobalMatches: updateGlobalMatches,
    newPlayerName,
    setNewPlayerName,
    homeTeam,
    setHomeTeam,
    awayTeam,
    setAwayTeam,
    currentStep,
    setCurrentStep,
    isHost,
    canAdvanceToMatches,
    canAdvanceToCommonMatch,
    canAdvanceToAssign,
    canStartGame,
    handleAddPlayer,
    handleAddPlayerByName,
    handleRemovePlayer,
    handleAddMatch,
    handleRemoveMatch,
    handleSelectCommonMatch,
    toggleMatchAssignment,
    handleLeaveRoom,
    handleStartGame,
    handleRandomAssignment,
  } = useSetupGameLogic();

  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);

  const renderPlayersStep = () => (
    <SetupGamePlayerList
      players={players}
      newPlayerName={newPlayerName}
      setNewPlayerName={setNewPlayerName}
      handleAddPlayer={handleAddPlayer}
      handleAddPlayerByName={handleAddPlayerByName}
      handleRemovePlayer={handleRemovePlayer}
      roomCode={currentRoom?.code}
      handleLeaveRoom={currentRoom ? handleLeaveRoom : undefined}
    />
  );

  const renderMatchesStep = () => (
    <MatchList
      matches={matches}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      setHomeTeam={setHomeTeam}
      setAwayTeam={setAwayTeam}
      handleAddMatch={handleAddMatch}
      handleRemoveMatch={handleRemoveMatch}
      setGlobalMatches={updateGlobalMatches}
      isHost={isHost}
    />
  );

  const renderCommonMatchStep = () => (
    <CommonMatchSelector
      matches={matches}
      selectedCommonMatch={commonMatchId}
      handleSelectCommonMatch={handleSelectCommonMatch}
      isHost={isHost}
    />
  );

  const renderAssignStep = () => (
    <AssignmentSection
      players={players}
      matches={matches}
      commonMatchId={commonMatchId}
      playerAssignments={playerAssignments}
      toggleMatchAssignment={toggleMatchAssignment}
      matchesPerPlayer={matchesPerPlayer}
      setMatchesPerPlayer={setMatchesPerPlayer}
      handleRandomAssignment={handleRandomAssignment}
      currentPlayerId={currentPlayerId || undefined}
      isHost={isHost}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <SetupWizard
        renderPlayersStep={renderPlayersStep}
        renderMatchesStep={renderMatchesStep}
        renderCommonMatchStep={renderCommonMatchStep}
        renderAssignStep={renderAssignStep}
        handleStartGame={handleStartGame}
        canAdvanceToMatches={canAdvanceToMatches}
        canAdvanceToCommonMatch={canAdvanceToCommonMatch}
        canAdvanceToAssign={canAdvanceToAssign}
        canStartGame={canStartGame}
        newPlayerName={newPlayerName}
        handleAddPlayer={handleAddPlayer}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        isHost={isHost}
      />
    </SafeAreaView>
  );
};

export default SetupGameScreen;
