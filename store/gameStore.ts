import { captureSavedMatchList } from "./matchSnapshots";
import { SyncedPreferenceState, ThemeMode, createDefaultSyncedPreferenceState, hydrateSyncedPreferenceState, serializeSyncedPreferenceState } from "./syncedPreferences";
/**
 * @file gameStore.ts
 * @description Global Zustand store defining core domain entities (Player, Match, GameSession) and state/actions for configuring, running, and persisting game sessions. Persists a curated subset of state to AsyncStorage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type LeagueEndpoint } from "../constants/leagues";
import type { FootballMatchErrorCode, SavedMatch, SoloTrackingGrant, SoloTrackingSelection } from "../types/footballMatch";
import type { ActiveGameContext } from "../types/room";

export interface SoloTrackingState {
  grant: SoloTrackingGrant | null;
  pending: SoloTrackingSelection | null;
  /** A definitive denial stops passive retry churn for this selection only. */
  rejection?: { catalogMatchIds: string[]; code: FootballMatchErrorCode };
}

function trackingForNewGame(tracking: SoloTrackingState | null): SoloTrackingState | null {
  if (!tracking) return null;
  const expiredGrant = tracking.grant && Date.parse(tracking.grant.expiresAt) <= Date.now();
  if (expiredGrant && (!tracking.pending || "grantToken" in tracking.pending)) return null;
  if (tracking.rejection) return tracking.grant || tracking.pending ? { grant: tracking.grant, pending: tracking.pending } : null;
  return tracking;
}

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
  catalogMatchId?: string;
  /** Public saved values only. Captured values survive provider-cache eviction. */
  catalogSnapshot?: SavedMatch;
  /** Name of the home team. */
  homeTeam: string;
  /** Name of the away team. */
  awayTeam: string;
  /** Number of goals scored by the home team. */
  homeGoals: number;
  /** Number of goals scored by the away team. */
  awayGoals: number;
  /** Multiplayer source identity used to keep provider matches read-only. */
  sourceProvider?: string;
  sourceMatchId?: string | null;
  sourceLeagueCode?: string | null;
  /** Optional total number of goals in the match (legacy / derived). */
  goals?: number;
  /**
   * Display-oriented kickoff. Deliberately loose: the discovery flow puts a local
   * `HH:MM` here while other paths put a full ISO string, and `MatchItem` renders
   * either. Do not treat it as a timestamp — use {@link Match.kickoffAt}.
   */
  startTime?: string;
  /**
   * The provider's kickoff instant, ISO-8601, when the match came from match
   * discovery. Absent for a fixture entered by hand.
   *
   * Separate from `startTime` because that one is a display string and cannot be
   * parsed reliably; persisting a fixture to a multiplayer room needs a genuine
   * `timestamptz`, and passing `"15:00"` to one fails the insert outright.
   */
  kickoffAt?: string;
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
  isEarlyLeaveResult?: boolean;
}

/**
 * Global game state structure managed by Zustand.
 * @description Includes current configuration, runtime game data, user preferences, and persisted history along with mutation actions.
 */
interface GameState {
  /** Tracking credentials are separate from all exported/local history records. */
  soloTracking: SoloTrackingState | null;
  setSoloTracking: (tracking: SoloTrackingState | null) => void;
  captureSavedMatches: (matches: SavedMatch[]) => void;
  /** Current theme mode for the app. */
  theme: ThemeMode;
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
  /** Identifies whether the current game is server-backed or solo-local. */
  activeGameContext: ActiveGameContext;
  /** In-memory terminal notice; deliberately excluded from persistence. */
  endedGuestSessionId: string | null;

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
      | ((prev: PlayerAssignments) => PlayerAssignments),
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
  setActiveGameContext: (
    context: Partial<ActiveGameContext>,
  ) => void;
  clearActiveGameContext: () => void;

