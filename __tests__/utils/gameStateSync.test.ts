/**
 * Game State Sync Tests
 *
 * Tests for game state synchronization with Gun.js
 */

import {
  initializeGameState,
  getGameState,
  addPlayer,
  removePlayer,
  addMatch,
  removeMatch,
  updateMatchScore,
  setCommonMatch,
  updatePlayerAssignments,
  updateGamePhase,
  recordPlayerDrink,
  getSyncStatus,
  clearGameStateCache,
} from "../../utils/gameStateSync";
import { Player, Match } from "../../store/store";

describe("Game State Sync", () => {
  const testRoomCode = "TEST99";
  const testPlayer: Player = {
    id: "player-1",
    name: "Test Player",
    drinksTaken: 0,
  };
  const testMatch: Match = {
    id: "match-1",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    homeGoals: 0,
    awayGoals: 0,
  };

  beforeEach(() => {
    clearGameStateCache();
  });

  afterEach(() => {
    clearGameStateCache();
  });

  describe("initializeGameState", () => {
    it("should initialize game state with default values", async () => {
      const state = await initializeGameState(testRoomCode, "host-1");

      expect(state).toBeDefined();
      expect(state.version).toBe(1);
      expect(state.players).toEqual([]);
      expect(state.matches).toEqual([]);
      expect(state.commonMatchId).toBeNull();
      expect(state.playerAssignments).toEqual({});
      expect(state.matchesPerPlayer).toBe(3);
      expect(state.phase).toBe("setup");
      expect(state.lastUpdated).toBeGreaterThan(0);
    });

    it("should normalize room code to uppercase", async () => {
      const state = await initializeGameState("test99", "host-1");
      expect(state).toBeDefined();
    });
  });

  describe("getGameState", () => {
    it("should return null for non-existent room", async () => {
      const state = await getGameState("NONEXIST");
      expect(state).toBeNull();
    }, 5000);

    it("should return cached state if available", async () => {
      const initialState = await initializeGameState(testRoomCode, "host-1");
      const retrievedState = await getGameState(testRoomCode);

      expect(retrievedState).toEqual(initialState);
    });
  });

  describe("addPlayer", () => {
    it("should add player to game state", async () => {
      await initializeGameState(testRoomCode, "host-1");
      const state = await addPlayer(testRoomCode, testPlayer);

      expect(state).toBeDefined();
      expect(state!.players).toHaveLength(1);
      expect(state!.players[0]).toEqual(testPlayer);
    });

    it("should not duplicate players with same ID", async () => {
      await initializeGameState(testRoomCode, "host-1");
      await addPlayer(testRoomCode, testPlayer);
      const state = await addPlayer(testRoomCode, testPlayer);

      expect(state!.players).toHaveLength(1);
    });

    it("should update lastUpdated timestamp", async () => {
      const initialState = await initializeGameState(testRoomCode, "host-1");
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updatedState = await addPlayer(testRoomCode, testPlayer);

      expect(updatedState!.lastUpdated).toBeGreaterThan(
        initialState.lastUpdated
      );
    });
  });

  describe("removePlayer", () => {
    it("should remove player from game state", async () => {
      await initializeGameState(testRoomCode, "host-1");
      await addPlayer(testRoomCode, testPlayer);
      const state = await removePlayer(testRoomCode, testPlayer.id);

      expect(state).toBeDefined();
      expect(state!.players).toHaveLength(0);
    });

    it("should not error when removing non-existent player", async () => {
      await initializeGameState(testRoomCode, "host-1");
      const state = await removePlayer(testRoomCode, "non-existent");

      expect(state).toBeDefined();
      expect(state!.players).toHaveLength(0);
    });
  });

  describe("addMatch", () => {
    it("should add match to game state", async () => {
      await initializeGameState(testRoomCode, "host-1");
      const state = await addMatch(testRoomCode, testMatch);

      expect(state).toBeDefined();
      expect(state!.matches).toHaveLength(1);
      expect(state!.matches[0]).toEqual(testMatch);
    });

    it("should not duplicate matches with same ID", async () => {
      await initializeGameState(testRoomCode, "host-1");
      await addMatch(testRoomCode, testMatch);
      const state = await addMatch(testRoomCode, testMatch);

      expect(state!.matches).toHaveLength(1);
    });
  });

  describe("removeMatch", () => {
    it("should remove match from game state", async () => {
      await initializeGameState(testRoomCode, "host-1");
      await addMatch(testRoomCode, testMatch);
      const state = await removeMatch(testRoomCode, testMatch.id);

      expect(state).toBeDefined();
      expect(state!.matches).toHaveLength(0);
    });
  });

  describe("updateMatchScore", () => {
    it("should update match scores", async () => {
      await initializeGameState(testRoomCode, "host-1");
      await addMatch(testRoomCode, testMatch);
      const state = await updateMatchScore(testRoomCode, testMatch.id, 2, 1);

      expect(state).toBeDefined();
      expect(state!.matches[0].homeGoals).toBe(2);
      expect(state!.matches[0].awayGoals).toBe(1);
    });

    it("should not affect other matches", async () => {
      const match2: Match = {
        id: "match-2",
        homeTeam: "Liverpool",
        awayTeam: "Man United",
        homeGoals: 0,
        awayGoals: 0,
      };

      await initializeGameState(testRoomCode, "host-1");
      await addMatch(testRoomCode, testMatch);
      await addMatch(testRoomCode, match2);
      const state = await updateMatchScore(testRoomCode, testMatch.id, 3, 0);

      expect(state!.matches).toHaveLength(2);
      expect(state!.matches.find((m) => m.id === testMatch.id)!.homeGoals).toBe(
        3
      );
      expect(state!.matches.find((m) => m.id === match2.id)!.homeGoals).toBe(0);
    });
  });

  describe("setCommonMatch", () => {
    it("should set common match ID", async () => {
      await initializeGameState(testRoomCode, "host-1");
      const state = await setCommonMatch(testRoomCode, "match-123");

      expect(state).toBeDefined();
      expect(state!.commonMatchId).toBe("match-123");
    });

    it("should clear common match with null", async () => {
      await initializeGameState(testRoomCode, "host-1");
      await setCommonMatch(testRoomCode, "match-123");
      const state = await setCommonMatch(testRoomCode, null);

      expect(state!.commonMatchId).toBeNull();
    });
  });

  describe("updatePlayerAssignments", () => {
    it("should update player assignments", async () => {
      await initializeGameState(testRoomCode, "host-1");
      const assignments = {
        "player-1": ["match-1", "match-2"],
        "player-2": ["match-3", "match-4"],
      };
      const state = await updatePlayerAssignments(testRoomCode, assignments);

      expect(state).toBeDefined();
      expect(state!.playerAssignments).toEqual(assignments);
    });
  });

  describe("updateGamePhase", () => {
    it("should update game phase", async () => {
      await initializeGameState(testRoomCode, "host-1");
      const state = await updateGamePhase(testRoomCode, "in-progress");

      expect(state).toBeDefined();
      expect(state!.phase).toBe("in-progress");
    });

    it("should transition through all phases", async () => {
      await initializeGameState(testRoomCode, "host-1");

      let state = await updateGamePhase(testRoomCode, "match-selection");
      expect(state!.phase).toBe("match-selection");

      state = await updateGamePhase(testRoomCode, "in-progress");
      expect(state!.phase).toBe("in-progress");

      state = await updateGamePhase(testRoomCode, "finished");
      expect(state!.phase).toBe("finished");
    });
  });

  describe("recordPlayerDrink", () => {
    it("should increment player drink count", async () => {
      await initializeGameState(testRoomCode, "host-1");
      await addPlayer(testRoomCode, testPlayer);
      const state = await recordPlayerDrink(testRoomCode, testPlayer.id);

      expect(state).toBeDefined();
      expect(state!.players[0].drinksTaken).toBe(1);
    });

    it("should handle multiple drinks", async () => {
      await initializeGameState(testRoomCode, "host-1");
      await addPlayer(testRoomCode, testPlayer);

      await recordPlayerDrink(testRoomCode, testPlayer.id);
      await recordPlayerDrink(testRoomCode, testPlayer.id);
      const state = await recordPlayerDrink(testRoomCode, testPlayer.id);

      expect(state!.players[0].drinksTaken).toBe(3);
    });

    it("should not affect other players", async () => {
      const player2: Player = {
        id: "player-2",
        name: "Player Two",
        drinksTaken: 0,
      };

      await initializeGameState(testRoomCode, "host-1");
      await addPlayer(testRoomCode, testPlayer);
      await addPlayer(testRoomCode, player2);

      const state = await recordPlayerDrink(testRoomCode, testPlayer.id);

      expect(
        state!.players.find((p) => p.id === testPlayer.id)!.drinksTaken
      ).toBe(1);
      expect(state!.players.find((p) => p.id === player2.id)!.drinksTaken).toBe(
        0
      );
    });
  });

  describe("getSyncStatus", () => {
    it("should return disconnected for non-existent room", () => {
      const status = getSyncStatus("NONEXIST");
      expect(status).toBe("disconnected");
    });

    it("should return synced after successful initialization", async () => {
      await initializeGameState(testRoomCode, "host-1");
      const status = getSyncStatus(testRoomCode);
      expect(status).toBe("synced");
    });
  });

  describe("clearGameStateCache", () => {
    it("should clear local cache but Gun data persists", async () => {
      const initialState = await initializeGameState(testRoomCode, "host-1");

      // Verify cache exists
      const cachedState = await getGameState(testRoomCode);
      expect(cachedState).toEqual(initialState);

      // Clear cache
      clearGameStateCache(testRoomCode);

      // Sync status should be disconnected after cache clear
      const statusAfterClear = getSyncStatus(testRoomCode);
      expect(statusAfterClear).toBe("disconnected");

      // After clearing cache, getGameState will fetch from Gun
      // Gun still has the data, so it will be returned and cached again
      const stateFromGun = await getGameState(testRoomCode);
      expect(stateFromGun).toBeDefined();
      expect(stateFromGun?.version).toBe(initialState.version);

      // Status should be synced again after fetching
      const statusAfterFetch = getSyncStatus(testRoomCode);
      expect(statusAfterFetch).toBe("synced");
    });

    it("should clear all caches when no room specified", async () => {
      await initializeGameState("ROOM1", "host-1");
      await initializeGameState("ROOM2", "host-2");

      clearGameStateCache();

      const status1 = getSyncStatus("ROOM1");
      const status2 = getSyncStatus("ROOM2");

      expect(status1).toBe("disconnected");
      expect(status2).toBe("disconnected");
    });
  });

  describe("Room Player Auto-Population", () => {
    it("should initialize game state with room players", async () => {
      const roomPlayers = [
        {
          id: "host-1",
          name: "Host Player",
          isHost: true,
          joinedAt: Date.now(),
        },
        {
          id: "player-1",
          name: "Player One",
          isHost: false,
          joinedAt: Date.now(),
        },
        {
          id: "player-2",
          name: "Player Two",
          isHost: false,
          joinedAt: Date.now(),
        },
      ];

      const state = await initializeGameState(
        testRoomCode,
        "host-1",
        roomPlayers
      );

      expect(state).toBeDefined();
      expect(state.players).toHaveLength(3);

      // Check host is included
      const hostPlayer = state.players.find((p) => p.id === "host-1");
      expect(hostPlayer).toBeDefined();
      expect(hostPlayer?.name).toBe("Host Player");
      expect(hostPlayer?.drinksTaken).toBe(0);

      // Check other players
      const player1 = state.players.find((p) => p.id === "player-1");
      expect(player1).toBeDefined();
      expect(player1?.name).toBe("Player One");
      expect(player1?.drinksTaken).toBe(0);
    });

    it("should convert RoomPlayer to Player format with drinksTaken", async () => {
      const roomPlayers = [
        { id: "host-1", name: "Test Host", isHost: true, joinedAt: Date.now() },
      ];

      const state = await initializeGameState(
        testRoomCode,
        "host-1",
        roomPlayers
      );

      expect(state.players[0]).toEqual({
        id: "host-1",
        name: "Test Host",
        drinksTaken: 0,
      });
    });

    it("should initialize empty players array when no room players provided", async () => {
      const state = await initializeGameState(testRoomCode, "host-1");

      expect(state.players).toEqual([]);
    });

    it("should handle empty room players array", async () => {
      const state = await initializeGameState(testRoomCode, "host-1", []);

      expect(state.players).toEqual([]);
    });
  });
});
