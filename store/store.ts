/**
 * @file store.ts
 * @description Global Zustand store defining core domain entities (Player, Match, GameSession) and state/actions for configuring, running, and persisting game sessions. Persists a curated subset of state to AsyncStorage.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LEAGUE_ENDPOINTS, LeagueEndpoint } from "../constants/leagues";

/**
 * Player participating in a game.
 * @description Contains a unique identifier, display name and optional drink count metric accumulated during the game.
 */
export interface Player {
  /** Unique identifier for the player. */
  id: string;
  /** Name of the player. */
  name: string;
  /** Optional count of drinks taken by the player during a game session. */
  drinksTaken?: number;
}

/**
 * Match within the game session.
 * @description Stores IDs, participating team names, individual goal counts, and a legacy aggregate goal field retained for migration.
 */
export interface Match {
  /** Unique identifier for the match. */
  id: string;
  /** Name of the home team. */
  homeTeam: string;
  /** Name of the away team. */
  awayTeam: string;
  /** Number of goals scored by the home team. */
  homeGoals: number;
  /** Number of goals scored by the away team. */
  awayGoals: number;
  /** Optional total number of goals in the match (legacy / derived). */
  goals?: number;
  startTime?: string;
}

/**
 * Mapping of player IDs to the match IDs they are assigned.
 * @description Used to determine involvement and derive who should drink after a goal event.
 */
type PlayerAssignments = { [playerId: string]: string[] };

/**
 * Historical game session snapshot.
 * @description Captures final state needed for later statistics: players (with drinks), matches, assignments, chosen common match and per‑player match count.
 */
interface GameSession {
  /** Unique identifier for the game session. */
  id: string;
  /** ISO timestamp when the game session was saved. */
  date: string;
  /** Players who participated (with final drink counts). */
  players: Player[];
  /** Matches in the session. */
  matches: Match[];
  /** Common match ID if selected. */
  commonMatchId: string | null;
  /** Player-to-match assignment map. */
  playerAssignments: PlayerAssignments;
  /** Matches per player in this session. */
  matchesPerPlayer: number;
}

/**
 * Global game state structure managed by Zustand.
 * @description Includes current configuration, runtime game data, user preferences, and persisted history along with mutation actions.
 */
interface GameState {
  /** Current theme mode for the app. */
  theme: "light" | "dark";
  // Current game state
  /** Players in the current (active) game. */
  players: Player[];
  /** Matches in the current game. */
  matches: Match[];
  /** Common match ID for current game (if any). */
  commonMatchId: string | null;
  /** Current player-to-match assignments. */
  playerAssignments: PlayerAssignments;
  /** Matches per player for current setup. */
  matchesPerPlayer: number;
  /** Whether the intro video has played this app session. */
  hasVideoPlayed: boolean;
  /** Whether sound effects are enabled. */
  soundEnabled: boolean;
  /** Whether common match goal notifications are enabled. */
  commonMatchNotificationsEnabled: boolean;
  /** Leagues configured by user for fetching match data. */
  configuredLeagues: LeagueEndpoint[];
  /** Default leagues pre-selected when opening match list. */
  defaultSelectedLeagues: LeagueEndpoint[];

  // Game history
  /** Completed game sessions history. */
  history: GameSession[];

  // Actions for current game
  /**
  /**
   * Sets or updates players for the current game.
   * @param players Array or updater producing the new player collection.
   */
  setPlayers: (players: Player[] | ((prev: Player[]) => Player[])) => void;
  /**
   * Sets or updates matches for the current game.
   * @param matches Array or updater producing the new match collection.
   */
  setMatches: (matches: Match[] | ((prev: Match[]) => Match[])) => void;
  /**
   * Sets the common match ID.
   * @param commonMatchId Match ID or null to clear.
   */
  setCommonMatchId: (commonMatchId: string | null) => void;
  /**
   * Sets or updates player assignments.
   * @param playerAssignments Mapping or updater function.
   */
  setPlayerAssignments: (
    playerAssignments:
      | PlayerAssignments
      | ((prev: PlayerAssignments) => PlayerAssignments)
  ) => void;
  /**
   * Sets matches per player configuration value.
   * @param count Number of matches each player should receive.
   */
  setMatchesPerPlayer: (count: number) => void;
  /**
   * Marks whether intro video has played this session.
   * @param value Boolean flag.
   */
  setHasVideoPlayed: (value: boolean) => void;
  /**
   * Enables or disables sound effects.
   * @param enabled Boolean flag.
   */
  setSoundEnabled: (enabled: boolean) => void;
  /**
   * Enables or disables notifications for the common match.
   * @param enabled Boolean flag.
   */
  setCommonMatchNotificationsEnabled: (enabled: boolean) => void;
  /**
   * Sets configured leagues list.
   * @param leagues League endpoint descriptors.
   */
  setConfiguredLeagues: (leagues: LeagueEndpoint[]) => void;
  /**
   * Adds a league to the configured list (de‑duplicates by code).
   * @param league League endpoint to add.
   */
  addLeague: (league: LeagueEndpoint) => void;
  /**
   * Removes a league by code.
   * @param code League code.
   */
  removeLeague: (code: string) => void;
  /** Resets leagues and defaults to initial set. */
  resetLeaguesToDefaults: () => void;
  /**
   * Updates default selected leagues.
   * @param leagues League endpoints to mark as default.
   */
  setDefaultSelectedLeagues: (leagues: LeagueEndpoint[]) => void;
  /** Sets the current theme (light or dark). */
  setTheme: (theme: "light" | "dark") => void;

  // Actions for game history
  /** Saves current game state as a new history entry. */
  saveGameToHistory: () => void;
  /** Resets current game state (retains history, soundEnabled, hasVideoPlayed). */
  resetState: () => void;
}

/**
 * Zustand store hook exposing global game state & actions.
 * @description Applies persistence middleware (AsyncStorage) to a curated subset of state keys for resilience across app restarts.
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
      theme: "light",
      soundEnabled: true,
      commonMatchNotificationsEnabled: true,
      configuredLeagues: LEAGUE_ENDPOINTS, // Initialize with all available as "configured"
      defaultSelectedLeagues: [
        { name: "Premier League", code: "eng.1", category: "Europe" },
        { name: "Championship", code: "eng.2", category: "Europe" },
      ],
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
        set({
          configuredLeagues: LEAGUE_ENDPOINTS,
          defaultSelectedLeagues: [
            { name: "Premier League", code: "eng.1", category: "Europe" },
            { name: "Championship", code: "eng.2", category: "Europe" },
          ],
        }),
      setDefaultSelectedLeagues: (leagues) =>
        set({ defaultSelectedLeagues: leagues }),

      setTheme: (theme) => set({ theme }),

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
        defaultSelectedLeagues: state.defaultSelectedLeagues,
        theme: state.theme,
      }),
    }
  )
);
