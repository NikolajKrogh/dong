import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LEAGUE_ENDPOINTS, LeagueEndpoint } from "../constants/leagues";

/**
 * @brief Interface representing a player in the game.
 * - Contains the player's unique identifier, name, and optionally the number of drinks taken.
 */
export interface Player {
  /** @brief Unique identifier for the player. */
  id: string;
  /** @brief Name of the player. */
  name: string;
  /** @brief Optional count of drinks taken by the player during a game session. */
  drinksTaken?: number;
}

/**
 * @brief Interface representing a match in the game.
 * - Contains the match's unique identifier, team names, goals scored by each team, and optionally the total goals.
 */
export interface Match {
  /** @brief Unique identifier for the match. */
  id: string;
  /** @brief Name of the home team. */
  homeTeam: string;
  /** @brief Name of the away team. */
  awayTeam: string;
  /** @brief Number of goals scored by the home team. */
  homeGoals: number;
  /** @brief Number of goals scored by the away team. */
  awayGoals: number;
  /** @brief Optional total number of goals in the match (calculated). */
  goals?: number;
  startTime?: string;
}

/**
 * @brief Type definition for mapping player IDs to an array of match IDs they are assigned to.
 * - Used to track which matches each player is participating in.
 */
type PlayerAssignments = { [playerId: string]: string[] };

/**
 * @brief Interface representing a completed game session stored in history.
 * - Contains details about the game, including players, matches, assignments, and settings at the time of completion.
 */
interface GameSession {
  /** @brief Unique identifier for the game session. */
  id: string;
  /** @brief ISO string representation of the date and time the game session was saved. */
  date: string;
  /** @brief Array of players who participated in the game session, including their final drink counts. */
  players: Player[];
  /** @brief Array of matches played during the game session. */
  matches: Match[];
  /** @brief The common match ID used during the game, if applicable. */
  commonMatchId: string | null;
  /** @brief Mapping of player IDs to the match IDs they were assigned. */
  playerAssignments: PlayerAssignments;
  /** @brief The number of matches assigned per player in this session. */
  matchesPerPlayer: number;
}

/**
 * @brief Interface defining the structure of the game state managed by Zustand.
 * - Includes current game details, game history, and actions to modify the state.
 */
interface GameState {
  // Current game state
  /** @brief Array of players currently participating in the game. */
  players: Player[];
  /** @brief Array of matches currently part of the game. */
  matches: Match[];
  /** @brief The common match ID for the current game, if one is selected. */
  commonMatchId: string | null;
  /** @brief Current mapping of player IDs to assigned match IDs. */
  playerAssignments: PlayerAssignments;
  /** @brief Number of matches assigned per player for the current game setup. */
  matchesPerPlayer: number;
  /** @brief Flag indicating if the introductory video has been played during the current app session. */
  hasVideoPlayed: boolean;
  /** @brief Flag indicating if sound effects are enabled. */
  soundEnabled: boolean;
  /** @brief Flag indicating if notifications for common match are enabled. */
  commonMatchNotificationsEnabled: boolean;
  /** @brief Leagues configured by the user for fetching match data */
  configuredLeagues: LeagueEndpoint[];

  // Game history
  /** @brief Array containing past completed game sessions. */
  history: GameSession[];

  // Actions for current game
  /**
   * @brief Sets or updates the list of players in the current game.
   * @param players - Either an array of Player objects or a function that receives the previous state and returns the new array.
   * @return void
   */
  setPlayers: (players: Player[] | ((prev: Player[]) => Player[])) => void;
  /**
   * @brief Sets or updates the list of matches in the current game.
   * @param matches - Either an array of Match objects or a function that receives the previous state and returns the new array.
   * @return void
   */
  setMatches: (matches: Match[] | ((prev: Match[]) => Match[])) => void;
  /**
   * @brief Sets the common match ID for the current game.
   * @param commonMatchId - The ID of the common match, or null if none.
   * @return void
   */
  setCommonMatchId: (commonMatchId: string | null) => void;
  /**
   * @brief Sets or updates the player-to-match assignments for the current game.
   * @param playerAssignments - Either a PlayerAssignments object or a function that receives the previous state and returns the new object.
   * @return void
   */
  setPlayerAssignments: (
    playerAssignments:
      | PlayerAssignments
      | ((prev: PlayerAssignments) => PlayerAssignments)
  ) => void;
  /**
   * @brief Sets the number of matches assigned per player for the current game setup.
   * @param count - The number of matches per player.
   * @return void
   */
  setMatchesPerPlayer: (count: number) => void;
  /**
   * @brief Sets the flag indicating whether the introductory video has played.
   * @param value - Boolean value, true if the video has played, false otherwise.
   * @return void
   */
  setHasVideoPlayed: (value: boolean) => void;
  /**
   * @brief Sets the flag indicating whether sound effects are enabled.
   * @param enabled - Boolean value, true if sound is enabled, false otherwise.
   * @return void
   */
  setSoundEnabled: (enabled: boolean) => void;
  /**
   * @brief Sets the flag indicating whether notifications for common match are enabled.
   * @param enabled - Boolean value, true if common match notifications are enabled, false otherwise.
   * @return void
   */
  setCommonMatchNotificationsEnabled: (enabled: boolean) => void;
  /**
   * @brief Sets the list of configured leagues
   * @param leagues - Array of league endpoints
   */
  setConfiguredLeagues: (leagues: LeagueEndpoint[]) => void;
  /**
   * @brief Adds a league to the configured leagues
   * @param league - The league endpoint to add
   */
  addLeague: (league: LeagueEndpoint) => void;
  /**
   * @brief Removes a league from the configured leagues
   * @param code - The league code to remove
   * @return void
   */
  removeLeague: (code: string) => void;
  /**
   * @brief Reset leagues to defaults
   */
  resetLeaguesToDefaults: () => void;

