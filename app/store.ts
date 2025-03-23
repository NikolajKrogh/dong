import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Player {
  id: string;
  name: string;
  drinksTaken?: number;
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  goals: number;
}

type PlayerAssignments = { [playerId: string]: string[] };

interface GameSession {
  id: string;
  date: string;
  players: Player[];
  matches: Match[];
  commonMatchId: string | null;
  playerAssignments: PlayerAssignments;
  matchesPerPlayer: number; // Add to game session history
}

interface GameState {
  // Current game state
  players: Player[];
  matches: Match[];
  commonMatchId: string | null;
  playerAssignments: PlayerAssignments;
  matchesPerPlayer: number; // Add this property
  
  // Game history
  history: GameSession[];
  
  // Actions for current game
  setPlayers: (players: Player[] | ((prev: Player[]) => Player[])) => void;
  setMatches: (matches: Match[] | ((prev: Match[]) => Match[])) => void;
  setCommonMatchId: (commonMatchId: string | null) => void;
  setPlayerAssignments: (playerAssignments: PlayerAssignments | ((prev: PlayerAssignments) => PlayerAssignments)) => void;
  setMatchesPerPlayer: (count: number) => void; // Add this action
  
  // Actions for game history
  saveGameToHistory: () => void;
  resetState: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // Current game state
      players: [],
      matches: [],
      commonMatchId: null,
      playerAssignments: {},
      matchesPerPlayer: 1, // Default value
      
      // Game history
      history: [],
      
      // Actions for current game
      setPlayers: (players) => set((state) => ({ 
        players: typeof players === 'function' ? players(state.players) : players 
      })),
      setMatches: (matches) => set((state) => ({ 
        matches: typeof matches === 'function' ? matches(state.matches) : matches 
      })),
      setCommonMatchId: (commonMatchId) => set({ commonMatchId }),
      setPlayerAssignments: (playerAssignments) => set((state) => ({ 
        playerAssignments: typeof playerAssignments === 'function' ? playerAssignments(state.playerAssignments) : playerAssignments 
      })),
      setMatchesPerPlayer: (count) => set({ matchesPerPlayer: count }), // Add this action
      
      // Actions for game history
      saveGameToHistory: () => set((state) => {
        // Create a game session from the current state
        const newGameSession: GameSession = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          players: state.players,
          matches: state.matches,
          commonMatchId: state.commonMatchId,
          playerAssignments: state.playerAssignments,
          matchesPerPlayer: state.matchesPerPlayer // Include in history
        };
        
        // Add it to history
        return {
          history: [...state.history, newGameSession]
        };
      }),
      
      resetState: () => set({ 
        players: [], 
        matches: [], 
        commonMatchId: null, 
        playerAssignments: {},
        matchesPerPlayer: 1 // Reset to default
      }),
    }),
    {
      name: 'dong-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);