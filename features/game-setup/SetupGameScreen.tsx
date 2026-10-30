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
} from ".";
import { ShellScreen } from "../../components/ui";
import { ScreenReaderHeading } from "../../components/ui/ScreenReaderHeading";
import { Player, useGameStore } from "../../store/gameStore";
import { createRandomAssignments, createTargetedAssignments, validateLocalAssignments } from "./createRandomAssignments";
import { selectGameplayMatches } from "./selectGameplayMatches";
import { isWideLayout } from "../../styles/responsive";
import createSetupGameStyles from "./setupGameStyles";
import { useColors } from "../../styles/theme";
import { useGameStoreHydration } from "../../store/useGameStoreHydration";
import { useNavigationReady } from "../../platform/navigation/useNavigationReady";
import { parseSoloStep, resolveStep, sameViewParams, SOLO_STEPS, withViewParams, type SoloStep, type RouteParams } from "../../platform/navigation/routeState";

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
  const hydrated = useGameStoreHydration();
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
    playerMatchCounts,
    setPlayerMatchCount,
    setPlayers: setGlobalPlayers,
    setMatches: setGlobalMatches,
    setCommonMatchId: setGlobalCommonMatchId,
    setPlayerAssignments: setGlobalPlayerAssignments,
    setMatchesPerPlayer,
  } = useGameStore();

  const canAdvanceToMatches = players.length > 0 || !!newPlayerName.trim();
  const canAdvanceToCommonMatch = matches.length > 0;
  const canAdvanceToAssign = matches.length >= 1 && commonMatchId !== null;
  const resolveSetupStep = React.useCallback((requested: SoloStep): SoloStep => {
    return resolveStep(requested, SOLO_STEPS, [
      true,
      players.length > 0,
      matches.length > 0,
      matches.length > 0 && matches.some(match => match.id === commonMatchId),
    ]);
  }, [players.length, matches, commonMatchId]);
  const routeRequest = JSON.stringify(params.step ?? null);
  useEffect(() => {
    if (!navigationReady || !hydrated || restoredRequest.current === routeRequest) return;
    restoredRequest.current = routeRequest;
    pendingStep.current = null;
    const step = resolveSetupStep(requestedStep);
    setActiveStep(step);
    // Route restoration is an external navigation event, independent of live prerequisites.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (step !== requestedStep) setRestoreNotice("Complete this step before continuing your setup.");
    const canonical = withViewParams(params, { step: step === "players" ? undefined : step });
    if (!sameViewParams(params, canonical)) router.setParams({ step: step === "players" ? undefined : step });
  }, [navigationReady, hydrated, routeRequest, requestedStep, params, resolveSetupStep, router]);
  const changeStep = (key: string) => {
    const step = resolveSetupStep(key as SoloStep);
    if (step === activeStep || step === pendingStep.current) return;
    pendingStep.current = step;
    setRestoreNotice("");
    router.push({ pathname: "/setupGame", params: withViewParams(params, { step: step === "players" ? undefined : step }) });
  };
  const backStep = (key: string) => {
    const step = resolveSetupStep(key as SoloStep);
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

  const handleStartGame = useStartGame();

  const { handleRandomAssignment, isAssigning } = useRandomAssignment();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ShellScreen
        padded={false}
        centerContent={wideLayout}
        contentMaxWidth={wideLayout ? 1120 : undefined}
      >
        <ScreenReaderHeading>Set up game</ScreenReaderHeading>
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
                  playerMatchCounts={playerMatchCounts}
                  setPlayerMatchCount={setPlayerMatchCount}
                  isAssigning={isAssigning}
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

function useStartGame(): () => void {
  const router = useRouter();
  const { players, matches, commonMatchId, playerAssignments,
    matchesPerPlayer, playerMatchCounts, assignmentPolicyVersion,
    setMatches: setGlobalMatches, clearActiveGameContext } = useGameStore();
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

    if (assignmentPolicyVersion === 2) {
      try {
        validateLocalAssignments(players, matches, commonMatchId, playerAssignments, matchesPerPlayer, playerMatchCounts);
      } catch (error) {
        Toast.show({ type: "themedWarning", text1: "Check player assignments", text2: error instanceof Error ? error.message : "Review individual match counts." });
        return;
      }
    }
    const filteredMatches = selectGameplayMatches(matches, commonMatchId, playerAssignments);
    setGlobalMatches(filteredMatches);
    clearActiveGameContext();

    router.push("/gameProgress");
  };

  return handleStartGame;
}

function useRandomAssignment(): { handleRandomAssignment: (count: number) => Promise<void>; isAssigning: boolean } {
  const { players, matches, commonMatchId, playerMatchCounts, assignmentPolicyVersion, setPlayerAssignments: setGlobalPlayerAssignments } = useGameStore();
  const [isAssigning, setIsAssigning] = useState(false);
  const inFlight = useRef(false);
  const handleRandomAssignment = async (numMatches: number) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsAssigning(true);
    try {
      const newAssignments = assignmentPolicyVersion === 2 ? await createTargetedAssignments(
        players, matches, commonMatchId, numMatches, playerMatchCounts,
      ) : createRandomAssignments(
        players,
        matches,
        commonMatchId,
        numMatches,
      );
      const latest = useGameStore.getState();
      if (latest.players !== players || latest.matches !== matches || latest.commonMatchId !== commonMatchId ||
        latest.playerMatchCounts !== playerMatchCounts || latest.matchesPerPlayer !== numMatches) {
        throw new Error("Setup changed. Randomize again to use the latest counts.");
      }
      setGlobalPlayerAssignments(newAssignments);
      Toast.show({
        type: "themedSuccess",
        text1: "Matches assigned",
        text2: "Each player has their configured count plus the common match. Unequal counts use best-effort sharing.",
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
    } finally {
      inFlight.current = false;
      setIsAssigning(false);
    }
  };
  return { handleRandomAssignment, isAssigning };
}

export default SetupGameScreen;
