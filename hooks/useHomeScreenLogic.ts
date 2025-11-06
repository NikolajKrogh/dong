/**
 * @file useHomeScreenLogic.ts
 * @description Encapsulates state, effects, and handlers for the home screen including splash lifecycle, onboarding detection, ongoing game persistence, and room creation/join flows.
 */
import React from "react";
import { Animated, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useGameStore } from "../store/store";
import { createRoom, joinRoom } from "../utils/roomManager";
import { getDeviceId } from "../utils/deviceId";

/**
 * Player statistics aggregate describing the top drinker across history.
 */
interface TopDrinkerInfo {
  name: string;
  drinks: number;
}

/**
 * Values and callbacks exposed by the home screen logic hook.
 */
export interface HomeScreenHookResult {
  isSplashVisible: boolean;
  fadeAnim: Animated.Value;
  isFirstLaunch: boolean;
  hasGameInProgress: boolean;
  playersCount: number;
  matchesCount: number;
  historyCount: number;
  topDrinkerInfo: TopDrinkerInfo | null;
  totalDrinks: number;
  isConfirmModalVisible: boolean;
  openConfirmModal: () => void;
  closeConfirmModal: () => void;
  handleCancelGame: () => void;
  isJoinModalVisible: boolean;
  openJoinModal: () => void;
  closeJoinModal: () => void;
  isCreateModalVisible: boolean;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  isCreatingRoom: boolean;
  playerNameInput: string;
  onPlayerNameChange: (value: string) => void;
  roomCodeInput: string;
  onRoomCodeChange: (value: string) => void;
  handleCreateGameButtonPress: () => void;
  handleCreateGame: () => Promise<void>;
  handleJoinGame: () => Promise<void>;
  navigateToGameProgress: () => void;
  navigateToHistory: () => void;
  navigateToUserPreferences: () => void;
  handleFirstLaunchComplete: () => void;
}

// Track splash visibility across the app lifecycle to ensure it only shows once per session.
let hasSplashBeenShown = false;

/**
 * Provides the stateful logic driving the home screen presenter, covering splash timing, onboarding detection, and multiplayer room workflows.
 * @returns {HomeScreenHookResult} Derived data and handlers needed to render the home screen UI.
 */