  // Actions for game history
  /** Saves current game state as a new history entry. */
  saveGameToHistory: () => void;
  saveHistorySession: (session: GameSession) => void;
  /** Resets current game state (retains history, soundEnabled, hasVideoPlayed). */
  resetState: () => void;
}

/**
 * Zustand store hook exposing global game state & actions.
 * @description Applies persistence middleware (AsyncStorage) to a curated subset of state keys for resilience across app restarts.
 */
export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      // --- Initial State ---
      soloTracking: null,
      players: [],
      matches: [],
      commonMatchId: null,
      playerAssignments: {},
      matchesPerPlayer: 1,
      hasVideoPlayed: false,
      ...createDefaultSyncedPreferenceState(),
      history: [],
      endedGuestSessionId: null,
      activeGameContext: {
        mode: "solo",
        sessionId: null,
        participantId: null,
        accessKind: null,
        lastAppliedSequence: 0,
      },

      // --- Actions ---
      setSoloTracking: (soloTracking) => set({ soloTracking }),
      captureSavedMatches: (saved) => set((state) => {
        if (!saved.length) return state;
        const savedById = new Map(saved.map(match => [match.catalogMatchId, match]));
        const matches = captureSavedMatchList(state.matches, savedById);
        return matches === state.matches ? state : { matches };
      }),
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
            (l) => l.code !== code,
          ),
        })),
      resetLeaguesToDefaults: () => {
        const defaults = createDefaultSyncedPreferenceState();
        set({ configuredLeagues: defaults.configuredLeagues, defaultSelectedLeagues: defaults.defaultSelectedLeagues });
      },
      setDefaultSelectedLeagues: (leagues) =>
        set({ defaultSelectedLeagues: leagues }),

      setTheme: (theme) => set({ theme }),
      setActiveGameContext: (context) =>
        set((state) => ({
          activeGameContext: {
            ...state.activeGameContext,
            ...context,
          },
        })),
      clearActiveGameContext: () =>
        set({
          activeGameContext: {
            mode: "solo",
            sessionId: null,
            participantId: null,
            accessKind: null,
            lastAppliedSequence: 0,
          },
        }),

      saveGameToHistory: () =>
        set((state) => {
          const newGameSession: GameSession = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            players: JSON.parse(JSON.stringify(state.players)) as Player[],
            matches: JSON.parse(JSON.stringify(state.matches)) as Match[],
            commonMatchId: state.commonMatchId,
            playerAssignments: JSON.parse(JSON.stringify(state.playerAssignments)) as PlayerAssignments,
            matchesPerPlayer: state.matchesPerPlayer,
          };
          return {
            history: [...state.history, newGameSession],
          };
        }),

      saveHistorySession: (session) =>
        set((state) => ({
          history: [...state.history.filter((game) => game.id !== session.id), session],
        })),

      resetState: () =>
        set((state) => ({
          soloTracking: trackingForNewGame(state.soloTracking),
          players: [],
          matches: [],
          commonMatchId: null,
          playerAssignments: {},
          matchesPerPlayer: 1,
          activeGameContext: {
            mode: "solo",
            sessionId: null,
            participantId: null,
            accessKind: null,
            lastAppliedSequence: 0,
          },
          // Note: hasVideoPlayed and soundEnabled are intentionally not reset here
        })),
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
        soloTracking: state.soloTracking,
        activeGameContext: state.activeGameContext,
        ...serializeSyncedPreferenceState(state),
      }),
    },
  ),
);

export const getCurrentSyncedPreferenceState = (): SyncedPreferenceState =>
  serializeSyncedPreferenceState(useGameStore.getState());

export const applySyncedPreferenceState = (
  value: unknown,
  fallback = getCurrentSyncedPreferenceState(),
) => {
  const nextSyncedPreferences = hydrateSyncedPreferenceState(value, fallback);
  useGameStore.setState(nextSyncedPreferences);

  return nextSyncedPreferences;
};
