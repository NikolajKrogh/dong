/**
 * Room Manager Tests
 *
 * Tests for room creation, joining, and management utilities
 */

import {
  generateRoomCode,
  generateRoomId,
  createRoom,
  joinRoom,
  leaveRoom,
  syncMatchesToRoom,
  syncCommonMatchToRoom,
  syncAssignmentsToRoom,
  type AssignmentEnvelope,
} from "../../utils/roomManager";

describe("Room Manager", () => {
  describe("generateRoomCode", () => {
    it("should generate a 6-character code", () => {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
    });

    it("should only contain valid characters", () => {
      const code = generateRoomCode();
      const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
      expect(code).toMatch(validChars);
    });

    it("should generate unique codes", () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateRoomCode());
      }
      // Should have high likelihood of unique codes
      expect(codes.size).toBeGreaterThan(95);
    });
  });

  describe("generateRoomId", () => {
    it("should generate a room ID", () => {
      const id = generateRoomId();
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    it('should start with "room_"', () => {
      const id = generateRoomId();
      expect(id).toMatch(/^room_/);
    });

    it("should generate unique IDs", () => {
      const id1 = generateRoomId();
      const id2 = generateRoomId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("createRoom", () => {
    it("should create a room with valid data", async () => {
      const hostId = "test-host-123";
      const hostName = "Test Host";
      const maxPlayers = 10;

      const room = await createRoom(hostId, hostName, maxPlayers);

      expect(room).toBeDefined();
      expect(room.hostId).toBe(hostId);
      expect(room.hostName).toBe(hostName);
      expect(room.maxPlayers).toBe(maxPlayers);
      expect(room.code).toHaveLength(6);
      expect(room.players).toHaveLength(1);
      expect(room.players[0].id).toBe(hostId);
      expect(room.players[0].isHost).toBe(true);
    });

    it("should use default max players if not provided", async () => {
      const room = await createRoom("host-456", "Host Two");
      expect(room.maxPlayers).toBe(10);
    });

    it("should include host in the players array", async () => {
      const hostId = "host-789";
      const hostName = "John Doe";

      const room = await createRoom(hostId, hostName);

      // Host should be in players list
      expect(room.players).toHaveLength(1);
      expect(room.players[0]).toEqual({
        id: hostId,
        name: hostName,
        isHost: true,
        joinedAt: expect.any(Number),
      });
    });

    it("should have host with correct name property", async () => {
      const hostId = "host-abc";
      const hostName = "Jane Smith";

      const room = await createRoom(hostId, hostName);

      // Verify host has name property
      const hostPlayer = room.players.find((p) => p.id === hostId);
      expect(hostPlayer).toBeDefined();
      expect(hostPlayer?.name).toBe(hostName);
      expect(hostPlayer?.isHost).toBe(true);
    });

    it("should create room with timestamp", async () => {
      const beforeTime = Date.now();
      const room = await createRoom("host-xyz", "Test Host");
      const afterTime = Date.now();

      expect(room.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(room.createdAt).toBeLessThanOrEqual(afterTime);

      // Host should also have joinedAt timestamp
      expect(room.players[0].joinedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(room.players[0].joinedAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("leaveRoom", () => {
    it("should not throw when leaving a room", () => {
      expect(() => {
        leaveRoom("TEST12", "player-123");
      }).not.toThrow();
    });
  });

  describe("Player Data Validation", () => {
    it("should create valid player objects with required fields", async () => {
      const hostId = "host-validation-1";
      const hostName = "Valid Host";

      const room = await createRoom(hostId, hostName);
      const hostPlayer = room.players[0];

      // Must have id
      expect(hostPlayer.id).toBeDefined();
      expect(typeof hostPlayer.id).toBe("string");
      expect(hostPlayer.id.length).toBeGreaterThan(0);

      // Must have name
      expect(hostPlayer.name).toBeDefined();
      expect(typeof hostPlayer.name).toBe("string");
      expect(hostPlayer.name.length).toBeGreaterThan(0);

      // Must have isHost flag
      expect(hostPlayer.isHost).toBeDefined();
      expect(typeof hostPlayer.isHost).toBe("boolean");

      // Must have joinedAt timestamp
      expect(hostPlayer.joinedAt).toBeDefined();
      expect(typeof hostPlayer.joinedAt).toBe("number");
    });

    it("should not have undefined or null in player fields", async () => {
      const room = await createRoom("host-check", "Check Host");
      const hostPlayer = room.players[0];

      expect(hostPlayer.id).not.toBeNull();
      expect(hostPlayer.id).not.toBeUndefined();
      expect(hostPlayer.name).not.toBeNull();
      expect(hostPlayer.name).not.toBeUndefined();
      expect(hostPlayer.isHost).not.toBeNull();
      expect(hostPlayer.isHost).not.toBeUndefined();
      expect(hostPlayer.joinedAt).not.toBeNull();
      expect(hostPlayer.joinedAt).not.toBeUndefined();
    });

    it("should only include one player (host) in new room", async () => {
      const room = await createRoom("host-single", "Single Host");

      // Should have exactly 1 player
      expect(room.players).toHaveLength(1);

      // That player should be the host
      expect(room.players[0].isHost).toBe(true);
      expect(room.players[0].id).toBe("host-single");
    });
  });

  describe("Game State Syncing", () => {
    describe("syncMatchesToRoom", () => {
      it("should sync matches without throwing", () => {
        const matches = [
          {
            id: "1",
            homeTeam: "Team A",
            awayTeam: "Team B",
            homeGoals: 0,
            awayGoals: 0,
          },
          {
            id: "2",
            homeTeam: "Team C",
            awayTeam: "Team D",
            homeGoals: 0,
            awayGoals: 0,
          },
        ];

        expect(() => {
          syncMatchesToRoom("TEST12", matches);
        }).not.toThrow();
      });

      it("should handle empty matches array", () => {
        expect(() => {
          syncMatchesToRoom("TEST12", []);
        }).not.toThrow();
      });
    });

    describe("syncCommonMatchToRoom", () => {
      it("should sync common match ID without throwing", () => {
        expect(() => {
          syncCommonMatchToRoom("TEST12", "match-123");
        }).not.toThrow();
      });

      it("should handle null common match ID", () => {
        expect(() => {
          syncCommonMatchToRoom("TEST12", null);
        }).not.toThrow();
      });
    });

    describe("syncAssignmentsToRoom", () => {
      it("should sync assignments without throwing", () => {
        const envelope: AssignmentEnvelope = {
          version: 1,
          authorId: "player-1",
          updatedAt: Date.now(),
          assignments: {
            "player-1": ["match-1", "match-2"],
            "player-2": ["match-1", "match-3"],
          },
        };

        expect(() => {
          syncAssignmentsToRoom("TEST12", envelope);
        }).not.toThrow();
      });

      it("should handle empty assignments", () => {
        const envelope: AssignmentEnvelope = {
          version: 2,
          authorId: "player-1",
          updatedAt: Date.now(),
          assignments: {},
        };

        expect(() => {
          syncAssignmentsToRoom("TEST12", envelope);
        }).not.toThrow();
      });
    });
  });
});
