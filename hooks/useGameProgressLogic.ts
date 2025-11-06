import React from "react";
import { AppState, AppStateStatus } from "react-native";
import { useRouter } from "expo-router";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import Toast from "react-native-toast-message";
import { useLiveScores, MatchWithScore } from "./useLiveScores";
import { usePersistedTeamLogos } from "./usePersistedTeamLogos";
import { useGameStore, Match, Player } from "../store/store";
import type { GameRoom } from "../types/room";
import {
  subscribeToRoom,
  syncMatchesToRoom,
  syncPlayerDrinksToRoom,
  MatchesEnvelope,
  PlayerDrinksEnvelope,
} from "../utils/roomManager";

/**
 * Tracks metadata for the most recent goal event to trigger sound and toast side-effects once the state update settles.
 */
interface LastGoalInfo {
  matchId: string;
  team: "home" | "away";
  isLiveUpdate: boolean;
  newTotal?: number;
  otherTeamScore?: number;
  timestamp: number;
}

/**
 * Queued toast payload awaiting display in the sequential toast queue.
 */
interface QueuedToastData {
  type: string;
  text1: string;
  text2?: string;
  props?: Record<string, unknown>;
  position?: "top" | "bottom";
  visibilityTime?: number;
}

const createMatchesHash = (matches: Match[]): string => {
  const normalized = [...matches]
    .map((match) => ({
      ...match,
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return JSON.stringify(normalized);
};

const createPlayerDrinksHash = (
  playerDrinks: Record<string, number>
): string => {
  const normalized = Object.entries(playerDrinks)
    .map(([playerId, drinks]) => [playerId, Number(drinks || 0)])
    .sort(([a], [b]) => String(a).localeCompare(String(b)));

  return JSON.stringify(normalized);
};

const UNKNOWN_AUTHOR_ID = "unknown";
const SYNC_DEBOUNCE_MS = 150;

const isMatchesEnvelope = (value: unknown): value is MatchesEnvelope => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as MatchesEnvelope;
  return (
    typeof candidate.version === "number" &&
    typeof candidate.authorId === "string" &&
    typeof candidate.updatedAt === "number" &&
    Array.isArray(candidate.matches)
  );
};

const isPlayerDrinksEnvelope = (
  value: unknown
): value is PlayerDrinksEnvelope => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as PlayerDrinksEnvelope;
  return (
    typeof candidate.version === "number" &&
    typeof candidate.authorId === "string" &&
    typeof candidate.updatedAt === "number" &&
    candidate.playerDrinks !== undefined &&
    typeof candidate.playerDrinks === "object" &&
    !Array.isArray(candidate.playerDrinks)
  );
};

/**
 * Values and callbacks exposed by the game progress screen logic hook.
 */
export interface GameProgressHookResult {
  activeTab: "matches" | "players";
  setActiveTab: React.Dispatch<React.SetStateAction<"matches" | "players">>;
  isAlertVisible: boolean;
  isQuickActionsVisible: boolean;
  selectedMatchId: string | null;
  refreshing: boolean;
  liveMatches: MatchWithScore[];
  lastUpdated: Date | null;
  isPolling: boolean;
  players: Player[];
  matches: Match[];
  commonMatchId: string | null;
  playerAssignments: Record<string, string[]>;
  currentRoom: GameRoom | null;
  handleBackToSetup: () => void;
  handleEndGame: () => void;
  confirmEndGame: () => void;
  cancelEndGame: () => void;
  openQuickActions: (matchId: string) => void;
  closeQuickActions: () => void;
  handleGoalIncrement: (
    matchId: string,
    team: "home" | "away",
    newTotal?: number
  ) => void;
  handleGoalDecrement: (matchId: string, team: "home" | "away") => void;
  handleDrinkIncrement: (playerId: string) => void;
  handleDrinkDecrement: (playerId: string) => void;
  onRefresh: () => Promise<void>;
}

/**
 * Encapsulates the heavy business logic for the game progress screen including live score polling, toast queueing, sound playback, and Gun room synchronisation.
 * @returns {GameProgressHookResult} State and handlers necessary to render the game progress UI layer.
 */
const useGameProgressLogic = (): GameProgressHookResult => {
  const router = useRouter();
  const {
    players,
    matches,
    commonMatchId,
    playerAssignments,
    setPlayers,
    setMatches,
    saveGameToHistory,
    resetState,
    soundEnabled,
    commonMatchNotificationsEnabled,
    currentRoom,
    setCurrentRoom,
    currentPlayerId,
  } = useGameStore();

  usePersistedTeamLogos();

  const [activeTab, setActiveTab] = React.useState<"matches" | "players">(
    "matches"
  );
  const [isAlertVisible, setIsAlertVisible] = React.useState(false);
  const [selectedMatchId, setSelectedMatchId] = React.useState<string | null>(
    null
  );
  const [isQuickActionsVisible, setIsQuickActionsVisible] =
    React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [appState, setAppState] = React.useState<AppStateStatus>(
    AppState.currentState
  );
  const [soundObject, setSoundObject] = React.useState<Audio.Sound | null>(
    null
  );
  const [lastGoalInfo, setLastGoalInfo] = React.useState<LastGoalInfo | null>(
    null
  );
  const [toastQueue, setToastQueue] = React.useState<QueuedToastData[]>([]);
  const [isToastCurrentlyVisible, setIsToastCurrentlyVisible] =
    React.useState(false);
  const [isSoundPlaying, setIsSoundPlaying] = React.useState(false);

  const isSyncingFromGunRef = React.useRef(false);
  const matchesVersionRef = React.useRef(0);
  const latestMatchesRef = React.useRef<{
    version: number;
    hash: string;
    authorId: string | null;
  } | null>(null);
  const playerDrinksVersionRef = React.useRef(0);
  const latestPlayerDrinksRef = React.useRef<{
    version: number;
    hash: string;
    authorId: string | null;
  } | null>(null);
  const matchesSyncTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const playerDrinksSyncTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const playDongSound = React.useCallback(async () => {
    if (!soundEnabled || isSoundPlaying || appState !== "active") {
      return;
    }

    setIsSoundPlaying(true);

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      });

      const { sound } = await Audio.Sound.createAsync(
        require("../assets/sounds/dong.mp3")
      );

      setSoundObject(sound);

      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (
          status.isLoaded &&
          !status.isPlaying &&
          status.positionMillis > 0 &&
          status.durationMillis !== undefined &&
          status.positionMillis === status.durationMillis
        ) {
          sound.unloadAsync();
          setIsSoundPlaying(false);
        }
      });
    } catch (error) {
      console.error("Error playing sound:", error);
      setIsSoundPlaying(false);
    }
  }, [soundEnabled, isSoundPlaying, appState]);

  const stopSound = React.useCallback(async () => {
    if (!soundObject) {
      return;
    }

    try {
      const status = await soundObject.getStatusAsync();
      if (status.isLoaded) {
        await soundObject.stopAsync();
        await soundObject.unloadAsync();
      }
      setSoundObject(null);
    } catch (error) {
      console.error("Error stopping sound:", error);
    }
    setIsSoundPlaying(false);
  }, [soundObject]);

  // Stop audio when app leaves the foreground
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState !== "active" && appState === "active") {
        stopSound();
      }
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription.remove();
      stopSound();
    };
  }, [appState, stopSound]);

  const applyMatchesEnvelope = React.useCallback(
    (envelope: MatchesEnvelope, options?: { alreadyApplied?: boolean }) => {
      const { alreadyApplied = false } = options ?? {};

      const matchesHash = createMatchesHash(envelope.matches);
      const latest = latestMatchesRef.current;

      if (latest) {
        if (envelope.version < latest.version) {
          console.debug(
            "🎮 [GameProgress] Ignoring stale matches envelope",
            envelope.version,
            "<",
            latest.version
          );
          return false;
        }

        if (
          envelope.version === latest.version &&
          latest.hash === matchesHash
        ) {
          latestMatchesRef.current = {
            version: envelope.version,
            hash: matchesHash,
            authorId: envelope.authorId,
          };
          matchesVersionRef.current = Math.max(
            matchesVersionRef.current,
            envelope.version
          );
          return false;
        }

        if (
          envelope.version === latest.version &&
          latest.hash !== matchesHash
        ) {
          console.warn(
            "🎮 [GameProgress] Matches envelope hash mismatch at same version",
            {
              version: envelope.version,
              previousHash: latest.hash,
              incomingHash: matchesHash,
            }
          );
        }
      }

      latestMatchesRef.current = {
        version: envelope.version,
        hash: matchesHash,
        authorId: envelope.authorId,
      };
      matchesVersionRef.current = Math.max(
        matchesVersionRef.current,
        envelope.version
      );

      if (alreadyApplied) {
        return true;
      }

      const localPlayerId = useGameStore.getState().currentPlayerId;
      const authoredBySelf =
        localPlayerId != null && envelope.authorId === localPlayerId;

      if (authoredBySelf) {
        return true;
      }

      isSyncingFromGunRef.current = true;
      setMatches(envelope.matches);
      setTimeout(() => {
        isSyncingFromGunRef.current = false;
      }, 100);

      return true;
    },
    [setMatches]
  );

  const applyPlayerDrinksEnvelope = React.useCallback(
    (
      envelope: PlayerDrinksEnvelope,
      options?: { alreadyApplied?: boolean }
    ) => {
      const { alreadyApplied = false } = options ?? {};

      const drinksHash = createPlayerDrinksHash(envelope.playerDrinks);
      const latest = latestPlayerDrinksRef.current;

      if (latest) {
        if (envelope.version < latest.version) {
          console.debug(
            "🎮 [GameProgress] Ignoring stale player drinks envelope",
            envelope.version,
            "<",
            latest.version
          );
          return false;
        }

        if (envelope.version === latest.version && latest.hash === drinksHash) {
          latestPlayerDrinksRef.current = {
            version: envelope.version,
            hash: drinksHash,
            authorId: envelope.authorId,
          };
          playerDrinksVersionRef.current = Math.max(
            playerDrinksVersionRef.current,
            envelope.version
          );
          return false;
        }

        if (envelope.version === latest.version && latest.hash !== drinksHash) {
          console.warn(
            "🎮 [GameProgress] Player drinks envelope hash mismatch at same version",
            {
              version: envelope.version,
              previousHash: latest.hash,
              incomingHash: drinksHash,
            }
          );
        }
      }

      latestPlayerDrinksRef.current = {
        version: envelope.version,
        hash: drinksHash,
        authorId: envelope.authorId,
      };
      playerDrinksVersionRef.current = Math.max(
        playerDrinksVersionRef.current,
        envelope.version
      );

      if (alreadyApplied) {
        return true;
      }

      const localPlayerId = useGameStore.getState().currentPlayerId;
      const authoredBySelf =
        localPlayerId != null && envelope.authorId === localPlayerId;

      if (authoredBySelf) {
        return true;
      }

      isSyncingFromGunRef.current = true;
      setPlayers((prevPlayers) => {
        let changed = false;
        const nextPlayers = prevPlayers.map((player) => {
          const nextDrinks = envelope.playerDrinks[player.id] ?? 0;
          const currentDrinks = player.drinksTaken ?? 0;
          if (currentDrinks === nextDrinks) {
            return player;
          }
          changed = true;
          return {
            ...player,
            drinksTaken: nextDrinks,
          };
        });

        return changed ? nextPlayers : prevPlayers;
      });
      setTimeout(() => {
        isSyncingFromGunRef.current = false;
      }, 100);

      return true;
    },
    [setPlayers]
  );

  // Subscribe to Gun room updates and mirror into local store state
  React.useEffect(() => {
    if (!currentRoom?.code) {
      return;
    }

    const unsubscribe = subscribeToRoom(currentRoom.code, (updatedRoom) => {
      if (!updatedRoom) {
        return;
      }

      setCurrentRoom(updatedRoom);

      if (updatedRoom.matches) {
        try {
          const parsedMatches =
            typeof updatedRoom.matches === "string"
              ? JSON.parse(updatedRoom.matches)
              : updatedRoom.matches;

          if (isMatchesEnvelope(parsedMatches)) {
            applyMatchesEnvelope(parsedMatches);
          } else if (Array.isArray(parsedMatches)) {
            const fallbackVersion = Math.max(
              matchesVersionRef.current + 1,
              Date.now()
            );
            applyMatchesEnvelope({
              version: fallbackVersion,
              authorId: UNKNOWN_AUTHOR_ID,
              updatedAt: Date.now(),
              matches: parsedMatches,
            });
          }
        } catch (error) {
          console.error("🎮 [GameProgress] Failed to parse matches:", error);
        }
      }

      let drinksEnvelope: PlayerDrinksEnvelope | null = null;
      if (updatedRoom.playerDrinks) {
        try {
          const parsedDrinks =
            typeof updatedRoom.playerDrinks === "string"
              ? JSON.parse(updatedRoom.playerDrinks)
              : updatedRoom.playerDrinks;

          if (isPlayerDrinksEnvelope(parsedDrinks)) {
            drinksEnvelope = parsedDrinks;
            applyPlayerDrinksEnvelope(parsedDrinks, { alreadyApplied: true });
          } else if (
            parsedDrinks &&
            typeof parsedDrinks === "object" &&
            !Array.isArray(parsedDrinks)
          ) {
            const fallbackVersion = Math.max(
              playerDrinksVersionRef.current + 1,
              Date.now()
            );
            drinksEnvelope = {
              version: fallbackVersion,
              authorId: UNKNOWN_AUTHOR_ID,
              updatedAt: Date.now(),
              playerDrinks: parsedDrinks as Record<string, number>,
            };
            applyPlayerDrinksEnvelope(drinksEnvelope, { alreadyApplied: true });
          }
        } catch (error) {
          console.error(
            "🎮 [GameProgress] Failed to parse player drinks:",
            error
          );
        }
      }

      const drinksMap = drinksEnvelope?.playerDrinks ?? {};
      const roomPlayers = updatedRoom.players.map((rp) => ({
        id: rp.id,
        name: rp.name,
        drinksTaken: drinksMap[rp.id] || 0,
      }));

      const currentPlayers = useGameStore.getState().players;
      const playerIdsInRoom = new Set(roomPlayers.map((p) => p.id));
      const removedPlayers = currentPlayers.filter(
        (cp) => !playerIdsInRoom.has(cp.id)
      );

      const drinksChanged = roomPlayers.some((rp) => {
        const existing = currentPlayers.find((cp) => cp.id === rp.id);
        return !existing || existing.drinksTaken !== rp.drinksTaken;
      });

      if (
        removedPlayers.length > 0 ||
        roomPlayers.length !== currentPlayers.length ||
        drinksChanged
      ) {
        isSyncingFromGunRef.current = true;
        setPlayers(roomPlayers);
        setTimeout(() => {
          isSyncingFromGunRef.current = false;
        }, 100);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [
    applyMatchesEnvelope,
    applyPlayerDrinksEnvelope,
    currentRoom?.code,
    setCurrentRoom,
    setPlayers,
  ]);

  // Push matches to Gun when locally changed
  React.useEffect(() => {
    if (
      !currentRoom?.code ||
      isSyncingFromGunRef.current ||
      matches.length === 0
    ) {
      return;
    }

    if (matchesSyncTimeoutRef.current) {
      clearTimeout(matchesSyncTimeoutRef.current);
    }

    const roomCode = currentRoom.code;
    const scheduledMatches = matches;
    matchesSyncTimeoutRef.current = setTimeout(() => {
      const version = Math.max(matchesVersionRef.current + 1, Date.now());
      const authorId = currentPlayerId ?? UNKNOWN_AUTHOR_ID;
      const envelope: MatchesEnvelope = {
        version,
        authorId,
        updatedAt: Date.now(),
        matches: scheduledMatches,
      };

      applyMatchesEnvelope(envelope, { alreadyApplied: true });
      syncMatchesToRoom(roomCode, envelope);
      matchesSyncTimeoutRef.current = null;
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (matchesSyncTimeoutRef.current) {
        clearTimeout(matchesSyncTimeoutRef.current);
        matchesSyncTimeoutRef.current = null;
      }
    };
  }, [applyMatchesEnvelope, currentPlayerId, currentRoom?.code, matches]);

  // Push player drink totals to Gun when locally changed
  React.useEffect(() => {
    if (!currentRoom?.code || isSyncingFromGunRef.current) {
      return;
    }

    if (playerDrinksSyncTimeoutRef.current) {
      clearTimeout(playerDrinksSyncTimeoutRef.current);
    }

    const roomCode = currentRoom.code;
    const scheduledPlayers = players;
    playerDrinksSyncTimeoutRef.current = setTimeout(() => {
      const playerDrinks: Record<string, number> = {};
      scheduledPlayers.forEach((player) => {
        playerDrinks[player.id] = player.drinksTaken || 0;
      });

      const version = Math.max(playerDrinksVersionRef.current + 1, Date.now());
      const authorId = currentPlayerId ?? UNKNOWN_AUTHOR_ID;
      const envelope: PlayerDrinksEnvelope = {
        version,
        authorId,
        updatedAt: Date.now(),
        playerDrinks,
      };

      applyPlayerDrinksEnvelope(envelope, { alreadyApplied: true });
      syncPlayerDrinksToRoom(roomCode, envelope);
      playerDrinksSyncTimeoutRef.current = null;
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (playerDrinksSyncTimeoutRef.current) {
        clearTimeout(playerDrinksSyncTimeoutRef.current);
        playerDrinksSyncTimeoutRef.current = null;
      }
    };
  }, [applyPlayerDrinksEnvelope, currentPlayerId, currentRoom?.code, players]);

  const handleEndGame = React.useCallback(() => {
    setIsAlertVisible(true);
  }, []);

  const confirmEndGame = React.useCallback(() => {
    setIsAlertVisible(false);
    saveGameToHistory();
    resetState();
    router.replace("/");
  }, [resetState, router, saveGameToHistory]);

  const cancelEndGame = React.useCallback(() => {
    setIsAlertVisible(false);
  }, []);

  const handleBackToSetup = React.useCallback(() => {
    router.push("/setupGame");
  }, [router]);

  const handleGoalIncrement = React.useCallback(
    (matchId: string, team: "home" | "away", newTotal?: number) => {
      let goalScoredInfo: LastGoalInfo | null = null;

      setMatches((prevMatches) =>
        prevMatches.map((match) => {
          if (match.id !== matchId) {
            return match;
          }

          const updatedMatch = { ...match };
          const isLive = typeof newTotal === "number";
          let goalActuallyScored = false;
          let liveUpdateNewTotal: number | undefined;
          let liveUpdateOtherScore: number | undefined;

          if (isLive) {
            if (team === "home") {
              if (newTotal > (match.homeGoals || 0)) {
                goalActuallyScored = true;
                updatedMatch.homeGoals = newTotal;
                liveUpdateNewTotal = newTotal;
                liveUpdateOtherScore = match.awayGoals || 0;
              } else if (newTotal !== match.homeGoals) {
                updatedMatch.homeGoals = newTotal;
              }
            } else if (newTotal > (match.awayGoals || 0)) {
              goalActuallyScored = true;
              updatedMatch.awayGoals = newTotal;
              liveUpdateNewTotal = newTotal;
              liveUpdateOtherScore = match.homeGoals || 0;
            } else if (newTotal !== match.awayGoals) {
              updatedMatch.awayGoals = newTotal;
            }
          } else if (team === "home") {
            updatedMatch.homeGoals = (match.homeGoals || 0) + 1;
            goalActuallyScored = true;
          } else {
            updatedMatch.awayGoals = (match.awayGoals || 0) + 1;
            goalActuallyScored = true;
          }

          if (goalActuallyScored) {
            goalScoredInfo = {
              matchId,
              team,
              isLiveUpdate: isLive,
              newTotal: liveUpdateNewTotal,
              otherTeamScore: liveUpdateOtherScore,
              timestamp: Date.now(),
            };
          }

          return updatedMatch;
        })
      );

      if (goalScoredInfo) {
        setLastGoalInfo(goalScoredInfo);
      }
    },
    [setMatches]
  );

  const handleGoalDecrement = React.useCallback(
    (matchId: string, team: "home" | "away") => {
      setMatches((prevMatches) =>
        prevMatches.map((match) => {
          if (match.id !== matchId) {
            return match;
          }

          if (team === "home" && (match.homeGoals || 0) > 0) {
            return { ...match, homeGoals: (match.homeGoals || 0) - 1 };
          }

          if (team === "away" && (match.awayGoals || 0) > 0) {
            return { ...match, awayGoals: (match.awayGoals || 0) - 1 };
          }

          return match;
        })
      );
    },
    [setMatches]
  );

  const handleDrinkIncrement = React.useCallback(
    (playerId: string) => {
      setPlayers((prevPlayers) =>
        prevPlayers.map((player) =>
          player.id === playerId
            ? {
                ...player,
                drinksTaken: (player.drinksTaken || 0) + 0.5,
              }
            : player
        )
      );
    },
    [setPlayers]
  );

  const handleDrinkDecrement = React.useCallback(
    (playerId: string) => {
      setPlayers((prevPlayers) =>
        prevPlayers.map((player) =>
          player.id === playerId && (player.drinksTaken ?? 0) > 0
            ? {
                ...player,
                drinksTaken: (player.drinksTaken ?? 0) - 0.5,
              }
            : player
        )
      );
    },
    [setPlayers]
  );

  const openQuickActions = React.useCallback((matchId: string) => {
    setSelectedMatchId(matchId);
    setIsQuickActionsVisible(true);
  }, []);

  const closeQuickActions = React.useCallback(() => {
    setIsQuickActionsVisible(false);
    setSelectedMatchId(null);
  }, []);

  const migrateMatchData = React.useCallback(() => {
    setMatches((prevMatches) =>
      prevMatches.map((match) => {
        if (
          match.goals !== undefined &&
          (match.homeGoals === undefined || match.awayGoals === undefined)
        ) {
          return {
            ...match,
            homeGoals: Math.floor(match.goals / 2),
            awayGoals: Math.ceil(match.goals / 2),
          };
        }

        return {
          ...match,
          homeGoals: match.homeGoals || 0,
          awayGoals: match.awayGoals || 0,
        };
      })
    );
  }, [setMatches]);

  const getPlayersWhoDrink = React.useCallback(
    (matchId: string): string[] => {
      if (matchId === commonMatchId) {
        return players.map((player) => player.name);
      }

      return players
        .filter((player) => playerAssignments[player.id]?.includes(matchId))
        .map((player) => player.name);
    },
    [commonMatchId, playerAssignments, players]
  );

  const calculateToastScoreDisplay = React.useCallback(
    (
      match: Match,
      team: "home" | "away",
      isLiveUpdate: boolean,
      newTotal?: number,
      otherTeamScore?: number
    ): { homeScore: number; awayScore: number } => {
      if (
        isLiveUpdate &&
        typeof newTotal === "number" &&
        typeof otherTeamScore === "number"
      ) {
        return team === "home"
          ? { homeScore: newTotal, awayScore: otherTeamScore }
          : { homeScore: otherTeamScore, awayScore: newTotal };
      }

      return {
        homeScore: match.homeGoals || 0,
        awayScore: match.awayGoals || 0,
      };
    },
    []
  );

  const formatGoalToastMessage = React.useCallback(
    (playersToDrink: string[]) => {
      if (playersToDrink.length === 0) {
        return "";
      }

      if (playersToDrink.length <= 3) {
        return `${playersToDrink.join(", ")} should drink!`;
      }

      return `${playersToDrink.slice(0, 2).join(", ")} and ${
        playersToDrink.length - 2
      } others should drink!`;
    },
    []
  );

  const enqueueGoalToast = React.useCallback(
    (
      matchId: string,
      team: "home" | "away",
      isLiveUpdate = false,
      newTotal?: number,
      otherTeamScore?: number
    ) => {
      if (matchId === commonMatchId && !commonMatchNotificationsEnabled) {
        return;
      }

      const match = matches.find((item) => item.id === matchId);
      if (!match) {
        console.warn(
          "Toast: Match not found in current state for enqueue:",
          matchId
        );
        return;
      }

      const { homeScore, awayScore } = calculateToastScoreDisplay(
        match,
        team,
        isLiveUpdate,
        newTotal,
        otherTeamScore
      );

      const playersToDrink = getPlayersWhoDrink(matchId);
      const message = formatGoalToastMessage(playersToDrink);
      if (!message) {
        return;
      }

      const toastData: QueuedToastData = {
        type: "success",
        text1: `${match.homeTeam} ${homeScore}-${awayScore} ${match.awayTeam}`,
        text2: message,
        props: {
          scoringTeam: team,
        },
        position: "bottom",
        visibilityTime: 5000,
      };

      setToastQueue((prevQueue) => [...prevQueue, toastData]);
    },
    [
      matches,
      commonMatchId,
      commonMatchNotificationsEnabled,
      calculateToastScoreDisplay,
      getPlayersWhoDrink,
      formatGoalToastMessage,
    ]
  );

  // Sequentially show queued goal toasts
  React.useEffect(() => {
    if (!isToastCurrentlyVisible && toastQueue.length > 0) {
      const [toastToShow, ...remaining] = toastQueue;
      setToastQueue(remaining);
      setIsToastCurrentlyVisible(true);

      Toast.show({
        ...toastToShow,
        onHide: () => {
          setIsToastCurrentlyVisible(false);
        },
      });
    }
  }, [toastQueue, isToastCurrentlyVisible]);

  const {
    liveMatches,
    isPolling,
    lastUpdated,
    startPolling,
    stopPolling,
    fetchCurrentScores,
  } = useLiveScores(matches, handleGoalIncrement, 60000);

  // Kick off live polling while matches exist
  React.useEffect(() => {
    if (matches.length === 0) {
      stopPolling();
      return;
    }

    startPolling();
    return () => {
      stopPolling();
    };
  }, [matches.length, startPolling, stopPolling]);

  // Normalise legacy match data once on mount
  React.useEffect(() => {
    migrateMatchData();
  }, [migrateMatchData]);

  // Trigger audio/toast effects after goal-related state updates
  React.useEffect(() => {
    if (!lastGoalInfo) {
      return;
    }

    const { matchId, team, isLiveUpdate, newTotal, otherTeamScore } =
      lastGoalInfo;

    if (matchId === commonMatchId && !commonMatchNotificationsEnabled) {
      setLastGoalInfo(null);
      return;
    }

    playDongSound();
    enqueueGoalToast(matchId, team, isLiveUpdate, newTotal, otherTeamScore);
    setLastGoalInfo(null);
  }, [
    lastGoalInfo,
    commonMatchId,
    commonMatchNotificationsEnabled,
    playDongSound,
    enqueueGoalToast,
  ]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCurrentScores();
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchCurrentScores]);

  return {
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
  };
};

export default useGameProgressLogic;
