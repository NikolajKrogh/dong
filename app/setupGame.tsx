import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useRouter } from "expo-router";
import { useGameStore, Player, Match } from "../store/store";
import createSetupGameStyles from "./style/setupGameStyles";
import { useColors } from "./style/theme";
import { createRandomAssignments } from "../utils/setupGameAssignments";
import {
  SetupGamePlayerList,
  MatchList,
  AssignmentSection,
  SetupWizard,
  CommonMatchSelector,
} from "../components";

/**
 * Game setup wizard: players, matches, common match selection, and assignments.
 * @component
 * @description Orchestrates multi-step setup (players > matches > common match > assignments)
 * leveraging store state + remote match data; finalizes by filtering matches and navigating to gameplay.
 */
const SetupGameScreen = () => {
  const router = useRouter();
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const {
    players,
    matches,
    commonMatchId,
    playerAssignments,
    matchesPerPlayer,
    setPlayers: setGlobalPlayers,
    setMatches: setGlobalMatches,
    setCommonMatchId: setGlobalCommonMatchId,
    setPlayerAssignments: setGlobalPlayerAssignments,
    setMatchesPerPlayer,
  } = useGameStore();

  const canAdvanceToMatches = players.length > 0;
  const canAdvanceToCommonMatch = matches.length > 0;
  const canAdvanceToAssign = matches.length >= 1 && commonMatchId !== null;
  const canStartGame =
    players.length > 0 && matches.length > 0 && commonMatchId !== null;

  const handleAddPlayer = () => {
    if (newPlayerName.trim()) {
      const newPlayer: Player = {
        id: String(Date.now()),
        name: newPlayerName.trim(),
      };
      setGlobalPlayers([...players, newPlayer]);
      setNewPlayerName("");

      setGlobalPlayerAssignments({
        ...playerAssignments,
        [newPlayer.id]: [],
      });
    }
  };

  const handleAddPlayerByName = (playerName: string) => {
    if (playerName.trim()) {
      const newPlayer: Player = {
        id: String(Date.now()),
        name: playerName.trim(),
      };
      setGlobalPlayers([...players, newPlayer]);

      setGlobalPlayerAssignments({
        ...playerAssignments,
        [newPlayer.id]: [],
      });
    }
  };

  const handleRemovePlayer = (playerId: string) => {
    setGlobalPlayers((prevPlayers) =>
      prevPlayers.filter((player) => player.id !== playerId),
    );

    setGlobalPlayerAssignments((prevAssignments) => {
      const newAssignments: { [key: string]: string[] } = {
        ...prevAssignments,
      };
      delete newAssignments[playerId];
      return newAssignments;
    });
  };

  const handleAddMatch = () => {
    if (homeTeam.trim() && awayTeam.trim()) {
      const newMatch: Match = {
        id: String(Date.now()),
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        homeGoals: 0,
        awayGoals: 0,
      };
      setGlobalMatches([...matches, newMatch]);
      setHomeTeam("");
      setAwayTeam("");
    }
  };

  const handleRemoveMatch = (matchId: string) => {
    setGlobalMatches((prevMatches) =>
      prevMatches.filter((match) => match.id !== matchId),
    );

    setGlobalPlayerAssignments((prevAssignments) => {
      const newAssignments: { [key: string]: string[] } = {};
      for (const playerId in prevAssignments) {
        if (prevAssignments.hasOwnProperty(playerId)) {
          newAssignments[playerId] = prevAssignments[playerId].filter(
            (id) => id !== matchId,
          );
        }
      }
      return newAssignments;
    });

    if (commonMatchId === matchId) {
      setGlobalCommonMatchId(null);
    }
  };

  const handleSelectCommonMatch = (matchId: string) => {
    setGlobalCommonMatchId(matchId);
  };

  const toggleMatchAssignment = (playerId: string, matchId: string) => {
    setGlobalPlayerAssignments(
      (prevAssignments: { [playerId: string]: string[] }) => {
        const currentAssignments = prevAssignments[playerId] || [];
        const index = currentAssignments.indexOf(matchId);

        let newAssignments: string[];
        if (index === -1) {
          newAssignments = [...currentAssignments, matchId];
        } else {
          newAssignments = [...currentAssignments];
          newAssignments.splice(index, 1);
        }

        return {
          ...prevAssignments,
          [playerId]: newAssignments,
        };
      },
    );
  };

  const handleStartGame = () => {
    if (players.length === 0) {
      Toast.show({
        type: "themedWarning",
        text1: "No Players",
        text2: "Please add at least one player to start the game.",
        position: "bottom",
      });
      return;
    }

    if (matches.length === 0) {
      Toast.show({
        type: "themedWarning",
        text1: "No Matches",
        text2: "Please add at least one match to start the game.",
        position: "bottom",
      });
      return;
    }

    if (!commonMatchId) {
      Toast.show({
        type: "themedWarning",
        text1: "No Common Match",
        text2: "Please select a common match that all players will drink for.",
        position: "bottom",
      });
      return;
    }

    const assignedMatchIds = new Set(Object.values(playerAssignments).flat());
    const filteredMatches = matches.filter(
      (match) =>
        assignedMatchIds.has(match.id) ||
        (commonMatchId && match.id === commonMatchId),
    );
    setGlobalMatches(filteredMatches);

    router.push("/gameProgress");
  };

  const handleRandomAssignment = (numMatches: number) => {
    try {
      const newAssignments = createRandomAssignments(
        players,
        matches,
        commonMatchId,
        numMatches,
      );

      setGlobalPlayerAssignments(newAssignments);
      Toast.show({
        type: "themedSuccess",
        text1: "Matches assigned",
        text2: `Each player has ${numMatches} additional matches plus the common match.`,
        position: "bottom",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error.";

      Toast.show({
        type: "themedWarning",
        text1: "Failed",
        text2: errorMessage,
        position: "bottom",
      });
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <SetupWizard
        playersStep={
          <SetupGamePlayerList
            players={players}
            newPlayerName={newPlayerName}
            setNewPlayerName={setNewPlayerName}
            handleAddPlayer={handleAddPlayer}
            handleAddPlayerByName={handleAddPlayerByName}
            handleRemovePlayer={handleRemovePlayer}
          />
        }
        matchesStep={
          <MatchList
            matches={matches}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            setHomeTeam={setHomeTeam}
            setAwayTeam={setAwayTeam}
            handleAddMatch={handleAddMatch}
            handleRemoveMatch={handleRemoveMatch}
            setGlobalMatches={setGlobalMatches}
          />
        }
        commonMatchStep={
          <CommonMatchSelector
            matches={matches}
            selectedCommonMatch={commonMatchId}
            handleSelectCommonMatch={handleSelectCommonMatch}
          />
        }
        assignStep={
          <AssignmentSection
            players={players}
            matches={matches}
            commonMatchId={commonMatchId}
            playerAssignments={playerAssignments}
            toggleMatchAssignment={toggleMatchAssignment}
            matchesPerPlayer={matchesPerPlayer}
            setMatchesPerPlayer={setMatchesPerPlayer}
            handleRandomAssignment={handleRandomAssignment}
          />
        }
        handleStartGame={handleStartGame}
        canAdvanceToMatches={canAdvanceToMatches}
        canAdvanceToCommonMatch={canAdvanceToCommonMatch}
        canAdvanceToAssign={canAdvanceToAssign}
        canStartGame={canStartGame}
        newPlayerName={newPlayerName}
        handleAddPlayer={handleAddPlayer}
      />
    </SafeAreaView>
  );
};

export default SetupGameScreen;