  // Actions for game history
  /**
   * @brief Saves the current game state as a new session in the history.
   * @params None
   * @return void
   */
  saveGameToHistory: () => void;
  /**
   * @brief Resets the current game state fields to their initial default values.
   * - Does not reset history, soundEnabled, or hasVideoPlayed status.
   * @params None
   * @return void
   */
  resetState: () => void;
}

/**
 * @brief Zustand store hook for managing the global game state.
 * - Uses persistence middleware to save parts of the state to AsyncStorage.
 * - Provides access to the game state variables and actions defined in GameState.
 */
export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // --- Initial State ---
      players: [],
      matches: [],
      commonMatchId: null,
      playerAssignments: {},
      matchesPerPlayer: 1,
      hasVideoPlayed: false,
      soundEnabled: true,
      commonMatchNotificationsEnabled: true,
      configuredLeagues: LEAGUE_ENDPOINTS, // Initialize with defaults
      history: [],

      // --- Actions ---
      setPlayers: (players) =>
        set((state) => ({
          players:
            typeof players === "function" ? players(state.players) : players,
        })),
      setMatches: (matches) =>
        set((state) => ({
          matches:
            typeof matches === "function" ? matches(state.matches) : matches,
        })),
      setCommonMatchId: (commonMatchId) => set({ commonMatchId }),
      setPlayerAssignments: (playerAssignments) =>
        set((state) => ({
          playerAssignments:
            typeof playerAssignments === "function"
              ? playerAssignments(state.playerAssignments)
              : playerAssignments,
        })),
      setMatchesPerPlayer: (count) => set({ matchesPerPlayer: count }),
      setHasVideoPlayed: (value) => set({ hasVideoPlayed: value }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setCommonMatchNotificationsEnabled: (enabled) =>
        set({ commonMatchNotificationsEnabled: enabled }),
      setConfiguredLeagues: (leagues) => set({ configuredLeagues: leagues }),
      addLeague: (league) =>
        set((state) => ({
          configuredLeagues: [
            ...state.configuredLeagues.filter((l) => l.code !== league.code),
            league,
          ],
        })),
      removeLeague: (code) =>
        set((state) => ({
          configuredLeagues: state.configuredLeagues.filter(
            (l) => l.code !== code
          ),
        })),
      resetLeaguesToDefaults: () =>
        set({ configuredLeagues: LEAGUE_ENDPOINTS }),

      saveGameToHistory: () =>
        set((state) => {
          const newGameSession: GameSession = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            players: state.players,
            matches: state.matches,
            commonMatchId: state.commonMatchId,
            playerAssignments: state.playerAssignments,
            matchesPerPlayer: state.matchesPerPlayer,
          };
          return {
            history: [...state.history, newGameSession],
          };
        }),

      resetState: () =>
        set({
          players: [],
          matches: [],
          commonMatchId: null,
          playerAssignments: {},
          matchesPerPlayer: 1,
          // Note: hasVideoPlayed and soundEnabled are intentionally not reset here
        }),
    }),
    {
      // --- Persistence Configuration ---
      name: "dong-storage", // Name for the persisted storage item
      storage: createJSONStorage(() => AsyncStorage), // Storage mechanism
      partialize: (state) => ({
        // Selectively persist parts of the state
        players: state.players,
        matches: state.matches,
        commonMatchId: state.commonMatchId,
        playerAssignments: state.playerAssignments,
        matchesPerPlayer: state.matchesPerPlayer,
        history: state.history,
        soundEnabled: state.soundEnabled,
        commonMatchNotificationsEnabled: state.commonMatchNotificationsEnabled,
        configuredLeagues: state.configuredLeagues,
      }),
    }
  )
);
