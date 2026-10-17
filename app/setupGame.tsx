import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Text, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import {
  AssignmentSection,
  CommonMatchSelector,
  MatchList,
  SetupGamePlayerList,
  SetupWizard,
} from "../components";
import { ShellScreen } from "../components/ui";
import { Player, useGameStore } from "../store/store";
import { createRandomAssignments } from "../utils/setupGameAssignments";
import { isWideLayout } from "../styles/responsive";
import createSetupGameStyles from "../styles/setupGameStyles";
import { useColors } from "../styles/theme";
import { useStoreHydration } from "../utils/navigation/useStoreHydration";
import { useNavigationReady } from "../utils/navigation/useNavigationReady";
import { parseSoloStep, resolveStep, sameViewParams, SOLO_STEPS, withViewParams, type SoloStep, type RouteParams } from "../utils/navigation/viewState";

/**
 * Game setup wizard: players, matches, common match selection, and assignments.
 * @component
 * @description Orchestrates multi-step setup (players > matches > common match > assignments)
 * leveraging store state + remote match data; finalizes by filtering matches and navigating to gameplay.
 */
const SetupGameScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const navigationReady = useNavigationReady();
  const params = useLocalSearchParams() as RouteParams;
  const requestedStep = parseSoloStep(params);
  const hydrated = useStoreHydration();
  const [activeStep, setActiveStep] = useState<SoloStep>("players");
  const [restoreNotice, setRestoreNotice] = useState("");
  const restoredRequest = useRef<string | null>(null);
  const pendingStep = useRef<string | null>(null);
  useFocusEffect(React.useCallback(() => { pendingStep.current = null; }, []));
  const { width } = useWindowDimensions();
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const wideLayout = isWideLayout(width);
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
    clearActiveGameContext,
  } = useGameStore();

  const canAdvanceToMatches = players.length > 0 || !!newPlayerName.trim();
  const canAdvanceToCommonMatch = matches.length > 0;
  const canAdvanceToAssign = matches.length >= 1 && commonMatchId !== null;
  const routeRequest = JSON.stringify(params.step ?? null);
  useEffect(() => {
    if (!navigationReady || !hydrated || restoredRequest.current === routeRequest) return;
    restoredRequest.current = routeRequest;
    pendingStep.current = null;
    const step = resolveStep(requestedStep, SOLO_STEPS, [true, players.length > 0, matches.length > 0, matches.length > 0 && matches.some(match => match.id === commonMatchId)]);
    setActiveStep(step);
    // Route restoration is an external navigation event, independent of live prerequisites.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (step !== requestedStep) setRestoreNotice("Complete this step before continuing your setup.");
    const canonical = withViewParams(params, { step: step === "players" ? undefined : step });
    if (!sameViewParams(params, canonical)) router.setParams({ step: step === "players" ? undefined : step });
  }, [navigationReady, hydrated, routeRequest, requestedStep, params, players.length, matches, commonMatchId, router]);
  const changeStep = (key: string) => {
    const step = resolveStep(key as SoloStep, SOLO_STEPS, [true, players.length > 0, matches.length > 0, matches.length > 0 && matches.some(match => match.id === commonMatchId)]);
    if (step === activeStep || step === pendingStep.current) return;
    pendingStep.current = step;
    setRestoreNotice("");
    router.push({ pathname: "/setupGame", params: withViewParams(params, { step: step === "players" ? undefined : step }) });
  };
  const backStep = (key: string) => {
    const step = resolveStep(key as SoloStep, SOLO_STEPS, [true, players.length > 0, matches.length > 0, matches.length > 0 && matches.some(match => match.id === commonMatchId)]);
    setRestoreNotice("");
    const stack = navigation.getState();
    const previous = stack?.routes[(stack.index ?? 0) - 1];
    if (router.canGoBack() && previous?.name === "setupGame" && parseSoloStep((previous.params ?? {}) as RouteParams) === step) router.back();
    else router.setParams({ step: step === "players" ? undefined : step });
  };
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
    clearActiveGameContext();

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
      <ShellScreen
        padded={false}
        centerContent={wideLayout}
        contentMaxWidth={wideLayout ? 1120 : undefined}
      >
        <Text accessibilityRole="header" style={styles.currentStepLabel}>Set up game</Text>
        {!hydrated ? <Text>Loading your saved setup…</Text> : <>
        {restoreNotice ? <Text accessibilityRole="alert">{restoreNotice}</Text> : null}
        <SetupWizard
          activeStepKey={activeStep}
          onStepChange={changeStep}
          onStepBack={backStep}
          steps={[
            {
              key: "players",
              name: "Players",
              icon: "add-circle",
              canEnter: true,
              content: (
                <SetupGamePlayerList
                  players={players}
                  newPlayerName={newPlayerName}
                  setNewPlayerName={setNewPlayerName}
                  handleAddPlayer={handleAddPlayer}
                  handleAddPlayerByName={handleAddPlayerByName}
                  handleRemovePlayer={handleRemovePlayer}
                />
              ),
            },
            {
              key: "matches",
              name: "Matches",
              icon: "game-controller-outline",
              canEnter: canAdvanceToMatches,
              content: (
                <MatchList
                  matches={matches}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  setHomeTeam={setHomeTeam}
                  setAwayTeam={setAwayTeam}
                  handleRemoveMatch={handleRemoveMatch}
                  setGlobalMatches={setGlobalMatches}
                />
              ),
            },
            {
              key: "common",
              name: "Common",
              icon: "tv-outline",
              canEnter: canAdvanceToCommonMatch,
              content: (
                <CommonMatchSelector
                  matches={matches}
                  selectedCommonMatch={commonMatchId}
                  handleSelectCommonMatch={handleSelectCommonMatch}
                />
              ),
            },
            {
              key: "assign",
              name: "Assign",
              icon: "git-network",
              canEnter: canAdvanceToAssign,
              content: (
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
              ),
            },
          ]}
          firstSlotAction={{
            label: "Home",
            icon: "home",
            iconPosition: "leading",
            onPress: () => router.replace("/"),
            backgroundColor: colors.secondary,
          }}
          finalAction={{
            label: "Start Game",
            icon: "play",
            onPress: handleStartGame,
            disabled: !canStartGame,
            backgroundColor: colors.success,
          }}
          // The players step lets you type a name and hit Next without pressing
          // Add; commit it rather than silently dropping it.
          onBeforeNext={(index) => {
            if (index === 0 && newPlayerName.trim()) {
              handleAddPlayer();
              return true;
            }
            return false;
          }}
        />
        </>}
      </ShellScreen>
    </SafeAreaView>
  );
};

export default SetupGameScreen;