const useHomeScreenLogic = (): HomeScreenHookResult => {
  const router = useRouter();
  const {
    currentRoom,
    players,
    matches,
    history,
    resetState,
    setCurrentRoom,
    setCurrentPlayerId,
    setRoomConnectionStatus,
    playerName: storedPlayerName,
    setPlayerName: setStoredPlayerName,
  } = useGameStore();

  const [isConfirmModalVisible, setIsConfirmModalVisible] =
    React.useState(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = React.useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = React.useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = React.useState(false);
  const [playerNameInput, setPlayerNameInput] = React.useState("");
  const [roomCodeInput, setRoomCodeInput] = React.useState("");
  const [isSplashVisible, setIsSplashVisible] = React.useState(
    !hasSplashBeenShown
  );
  const [isFirstLaunch, setIsFirstLaunch] = React.useState(false);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  // Handle splash animation timing and visibility.
  React.useEffect(() => {
    if (!isSplashVisible) {
      return;
    }

    hasSplashBeenShown = true;

    const timeout = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        setIsSplashVisible(false);
      });
    }, 3000);

    return () => {
      clearTimeout(timeout);
    };
  }, [fadeAnim, isSplashVisible]);

  // Detect first launch to show onboarding once.
  React.useEffect(() => {
    const checkFirstLaunch = async () => {
      const hasLaunched = await AsyncStorage.getItem("hasLaunched");
      if (!hasLaunched) {
        await AsyncStorage.setItem("hasLaunched", "true");
        setIsFirstLaunch(true);
      }
    };

    checkFirstLaunch();
  }, []);

  // Prefill local player name when modals open and a stored value exists.
  React.useEffect(() => {
    if ((isCreateModalVisible || isJoinModalVisible) && storedPlayerName) {
      setPlayerNameInput(storedPlayerName);
    }
  }, [isCreateModalVisible, isJoinModalVisible, storedPlayerName]);

  const playersCount = players.length;
  const matchesCount = matches.length;
  const historyCount = history.length;
  const hasGameInProgress =
    playersCount > 0 && matchesCount > 0 && Boolean(currentRoom?.code);

  const totalDrinks = React.useMemo(() => {
    return history.reduce((sum, game) => {
      return (
        sum +
        game.players.reduce(
          (gameSum, player) => gameSum + (player.drinksTaken || 0),
          0
        )
      );
    }, 0);
  }, [history]);

  const topDrinkerInfo = React.useMemo(() => {
    if (history.length === 0) {
      return null;
    }

    const playerDrinks = new Map<string, number>();

    history.forEach((game) => {
      game.players.forEach((player) => {
        const current = playerDrinks.get(player.name) || 0;
        playerDrinks.set(player.name, current + (player.drinksTaken || 0));
      });
    });

    let topPlayer: TopDrinkerInfo | null = null;

    playerDrinks.forEach((drinks, name) => {
      if (!topPlayer || drinks > topPlayer.drinks) {
        topPlayer = { name, drinks };
      }
    });

    return topPlayer;
  }, [history]);

  const openConfirmModal = React.useCallback(() => {
    setIsConfirmModalVisible(true);
  }, []);

  const closeConfirmModal = React.useCallback(() => {
    setIsConfirmModalVisible(false);
  }, []);

  const handleCancelGame = React.useCallback(() => {
    resetState();
    setIsConfirmModalVisible(false);
  }, [resetState]);

  const openJoinModal = React.useCallback(() => {
    setIsJoinModalVisible(true);
  }, []);

  const closeJoinModal = React.useCallback(() => {
    if (isCreatingRoom) {
      return;
    }
    setIsJoinModalVisible(false);
    setPlayerNameInput("");
    setRoomCodeInput("");
  }, [isCreatingRoom]);

  const openCreateModal = React.useCallback(() => {
    setIsCreateModalVisible(true);
  }, []);

  const closeCreateModal = React.useCallback(() => {
    if (isCreatingRoom) {
      return;
    }
    setIsCreateModalVisible(false);
    setPlayerNameInput("");
  }, [isCreatingRoom]);

  const navigateToGameProgress = React.useCallback(() => {
    router.push("/gameProgress");
  }, [router]);

  const navigateToHistory = React.useCallback(() => {
    router.push("/history");
  }, [router]);

  const navigateToUserPreferences = React.useCallback(() => {
    router.push("/userPreferences");
  }, [router]);

  const handleCreateGameWithName = React.useCallback(
    async (hostName: string) => {
      setIsCreatingRoom(true);
      setRoomConnectionStatus("connecting");

      try {
        const playerId = await getDeviceId();
        const room = await createRoom(playerId, hostName, 10);

        setCurrentPlayerId(playerId);
        setCurrentRoom(room);
        setRoomConnectionStatus("connected");
        setStoredPlayerName(hostName);

        if (isCreateModalVisible) {
          setIsCreateModalVisible(false);
          setPlayerNameInput("");
        }

        router.push("/setupGame");
      } catch (error) {
        console.error("Failed to create room:", error);
        setRoomConnectionStatus("error");
        Alert.alert("Error", "Failed to create room. Please try again.");
      } finally {
        setIsCreatingRoom(false);
      }
    },
    [
      isCreateModalVisible,
      router,
      setCurrentPlayerId,
      setCurrentRoom,
      setRoomConnectionStatus,
      setStoredPlayerName,
    ]
  );

  const handleCreateGameButtonPress = React.useCallback(() => {
    if (storedPlayerName) {
      handleCreateGameWithName(storedPlayerName);
    } else {
      openCreateModal();
    }
  }, [handleCreateGameWithName, openCreateModal, storedPlayerName]);

  const handleCreateGame = React.useCallback(async () => {
    const trimmedName = playerNameInput.trim();
    if (!trimmedName) {
      Alert.alert("Name Required", "Please enter your name");
      return;
    }

    await handleCreateGameWithName(trimmedName);
  }, [handleCreateGameWithName, playerNameInput]);

  const handleJoinGame = React.useCallback(async () => {
    const trimmedName = playerNameInput.trim();
    const trimmedCode = roomCodeInput.trim().toUpperCase();

    if (!trimmedName) {
      Alert.alert("Name Required", "Please enter your name");
      return;
    }

    if (!trimmedCode) {
      Alert.alert("Room Code Required", "Please enter a room code");
      return;
    }

    if (trimmedCode.length !== 6) {
      Alert.alert("Invalid Code", "Room code must be 6 characters");
      return;
    }

    setIsCreatingRoom(true);
    setRoomConnectionStatus("connecting");

    try {
      const playerId = await getDeviceId();
      const room = await joinRoom(trimmedCode, playerId, trimmedName);

      if (!room) {
        setRoomConnectionStatus("error");
        Alert.alert(
          "Room Not Found",
          "Could not find a room with that code. Please check and try again."
        );
        setIsCreatingRoom(false);
        return;
      }

      setCurrentPlayerId(playerId);
      setCurrentRoom(room);
      setRoomConnectionStatus("connected");
      setStoredPlayerName(trimmedName);

      setIsJoinModalVisible(false);
      setPlayerNameInput("");
      setRoomCodeInput("");
      router.push("/setupGame");
    } catch (error) {
      console.error("Failed to join room:", error);
      setRoomConnectionStatus("error");
      Alert.alert("Error", "Failed to join room. Please try again.");
    } finally {
      setIsCreatingRoom(false);
    }
  }, [
    playerNameInput,
    roomCodeInput,
    router,
    setCurrentPlayerId,
    setCurrentRoom,
    setRoomConnectionStatus,
    setStoredPlayerName,
  ]);

  const onPlayerNameChange = React.useCallback((value: string) => {
    setPlayerNameInput(value);
  }, []);

  const onRoomCodeChange = React.useCallback((value: string) => {
    setRoomCodeInput(value.toUpperCase());
  }, []);

  const handleFirstLaunchComplete = React.useCallback(() => {
    setIsFirstLaunch(false);
  }, []);

  return {
    isSplashVisible,
    fadeAnim,
    isFirstLaunch,
    hasGameInProgress,
    playersCount,
    matchesCount,
    historyCount,
    topDrinkerInfo,
    totalDrinks,
    isConfirmModalVisible,
    openConfirmModal,
    closeConfirmModal,
    handleCancelGame,
    isJoinModalVisible,
    openJoinModal,
    closeJoinModal,
    isCreateModalVisible,
    openCreateModal,
    closeCreateModal,
    isCreatingRoom,
    playerNameInput,
    onPlayerNameChange,
    roomCodeInput,
    onRoomCodeChange,
    handleCreateGameButtonPress,
    handleCreateGame,
    handleJoinGame,
    navigateToGameProgress,
    navigateToHistory,
    navigateToUserPreferences,
    handleFirstLaunchComplete,
  };
};

export default useHomeScreenLogic;
